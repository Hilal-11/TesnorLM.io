// Full-page screenshots of a dev route at the TensorLM breakpoints, in light and dark.
//
//   node scripts/screenshots.mjs <route> <outDir> [width ...]
//   e.g. node scripts/screenshots.mjs /dev/tokens ../../docs/screenshots/phase1/p1.0 1440 390
//
// Needs `npm run dev` running (dev routes 404 in production). Uses the locally installed Edge on
// Windows and Chrome on macOS, so no Playwright browser download is needed; override with
// SHOTS_CHANNEL (e.g. "chromium" after `npx playwright install chromium`) and SHOTS_BASE_URL.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const [route, outDir, ...widthArgs] = process.argv.slice(2);
if (!route || !outDir) {
  console.error("Usage: node scripts/screenshots.mjs <route> <outDir> [width ...]");
  process.exit(1);
}

const widths = widthArgs.length ? widthArgs.map(Number) : [1440, 1024, 768, 390];
const baseUrl = process.env.SHOTS_BASE_URL ?? "http://localhost:3000";
const channel =
  process.env.SHOTS_CHANNEL ??
  (process.platform === "win32" ? "msedge" : process.platform === "darwin" ? "chrome" : undefined);
const slug = route.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "home";

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

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const file = path.join(outDir, `${slug}-${theme}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
      console.log(`${file}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
