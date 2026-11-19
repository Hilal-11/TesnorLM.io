import { describe, expect, it } from "vitest";
import {
  boardIds,
  columnId,
  dropChanged,
  findColumn,
  moveAcross,
  neighboursOf,
  placeOf,
  reorderWithin,
  type BoardIds,
} from "./board";
import type { Notebook } from "./shared";

const ids = (): BoardIds => ({
  to_read: ["a", "b", "c"],
  learning: ["d"],
  reviewing: [],
  mastered: [],
});

describe("board ids", () => {
  it("groups by status in position order", () => {
    const n = (id: string, status: Notebook["status"], position: string) =>
      ({ id, status, position }) as Notebook;
    expect(
      boardIds([n("x", "learning", "a2"), n("y", "learning", "a1"), n("z", "mastered", "a0")]),
    ).toEqual({ to_read: [], learning: ["y", "x"], reviewing: [], mastered: ["z"] });
  });

  it("finds the column of a card or a column droppable", () => {
    expect(findColumn(ids(), "d")).toBe("learning");
    expect(findColumn(ids(), columnId("reviewing"))).toBe("reviewing");
    expect(findColumn(ids(), "column:nope")).toBeUndefined();
    expect(findColumn(ids(), "missing")).toBeUndefined();
  });
});

describe("dragging", () => {
  it("moves across columns before the card it's over", () => {
    expect(moveAcross(ids(), "b", "d")).toMatchObject({
      to_read: ["a", "c"],
      learning: ["b", "d"],
    });
  });

  it("moves to the end of a column when over the column itself (empty columns too)", () => {
    expect(moveAcross(ids(), "a", columnId("learning")).learning).toEqual(["d", "a"]);
    expect(moveAcross(ids(), "a", columnId("mastered")).mastered).toEqual(["a"]);
  });

  it("returns the same object when the column doesn't change", () => {
    const before = ids();
    expect(moveAcross(before, "a", "c")).toBe(before);
    expect(moveAcross(before, "a", columnId("to_read"))).toBe(before);
  });

  it("reorders within a column on drop", () => {
    expect(reorderWithin(ids(), "a", "c").to_read).toEqual(["b", "c", "a"]);
    expect(reorderWithin(ids(), "c", "a").to_read).toEqual(["c", "a", "b"]);
    expect(reorderWithin(ids(), "a", columnId("to_read")).to_read).toEqual(["b", "c", "a"]);
    const before = ids();
    expect(reorderWithin(before, "a", "a")).toBe(before);
    expect(reorderWithin(before, "a", "d")).toBe(before);
  });
});

describe("landing", () => {
  it("reports neighbours and place", () => {
    expect(neighboursOf(ids(), "b")).toEqual({ status: "to_read", beforeId: "a", afterId: "c" });
    expect(neighboursOf(ids(), "a")).toEqual({ status: "to_read", beforeId: null, afterId: "b" });
    expect(neighboursOf(ids(), "d")).toEqual({ status: "learning", beforeId: null, afterId: null });
    expect(placeOf(ids(), "c")).toEqual({ status: "to_read", position: 3, total: 3 });
  });

  it("knows when a drop changed nothing", () => {
    expect(dropChanged(ids(), ids(), "b")).toBe(false);
    expect(dropChanged(ids(), reorderWithin(ids(), "a", "b"), "a")).toBe(true);
    expect(dropChanged(ids(), moveAcross(ids(), "a", "d"), "a")).toBe(true);
  });
});
