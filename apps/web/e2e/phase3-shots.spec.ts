import path from "node:path";
import { test, type Page } from "@playwright/test";
import { setTheme } from "./helpers";
import { admin, signInNewPerson, skipWithoutStack } from "./local-stack";

/**
 * Phase 3 screenshots for design review (skill section 13): every screen at 1440, 1024 and 390,
 * light and dark, with seeded data (no real files needed).
 *   SHOTS=1 npm run e2e:local -- e2e/phase3-shots.spec.ts
 * Output: docs/screenshots/phase3/<screen>-<width>-<theme>.png (git-ignored).
 */
skipWithoutStack();
test.skip(!process.env.SHOTS, "screenshots only on request (SHOTS=1)");
test.setTimeout(900_000);

const OUT = path.resolve(__dirname, "../../../docs/screenshots/phase3");
const WIDTHS = [1440, 1024, 390];
const THEMES = ["light", "dark"] as const;

async function seed(userId: string) {
  const db = admin();
  const notebooks = [
    {
      title: "Transformers",
      subject: "Machine learning & AI",
      color: "cobalt",
      status: "learning",
      exam_date: "2026-12-12",
      description: "Attention, encoders and decoders.",
    },
    { title: "Linear algebra", subject: "Mathematics", color: "teal", status: "to_read" },
    { title: "Organic chemistry", subject: "Chemistry", color: "amber", status: "reviewing" },
    { title: "Signals and systems", subject: "Electronics", color: "rose", status: "mastered" },
  ].map((n, i) => ({ ...n, user_id: userId, position: `a${i}` }));
  const { data, error } = await db.from("notebooks").insert(notebooks).select("id, title");
  if (error) throw error;
  const main = data!.find((n) => n.title === "Transformers")!.id;
  const rows = [
    {
      name: "attention-is-all-you-need-annotated.pdf",
      stage: "ready",
      progress: 100,
      page_count: 15,
      chunk_count: 48,
      figure_count: 6,
    },
    {
      name: "bert-pretraining.pdf",
      stage: "parsing_deep",
      progress: 22,
      stage_detail: "Reading page 7 of 16",
    },
    {
      name: "scanned-lecture-notes.pdf",
      stage: "ocr",
      progress: 30,
      stage_detail: "Running OCR on page 3 of 9",
      ocr_used: true,
    },
    {
      name: "vision-transformer.pdf",
      stage: "indexing",
      progress: 80,
      stage_detail: "Indexing 128 passages",
    },
    { name: "locked-handout.pdf", stage: "needs_password" },
    { name: "damaged-thesis.pdf", stage: "failed", error_code: "unreadable_after_repair" },
  ];
  for (const [i, r] of rows.entries()) {
    const ins = await db
      .from("documents")
      .insert({
        notebook_id: main,
        user_id: userId,
        title: r.name,
        original_filename: r.name,
        file_size: 1_200_000 + i * 90_000,
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    const t0 = Date.now() - 60_000;
    const at = (s: number) => new Date(t0 + s * 1000).toISOString();
    const fields = Object.fromEntries(Object.entries(r).filter(([k]) => k !== "name"));
    const up = await db
      .from("documents")
      .update({
        ...fields,
        created_at: at(i),
        stage_timings:
          r.stage === "ready"
            ? {
                uploading: { started_at: at(0), duration_ms: 2100 },
                queued: { started_at: at(2), duration_ms: 400 },
                validating: { started_at: at(3), duration_ms: 900 },
                parsing: { started_at: at(4), duration_ms: 41_000 },
                reading_figures: { started_at: at(45), duration_ms: 6300 },
                indexing: { started_at: at(52), duration_ms: 3800 },
                ready: { started_at: at(56) },
              }
            : {},
      })
      .eq("id", ins.data.id);
    if (up.error) throw up.error;
  }
  return { main, empty: data!.find((n) => n.title === "Linear algebra")!.id };
}

async function shot(page: Page, name: string, width: number, theme: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}-${theme}.png`), fullPage: true });
}

test("phase 3 screens", async ({ page }) => {
  const { userId } = await signInNewPerson(page);
  const { main, empty } = await seed(userId);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of THEMES) {
      for (const view of ["grid", "list", "board"]) {
        await page.goto(`/app/notebooks?view=${view}`);
        await setTheme(page, theme);
        await page.getByRole("heading", { level: 1, name: "Notebooks" }).waitFor();
        await shot(page, `notebooks-${view}`, width, theme);
      }
      await page.getByRole("button", { name: "New notebook" }).first().click();
      await page.getByRole("dialog").waitFor();
      await shot(page, "notebook-dialog", width, theme);
      await page.keyboard.press("Escape");

      await page.goto(`/app/notebooks/${empty}`);
      await setTheme(page, theme);
      await page.getByRole("heading", { name: "Add your first source" }).waitFor();
      await shot(page, "sources-empty", width, theme);

      await page.goto(`/app/notebooks/${main}`);
      await setTheme(page, theme);
      await page.locator("[data-slot=source-card]").first().waitFor();
      await shot(page, "sources", width, theme);
      await page
        .getByRole("button", { name: "attention-is-all-you-need-annotated.pdf", exact: true })
        .click();
      await page.getByRole("list", { name: "Stage timeline" }).waitFor();
      await shot(page, "source-detail", width, theme);

      await page.getByRole("button", { name: "Add source" }).first().click();
      await page.getByRole("dialog", { name: "Add sources" }).waitFor();
      await shot(page, "upload-dialog", width, theme);
      await page.keyboard.press("Escape");
    }
  }
});
