import { test, expect } from "@playwright/test";
import { notebook, daily } from "../src/puzzles";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
});
test("notebook solution, page stamp, replay and classic restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  for (let n = 0; n < 6; n++) {
    if (n === 0) {
      await page.locator("#book-top").click();
      await page.locator(`[data-game="${notebook[n].id}"]`).click();
    }
    for (const p of notebook[n].solution) {
      await page.locator(`[data-index="${p.a}"]`).click();
      await page.locator(`[data-index="${p.b}"]`).click();
      await expect(page.locator("#undo")).toBeEnabled();
    }
    await expect(page.locator("#win")).toBeVisible();
    if (n < 5) await page.locator("#play-again").click();
  }
  await expect(page.locator("#award")).toContainText("Страница 1 завершена");
  await page.locator("#book-top").click();
  await expect(page.locator(".stamp")).toHaveText("Завершено ✓");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/notebook.png",
  });
  await page.locator("#collection-back").click();
  await page.locator("#classic-mode").click();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.reload();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.locator("#menu").click();
  await page.locator("#book-mode").click();
  await expect(page.locator(".task.done")).toHaveCount(6);
});
test("hint remains after first choice and settings apply", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hint").click();
  const a = page.locator(".hinted").first();
  await a.click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/game-light-v2.png",
  });
  await page.locator("#menu").click();
  await page.locator("#dark").check();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/menu-dark-v2.png",
  });
  await page.locator("#close").click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/game-dark-v2.png",
  });
});
test("daily calendar closes future days and persists trophy", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-15T12:00:00"));
  await page.goto("/");
  await page.locator("#menu").click();
  await page.locator("#daily-mode").click();
  await expect(
    page.locator('[data-game="daily-v1-2026-10-16"]'),
  ).toBeDisabled();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/calendar.png",
  });
  await page.locator('[data-game="daily-v1-2026-10-01"]').click();
  for (const p of daily("2026-10-01").solution) {
    await page.locator(`[data-index="${p.a}"]`).click();
    await page.locator(`[data-index="${p.b}"]`).click();
    await expect(page.locator("#undo")).toBeEnabled();
  }
  await expect(page.locator("#award")).toContainText("1 из 31");
  await page.reload();
  await expect(page.locator("#win")).toBeVisible();
  await page.locator("#play-again").click();
  await expect(page.locator('[data-game="daily-v1-2026-10-01"]')).toHaveClass(
    /done/,
  );
});
test("quick onboarding ends after two exercises", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.removeItem("seeds-bits.settings.v1"),
  );
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await page.locator("#lesson-next").click();
  }
  await expect(page.locator("#lesson")).toBeHidden();
  await expect(page.locator("#remaining")).toHaveText("28");
});
test("long hint navigates without losing selection", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: {
          board: [1, ...Array(269).fill(0), 1],
          scroll: 0,
          moves: 0,
          additions: 0,
        },
        history: [],
      }),
    ),
  );
  await page.goto("/");
  await page.locator("#hint").click();
  await page.locator('[data-index="0"]').click();
  await expect(page.locator("#hint-jump")).toBeVisible();
  await page.locator("#hint-jump").click();
  await page.locator('[data-index="270"]').click();
  await expect(page.locator("#win")).toBeVisible();
});
test("bronze trophy survives replay, widths and dark calendar", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-15T12:00:00"));
  await page.addInitScript(() => {
    if (localStorage.getItem("seeds-bits.progress.v2")) return;
    localStorage.setItem(
      "seeds-bits.progress.v2",
      JSON.stringify({
        version: 2,
        active: "classic",
        sessions: {
          classic: {
            rules: 1,
            current: { board: [5, 5], scroll: 0, moves: 0, additions: 0 },
            history: [],
          },
        },
        hints: {},
        done: Array.from({ length: 7 }, (_, i) => `daily-v1-2026-10-0${i + 1}`),
        seen: [],
      }),
    );
  });
  await page.goto("/");
  await page.locator("#menu").click();
  await page.locator("#trophies-mode").click();
  await expect(page.locator(".tier-1")).toContainText("Бронза");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/trophy-bronze.png",
  });
  await page.locator(".trophy").click();
  await expect(page.locator(".task.done")).toHaveCount(7);
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    expect(
      await page
        .locator("#dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.locator("#close").click();
  await page.locator("#menu").click();
  await page.locator("#dark").check();
  await page.locator("#daily-mode").click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/calendar-dark.png",
  });
});
