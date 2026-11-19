import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";
import { admin, signInNewPerson, skipWithoutStack } from "./local-stack";

skipWithoutStack();

/** Three notebooks in "To read" (created straight in the database), then the board. */
async function boardWith(page: Page, titles: string[]) {
  const { userId } = await signInNewPerson(page);
  const rows = titles.map((title, i) => ({ user_id: userId, title, position: `a${i}` }));
  const { error } = await admin().from("notebooks").insert(rows);
  if (error) throw error;
  await page.goto("/app/notebooks?view=board");
  await expect(page.getByRole("heading", { name: "To read" })).toBeVisible();
  return userId;
}

const column = (page: Page, name: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });

const live = (page: Page) => page.locator("[role=status][aria-live]");

/** Keyboard drag like a person: pick up, wait for the announcement, then one key at a time. */
async function keyDrag(page: Page, title: string, keys: string[], end = "Space") {
  await page.getByRole("button", { name: `Move ${title}` }).focus();
  await page.keyboard.press("Space");
  await expect(live(page)).toContainText(`Picked up ${title}`);
  for (const key of keys) {
    await page.waitForTimeout(150);
    await page.keyboard.press(key);
  }
  await page.waitForTimeout(150);
  await page.keyboard.press(end);
}

async function statusOf(userId: string, title: string) {
  const { data } = await admin()
    .from("notebooks")
    .select("status")
    .eq("user_id", userId)
    .eq("title", title);
  return data?.[0]?.status;
}

test("mouse: drag a card to another column; it persists, counts update, no tilt", async ({
  page,
}) => {
  const userId = await boardWith(page, ["Alpha", "Beta", "Gamma"]);
  await expect(column(page, "To read").getByText("3", { exact: true })).toBeVisible();
  await expect(column(page, "Learning")).toContainText("Drag notebooks here");

  const card = column(page, "To read").locator("article", { hasText: "Beta" });
  const target = column(page, "Learning");
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });

  // While dragging: the target column is highlighted and the lifted card isn't rotated.
  await expect(target).toHaveAttribute("data-highlighted", "true");
  const overlay = page.locator("[aria-hidden=true][inert] article");
  await expect(overlay).toBeVisible();
  const transform = await overlay.evaluate((el) => {
    const parent = el.closest("[style*=transform]") as HTMLElement | null;
    return parent ? getComputedStyle(parent).transform : "none";
  });
  expect(transform).not.toMatch(/rotate/);
  if (transform.startsWith("matrix(")) {
    const [a, b] = transform.slice(7, -1).split(",").map(Number);
    expect(Math.abs(b)).toBeLessThan(1e-6); // no rotation component
    expect(a).toBeCloseTo(1, 3);
  }
  await page.mouse.up();

  await expect(column(page, "Learning").locator("article", { hasText: "Beta" })).toBeVisible();
  await expect(column(page, "Learning").getByText("1", { exact: true })).toBeVisible();
  await expect(column(page, "To read").getByText("2", { exact: true })).toBeVisible();
  await expect.poll(() => statusOf(userId, "Beta"), { timeout: 15_000 }).toBe("learning");
  await page.reload();
  await expect(column(page, "Learning").locator("article", { hasText: "Beta" })).toBeVisible();
});

test("keyboard: Space picks up, arrows move, Space drops, with announcements", async ({ page }) => {
  const userId = await boardWith(page, ["Alpha", "Beta", "Gamma"]);
  await keyDrag(page, "Alpha", ["ArrowDown", "ArrowDown"]);
  await expect(live(page)).toContainText("Alpha dropped in To read, position 3 of 3");

  // Order persisted: Alpha moved below the others.
  await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from("notebooks")
          .select("title, position")
          .eq("user_id", userId)
          .in("title", ["Alpha", "Beta", "Gamma"]);
        return (data ?? [])
          .sort((a, b) => (a.position < b.position ? -1 : 1))
          .map((n) => n.title)
          .join(",");
      },
      { timeout: 15_000 },
    )
    .toBe("Beta,Gamma,Alpha");

  // Across columns with the arrow keys.
  await keyDrag(page, "Gamma", ["ArrowRight"]);
  await expect(live(page)).toContainText("Gamma dropped in Learning, position 1 of 1");
  await expect.poll(() => statusOf(userId, "Gamma"), { timeout: 15_000 }).toBe("learning");

  // Escape cancels.
  await keyDrag(page, "Beta", ["ArrowRight"], "Escape");
  await expect(live(page)).toContainText("Move cancelled");
  await expect(column(page, "To read").locator("article", { hasText: "Beta" })).toBeVisible();
  expect(await statusOf(userId, "Beta")).toBe("to_read");
});

test("a failed move rolls back with an error toast", async ({ page }) => {
  const userId = await boardWith(page, ["Alpha", "Beta"]);
  // Server actions POST to the page with a Next-Action header: fail them.
  await page.route("**/app/notebooks**", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"]
      ? route.abort()
      : route.continue(),
  );
  await keyDrag(page, "Alpha", ["ArrowRight"]);
  await expect(
    page
      .getByRole("region", { name: /Notifications/ })
      .getByText(`Couldn't move "Alpha". Try again.`),
  ).toBeVisible();
  await expect(column(page, "To read").locator("article", { hasText: "Alpha" })).toBeVisible();
  expect(await statusOf(userId, "Alpha")).toBe("to_read");
});

test("reduced motion: sortable cards have no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await boardWith(page, ["Alpha", "Beta"]);
  await page.getByRole("button", { name: "Move Alpha" }).focus();
  await page.keyboard.press("Space");
  await expect(live(page)).toContainText("Picked up Alpha");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  const transitions = await page
    .locator("ol > li")
    .evaluateAll((items) => items.map((li) => (li as HTMLElement).style.transition));
  expect(transitions.every((t) => t === "" || t === "none")).toBe(true);
  await page.keyboard.press("Escape");
});

test("mobile: columns stack and nothing overflows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boardWith(page, ["Alpha"]);
  await expectNoHorizontalOverflow(page);
  const toRead = (await column(page, "To read").boundingBox())!;
  const learning = (await column(page, "Learning").boundingBox())!;
  expect(learning.y).toBeGreaterThan(toRead.y + toRead.height - 1); // stacked, not side by side
  await expectNoAxeViolations(page);
});
