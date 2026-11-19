import { describe, expect, it } from "vitest";
import { formatContext, type Chunk } from "@/lib/retrieval";

const chunk = (overrides: Partial<Chunk> = {}): Chunk => ({
  id: "c1",
  document_id: "d1",
  section: "3 Model Architecture > 3.2 Attention",
  content: "Attention maps a query and key-value pairs to an output.",
  ...overrides,
});

describe("formatContext", () => {
  it("numbers chunks [1], [2], ... in order so the model can cite them", () => {
    const out = formatContext([
      chunk({ id: "a", content: "first" }),
      chunk({ id: "b", content: "second" }),
      chunk({ id: "c", content: "third" }),
    ]);

    expect(out.indexOf("[1]")).toBeLessThan(out.indexOf("[2]"));
    expect(out.indexOf("[2]")).toBeLessThan(out.indexOf("[3]"));
    expect(out).toMatch(/^\[1\] [^\n]*\nfirst/);
    expect(out).toContain("[2] (section: 3 Model Architecture > 3.2 Attention)\nsecond");
  });

  it('falls back to "n/a" when a chunk has no section', () => {
    expect(formatContext([chunk({ section: null, content: "body" })])).toBe(
      "[1] (section: n/a)\nbody",
    );
  });

  it("separates chunks with a --- divider and adds none after the last chunk", () => {
    const out = formatContext([chunk({ content: "one" }), chunk({ content: "two" })]);

    expect(out.split("\n\n---\n\n")).toHaveLength(2);
    expect(out.endsWith("two")).toBe(true);
  });

  it("returns an empty string for no chunks", () => {
    expect(formatContext([])).toBe("");
  });
});
