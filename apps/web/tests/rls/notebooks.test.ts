/**
 * Notebook data layer (src/lib/notebooks/repo.ts) against the real database, as two people:
 * ownership, ordering, soft delete + restore, conflicts, and the hard-delete cleanup.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hardDeleteNotebook, listPrefix } from "@/lib/cleanup";
import * as repo from "@/lib/notebooks/repo";
import { admin, must, person, type Person } from "./support";

let A: Person;
let B: Person;
const db = (p: Person) => p.client as repo.Db;

beforeAll(async () => {
  A = await person("nb-a");
  B = await person("nb-b");
});

afterAll(async () => {
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id); // cascades
});

const create = (title: string, status: "to_read" | "learning" = "to_read") =>
  repo.createNotebook(db(A), A.user.id, { title, color: "cobalt", status });

describe("ownership", () => {
  it("hides A's notebook from B: get is null, update/move/delete fail", async () => {
    const n = await create("A only");
    expect(await repo.getNotebook(db(B), n.id)).toBeNull();
    expect((await repo.listNotebooks(db(B))).map((x) => x.id)).not.toContain(n.id);
    await expect(repo.updateNotebook(db(B), n.id, { title: "B" }, n.updated_at)).rejects.toThrow(
      /couldn't find/,
    );
    await expect(repo.moveNotebook(db(B), { id: n.id, status: "mastered" })).rejects.toThrow(
      /couldn't find/,
    );
    await expect(repo.softDeleteNotebook(db(B), n.id)).rejects.toThrow(/couldn't find/);
    expect((await repo.getNotebook(db(A), n.id))?.title).toBe("A only");
  });
});

describe("ordering", () => {
  it("appends new notebooks to the end of their column and moves between neighbours", async () => {
    const one = await create("one", "learning");
    const two = await create("two", "learning");
    const three = await create("three", "learning");
    expect(one.position < two.position && two.position < three.position).toBe(true);

    await repo.moveNotebook(db(A), {
      id: three.id,
      status: "learning",
      beforeId: one.id,
      afterId: two.id,
    });
    const learning = repo.boardColumns(await repo.listNotebooks(db(A), { status: "learning" }));
    expect(learning.get("learning")?.map((n) => n.title)).toEqual(["one", "three", "two"]);

    // To another column with no neighbours: goes to the end of that column.
    const moved = await repo.moveNotebook(db(A), { id: one.id, status: "mastered" });
    expect(moved.status).toBe("mastered");
  });
});

describe("soft delete and restore", () => {
  it("disappears from lists at once and comes back on restore", async () => {
    const n = await create("Temporary");
    await repo.softDeleteNotebook(db(A), n.id);
    expect((await repo.listNotebooks(db(A))).map((x) => x.id)).not.toContain(n.id);
    expect(await repo.getNotebook(db(A), n.id)).toBeNull();
    await repo.restoreNotebook(db(A), n.id);
    expect((await repo.listNotebooks(db(A))).map((x) => x.id)).toContain(n.id);
  });
});

describe("conflicts", () => {
  it("rejects a stale update and returns the fresh row", async () => {
    const n = await create("Original");
    const saved = await repo.updateNotebook(db(A), n.id, { title: "From tab 1" }, n.updated_at);
    expect(saved.title).toBe("From tab 1");
    const stale = repo.updateNotebook(db(A), n.id, { title: "From tab 2" }, n.updated_at);
    await expect(stale).rejects.toBeInstanceOf(repo.NotebookConflict);
    const err = (await stale.catch((e: unknown) => e)) as repo.NotebookConflict;
    expect(err.fresh.title).toBe("From tab 1");
  });

  it("doesn't count opening a notebook as an edit", async () => {
    const n = await create("Opened");
    await repo.touchNotebook(db(A), n.id);
    const after = await repo.getNotebook(db(A), n.id);
    expect(after?.last_opened_at).not.toBeNull();
    expect(after?.updated_at).toBe(n.updated_at);
    await expect(
      repo.updateNotebook(db(A), n.id, { color: "teal" }, n.updated_at),
    ).resolves.toMatchObject({ color: "teal" });
  });
});

describe("source counts", () => {
  it("counts live documents only", async () => {
    const n = await create("Counted");
    const docs = must(
      await A.client
        .from("documents")
        .insert([
          { notebook_id: n.id, user_id: A.user.id, title: "a.pdf" },
          { notebook_id: n.id, user_id: A.user.id, title: "b.pdf" },
        ])
        .select("id"),
    );
    must(
      await A.client
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", docs[0].id)
        .select(),
    );
    const listed = (await repo.listNotebooks(db(A))).find((x) => x.id === n.id);
    expect(listed?.source_count).toBe(1);
  });
});

describe("hard delete (cleanup job)", () => {
  it("does nothing for a restored notebook", async () => {
    const n = await create("Kept");
    await repo.softDeleteNotebook(db(A), n.id);
    await repo.restoreNotebook(db(A), n.id);
    expect(await hardDeleteNotebook(admin as repo.Db, n.id)).toEqual({ status: "restored" });
  });

  it("removes documents, their storage files and the row once still deleted", async () => {
    const n = await create("Doomed");
    const doc = must(
      await A.client
        .from("documents")
        .insert({ notebook_id: n.id, user_id: A.user.id, title: "paper.pdf" })
        .select("id, storage_path")
        .single(),
    );
    const prefix = `${A.user.id}/${doc.id}`;
    must(
      await A.client.storage
        .from("documents")
        .upload(doc.storage_path, new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    );
    must(
      await admin.storage
        .from("documents")
        .upload(`${prefix}/figures/run/1.webp`, new Blob(["x"], { type: "image/webp" })),
    );
    must(
      await admin.storage
        .from("ingest-artifacts")
        .upload(`${prefix}/run/doc.json`, new Blob(["{}"], { type: "application/json" })),
    );

    await repo.softDeleteNotebook(db(A), n.id);
    const result = await hardDeleteNotebook(admin as repo.Db, n.id);
    expect(result).toEqual({ status: "deleted", documents: 1, files: 3 });

    expect(await listPrefix(admin as repo.Db, "documents", prefix)).toEqual([]);
    expect(await listPrefix(admin as repo.Db, "ingest-artifacts", prefix)).toEqual([]);
    expect(must(await admin.from("notebooks").select("id").eq("id", n.id))).toHaveLength(0);
    expect(must(await admin.from("documents").select("id").eq("id", doc.id))).toHaveLength(0);
    // Repeating is safe.
    expect(await hardDeleteNotebook(admin as repo.Db, n.id)).toEqual({ status: "gone" });
  });
});
