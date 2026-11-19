import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Sets the theme the way the app does (a class on <html>). */
export async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
  }, theme);
}

/** WCAG 2.1 A/AA with real colour contrast; fails on any violation with a readable list. */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  const report = results.violations
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
  expect(results.violations, report).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}
