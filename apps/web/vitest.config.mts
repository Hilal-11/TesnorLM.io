import { defineConfig } from "vitest/config";

// Run tests through `npm test` / `npm run test:watch` (scripts/vitest.mjs): it works around a
// Windows drive-letter bug in Vitest 5.
export default defineConfig({
  // Vite 8 resolves tsconfig "paths" natively, so "@/..." imports work in tests.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html"],
    },
  },
});
