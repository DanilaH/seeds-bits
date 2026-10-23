import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
test.use({ screenshot: "only-on-failure" });
const out = "test-results/composition";
mkdirSync(out, { recursive: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("seeds-bits.settings.v1"))
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
  });
});
test("root home has one classic entry, pause has an explicit return, and wide home uses two columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("#close")).toBeHidden();
  await expect(page.locator("#classic-mode")).toBeHidden();
  await expect(page.locator("#resume")).toContainText("классику");
  const a = await page.locator(".home-current").boundingBox(),
    b = await page.locator(".home-modes").boundingBox();
  expect(a!.width).toBeGreaterThan(400);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toBeVisible();
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  await expect(page.locator("#close")).toBeVisible();
  await page.locator("#close").click();
  await expect(page.locator("#dialog")).toBeHidden();
});
test("notebook continuation precedes selectors, with two page columns on tablets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("#book-mode").click();
  await expect(page.locator("#continue-book")).toBeInViewport();
  const c = await page.locator("#continue-book").boundingBox(),
    f = await page.locator("#book-chapter").boundingBox();
  expect(c!.y + c!.height).toBeLessThan(f!.y);
  const pages = page.locator(".book-page"),
    a = await pages.nth(0).boundingBox(),
    b = await pages.nth(1).boundingBox();
  expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  await page.locator("#continue-book").click();
  await expect(page.locator("#mode")).toContainText("задача 1");
});
test("progress has a meaningful jar figure and reachable continuation, switches show binary states", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#progress-open").click();
  await expect(page.locator(".progress-hero .jar-glass")).toBeVisible();
  await expect(page.locator(".hero-value")).toContainText("0");
  await page.locator("#progress-book").click();
  await expect(page.locator("#continue-book")).toBeVisible();
  await page.locator("#collection-back").click();
  await page.locator("#collection-back").click();
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await expect(page.locator("#dark")).toBeChecked();
  await expect(page.locator("#dark")).toHaveAttribute("role", "switch");
  const geometry = await page.locator("#dark").evaluate((e) => {
    const s = getComputedStyle(e, "::after");
    return {
      width: e.getBoundingClientRect().width,
      height: e.getBoundingClientRect().height,
      thumb: parseFloat(s.width),
      left: parseFloat(s.left),
      translate: new DOMMatrix(s.transform).m41,
    };
  });
  expect(
    geometry.left + geometry.translate + geometry.thumb,
  ).toBeLessThanOrEqual(geometry.width);
  expect(geometry.width).toBeGreaterThan(geometry.height);
});
test("home, archive, progress and play remain readable across portrait, landscape and themes", async ({
  browser,
}) => {
  const report: any[] = [];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [568, 320],
    [844, 390],
    [768, 1024],
    [1280, 800],
  ])
    for (const dark of [false, true]) {
      const context = await browser.newContext({
          viewport: { width, height },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      await page.addInitScript(
        (dark) =>
          localStorage.setItem(
            "seeds-bits.settings.v1",
            JSON.stringify({
              tutorialDone: true,
              theme: dark ? "dark" : "light",
            }),
          ),
        dark,
      );
      await page.goto("/");
      const capture = async (name: string) => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `${out}/${name}-${width}-${height}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
      };
      await expect(page.locator("#settings-open")).toBeInViewport();
      await expect(page.locator("#resume")).toBeInViewport();
      await capture("home");
      await page.locator("#book-mode").click();
      await capture("books");
      await page.locator("#continue-book").click();
      await expect(page.locator("#dialog")).toBeHidden();
      await capture("task");
      await page.locator("#menu").click();
      await expect(page.locator("#settings-open")).toBeInViewport();
      await capture("pause");
      await page.locator("#progress-open").click();
      await capture("progress");
      report.push({ width, height, dark });
      await context.close();
    }
  writeFileSync(out + "/screens.json", JSON.stringify(report, null, 2));
});
