import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/**
 * Full signed-in flow against the TEST Supabase project. To run:
 *   1. Point the app at the test project (its URL/keys in apps/web/.env.local), start `npm run dev`.
 *   2. E2E_AUTH=1 TEST_SUPABASE_URL=… TEST_SUPABASE_SERVICE_ROLE_KEY=… npx playwright test authed
 * The 6-digit code is fetched with the admin API (generateLink returns the email OTP).
 */
const url = process.env.TEST_SUPABASE_URL;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
test.skip(!process.env.E2E_AUTH || !url || !serviceKey, "needs E2E_AUTH=1 and the TEST_* project");

test("sign up → verify with code → onboarding → shell → sign out → sign in", async ({ page }) => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `Attention-${randomUUID().slice(0, 8)}!`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify$/);

  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const code = data.properties?.email_otp;
  expect(code, "admin API returned an email code").toMatch(/^\d{6}$/);
  await page.getByRole("textbox", { name: "Digit 1 of 6" }).fill(code!);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/app(\?welcome=1)?$/);
  await expect(page.getByRole("heading", { name: "Welcome, Ada" })).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/app$/); // signed-in people skip auth pages

  await page.goto("/app/settings");
  await page
    .getByRole("button", { name: /Ada Test|Account/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/app/notebooks");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fnotebooks$/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/notebooks$/);

  const { data: users } = await admin.auth.admin.listUsers();
  const created = users.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
});
