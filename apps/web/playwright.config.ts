import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests. Locally they reuse a running `npm run dev` (or start one) and drive the installed
 * Edge, so no browser download is needed; CI sets PLAYWRIGHT_CHANNEL=chromium after installing it.
 * The signed-in flow (e2e/authed.spec.ts) runs only when E2E_AUTH=1 and the app points at the
 * TEST Supabase project — see the comment in that file.
 */
const channel =
  process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: channel === "chromium" ? undefined : channel,
    trace: "retain-on-failure",
  },
  // With E2E_BASE_URL the server is already running (e.g. `npm run dev:local` on the local
  // Supabase stack), so Playwright mustn't start one against your real project.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
