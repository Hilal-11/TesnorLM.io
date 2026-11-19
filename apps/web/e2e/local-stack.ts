import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Signed-in tests against the LOCAL Supabase stack (or a test project). Run with:
 *   npm run e2e:local      (starts nothing: needs `npm run dev:local` on port 3100)
 * TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY come from with-local-supabase.mjs.
 */
export const url = process.env.TEST_SUPABASE_URL;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

export function skipWithoutStack() {
  test.skip(!url || !serviceKey, "needs the local stack (npm run e2e:local) or a TEST_* project");
}

export const admin = () =>
  createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

/** A confirmed person who has finished onboarding, signed in through the real login form. */
export async function signInNewPerson(page: Page, name = "Ada Test") {
  const db = admin();
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `Attention-${randomUUID().slice(0, 8)}!`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  await db
    .from("profiles")
    .update({ onboarding_done: true, onboarding_step: 4 })
    .eq("id", data.user.id);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The first sign-in after a dev server start compiles /app: allow for it.
  await expect(page).toHaveURL(/\/app(\?.*)?$/, { timeout: 30_000 });
  return { userId: data.user.id, email };
}
