/**
 * Cron sweepers (spec section 11) against the database and storage: stale uploads fail with
 * upload_interrupted and lose their partial file; stuck runs fail as internal; storage folders
 * without a document row are removed after 24 h; live documents are never touched.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPrefix } from "@/lib/cleanup";
import { sweepOrphans, sweepStaleUploads, sweepStuckRuns } from "@/lib/sweepers";
import { admin, must, person, type Person } from "./support";

let A: Person;
let notebook = "";
const HOUR = 60 * 60 * 1000;
const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" });

async function upload(path: string) {
  const res = await A.client.storage.from("documents").upload(path, pdf, { upsert: true });
  if (res.error) throw res.error;
}

async function newDocument() {
  return must(
    await A.client
      .from("documents")
      .insert({ notebook_id: notebook, user_id: A.user.id, title: "paper.pdf", file_size: 5 })
      .select("id, ingest_run_id, storage_path")
      .single(),
  );
}

const row = async (id: string) =>
  must(await admin.from("documents").select("stage, error_code").eq("id", id).single());

beforeAll(async () => {
  A = await person("sweep");
  notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "Sweep" })
      .select("id")
      .single(),
  ).id;
});

afterAll(async () => {
  if (A) await admin.auth.admin.deleteUser(A.user.id);
});

describe("stale uploads", () => {
  it("fails uploads stuck for 2 h and removes the partial file; leaves fresh ones", async () => {
    const stale = await newDocument();
    const fresh = await newDocument();
    await upload(stale.storage_path);
    await upload(fresh.storage_path);
    must(
      await admin
        .from("documents")
        .update({ created_at: new Date(Date.now() - 3 * HOUR).toISOString() })
        .eq("id", stale.id)
        .select("id"),
    );

    await sweepStaleUploads(admin);

    expect(await row(stale.id)).toEqual({ stage: "failed", error_code: "upload_interrupted" });
    expect(await listPrefix(admin, "documents", `${A.user.id}/${stale.id}`)).toEqual([]);
    expect((await row(fresh.id)).stage).toBe("uploading");
    expect(await listPrefix(admin, "documents", `${A.user.id}/${fresh.id}`)).toHaveLength(1);
  });
});

describe("stuck runs", () => {
  it("fails runs that haven't moved for 2 h as internal", async () => {
    const doc = await newDocument();
    for (const stage of ["queued", "validating", "parsing"]) {
      expect(
        must(
          await admin.rpc("set_document_stage", {
            p_document_id: doc.id,
            p_run_id: doc.ingest_run_id,
            p_stage: stage as "queued",
          }),
        ),
      ).toBe(true);
    }
    expect((await sweepStuckRuns(admin)).ids).not.toContain(doc.id); // not stuck yet
    expect((await sweepStuckRuns(admin, Date.now() + 3 * HOUR)).ids).toContain(doc.id);
    expect(await row(doc.id)).toEqual({ stage: "failed", error_code: "internal" });
  });
});

describe("orphans", () => {
  it("removes folders with no document row after 24 h, keeps live documents", async () => {
    const orphan = `${A.user.id}/${randomUUID()}`;
    await upload(`${orphan}/source.pdf`);
    const live = await newDocument();
    await upload(live.storage_path);

    await sweepOrphans(admin); // too young: kept
    expect(await listPrefix(admin, "documents", orphan)).toHaveLength(1);

    await sweepOrphans(admin, Date.now() + 25 * HOUR);
    expect(await listPrefix(admin, "documents", orphan)).toEqual([]);
    expect(await listPrefix(admin, "documents", `${A.user.id}/${live.id}`)).toHaveLength(1);
  });
});
