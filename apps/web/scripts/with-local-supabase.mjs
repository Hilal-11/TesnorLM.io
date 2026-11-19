// Runs a command against the LOCAL Supabase stack (`npx supabase start` from the repo root),
// without touching any .env file. Values come from `supabase status` and are never printed.
//
//   node scripts/with-local-supabase.mjs --test <command…>   TEST_SUPABASE_* (test:rls)
//   node scripts/with-local-supabase.mjs --app <command…>    NEXT_PUBLIC_SUPABASE_* and
//                                                             SUPABASE_SERVICE_ROLE_KEY (dev, worker)
//
// Environment variables beat .env files in Next.js and in the worker, so the app talks to the
// local stack while your real keys stay untouched.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const [mode, ...command] = process.argv.slice(2);
if (!["--test", "--app"].includes(mode) || command.length === 0) {
  console.error("usage: with-local-supabase.mjs --test|--app <command…>");
  process.exit(2);
}

const require = createRequire(import.meta.url);
const cliDir = path.dirname(require.resolve("supabase/package.json"));
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const status = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--no-install", "supabase", "status", "-o", "json", "--workdir", repoRoot],
  { cwd: path.dirname(cliDir), encoding: "utf8", shell: process.platform === "win32" },
);
let local;
try {
  local = JSON.parse(status.stdout.slice(status.stdout.indexOf("{")));
} catch {
  console.error(
    "with-local-supabase: the local stack isn't running. Start it with `npx supabase start`.",
  );
  process.exit(1);
}

const env =
  mode === "--test"
    ? {
        TEST_SUPABASE_URL: local.API_URL,
        TEST_SUPABASE_ANON_KEY: local.ANON_KEY,
        TEST_SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
      }
    : {
        NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
        SUPABASE_DB_URL: local.DB_URL,
      };

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: { ...process.env, ...env },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
