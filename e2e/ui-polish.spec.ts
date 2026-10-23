import { test, expect, type Page } from "@playwright/test";
async function boot(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
  await page.goto("/");
}
test("direct game shortcuts return to the game; collection calendar returns to its origin", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#resume").click();
  await page.locator("#book-top").click();
  await page.locator("#collection-back").click();
  await expect(page.locator("#dialog")).toBeHidden();
  await page.locator("#jar-meter").click();
  await expect(page.locator(".jar-collection")).toBeVisible();
  await page.locator("#trophies-mode").click();
  await page.locator("[data-month]").first().click();
  await expect(page.locator(".calendar")).toBeVisible();
  await page.locator("#collection-back").click();
  await expect(page.locator("#trophies-mode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toBeHidden();
});
test("notebooks have meaningful selection, progress and a recoverable empty filter", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#book-mode").click();
  await page.locator('[data-volume="4"]').click();
  await expect(page.locator('[data-volume="4"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-volume="4"]')).toBeFocused();
  expect(await page.locator("[data-volume][style*=cover-hue]").count()).toBe(0);
  await expect(page.locator("[data-volume] progress")).toHaveCount(10);
  await page.locator("#book-filter").selectOption("done");
  await expect(page.locator("#book-filter-reset")).toBeVisible();
  await page.locator("#book-filter-reset").click();
  await expect(page.locator("[data-volume]")).toHaveCount(10);
});
test("compact calendar picker retains focus and dates, with usable day targets at 320px", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2028-06-20T12:00:00"));
  await page.setViewportSize({ width: 320, height: 568 });
  await boot(page);
  await page.locator("#calendar-open").click();
  await expect(page.locator("#today-task")).toBeInViewport();
  await expect(page.locator("#calendar-month")).toBeHidden();
  await page.locator("#calendar-picker summary").click();
  await page.locator("#calendar-year").selectOption("2025");
  await page.locator("#calendar-month").selectOption("01");
  await expect(page.locator("#calendar-month")).toBeFocused();
  await page.locator("#calendar-picker summary").click();
  await expect(page.locator('[data-game="daily-v1-2025-01-01"]')).toBeEnabled();
  const targets = await page
    .locator(".calendar .task")
    .evaluateAll((es) =>
      es.map((e) => ({
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })),
    );
  expect(targets.every((r) => r.w >= 44 && r.h >= 44)).toBe(true);
});
test("light and dark UI fits phones, landscape and large tablets", async ({
  page,
}) => {
  await boot(page);
  for (const dark of [false, true]) {
    await page.locator("#settings-open").click();
    await page.locator("#dark").setChecked(dark);
    await page.locator("#settings-back").click();
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [568, 320],
      [1280, 800],
    ]) {
      await page.setViewportSize({ width, height });
      for (const [entry, name] of [
        ["book-mode", "books"],
        ["calendar-open", "calendar"],
        ["progress-open", "progress"],
      ]) {
        await page.locator("#" + entry).click();
        expect(
          await page
            .locator("#dialog")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/ui-polish/${name}-${width}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
        await page.locator("#collection-back").click();
      }
      await page.locator("#resume").click();
      await page.screenshot({
        path: `test-results/ui-polish/game-${width}-${dark ? "dark" : "light"}.png`,
        animations: "disabled",
      });
      if (width === 1280) {
        const boxes = await page.evaluate(() => ({
          board: document
            .querySelector("#viewport")!
            .getBoundingClientRect()
            .toJSON(),
          controls: document
            .querySelector("footer")!
            .getBoundingClientRect()
            .toJSON(),
        }));
        expect(boxes.controls.x).toBeGreaterThan(boxes.board.right);
      }
      await page.locator("#menu").click();
    }
  }
});
test("collection tabs and settings remain readable with enlarged text and reduced motion", async ({
  page,
}) => {
  await boot(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#progress-open").click();
  await page.locator("#progress-trophies").click();
  for (const id of ["trophies-mode", "jars-tab"]) {
    await page.locator("#" + id).click();
    await page.evaluate(() => {
      for (const e of document.querySelectorAll<HTMLElement>("#collection *")) {
        e.style.fontSize =
          parseFloat(getComputedStyle(e).fontSize) * 1.5 + "px";
      }
    });
    expect(
      await page
        .locator("#dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/ui-polish/${id}-large-text.png`,
      animations: "disabled",
    });
  }
});
