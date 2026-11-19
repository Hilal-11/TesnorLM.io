import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

// Reads the real token values from globals.css, so this test can't drift from the CSS.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Custom properties declared in the flat rule whose selector list is exactly `selector`. */
function declarationsFor(selector: string): Record<string, string> {
  const wanted = selector.replace(/\s+/g, "");
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Drop any statement before the selector (e.g. `@custom-variant …;`).
    if (sel.split(";").pop()!.replace(/\s+/g, "") !== wanted) continue;
    return Object.fromEntries(
      [...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]),
    );
  }
  throw new Error(`No rule for "${selector}" in globals.css`);
}

const lightRaw = declarationsFor(":root, .light");
const darkRaw = declarationsFor(".dark");
const derived = declarationsFor(":root, .light, .dark");

const themes = {
  light: { ...lightRaw, ...derived },
  dark: { ...lightRaw, ...darkRaw, ...derived },
};
type Theme = keyof typeof themes;

/** Resolves `var(--x)` chains to a hex colour. */
function colour(theme: Theme, name: string): string {
  const value = themes[theme][name];
  if (value === undefined) throw new Error(`--${name} is not defined for ${theme}`);
  const ref = /^var\(--([\w-]+)\)$/.exec(value);
  return ref ? colour(theme, ref[1]) : value;
}

const ratio = (theme: Theme, fg: string, bg: string) =>
  contrastRatio(colour(theme, fg), colour(theme, bg));

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ["ink", "paper"],
  ["graphite", "paper"],
  ["cobalt", "paper"],
  ["ink", "sheet"],
  ["graphite", "sheet"],
  ["ink", "sheet-2"],
  ["graphite", "muted"],
  ["primary-foreground", "cobalt"],
  ["danger-foreground", "danger"],
];

const FOCUS_RING_PAIRS: [fg: string, bg: string][] = [
  ["ring", "paper"],
  ["ring", "sheet"],
];

// Status colours always come with an icon and a word; the glyph must meet the 3:1 UI floor.
const STATUS_GLYPH_PAIRS: [fg: string, bg: string][] = ["success", "warning", "danger"].flatMap(
  (s) => [
    [s, "paper"],
    [s, "sheet"],
  ],
) as [string, string][];

describe.each(["light", "dark"] as const)("%s theme contrast", (theme) => {
  it.each(TEXT_PAIRS)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FOCUS_RING_PAIRS)("focus %s against %s is at least 3:1", (fg, bg) => {
    expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it.each(STATUS_GLYPH_PAIRS)("status %s on %s is at least 3:1", (fg, bg) => {
    expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("token values", () => {
  it("define every core and status colour as hex in both themes", () => {
    const names = ["paper", "sheet", "sheet-2", "ink", "graphite", "rule", "cobalt", "cobalt-soft"];
    for (const theme of ["light", "dark"] as const) {
      for (const name of [...names, "marker", "success", "warning", "danger"]) {
        expect(colour(theme, name), `${theme} --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("keep the diagram palette to five ordered series per theme", () => {
    for (const theme of ["light", "dark"] as const) {
      const series = [1, 2, 3, 4, 5].map((i) => colour(theme, `chart-${i}`));
      expect(new Set(series).size).toBe(5);
    }
    expect(colour("light", "chart-1")).toBe(colour("light", "cobalt"));
  });
});

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777", "#fff")).toBeCloseTo(4.48, 2);
  });
});
