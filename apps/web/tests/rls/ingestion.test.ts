/**
 * Phase 3 database behaviour (migration 0004): what people may write, the stage machine in SQL,
 * the atomic finalize swap, search over the current run only, Realtime delivery and storage
 * settings. Runs with `npm run test:rls` against the test project or the local stack.
 */
import { randomUUID } from "node:crypto";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STAGES, canTransition, type Stage } from "@/lib/ingestion/contract";
import { admin, anon, embedding, must, person, type Person } from "./support";

let A: Person;
let B: Person;
let notebook = "";

type Doc = { id: string; ingest_run_id: string };

async function newDocument(title = "paper.pdf"): Promise<Doc> {
  return must(
    await A.client
      .from("documents")
      .insert({ notebook_id: notebook, user_id: A.user.id, title, file_size: 1024 })
      .select("id, ingest_run_id")
      .single(),
  );
}

const stage = (doc: Doc, s: Stage, extra: Record<string, unknown> = {}, run = doc.ingest_run_id) =>
  admin.rpc("set_document_stage", {
    p_document_id: doc.id,
    p_run_id: run,
    p_stage: s,
    ...extra,
  });

async function walkTo(doc: Doc, path: Stage[]) {
  for (const s of path) expect(must(await stage(doc, s)), `move to ${s}`).toBe(true);
}

const row = async (id: string) =>
  must(await admin.from("documents").select("*").eq("id", id).single());

async function addChunk(doc: Doc, runId: string, index: number, content: string, axis = 0) {
  must(
    await admin
      .from("chunks")
      .insert({
        document_id: doc.id,
        notebook_id: notebook,
        ingest_run_id: runId,
        chunk_index: index,
        content,
        kind: "text",
        page_start: 1,
        page_end: 2,
        headings: ["1 Introduction"],
        bboxes: [{ page: 1, l: 72, t: 90, r: 540, b: 180 }],
        embedding: embedding(axis),
      })
      .select("id"),
  );
}

beforeAll(async () => {
  A = await person("ingest-a");
  B = await person("ingest-b");
  notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "Ingestion tests" })
      .select("id")
      .single(),
  ).id;
});

afterAll(async () => {
  if (notebook) await admin.from("notebooks").delete().eq("id", notebook);
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id);
});

describe("documents: what people may write", () => {
  it("starts every new document at uploading, with a server-chosen storage path", async () => {
    const doc = await newDocument();
    const d = await row(doc.id);
    expect(d.stage).toBe("uploading");
    expect(d.storage_path).toBe(`${A.user.id}/${doc.id}/source.pdf`);
    expect(d.ingest_run_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.original_filename).toBe("paper.pdf");
    expect(Object.keys(d.stage_timings)).toEqual(["uploading"]);
  });

  it("ignores a storage path or stage the client tries to set on insert", async () => {
    const { error } = await A.client.from("documents").insert({
      notebook_id: notebook,
      user_id: A.user.id,
      title: "sneaky.pdf",
      storage_path: `${B.user.id}/x/source.pdf`, // not an insertable column for people
    });
    expect(error).not.toBeNull();
  });

  it.each([
    ["stage", { stage: "ready" }],
    ["storage_path", { storage_path: "someone-else/x/source.pdf" }],
    ["progress", { progress: 100 }],
    ["ingest_run_id", { ingest_run_id: randomUUID() }],
    ["chunk_count", { chunk_count: 99 }],
  ])("can't change %s", async (_, patch) => {
    const doc = await newDocument();
    const { error } = await A.client.from("documents").update(patch).eq("id", doc.id);
    expect(error).not.toBeNull();
    const d = await row(doc.id);
    expect(d.stage).toBe("uploading");
    expect(d.storage_path).toBe(`${A.user.id}/${doc.id}/source.pdf`);
  });

  it("can rename and soft-delete their own document, but not hard-delete it", async () => {
    const doc = await newDocument();
    must(await A.client.from("documents").update({ title: "Renamed" }).eq("id", doc.id).select());
    const deletedAt = new Date().toISOString();
    must(
      await A.client.from("documents").update({ deleted_at: deletedAt }).eq("id", doc.id).select(),
    );
    await A.client.from("documents").delete().eq("id", doc.id);
    const d = await row(doc.id);
    expect(d.title).toBe("Renamed");
    expect(d.deleted_at).not.toBeNull();
  });

  it("can't hard-delete their own notebook (the cleanup job does that)", async () => {
    await A.client.from("notebooks").delete().eq("id", notebook);
    must(await admin.from("notebooks").select("id").eq("id", notebook).single());
  });

  it("can't set a notebook colour that isn't a palette token", async () => {
    const { error } = await A.client
      .from("notebooks")
      .update({ color: "#ff00ff" })
      .eq("id", notebook);
    expect(error).not.toBeNull();
  });
});

describe("pipeline functions are service-role only", () => {
  const calls: [string, Record<string, unknown>][] = [
    [
      "set_document_stage",
      { p_document_id: randomUUID(), p_run_id: randomUUID(), p_stage: "queued" },
    ],
    ["finalize_ingest", { p_document_id: randomUUID(), p_run_id: randomUUID() }],
    ["start_ingest_run", { p_document_id: randomUUID() }],
    ["ingest_transition_allowed", { p_from: "queued", p_to: "validating" }],
    ["realtime_tables", {}],
  ];

  it.each(calls)("%s refuses signed-in people and visitors", async (fn, args) => {
    for (const client of [A.client, anon]) {
      const { error } = await client.rpc(fn, args);
      expect(error, `${fn} was callable`).not.toBeNull();
    }
  });
});

describe("set_document_stage", () => {
  it("allows exactly the contract's transitions", async () => {
    for (const from of STAGES) {
      for (const to of STAGES) {
        const allowed = must(
          await admin.rpc("ingest_transition_allowed", { p_from: from, p_to: to }),
        );
        expect(allowed, `${from} → ${to}`).toBe(canTransition(from, to));
      }
    }
  });

  it("moves forward, records stage timings, and never lowers progress", async () => {
    const doc = await newDocument();
    await walkTo(doc, ["queued", "validating", "parsing"]);
    expect(
      must(await stage(doc, "parsing", { p_progress: 30, p_detail: "Reading page 9 of 20" })),
    ).toBe(true);
    expect(must(await stage(doc, "parsing", { p_progress: 10 }))).toBe(true);
    const d = await row(doc.id);
    expect(d.progress).toBe(30);
    expect(d.stage_detail).toBe("Reading page 9 of 20");
    expect(d.started_at).not.toBeNull();
    expect(Object.keys(d.stage_timings)).toEqual(
      expect.arrayContaining(["uploading", "queued", "validating", "parsing"]),
    );
    expect(d.stage_timings.validating.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("ignores stale runs, backward moves and 'ready'", async () => {
    const doc = await newDocument();
    await walkTo(doc, ["queued", "validating", "parsing"]);
    expect(must(await stage(doc, "indexing", {}, randomUUID()))).toBe(false); // stale run
    expect(must(await stage(doc, "validating"))).toBe(false); // backwards
    expect(must(await stage(doc, "ready"))).toBe(false); // only finalize_ingest
    expect((await row(doc.id)).stage).toBe("parsing");
  });

  it("records failures with a code and vars, and then stays failed", async () => {
    const doc = await newDocument();
    await walkTo(doc, ["queued", "validating"]);
    const vars = { pages: 240, limit: 200 };
    expect(
      must(await stage(doc, "failed", { p_error_code: "too_many_pages", p_error_vars: vars })),
    ).toBe(true);
    expect(must(await stage(doc, "parsing"))).toBe(false);
    const d = await row(doc.id);
    expect(d.stage).toBe("failed");
    expect(d.error_code).toBe("too_many_pages");
    expect(d.error_vars).toEqual(vars);
    expect(d.finished_at).not.toBeNull();
  });
});

describe("finalize_ingest", () => {
  it("swaps the new run in atomically and refuses stale runs", async () => {
    const doc = await newDocument();
    await walkTo(doc, ["queued", "validating", "parsing", "indexing"]);
    const oldRun = doc.ingest_run_id;
    await addChunk(doc, oldRun, 0, "old run passage");
    expect(
      must(await admin.rpc("finalize_ingest", { p_document_id: doc.id, p_run_id: oldRun })),
    ).toBe(true);

    // Re-process: a new run starts; the old run's chunks stay until the swap.
    const newRun = must(await admin.rpc("start_ingest_run", { p_document_id: doc.id })) as string;
    const next = { id: doc.id, ingest_run_id: newRun };
    await walkTo(next, ["validating", "parsing", "indexing"]);
    await addChunk(doc, newRun, 0, "new run passage one");
    await addChunk(doc, newRun, 1, "new run passage two");

    expect(
      must(await admin.rpc("finalize_ingest", { p_document_id: doc.id, p_run_id: oldRun })),
    ).toBe(false);
    expect(must(await admin.from("chunks").select("id").eq("document_id", doc.id))).toHaveLength(3);

    expect(
      must(await admin.rpc("finalize_ingest", { p_document_id: doc.id, p_run_id: newRun })),
    ).toBe(true);
    const chunks = must(
      await admin.from("chunks").select("content, ingest_run_id").eq("document_id", doc.id),
    );
    expect(chunks.map((c) => c.ingest_run_id)).toEqual([newRun, newRun]);
    const d = await row(doc.id);
    expect(d).toMatchObject({ stage: "ready", progress: 100, chunk_count: 2, attempt: 1 });

    // Repeating finalize for the current run is safe.
    expect(
      must(await admin.rpc("finalize_ingest", { p_document_id: doc.id, p_run_id: newRun })),
    ).toBe(true);
  });

  it("does nothing for a deleted document", async () => {
    const doc = await newDocument();
    await walkTo(doc, ["queued", "validating", "parsing", "indexing"]);
    must(
      await A.client
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id)
        .select(),
    );
    expect(
      must(
        await admin.rpc("finalize_ingest", { p_document_id: doc.id, p_run_id: doc.ingest_run_id }),
      ),
    ).toBe(false);
  });
});

describe("hybrid_search", () => {
  it("returns only the current run of Ready, live documents, with page fields", async () => {
    const ready = await newDocument("ready.pdf");
    await walkTo(ready, ["queued", "validating", "parsing", "indexing"]);
    await addChunk(ready, ready.ingest_run_id, 0, "transformers use attention heads", 7);
    must(
      await admin.rpc("finalize_ingest", {
        p_document_id: ready.id,
        p_run_id: ready.ingest_run_id,
      }),
    );
    // A newer run in progress: its chunk must not show up yet.
    const run2 = must(await admin.rpc("start_ingest_run", { p_document_id: ready.id })) as string;
    await addChunk(ready, run2, 0, "attention draft from an unfinished run", 7);

    const indexing = await newDocument("indexing.pdf");
    await walkTo(indexing, ["queued", "validating", "parsing", "indexing"]);
    await addChunk(indexing, indexing.ingest_run_id, 0, "attention in a half-indexed paper", 7);

    const deleted = await newDocument("deleted.pdf");
    await walkTo(deleted, ["queued", "validating", "parsing", "indexing"]);
    await addChunk(deleted, deleted.ingest_run_id, 0, "attention in a deleted paper", 7);
    must(
      await admin.rpc("finalize_ingest", {
        p_document_id: deleted.id,
        p_run_id: deleted.ingest_run_id,
      }),
    );
    must(
      await A.client
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleted.id)
        .select(),
    );

    const results = must(
      await A.client.rpc("hybrid_search", {
        query_text: "attention",
        query_embedding: embedding(7),
        p_notebook_id: notebook,
        match_count: 10,
      }),
    ) as {
      content: string;
      page_start: number;
      page_end: number;
      kind: string;
      bboxes: unknown;
      headings: string[];
    }[];

    // Other tests' Ready documents share this notebook; only these four rows matter here.
    const contents = results.map((r) => r.content);
    expect(contents).toContain("transformers use attention heads");
    for (const hidden of [
      "attention draft from an unfinished run",
      "attention in a half-indexed paper",
      "attention in a deleted paper",
    ]) {
      expect(contents).not.toContain(hidden);
    }
    expect(results.find((r) => r.content === "transformers use attention heads")).toMatchObject({
      page_start: 1,
      page_end: 2,
      kind: "text",
      headings: ["1 Introduction"],
      bboxes: [{ page: 1, l: 72, t: 90, r: 540, b: 180 }],
    });
  });
});

describe("Realtime", () => {
  it("publishes documents", async () => {
    expect(must(await admin.rpc("realtime_tables"))).toContain("documents");
  });

  it("delivers stage changes to the owner only", async () => {
    const doc = await newDocument("live.pdf");
    const events: Record<"A" | "B", unknown[]> = { A: [], B: [] };
    const channels: RealtimeChannel[] = [];

    await Promise.all(
      (["A", "B"] as const).map(
        (who) =>
          new Promise<void>((resolve, reject) => {
            const client = who === "A" ? A.client : B.client;
            const channel = client
              .channel(`doc-${who}-${doc.id}`)
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "documents",
                  filter: `id=eq.${doc.id}`,
                },
                (payload) => events[who].push(payload.new),
              )
              .subscribe((status) => {
                if (status === "SUBSCRIBED") resolve();
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
              });
            channels.push(channel);
          }),
      ),
    );

    // SUBSCRIBED can arrive just before database changes start flowing, so keep making real
    // changes (progress updates) until the owner hears one.
    must(await stage(doc, "queued"));
    const deadline = Date.now() + 15_000;
    for (let progress = 1; events.A.length === 0 && Date.now() < deadline; progress++) {
      await new Promise((r) => setTimeout(r, 500));
      must(await stage(doc, "queued", { p_progress: progress }));
    }
    await new Promise((r) => setTimeout(r, 1_500)); // give B's channel time to (wrongly) receive
    for (const c of channels) await c.unsubscribe();

    expect(events.A.at(-1)).toMatchObject({ id: doc.id, stage: "queued" });
    expect(events.B).toHaveLength(0);
  }, 30_000);
});

describe("storage", () => {
  it("limits the documents bucket to 50 MB PDFs and images", async () => {
    const bucket = must(await admin.storage.getBucket("documents"));
    expect(bucket.file_size_limit).toBe(52_428_800);
    expect([...(bucket.allowed_mime_types ?? [])].sort()).toEqual(
      ["application/pdf", "image/png", "image/webp"].sort(),
    );
  });

  it("keeps ingest artifacts away from people", async () => {
    const path = `${A.user.id}/${randomUUID()}/${randomUUID()}/doc.json`;
    must(
      await admin.storage
        .from("ingest-artifacts")
        .upload(path, new Blob(["{}"], { type: "application/json" })),
    );
    const read = await A.client.storage.from("ingest-artifacts").download(path);
    expect(read.data).toBeNull();
    const write = await A.client.storage
      .from("ingest-artifacts")
      .upload(`${A.user.id}/planted.json`, new Blob(["{}"], { type: "application/json" }));
    expect(write.error).not.toBeNull();
    await admin.storage.from("ingest-artifacts").remove([path]);
  });

  it("refuses a file type the bucket doesn't allow", async () => {
    const { error } = await A.client.storage
      .from("documents")
      .upload(`${A.user.id}/${randomUUID()}/notes.txt`, new Blob(["x"], { type: "text/plain" }));
    expect(error).not.toBeNull();
  });
});
