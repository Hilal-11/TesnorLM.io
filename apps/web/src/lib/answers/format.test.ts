import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMMANDS,
  LEVELS,
  commandTemplate,
  levelLabel,
  parseChartSpec,
  shiftLevel,
  validateFormat,
} from "./format";
import { FORMAT } from "./format.generated";

const source = JSON.parse(
  readFileSync(new URL("../../../../../contracts/answer-format.json", import.meta.url), "utf8"),
);

describe("answer-format contract", () => {
  it("the generated copy matches contracts/answer-format.json", () => {
    expect(FORMAT).toEqual(source);
  });

  it("parses, and rejects a broken copy", () => {
    expect(() => validateFormat(source)).not.toThrow();
    expect(() => validateFormat({ ...source, levels: { beginner: { label: "" } } })).toThrow();
  });

  it("has the skill's level words", () => {
    expect(LEVELS).toEqual(["beginner", "intermediate", "expert"]);
    expect(LEVELS.map(levelLabel)).toEqual(["Beginner", "Intermediate", "Expert"]);
    expect(shiftLevel("beginner", -1)).toBe("beginner");
    expect(shiftLevel("intermediate", 1)).toBe("expert");
  });

  it("every slash command has a template", () => {
    expect(COMMANDS.sort()).toEqual(
      ["deeper", "diagram", "example", "explain", "quiz", "simpler", "summarize"].sort(),
    );
    for (const c of COMMANDS) expect(commandTemplate(c).length).toBeGreaterThan(20);
  });

  it("labels general knowledge the skill's way", () => {
    expect(FORMAT.directives.general.label).toBe("Not from your sources");
    expect(FORMAT.directives["key-idea"].max).toBe(1);
  });
});

describe("chart specs", () => {
  const ok = { type: "line", xKey: "step", series: ["loss"], data: [{ step: 1, loss: 2.1 }] };

  it("accepts a valid spec", () => {
    expect(parseChartSpec(JSON.stringify(ok))).toMatchObject({ type: "line" });
  });

  it.each([
    ["not JSON", "{oops"],
    ["unknown type", JSON.stringify({ ...ok, type: "pie" })],
    ["too many series", JSON.stringify({ ...ok, series: ["a", "b", "c", "d", "e", "f"] })],
    ["missing xKey in rows", JSON.stringify({ ...ok, data: [{ loss: 1 }] })],
    ["series without numbers", JSON.stringify({ ...ok, series: ["acc"] })],
    ["extra keys", JSON.stringify({ ...ok, script: "alert(1)" })],
    ["too many points", JSON.stringify({ ...ok, data: Array.from({ length: 1001 }, (_, i) => ({ step: i, loss: i })) })],
  ])("rejects %s", (_, text) => {
    expect(parseChartSpec(text)).toBeNull();
  });
});
