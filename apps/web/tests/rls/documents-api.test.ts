/**
 * The source lifecycle (lib/documents/server.ts, behind every /api/documents route) as two people:
 * person B gets "not found" for everything of person A's — create in A's notebook, confirm,
 * cancel, re-process, delete, restore, download — and A's rows and files stay untouched.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cancelUpload,
  confirmUploaded,
  createDocument,
  downloadUrl,
  getSource,
  reprocess,
  restore,
  softDelete,
} from "@/lib/documents/server";
import { AppError } from "@/lib/errors";
import { admin, must, person, type Person } from "./support";

let A: Person;
let B: Person;
let notebook = "";
let docId = "";

const sha = "a".repeat(64);
const isNotFound = (err: unknown) => err instanceof AppError && err.status === 404;

async function expectNotFound(run: () => Promise<unknown>) {
  const err = await run().then(
    () => null,
    (e: unknown) => e,
  );
  expect(isNotFound(err), String(err)).toBe(true);
}

beforeAll(async () => {
  A = await person("doca");
  B = await person("docb");
  notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "A" })
      .select("id")
      .single(),
  ).id;
  const created = await createDocument(A.client, A.user, notebook, {
    filename: "paper.pdf",
    size: 5,
    sha256: sha,
  });
  docId = created.documentId;
  expect(created.storagePath).toBe(`${A.user.id}/${docId}/source.pdf`); // server-chosen path
  const up = await A.client.storage
    .from("documents")
    .upload(
      created.storagePath,
      new Blob([new Uint8Array([37, 80, 68, 70, 45])], { type: "application/pdf" }),
      {
        contentType: "application/pdf",
      },
    );
  if (up.error) throw up.error;
});

afterAll(async () => {
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id);
});

describe("person B can't reach person A's sources", () => {
  it("can't add a source to A's notebook", async () => {
    await expectNotFound(() =>
      createDocument(B.client, B.user, notebook, { filename: "x.pdf", size: 5, sha256: sha }),
    );
  });

  it("gets 404 for read, confirm, cancel, re-process, delete, restore and download", async () => {
    await expectNotFound(() => getSource(B.client, docId));
    await expectNotFound(() => confirmUploaded(B.client, admin, docId));
    await expectNotFound(() => cancelUpload(B.client, admin, docId));
    await expectNotFound(() => reprocess(B.client, admin, docId));
    await expectNotFound(() => softDelete(B.client, docId));
    await expectNotFound(() => restore(B.client, admin, docId));
    await expectNotFound(() => downloadUrl(B.client, admin, docId));
    await expectNotFound(() => getSource(B.client, randomUUID()));
  });

  it("A's document and file are untouched", async () => {
    const row = must(
      await admin.from("documents").select("stage, deleted_at").eq("id", docId).single(),
    );
    expect(row).toEqual({ stage: "uploading", deleted_at: null });
    const files = must(await admin.storage.from("documents").list(`${A.user.id}/${docId}`));
    expect(files.map((f) => f.name)).toEqual(["source.pdf"]);
  });
});

describe("the owner's lifecycle", () => {
  it("duplicates are refused unless forced; failed ones don't count", async () => {
    const dup = await createDocument(A.client, A.user, notebook, {
      filename: "again.pdf",
      size: 5,
      sha256: sha,
    }).catch((e: unknown) => e);
    expect(dup).toMatchObject({ code: "duplicate_file", status: 409 });
    expect((dup as AppError).details).toMatchObject({ existingId: docId });
    const forced = await createDocument(A.client, A.user, notebook, {
      filename: "again.pdf",
      size: 5,
      sha256: sha,
      force: true,
    });
    await cancelUpload(A.client, admin, forced.documentId);
    expect(
      must(await admin.from("documents").select("id").eq("id", forced.documentId)).length,
    ).toBe(0);
  });

  it("stops other types (until P3.5v2) and oversized files with contract copy", async () => {
    const notPdf = await createDocument(A.client, A.user, notebook, {
      filename: "notes.docx",
      size: 5,
      sha256: sha,
    }).catch((e: unknown) => e);
    expect(notPdf).toMatchObject({
      code: "unsupported_type",
      message: "TensorLM can't read this type of file yet.",
    });
    const big = await createDocument(A.client, A.user, notebook, {
      filename: "big.pdf",
      size: 120 * 1024 * 1024,
      sha256: sha,
    }).catch((e: unknown) => e);
    expect(big).toMatchObject({
      code: "file_too_large",
      message: "This file is 120 MB. The limit is 50 MB.",
    });
  });

  it("confirm checks the stored size; download is a signed link with the file name", async () => {
    // A declared size that doesn't match the stored object: upload_interrupted, nothing queued.
    const short = await createDocument(A.client, A.user, notebook, {
      filename: "short.pdf",
      size: 6,
      sha256: "b".repeat(64),
    });
    await A.client.storage
      .from("documents")
      .upload(short.storagePath, new Blob([new Uint8Array(5)], { type: "application/pdf" }));
    const mismatch = await confirmUploaded(A.client, admin, short.documentId).catch(
      (e: unknown) => e,
    );
    expect(mismatch).toMatchObject({ code: "upload_interrupted", status: 409 });
    const shortRow = must(
      await admin.from("documents").select("stage").eq("id", short.documentId).single(),
    );
    expect(shortRow.stage).toBe("uploading");

    // Matching size: the run moves to queued. Sending the event needs a queue, which this suite may
    // not have; then it says so with a 502 and the confirm can be repeated safely.
    const ok = await confirmUploaded(A.client, admin, docId).catch((e: unknown) => e);
    expect(ok instanceof AppError ? ok.code : (ok as { stage: string }).stage).toMatch(
      /^(queued|upstream)$/,
    );
    const row = must(await admin.from("documents").select("stage").eq("id", docId).single());
    expect(row.stage).toBe("queued");
    const { url, expiresIn } = await downloadUrl(A.client, admin, docId);
    expect(expiresIn).toBe(60);
    expect(url).toContain("download=paper.pdf");
  });

  it("re-process is limited to 3 an hour", async () => {
    must(
      await admin
        .from("documents")
        .update({
          stage: "failed",
          reprocessed_at: [
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        })
        .eq("id", docId)
        .select("id"),
    );
    const limited = await reprocess(A.client, admin, docId).catch((e: unknown) => e);
    expect(limited).toMatchObject({ code: "rate_limited", status: 429 });
  });
});

describe("quota", () => {
  it("a notebook takes MAX_SOURCES_FREE live, non-failed sources; failed ones don't count", async () => {
    const previous = process.env.MAX_SOURCES_FREE;
    process.env.MAX_SOURCES_FREE = "2";
    try {
      const nb = must(
        await A.client
          .from("notebooks")
          .insert({ user_id: A.user.id, title: "Quota" })
          .select("id")
          .single(),
      ).id;
      const add = (n: number, force = true) =>
        createDocument(A.client, A.user, nb, {
          filename: `q${n}.pdf`,
          size: 5,
          sha256: String(n).repeat(64).slice(0, 64),
          force,
        });
      await add(1);
      const second = await add(2);
      const third = await add(3).catch((e: unknown) => e);
      expect(third).toMatchObject({
        code: "quota_exceeded",
        status: 403,
        message: "This notebook has reached its limit of 2 sources.",
      });
      // A failed source frees its place.
      must(
        await admin
          .from("documents")
          .update({ stage: "failed" })
          .eq("id", second.documentId)
          .select("id"),
      );
      await expect(add(4)).resolves.toMatchObject({ documentId: expect.any(String) });
    } finally {
      if (previous === undefined) delete process.env.MAX_SOURCES_FREE;
      else process.env.MAX_SOURCES_FREE = previous;
    }
  });
});
