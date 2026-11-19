import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, setTheme } from "./helpers";
import { admin, signInNewPerson, skipWithoutStack } from "./local-stack";

skipWithoutStack();

async function createNotebook(page: Page, name: string, options: { subject?: string } = {}) {
  await page.getByRole("button", { name: "New notebook" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New notebook" });
  await dialog.getByLabel("Name").fill(name);
  if (options.subject) {
    await dialog.getByRole("button", { name: "Subject" }).click();
    await page.getByPlaceholder("Search or type a subject").fill(options.subject);
    await page
      .getByRole("option", { name: new RegExp(options.subject) })
      .first()
      .click();
  }
  await dialog.getByRole("radio", { name: "Teal" }).click();
  await dialog.getByLabel("Exam date").fill("2026-12-12");
  await dialog.getByRole("button", { name: "Create notebook" }).click();
  await expect(page).toHaveURL(/\/app\/notebooks\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("create → sidebar → rename inline → colour → delete → Undo → delete", async ({ page }) => {
  await signInNewPerson(page);
  await page.goto("/app/notebooks");
  await expect(page.getByRole("heading", { name: "Create your first notebook" })).toBeVisible();

  await createNotebook(page, "Transformers", { subject: "Machine learning & AI" });
  await expect(page.getByRole("navigation", { name: "Recent notebooks" }).first()).toContainText(
    "Transformers",
  );

  await page.goto("/app/notebooks");
  const card = page.locator("article", { hasText: "Transformers" });
  await expect(card).toContainText("Machine learning & AI");
  await expect(card).toContainText("No sources yet · Exam 12 Dec");
  await expect(card).toContainText("To read");

  // Rename inline: Enter saves, and it survives a reload.
  await card.getByRole("button", { name: "Notebook options for Transformers" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const input = page.getByRole("textbox", { name: "Notebook name" });
  await input.fill("Attention is all you need");
  await input.press("Enter");
  await expect(
    page.locator("#main").getByRole("link", { name: "Attention is all you need" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("#main").getByRole("link", { name: "Attention is all you need" }),
  ).toBeVisible();

  // Esc cancels a rename.
  const renamed = page.locator("article", { hasText: "Attention is all you need" });
  await renamed.getByRole("button", { name: /Notebook options/ }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Notebook name" }).fill("Nope");
  await page.getByRole("textbox", { name: "Notebook name" }).press("Escape");
  await expect(
    page.locator("#main").getByRole("link", { name: "Attention is all you need" }),
  ).toBeVisible();

  // Colour from the menu, persisted.
  await renamed.getByRole("button", { name: /Notebook options/ }).click();
  await page.getByRole("menuitem", { name: "Change colour" }).click();
  await page.getByRole("menuitemradio", { name: "Rose" }).click();
  await expect
    .poll(async () => {
      const { data } = await admin()
        .from("notebooks")
        .select("color")
        .eq("title", "Attention is all you need");
      return data?.[0]?.color;
    })
    .toBe("rose");
  await page.reload();

  // Delete shows Undo; Undo brings it back.
  await renamed.getByRole("button", { name: /Notebook options/ }).click();
  await page.getByRole("menuitem", { name: "Delete notebook" }).click();
  await expect(page.getByText("Notebook deleted")).toBeVisible();
  await expect(renamed).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("article", { hasText: "Attention is all you need" })).toBeVisible();

  // Delete again: stays deleted after a reload.
  await page
    .locator("article", { hasText: "Attention is all you need" })
    .getByRole("button", { name: /Notebook options/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete notebook" }).click();
  await expect(page.getByText("Notebook deleted")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Create your first notebook" })).toBeVisible();
});

test("view switch is kept in the URL and remembered; search filters", async ({ page }) => {
  await signInNewPerson(page);
  await page.goto("/app/notebooks");
  await createNotebook(page, "Linear algebra");
  await page.goto("/app/notebooks");
  await createNotebook(page, "Organic chemistry", { subject: "Organic chemistry" });
  await page.goto("/app/notebooks");

  await page.getByRole("radio", { name: "List" }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole("table", { name: "Notebooks" })).toBeVisible();
  await page.goto("/app/notebooks");
  await expect(page.getByRole("table", { name: "Notebooks" })).toBeVisible();

  await page.getByRole("radio", { name: "Board" }).click();
  await expect(page.getByRole("heading", { name: "To read" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mastered" })).toBeVisible();
  await expect(page.getByText("Drag notebooks here").first()).toBeVisible();

  await page.getByRole("radio", { name: "Grid" }).click();
  await page.getByRole("searchbox", { name: "Search notebooks" }).fill("chem");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search notebooks" }).fill("zzz");
  await expect(page.getByRole("heading", { name: "No notebooks match “zzz”" })).toBeVisible();
  await page
    .locator("[data-slot=empty-state]")
    .getByRole("button", { name: "Clear search" })
    .click();
  await expect(page.locator("article")).toHaveCount(2);
});

test("keyboard only: create a notebook", async ({ page }) => {
  await signInNewPerson(page);
  await page.goto("/app/notebooks");
  await page.getByRole("button", { name: "New notebook" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "New notebook" })).toBeVisible();
  await page.keyboard.type("Keyboard notebook");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Keyboard notebook" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`notebooks page has no axe violations (${theme}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signInNewPerson(page);
      await page.goto("/app/notebooks");
      await setTheme(page, theme);
      await expectNoAxeViolations(page); // empty state
      await createNotebook(page, "Accessible notebook");
      await page.goto("/app/notebooks");
      await setTheme(page, theme);
      for (const view of ["Grid", "List", "Board"]) {
        await page.getByRole("radio", { name: view }).click();
        await expectNoAxeViolations(page);
        await expectNoHorizontalOverflow(page);
      }
      await page.getByRole("button", { name: "New notebook" }).first().click();
      await expectNoAxeViolations(page);
    });
  }
}
