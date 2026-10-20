import { test, expect } from "@playwright/test";
const key = "seeds-bits.progress.v2";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    if (!localStorage.getItem("seeds-bits.progress.v2"))
      localStorage.setItem(
        "seeds-bits.progress.v2",
        JSON.stringify({
          version: 2,
          active: "classic",
          sessions: {
            classic: {
              rules: 1,
              current: { board: [5, 5], moves: 0, additions: 0, scroll: 0 },
              history: [],
            },
          },
          hints: {},
          done: ["book-v1-1"],
          seen: [],
        }),
      );
  });
});
test("win and reload count one attempt and preserve migrated progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#undo")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).meta.completed,
        key,
      ),
    )
    .toBe(1);
  await page.reload();
  await page.locator("#progress-open").click();
  await expect(page.locator(".progress-stats dd")).toHaveText([
    "1 из 2400",
    "0",
    "1",
    "1",
  ]);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/meta-progress.png",
  });
});
test("small screens and enlarged text keep menu and progress reachable", async ({
  page,
}) => {
  await page.goto("/");
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [568, 320],
    [600, 320],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#progress-open").click();
    await expect(page.locator("#progress-trophies")).toBeVisible();
    expect(
      await page
        .locator("#dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.locator("#collection-back").click();
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: "html {font-size: 150% !important}" });
  await page.locator("#progress-open").click();
  await page.locator("#progress-trophies").click();
  await expect(page.locator("#collection h2")).toHaveText("Мои трофеи");
  await page.locator("#collection-back").click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/meta-menu-small.png",
  });
});
test("midnight refresh opens new today and preserves an earlier daily", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T23:59:59") });
  await page.goto("/");
  await page.locator("#daily-mode").click();
  await expect(page.locator("#mode")).toContainText("20");
  await page.clock.fastForward(2000);
  await page.locator("#menu").click();
  await page.locator("#calendar-open").click();
  await expect(page.locator('[data-game="daily-v1-2026-10-21"]')).toBeEnabled();
  await page.locator("#collection-back").click();
  await page.locator("#daily-mode").click();
  await expect(page.locator("#mode")).toContainText("21");
  expect(
    await page.evaluate(
      (k) => Object.keys(JSON.parse(localStorage.getItem(k)!).sessions),
      key,
    ),
  ).toContain("daily-v1-2026-10-20");
});

test("failed result save blocks next party; retry persists one result", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreWrites = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2") throw Error("full");
      original.call(this, k, v);
    };
  });
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#retry-save")).toBeVisible();
  await page.locator("#play-again").click();
  await expect(page.locator("#play-again")).toBeEnabled();
  await expect(page.locator("#win")).toBeVisible();
  await page.evaluate(() => (window as any).restoreWrites());
  await page.locator("#retry-save").click();
  await expect(page.locator("#retry-save")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).meta.completed,
        key,
      ),
    )
    .toBe(1);
  await page.locator("#play-again").evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.locator("#remaining")).toHaveText("28");
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).meta.completed,
        key,
      ),
    )
    .toBe(1);
});
