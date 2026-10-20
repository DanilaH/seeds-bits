import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [568, 320],
  [667, 375],
  [844, 390],
  [1024, 600],
  [1280, 800],
]) {
  test(`landscape ${width}x${height}: readable board, scroll, results and rotation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("landscape")) return;
      sessionStorage.setItem("landscape", "1");
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
      localStorage.setItem(
        "seeds-bits.session.v1",
        JSON.stringify({
          rules: 1,
          current: {
            board: Array(540).fill(5),
            moves: 0,
            additions: 0,
            scroll: 0,
          },
          history: [],
        }),
      );
    });
    await page.goto("/");
    await page.locator("#resume").click();
    const geometry = await page.evaluate(() => {
      const v = document.querySelector("#viewport")!.getBoundingClientRect();
      const c = document.querySelector(".cell")!.getBoundingClientRect();
      const f = document.querySelector("footer")!.getBoundingClientRect();
      return {
        height: v.height,
        cell: c.width,
        bottom: f.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.cell).toBeGreaterThanOrEqual(36);
    expect(geometry.bottom).toBeLessThanOrEqual(height);
    if (width >= 540 && height <= 600)
      expect(geometry.height).toBeGreaterThan(height - 40);
    await page
      .locator("#viewport")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(page.locator('[data-index="539"]')).toBeInViewport();
    await page.locator('[data-index="538"]').click();
    await page.locator('[data-index="539"]').click();
    await expect(page.locator("#remaining")).toHaveText("538");
    await expect(page.locator("#undo")).toBeEnabled();
    await page.locator("#undo").click();
    await expect(page.locator("#remaining")).toHaveText("540");
    await page.screenshot({ path: `test-results/landscape-${width}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#undo")).toBeInViewport();
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      const k = "seeds-bits.progress.v2",
        p = JSON.parse(localStorage.getItem(k)!);
      p.sessions.classic.current.board = [5, 5];
      p.sessions.classic.history = [];
      localStorage.setItem(k, JSON.stringify(p));
    });
    await page.reload();
    await page.locator("#resume").click();
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#win-stats")).toBeVisible();
    await expect(page.locator("footer")).toBeHidden();
    await page.locator("#play-again").scrollIntoViewIfNeeded();
    await expect(page.locator("#play-again")).toBeInViewport();
    await page.screenshot({ path: `test-results/result-${width}.png` });
    await page.locator("#play-again").click();
    await expect(page.locator("footer")).toBeVisible();
  });
}
