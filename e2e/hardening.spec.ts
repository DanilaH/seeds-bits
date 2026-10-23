import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
});
test("a valid move is saved before its animation finishes", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const original = window.setTimeout;
    window.setTimeout = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) =>
      original(
        callback,
        delay === 100 ? 10000 : delay,
        ...args,
      )) as typeof setTimeout;
    (document.querySelector('[data-index="0"]') as HTMLElement).click();
    (document.querySelector('[data-index="9"]') as HTMLElement).click();
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("seeds-bits.progress.v2") || "{}")
              .sessions?.classic?.current?.moves,
        ),
      { timeout: 1500 },
    )
    .toBe(1);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
});
test("escape steps back from collections and settings without discarding game", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#resume")).toBeVisible();
  await page.locator("#settings-open").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#resume")).toBeVisible();
  await page.keyboard.press("Escape");
  // The startup home is a destination; only a pause menu dismisses to play.
  await expect(page.locator("#resume")).toBeVisible();
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#resume")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#board")).toBeVisible();
});
test("dead end restart can be cancelled and undo recovers the board", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.progress.v2",
      JSON.stringify({
        version: 2,
        active: "book-v1-1",
        sessions: {
          "book-v1-1": {
            rules: 1,
            current: { board: [1, 2], scroll: 0, moves: 1, additions: 0 },
            history: [
              { board: [1, 2, 5, 5], scroll: 0, moves: 0, additions: 0 },
            ],
          },
        },
        hints: {},
        done: [],
        seen: [],
      }),
    ),
  );
  await page.goto("/");
  await page.locator("#resume").click();
  await expect(page.locator("#restart-task")).toBeVisible();
  await page.locator("#restart-task").click();
  await page.locator("#cancel-new").click();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await expect(page.locator("#restart-task")).toBeHidden();
});
test("obsolete damaged save does not override current progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.evaluate(() =>
    localStorage.setItem("seeds-bits.session.v1", "broken"),
  );
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
});
test("failed storage is visible and retry preserves the accepted move", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () =>
      (Storage.prototype.setItem = original);
    Storage.prototype.setItem = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#retry-save")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Не удалось сохранить");
  await page.evaluate(() => (window as any).restoreStorage());
  await page.locator("#retry-save").click();
  await expect(page.locator("#retry-save")).toBeHidden();
  await expect(page.locator("#status")).toHaveText("Партия сохранена");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
});
test("large classic board survives repeated moves, mode changes and reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("seeds-bits.progress.v2")) return;
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: {
          board: Array(1800).fill(1),
          scroll: 0,
          moves: 0,
          additions: 0,
        },
        history: [],
      }),
    );
  });
  await page.goto("/");
  await page.locator("#resume").click();
  for (let n = 0; n < 30; n++) {
    await page.locator("#board button").nth(0).click();
    await page.locator("#board button").nth(1).click();
    await expect(page.locator("#remaining")).toHaveText(
      String(1800 - (n + 1) * 2),
    );
  }
  await page.locator("#viewport").evaluate((el) => (el.scrollTop = 1200));
  await page.locator("#book-top").click();
  await page.locator('[data-game="book-v1-1"]').click();
  await page.locator("#menu").click();
  await page.locator("#classic-mode").click();
  await expect(page.locator("#remaining")).toHaveText("1740");
  expect(
    await page.locator("#viewport").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(1100);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("1740");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("1742");
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
