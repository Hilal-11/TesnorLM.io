import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run tests through `npm test` / `npm run test:watch` (scripts/vitest.mjs): it works around a
// Windows drive-letter bug in Vitest 5.
export default defineConfig({
  // Vite 8 resolves tsconfig "paths" natively, so "@/..." imports work in tests.
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside a React Server environment; tests import server modules directly.
    alias: { "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
