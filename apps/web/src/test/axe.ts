import axe from "axe-core";
import { expect } from "vitest";

/**
 * Fails with a readable list when axe finds violations. Colour contrast is checked against real
 * CSS in the browser (Playwright) and by the token contrast test — jsdom can't compute it.
 */
export async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  const report = results.violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target).join("\n  ")}`)
    .join("\n");
  expect(results.violations, report).toEqual([]);
}
