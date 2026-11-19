import { describe, expect, it, vi } from "vitest";
import { errorCopy } from "@/lib/ingestion/contract";
import { checkFile, checkScan } from "./precheck";
import { MAX_PARALLEL, UploadManager, type ResumableOptions, type UploadDeps } from "./manager";

const pdf = (name = "paper.pdf", size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

type FakeUpload = { options: ResumableOptions; starts: number; aborted: boolean | null };

function setup(over: Partial<UploadDeps> = {}) {
  const uploads: FakeUpload[] = [];
  const calls: { url: string; body?: unknown }[] = [];
  let online = true;
  const responses = new Map<string, (body: unknown) => Response>();
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, body });
    for (const [prefix, respond] of responses) if (u.includes(prefix)) return respond(body);
    if (u.endsWith("/documents")) {
      return Response.json(
        { documentId: `doc-${calls.length}`, storagePath: `user/doc-${calls.length}/source.pdf` },
        { status: 201 },
      );
    }
    return Response.json({ stage: "queued" });
  });
  const deps: UploadDeps = {
    fetch: fetchFn as unknown as typeof fetch,
    scan: async () => ({ sha256: "a".repeat(64), isPdf: true, pages: 3, encrypted: false }),
    createUpload: (_file, options) => {
      const u: FakeUpload = { options, starts: 0, aborted: null };
      uploads.push(u);
      return {
        start: () => void (u.starts += 1),
        abort: async (terminate) => void (u.aborted = Boolean(terminate)),
      };
    },
    accessToken: async () => "token",
    supabaseUrl: "http://localhost:54321",
    anonKey: "anon",
    online: () => online,
    sleep: async () => undefined,
    ...over,
  };
  const m = new UploadManager(deps);
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { m, uploads, calls, responses, settle, setOnline: (v: boolean) => (online = v) };
}

async function flush(settle: () => Promise<unknown>, times = 5) {
  for (let i = 0; i < times; i++) await settle();
}

describe("pre-checks use the contract's codes", () => {
  it("rejects non-PDFs and oversized files at once", () => {
    expect(checkFile({ name: "notes.docx", size: 10, type: "" })).toEqual({ code: "not_pdf" });
    expect(checkFile({ name: "x.pdf", size: 10, type: "image/png" })).toEqual({ code: "not_pdf" });
    const big = checkFile({ name: "big.pdf", size: 120 * 1024 * 1024, type: "application/pdf" });
    expect(big).toEqual({ code: "file_too_large", vars: { sizeMb: "120", limitMb: "50" } });
    const copy = errorCopy(big!.code, big!.vars);
    expect(`${copy.message} ${copy.fix}`).toBe(
      "This file is 120 MB. The limit is 50 MB. Split the PDF or upload chapters separately.",
    );
    expect(checkFile({ name: "ok.PDF", size: 10, type: "application/pdf" })).toBeNull();
  });

  it("uses what the worker found in the bytes", () => {
    const base = { sha256: "a".repeat(64), isPdf: true, pages: 3, encrypted: false };
    expect(checkScan({ ...base, isPdf: false })).toEqual({ code: "not_pdf" });
    expect(checkScan({ ...base, encrypted: true })).toEqual({ code: "encrypted_pdf" });
    expect(checkScan({ ...base, pages: 201 })).toEqual({
      code: "too_many_pages",
      vars: { pages: 201, limit: 200 },
    });
    expect(checkScan({ ...base, pages: null })).toBeNull(); // unknown: the worker decides
  });
});

describe("upload manager", () => {
  it("uploads at most 3 at a time; the rest wait as Queued", async () => {
    const { m, uploads, settle } = setup();
    m.add(
      "nb",
      Array.from({ length: 5 }, (_, i) => pdf(`p${i}.pdf`)),
    );
    await flush(settle);
    const phases = m.getSnapshot().items.map((i) => i.phase);
    expect(phases.filter((p) => p === "uploading")).toHaveLength(MAX_PARALLEL);
    expect(phases.filter((p) => p === "waiting")).toHaveLength(2);
    // One finishes: the next one starts.
    uploads[0].options.onSuccess();
    await flush(settle);
    expect(uploads).toHaveLength(4);
    expect(m.getSnapshot().items[0].phase).toBe("done");
    expect(m.getSnapshot().announcement).toBe("p0.pdf uploaded");
  });

  it("refuses more than 10 files in one drop", () => {
    const { m } = setup();
    expect(
      m.add(
        "nb",
        Array.from({ length: 12 }, (_, i) => pdf(`p${i}.pdf`)),
      ),
    ).toEqual({
      added: 10,
      refused: 2,
    });
  });

  it("reports real byte progress", async () => {
    const { m, uploads, settle } = setup();
    m.add("nb", [pdf("a.pdf", 2000)]);
    await flush(settle);
    uploads[0].options.onProgress(500, 2000);
    expect(m.getSnapshot().items[0]).toMatchObject({ phase: "uploading", sent: 500, size: 2000 });
  });

  it("instant errors never reach the server", async () => {
    const { m, calls, settle } = setup();
    m.add("nb", [new File(["x"], "image.png", { type: "image/png" })]);
    await flush(settle);
    expect(m.getSnapshot().items[0]).toMatchObject({ phase: "failed", error: { code: "not_pdf" } });
    expect(calls).toHaveLength(0);
  });

  it("a duplicate offers Open it / Add anyway; Add anyway sends force", async () => {
    const { m, calls, responses, settle } = setup();
    responses.set("/notebooks/nb/documents", (body) =>
      (body as { force?: boolean }).force
        ? Response.json({ documentId: "d2", storagePath: "u/d2/source.pdf" }, { status: 201 })
        : Response.json(
            {
              code: "duplicate_file",
              error: "This paper is already in this notebook.",
              existingId: "d1",
            },
            { status: 409 },
          ),
    );
    m.add("nb", [pdf()]);
    await flush(settle);
    const item = m.getSnapshot().items[0];
    expect(item.error).toMatchObject({ code: "duplicate_file", existingId: "d1" });
    m.addAnyway(item.key);
    await flush(settle);
    expect(calls.at(-1)?.body).toMatchObject({ force: true });
    expect(m.getSnapshot().items[0].phase).toBe("uploading");
  });

  it("a dropped connection waits, then resumes from the server's offset", async () => {
    const { m, uploads, settle, setOnline } = setup();
    m.add("nb", [pdf()]);
    await flush(settle);
    uploads[0].options.onProgress(300, 1000);
    setOnline(false);
    expect(uploads[0].options.onRetry(null)).toBe(true);
    expect(m.getSnapshot().items[0].phase).toBe("reconnecting");
    uploads[0].options.onError(null); // retries ran out while offline: keep waiting
    expect(m.getSnapshot().items[0].phase).toBe("reconnecting");
    setOnline(true);
    m.resumeAll();
    expect(uploads[0].starts).toBe(2); // same Upload object: tus resumes at the stored offset
    uploads[0].options.onSuccess();
    await flush(settle);
    expect(m.getSnapshot().items[0].phase).toBe("done");
  });

  it("client errors aren't retried; online failures offer Resume upload", async () => {
    const { m, uploads, settle } = setup();
    m.add("nb", [pdf()]);
    await flush(settle);
    expect(uploads[0].options.onRetry(403)).toBe(false);
    uploads[0].options.onError(500);
    const item = m.getSnapshot().items[0];
    expect(item.error?.code).toBe("upload_interrupted");
    expect(errorCopy("upload_interrupted").actions.map((a) => a.label)).toEqual(["Resume upload"]);
    m.retry(item.key);
    expect(uploads[0].starts).toBe(2);
  });

  it("confirm retries server errors, then succeeds", async () => {
    let n = 0;
    const { m, uploads, responses, settle } = setup();
    responses.set("/uploaded", () =>
      ++n < 3
        ? Response.json({ code: "upstream" }, { status: 502 })
        : Response.json({ stage: "queued" }),
    );
    m.add("nb", [pdf()]);
    await flush(settle);
    uploads[0].options.onSuccess();
    await flush(settle, 10);
    expect(n).toBe(3);
    expect(m.getSnapshot().items[0].phase).toBe("done");
  });

  it("cancel aborts the upload, removes the partial file and the row", async () => {
    const { m, uploads, calls, settle } = setup();
    m.add("nb", [pdf()]);
    await flush(settle);
    const key = m.getSnapshot().items[0].key;
    expect(m.busy()).toBe(true);
    await m.cancel(key);
    expect(uploads[0].aborted).toBe(true);
    expect(calls.at(-1)?.url).toMatch(/\/api\/documents\/doc-\d+\/cancel$/);
    expect(m.getSnapshot().items).toHaveLength(0);
    expect(m.busy()).toBe(false);
  });
});
