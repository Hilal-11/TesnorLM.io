// Keeps apps/web/.env.local in step with the repo-root .env, so there is ONE file to edit.
// Runs before `npm run dev` and `npm run build` (predev/prebuild). On Windows, setup.sh's symlink
// became a one-time copy, which left the app on placeholder values. No root .env (CI, Vercel) =
// nothing to do. Never prints values.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
const localEnv = fileURLToPath(new URL("../.env.local", import.meta.url));
const header =
  "# Generated from the repo-root .env by scripts/sync-env.mjs. Edit ../../.env instead.\n";

if (!existsSync(rootEnv)) {
  console.log("sync-env: no repo-root .env, keeping apps/web/.env.local as is");
  process.exit(0);
}

const next = header + readFileSync(rootEnv, "utf8");
const current = existsSync(localEnv) ? readFileSync(localEnv, "utf8") : "";
if (current !== next) {
  if (current && !current.startsWith(header)) copyFileSync(localEnv, `${localEnv}.bak`);
  writeFileSync(localEnv, next);
  console.log("sync-env: apps/web/.env.local updated from the repo-root .env");
}
