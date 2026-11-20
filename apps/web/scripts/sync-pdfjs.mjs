// Copies pdf.js (the installed pdfjs-dist) into public/vendor/pdfjs/ so the upload pre-check
// worker loads it at run time instead of bundling it. Turbopack's production build hangs when a
// Web Worker entry bundles pdf.js (found in the Phase 3 audit), and the browser only needs these
// two files when someone actually drops a PDF.
//
// Runs before `npm run dev` and `npm run build` (predev/prebuild). public/vendor/ is git-ignored.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
const target = fileURLToPath(new URL("../public/vendor/pdfjs/", import.meta.url));

mkdirSync(target, { recursive: true });
for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
  copyFileSync(path.join(pkgDir, "build", file), path.join(target, file));
}
console.log(`sync-pdfjs: pdf.js ${version} → public/vendor/pdfjs/`);
