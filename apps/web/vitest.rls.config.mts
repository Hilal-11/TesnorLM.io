import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// RLS isolation tests run against a SEPARATE Supabase project (TEST_* vars in the repo-root
// .env.test). They create and delete users, so never point them at real data.
const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "rls",
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: loadEnv("test", root, ["TEST_", "NEXT_PUBLIC_SUPABASE_URL"]),
  },
});
