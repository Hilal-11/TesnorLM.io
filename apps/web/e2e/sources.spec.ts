import path from "node:path";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, setTheme } from "./helpers";
import { admin, signInNewPerson, skipWithoutStack } from "./local-stack";

/**
 * Sources, end to end on the local stack with the real queue and worker:
 *   npx supabase start · Inngest Dev Server · worker (WORKER_FAKE_AI=1) · npm run dev:local
 * then `npm run e2e:local -- e2e/sources.spec.ts`. Fixtures come from the worker's generator
 * (python services/worker/tests/fixtures/make_fixtures.py).
 */
// The real queue and worker run behind these tests: allow for a busy queue.
const expect = baseExpect.configure({ timeout: 30_000 });

skipWithoutStack();
test.skip(!process.env.E2E_PIPELINE, "needs the queue and worker running (E2E_PIPELINE=1)");
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const FIXTURES = path.resolve(__dirname, "../../../services/worker/tests/fixtures/generated");
const fixture = (name: string) => path.join(FIXTURES, `${name}.pdf`);

async function notebookPage(page: Page, title = "Live sources") {
  const { userId } = await signInNewPerson(page);
  const { data, error } = await admin()
    .from("notebooks")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  if (error) throw error;
  await page.goto(`/app/notebooks/${data.id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return { userId, notebookId: data.id as string };
}

async function chooseFiles(page: Page, names: string[]) {
  await page.getByRole("button", { name: "Add source" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add sources" });
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Browse files" }).click();
  await (await chooser).setFiles(names.map(fixture));
  return dialog;
}

/** Records every data-stage a source card shows, however briefly. */
async function recordStages(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __stages: string[]; __noReload: boolean };
    w.__stages = [];
    w.__noReload = true;
    const note = (el: Element) => {
      const s = el.getAttribute("data-stage");
      if (s && w.__stages.at(-1) !== s) w.__stages.push(s);
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.target instanceof Element && r.target.matches("[data-slot=source-card]"))
          note(r.target);
        for (const n of r.addedNodes) {
          if (n instanceof Element) n.querySelectorAll("[data-slot=source-card]").forEach(note);
        }
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-stage"],
    });
  });
}

const card = (page: Page, name: string) =>
  page.locator("[data-slot=source-card]", { hasText: name }).first();

test("upload a paper: Uploading → Reading → Indexing → Ready, live, no reload", async ({
  page,
}) => {
  const { notebookId } = await notebookPage(page);
  await recordStages(page);
  const dialog = await chooseFiles(page, ["paper_basic"]);
  await dialog.getByRole("button", { name: "Done" }).click(); // uploads keep going
  await expect(card(page, "paper_basic.pdf")).toHaveAttribute("data-stage", "ready", {
    timeout: 200_000,
  });
  await expect(card(page, "paper_basic.pdf")).toContainText("3 pages · Ready");

  const { stages, noReload } = await page.evaluate(() => {
    const w = window as unknown as { __stages: string[]; __noReload: boolean };
    return { stages: w.__stages, noReload: w.__noReload };
  });
  expect(noReload).toBe(true);
  expect(stages[0]).toBe("uploading");
  expect(stages).toContain("reading");
  expect(stages).toContain("indexing");
  expect(stages.at(-1)).toBe("ready");
  const order = ["uploading", "queued", "reading", "indexing", "ready"];
  const ranks = stages.map((s) => order.indexOf(s));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b)); // never backwards

  // The database has page-aware chunks for it.
  const { data: doc } = await admin()
    .from("documents")
    .select("id, page_count, chunk_count, figure_count")
    .eq("notebook_id", notebookId)
    .single();
  expect(doc).toMatchObject({ page_count: 3, figure_count: 2 });
  expect(doc!.chunk_count).toBeGreaterThan(0);

  // Detail panel: stage timeline with durations.
  await card(page, "paper_basic.pdf")
    .getByRole("button", { name: "paper_basic.pdf", exact: true })
    .click();
  const timeline = page.getByRole("list", { name: "Stage timeline" });
  await expect(timeline).toContainText("Checking the file");
  await expect(timeline).toContainText(/\d+(\.\d)? s|\d+ ms/);
  await expectNoAxeViolations(page);
});

test("a dropped connection shows Waiting for connection… and resumes", async ({ page }) => {
  await notebookPage(page, "Patchy wifi");
  let attempts = 0;
  await page.route("**/storage/v1/upload/resumable**", (route) =>
    attempts++ < 2 ? route.abort("internetdisconnected") : route.continue(),
  );
  await chooseFiles(page, ["paper_basic"]);
  await expect(page.getByText("Waiting for connection…").first()).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(card(page, "paper_basic.pdf")).toHaveAttribute(
    "data-stage",
    /queued|reading|indexing|ready/,
    {
      timeout: 60_000,
    },
  );
  expect(attempts).toBeGreaterThanOrEqual(3);
});

// v2 never rejects a PDF for its password or length (the worker asks for the password and reads
// up to MAX_PAGES; P3.7v2 adds those e2e paths). Until P3.5v2 only PDFs upload.
test("a type TensorLM can't read yet stops at once with the reason and the fix", async ({
  page,
}) => {
  const { notebookId } = await notebookPage(page, "Bad files");
  const dialog = await chooseFiles(page, ["not_pdf"]);
  await expect(dialog).toContainText("TensorLM can't read this type of file yet.");
  await expect(dialog).toContainText("Save it as PDF, Word, text or Markdown");
  await expectNoAxeViolations(page);
  const { count } = await admin()
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", notebookId);
  expect(count).toBe(0);
});

test("a corrupt PDF passes the browser check and fails in the worker with a fix", async ({
  page,
}) => {
  await notebookPage(page, "Corrupt");
  await chooseFiles(page, ["corrupt"]);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(card(page, "corrupt.pdf")).toHaveAttribute("data-stage", "failed", {
    timeout: 60_000,
  });
  await expect(card(page, "corrupt.pdf")).toContainText(
    "We couldn't read this file, even after trying to repair it.",
  );
  await expect(card(page, "corrupt.pdf")).toContainText("upload a different copy");
});

test("duplicates offer Open it and Add anyway", async ({ page }) => {
  await notebookPage(page, "Duplicates");
  let dialog = await chooseFiles(page, ["logo_repeat"]);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(card(page, "logo_repeat.pdf")).toHaveAttribute(
    "data-stage",
    /queued|reading|indexing|ready/,
  );
  dialog = await chooseFiles(page, ["logo_repeat"]);
  await expect(dialog).toContainText("This file is already in this notebook.");
  await dialog.getByRole("button", { name: "Add anyway" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("[data-slot=source-card]", { hasText: "logo_repeat.pdf" })).toHaveCount(
    2,
  );
});

test("cancel during upload removes the partial file and the row", async ({ page }) => {
  const { notebookId } = await notebookPage(page, "Cancel");
  await page.route("**/storage/v1/upload/resumable**", () => undefined); // never answers
  const dialog = await chooseFiles(page, ["paper_basic"]);
  await expect(dialog.getByText(/Uploading/).first()).toBeVisible();
  await expect
    .poll(
      async () =>
        (await admin().from("documents").select("id").eq("notebook_id", notebookId)).data?.length,
      { timeout: 20_000 },
    )
    .toBe(1);
  await dialog.getByRole("button", { name: "Cancel upload of paper_basic.pdf" }).click();
  await expect(dialog.getByRole("list", { name: "Files" })).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveText("paper_basic.pdf cancelled");
  await expect
    .poll(
      async () =>
        (await admin().from("documents").select("id").eq("notebook_id", notebookId)).data?.length,
      { timeout: 20_000 },
    )
    .toBe(0);
});

test("delete with Undo; deleted again, the cleanup job empties storage", async ({ page }) => {
  test.setTimeout(480_000); // two full ingests, then the 30 s Undo window and the cleanup job
  test.setTimeout(420_000); // two full reads plus the 30 s Undo window
  const { userId, notebookId } = await notebookPage(page, "Delete");
  const dialog = await chooseFiles(page, ["paper_basic"]);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(card(page, "paper_basic.pdf")).toHaveAttribute("data-stage", "ready", {
    timeout: 200_000,
  });
  const { data: doc } = await admin()
    .from("documents")
    .select("id")
    .eq("notebook_id", notebookId)
    .single();

  // Delete → hidden at once → Undo brings it back.
  await page.getByRole("button", { name: "Source options for paper_basic.pdf" }).click();
  await page.getByRole("menuitem", { name: "Delete source" }).click();
  await expect(page.getByText("Source deleted")).toBeVisible();
  await expect(card(page, "paper_basic.pdf")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "paper_basic.pdf")).toBeVisible();

  // Read again: a new run goes all the way to Ready.
  await page.getByRole("button", { name: "Source options for paper_basic.pdf" }).click();
  await page.getByRole("menuitem", { name: "Read again" }).click();
  await expect(card(page, "paper_basic.pdf")).not.toHaveAttribute("data-stage", "ready");
  await expect(card(page, "paper_basic.pdf")).toHaveAttribute("data-stage", "ready", {
    timeout: 200_000,
  });

  // Delete for good: after the 30 s Undo window the row and every stored file are gone.
  await page.getByRole("button", { name: "Source options for paper_basic.pdf" }).click();
  await page.getByRole("menuitem", { name: "Delete source" }).click();
  await expect
    .poll(
      async () => {
        const row = await admin().from("documents").select("id").eq("id", doc!.id).maybeSingle();
        const files = await admin().storage.from("documents").list(`${userId}/${doc!.id}`);
        return row.data === null && (files.data ?? []).length === 0;
      },
      { timeout: 90_000, intervals: [3000] },
    )
    .toBe(true);
});

test("keyboard: Ctrl+U opens Add sources; Esc closes it and focus returns", async ({ page }) => {
  await notebookPage(page, "Keyboard");
  const add = page.getByRole("button", { name: "Add source" }).first();
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add sources" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await page.keyboard.press("Control+u");
  await expect(page.getByRole("dialog", { name: "Add sources" })).toBeVisible();
  await page.keyboard.press("Escape");
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`notebook page and upload dialog: no axe violations (${theme}, ${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await notebookPage(page, `Axe ${theme}`);
      await setTheme(page, theme);
      await expectNoAxeViolations(page); // empty sources state
      await expectNoHorizontalOverflow(page);
      await chooseFiles(page, ["not_pdf"]);
      await expect(page.getByRole("dialog")).toContainText(
        "TensorLM can't read this type of file yet.",
      );
      await expectNoAxeViolations(page);
    });
  }
}
