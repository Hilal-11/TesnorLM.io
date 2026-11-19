import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, setTheme } from "./helpers";

// The signed-in shell is exercised through its dev preview (same component, sample person).
const SHELL = "/dev/app-shell";

test.describe("desktop shell", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("skip link first, Ctrl+B toggles the sidebar, Ctrl+K opens the palette", async ({
    page,
  }) => {
    await page.goto(SHELL);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    const toggle = page.getByRole("button", { name: /(Collapse|Expand) sidebar/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.locator("main").click();
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await page.keyboard.press("Control+b");

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog");
    await expect(palette.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("Quiz");
    await expect(palette.getByRole("option", { name: "Quizzes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`no axe violations (${theme})`, async ({ page }) => {
      await page.goto(SHELL);
      await setTheme(page, theme);
      await expectNoAxeViolations(page);
    });
  }
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tab bar marks the current tab; Ask opens a sheet; the drawer closes with Esc", async ({
    page,
  }) => {
    await page.goto(SHELL);
    const tabs = page.getByRole("navigation", { name: "Main tabs" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/app/settings",
    );

    await tabs.getByRole("button", { name: "Ask about your sources" }).click();
    await expect(page.getByRole("dialog", { name: "Ask about your sources" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByRole("link", { name: "Lessons" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("tab targets are at least 44px", async ({ page }) => {
    await page.goto(SHELL);
    const targets = page.getByRole("navigation", { name: "Main tabs" }).locator("a, button");
    for (const box of await targets.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()),
    )) {
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
  });

  test("no axe violations and nothing overflows at 320px", async ({ page }) => {
    await page.goto(SHELL);
    await expectNoAxeViolations(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await expectNoHorizontalOverflow(page);
  });
});
