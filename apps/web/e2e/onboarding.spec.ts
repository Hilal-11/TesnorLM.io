import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, setTheme } from "./helpers";

// Onboarding UI through its dev preview (nothing is saved there). Saving and resuming are covered
// by e2e/authed.spec.ts against the test project.
for (const step of [1, 2, 3, 4]) {
  for (const theme of ["light", "dark"] as const) {
    test(`step ${step} has no axe violations (${theme})`, async ({ page }) => {
      await page.goto(`/dev/onboarding?step=${step}`);
      await setTheme(page, theme);
      await expect(page.getByText(`Step ${step} of 4`)).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}

test("every step offers Skip for now and exactly one primary action", async ({ page }) => {
  for (const step of [1, 2, 3, 4]) {
    await page.goto(`/dev/onboarding?step=${step}`);
    await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
    await expect(page.locator('main [data-variant="primary"]')).toHaveCount(1);
  }
});

test("Continue waits for a choice on step 1", async ({ page }) => {
  await page.goto("/dev/onboarding?step=1");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("radio", { name: "Researcher" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});
