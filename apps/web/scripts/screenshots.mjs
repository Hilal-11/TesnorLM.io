// Full-page screenshots of a dev route at the TensorLM breakpoints, in light and dark.
//
//   node scripts/screenshots.mjs <route> <outDir> [width ...] [--sections] [--only=<id,id>]
//   e.g. node scripts/screenshots.mjs /dev/tokens ../../docs/screenshots/phase1/p1.0 1440 390
//
// --sections saves one image per [data-shot] element (e.g. each /dev/components family) instead of
// one very tall page; --only limits that to some sections.
//
// Needs `npm run dev` running (dev routes 404 in production). Uses the locally installed Edge on
// Windows and Chrome on macOS, so no Playwright browser download is needed; override with
// SHOTS_CHANNEL (e.g. "chromium" after `npx playwright install chromium`) and SHOTS_BASE_URL.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [route, outDir, ...widthArgs] = args.filter((a) => !a.startsWith("--"));
const perSection = flags.includes("--sections");
const only = flags
  .find((f) => f.startsWith("--only="))
  ?.slice(7)
  .split(",");
if (!route || !outDir) {
  console.error("Usage: node scripts/screenshots.mjs <route> <outDir> [width ...]");
  process.exit(1);
}

const widths = widthArgs.length ? widthArgs.map(Number) : [1440, 1024, 768, 390];
const baseUrl = process.env.SHOTS_BASE_URL ?? "http://localhost:3000";
const channel =
  process.env.SHOTS_CHANNEL ??
  (process.platform === "win32" ? "msedge" : process.platform === "darwin" ? "chrome" : undefined);
// File-safe name: "/dev/onboarding?step=2" → "dev-onboarding-step-2" (Windows rejects "?").
const slug =
  route
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "home";

try {
  await fetch(new URL(route, baseUrl));
} catch {
  console.error(`Can't reach ${baseUrl}. Start the dev server first: npm run dev`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch(channel && channel !== "chromium" ? { channel } : {});

try {
  for (const theme of ["light", "dark"]) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
      await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
      // Until the theme provider exists, set the theme the same way it will: a class on <html>.
      await page.evaluate((t) => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(t);
      }, theme);
      await page.evaluate(() => document.fonts.ready);
      // Let hydration and mount effects finish (Radix select values, auto-growing textareas).
      await page.waitForTimeout(800);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const warn = overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : "";
      if (perSection) {
        const ids = await page.$$eval("[data-shot]", (els) => els.map((e) => e.dataset.shot));
        for (const id of ids.filter((i) => !only || only.includes(i))) {
          const file = path.join(outDir, `${id}-${theme}-${width}.png`);
          // Clip from an unscrolled full-page capture so sticky elements stay in place.
          await page.evaluate(() => window.scrollTo(0, 0));
          const box = await page.locator(`[data-shot="${id}"]`).boundingBox();
          await page.screenshot({ path: file, fullPage: true, clip: box, animations: "disabled" });
          console.log(`${file}${warn}`);
        }
      } else {
        const file = path.join(outDir, `${slug}-${theme}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
        console.log(`${file}${warn}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
