import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, setTheme } from "./helpers";

test.describe("route protection (signed out)", () => {
  test("protected pages send you to sign in and keep where you were going", async ({ page }) => {
    await page.goto("/app/notebooks?tab=sources");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fnotebooks%3Ftab%3Dsources$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  });

  test("API routes answer 401 JSON without a session", async ({ request }) => {
    for (const path of ["/api/chat", "/api/documents"]) {
      const res = await request.post(path, { data: {} });
      expect(res.status()).toBe(401);
      expect(await res.json()).toEqual({ error: "Sign in to continue.", code: "unauthorized" });
    }
  });

  test("auth callbacks never redirect off-site", async ({ request }) => {
    for (const next of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
      const res = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, {
        maxRedirects: 0,
      });
      expect(new URL(res.headers().location ?? "/", "http://localhost:3000").host).toBe(
        "localhost:3000",
      );
    }
  });
});

test.describe("sign-in form", () => {
  test("email first, then password or a code", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();

    await page.getByLabel("Email").fill("asha@example.com");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Password")).toBeFocused();
    await expect(page.getByRole("button", { name: "Email me a code instead" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });
});

const PAGES = [
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
  "/reset-password",
  "/auth/error?reason=expired",
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`auth pages, ${theme}`, () => {
    for (const path of PAGES) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await setTheme(page, theme);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test("auth pages fit a 320px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of PAGES) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
});
