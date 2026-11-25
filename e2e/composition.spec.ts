import { openBookPicker, chooseBookVolume } from "./book-controls";
import { openClassicNew } from "./restore-game";
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
test("wide Home displays all modes and uses an explicit return",async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto("/");
  await expect(page.locator("#resume")).toBeHidden();
  for(const id of ["classic-mode","book-mode","daily-mode"]) await expect(page.locator("#"+id)).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toBeVisible();
  await openClassicNew(page,1);
  await page.locator("#menu").click();
  await expect(page.locator("#close")).toHaveCount(0);
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
});
test("tablet notebook has one 24-task grid and separate picker",async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto("/");
  await page.locator("#book-mode").click();
  await expect(page.locator("#continue-book")).toBeInViewport();
  await expect(page.locator(".compact-task-grid button")).toHaveCount(24);
  await chooseBookVolume(page,1);
  await expect(page.locator(".dialog-head .screen-heading h2")).toContainText("2");
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
      await expect(page.locator("#classic-mode")).toBeInViewport();
      await page.locator("#settings-open").scrollIntoViewIfNeeded();
      await expect(page.locator("#settings-open")).toBeInViewport();
      await capture("home");
      await page.locator("#book-mode").click();
      await capture("books");
      await page.locator("#continue-book").click();
      await expect(page.locator("#dialog")).toBeHidden();
      await capture("task");
      await page.locator("#menu").click();
      await expect(page.locator("#close")).toHaveCount(0);
      await expect(page.locator("#resume")).toBeInViewport();
      await capture("pause");
      if (!dark && width <= 390) {
        // Simulate enlarged text without changing the viewport or the hit target.
        const title = page.locator(".home-title h1");
        const size = await title.evaluate(el => getComputedStyle(el).fontSize);
        await title.evaluate((el, size) => {el.style.fontSize = (parseFloat(size) * 2) + "px";}, size);
        const bounds = await title.evaluate(el => {
          const text = document.createRange();
          text.selectNodeContents(el);
          const lines = text.getClientRects();
          const close = document.getElementById("dialog")!.getBoundingClientRect();
          return {lines:lines.length, textRight:text.getBoundingClientRect().right, closeLeft:close.right};
        });
        expect(bounds.lines).toBe(1);
        expect(bounds.textRight).toBeLessThanOrEqual(bounds.closeLeft);
        await title.evaluate(el => {el.style.fontSize = "";});
      }
      await page.locator("#progress-open").click();
      await capture("progress");
      report.push({ width, height, dark });
      await context.close();
    }
  writeFileSync(out + "/screens.json", JSON.stringify(report, null, 2));
});
