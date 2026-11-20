import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Smoke evals: real models (ANTHROPIC_API_KEY) against the TEST Supabase project or the local
// stack (scripts/with-local-supabase.mjs). Skipped when no key is set. Costs a few cents a run.
const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)) },
  },
  test: {
    name: "eval",
    environment: "node",
    include: ["tests/evals/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: loadEnv("test", root, ["TEST_", "NEXT_PUBLIC_SUPABASE_URL", "ANTHROPIC_API_KEY", "LLM_MODEL", "FAST_MODEL"]),
  },
});
