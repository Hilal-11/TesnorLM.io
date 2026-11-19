import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import {
  NOTEBOOK_STATUSES,
  compareBoardOrder,
  countByStatus,
  filterNotebooks,
  notebookCreateSchema,
  notebookMoveSchema,
  notebookPatchSchema,
  positionBetween,
  sortNotebooks,
  type Notebook,
} from "./shared";

const base: Notebook = {
  id: "00000000-0000-4000-8000-000000000000",
  user_id: "00000000-0000-4000-8000-0000000000aa",
  title: "Notebook",
  description: null,
  subject: null,
  status: "to_read",
  color: "cobalt",
  exam_date: null,
  position: "a0",
  last_opened_at: null,
  deleted_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const nb = (patch: Partial<Notebook>): Notebook => ({ ...base, ...patch });

describe("notebook schemas", () => {
  it("matches the database's notebook_status enum", () => {
    expect([...Constants.public.Enums.notebook_status]).toEqual([...NOTEBOOK_STATUSES]);
  });

  it("creates with defaults and trims", () => {
    expect(notebookCreateSchema.parse({ title: "  Transformers  " })).toEqual({
      title: "Transformers",
      color: "cobalt",
      status: "to_read",
    });
  });

  it("turns blank optional fields into null", () => {
    const parsed = notebookCreateSchema.parse({
      title: "ML",
      description: "  ",
      subject: "",
      exam_date: "",
    });
    expect(parsed).toMatchObject({ description: null, subject: null, exam_date: null });
  });

  it.each([
    [{ title: "" }, "Give the notebook a name."],
    [{ title: "x".repeat(121) }, "Use 120 characters or fewer."],
    [{ title: "ok", description: "x".repeat(501) }, "Use 500 characters or fewer."],
    [{ title: "ok", color: "#ff00ff" }, ""],
    [{ title: "ok", exam_date: "12/12/2026" }, "Use a date like 2026-12-12."],
    [{ title: "ok", user_id: "someone-else" }, ""],
  ])("rejects %j", (input, message) => {
    const result = notebookCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (message) expect(result.error?.issues[0].message).toBe(message);
  });

  it("patches only what was sent, and refuses an empty patch", () => {
    expect(notebookPatchSchema.parse({ color: "teal" })).toEqual({ color: "teal" });
    expect(notebookPatchSchema.parse({ exam_date: "" })).toEqual({ exam_date: null });
    expect(notebookPatchSchema.safeParse({}).success).toBe(false);
  });

  it("moves to a known status between optional neighbours", () => {
    expect(
      notebookMoveSchema.safeParse({ id: base.id, status: "learning", beforeId: null }).success,
    ).toBe(true);
    expect(notebookMoveSchema.safeParse({ id: base.id, status: "done" }).success).toBe(false);
  });
});

describe("board positions", () => {
  it("inserts between, before the first and after the last", () => {
    const first = positionBetween(null, null);
    const after = positionBetween(first, null);
    const before = positionBetween(null, first);
    const between = positionBetween(first, after);
    expect([before, first, between, after]).toEqual([before, first, between, after].sort());
    expect(new Set([before, first, between, after]).size).toBe(4);
  });

  it("recovers from inconsistent neighbours by going just after the lower one", () => {
    expect(positionBetween("a1", "a0") > "a1").toBe(true);
    expect(positionBetween("a1", "a1") > "a1").toBe(true);
  });

  it("keeps a valid order through 50 random moves", () => {
    // Deterministic pseudo-random sequence so a failure is reproducible.
    let seed = 42;
    const random = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;

    type Card = { id: string; position: string };
    let column: Card[] = [];
    let last: string | null = null;
    for (let i = 0; i < 8; i++) {
      last = positionBetween(last, null);
      column.push({ id: `c${i}`, position: last });
    }
    for (let move = 0; move < 50; move++) {
      const from = Math.floor(random() * column.length);
      const [card] = column.splice(from, 1);
      const to = Math.floor(random() * (column.length + 1));
      const lower = column[to - 1]?.position ?? null;
      const upper = column[to]?.position ?? null;
      column.splice(to, 0, { ...card, position: positionBetween(lower, upper) });
      const sorted = [...column].sort((a, b) => compareBoardOrder(a, b));
      expect(sorted.map((c) => c.id)).toEqual(column.map((c) => c.id));
      expect(column.every((c) => /^[0-9A-Za-z]+$/.test(c.position))).toBe(true);
    }
    column = [];
  });
});

describe("filtering and sorting", () => {
  const list = [
    nb({
      id: "1",
      title: "Physics 2",
      subject: "Physics",
      status: "learning",
      created_at: "2026-11-03T00:00:00Z",
      exam_date: "2026-12-20",
    }),
    nb({
      id: "2",
      title: "physics 10",
      description: "Quantum notes",
      last_opened_at: "2026-11-10T00:00:00Z",
    }),
    nb({
      id: "3",
      title: "Biology",
      subject: "Biology",
      exam_date: "2026-12-01",
      created_at: "2026-11-02T00:00:00Z",
    }),
  ];

  it("matches the search in title, description or subject, case-insensitively", () => {
    expect(filterNotebooks(list, { q: "PHYSICS" }).map((n) => n.id)).toEqual(["1", "2"]);
    expect(filterNotebooks(list, { q: "quantum" }).map((n) => n.id)).toEqual(["2"]);
    expect(filterNotebooks(list, { status: "learning" }).map((n) => n.id)).toEqual(["1"]);
    expect(filterNotebooks(list, { subject: "Biology" }).map((n) => n.id)).toEqual(["3"]);
  });

  it("sorts by last opened, name (numeric-aware), exam date and creation", () => {
    expect(sortNotebooks(list, "last_opened").map((n) => n.id)).toEqual(["2", "1", "3"]);
    expect(sortNotebooks(list, "title").map((n) => n.id)).toEqual(["3", "1", "2"]);
    expect(sortNotebooks(list, "exam_date").map((n) => n.id)).toEqual(["3", "1", "2"]);
    expect(sortNotebooks(list, "created").map((n) => n.id)).toEqual(["1", "3", "2"]);
  });

  it("counts notebooks per status", () => {
    expect(countByStatus(list)).toEqual({ to_read: 2, learning: 1, reviewing: 0, mastered: 0 });
  });
});
