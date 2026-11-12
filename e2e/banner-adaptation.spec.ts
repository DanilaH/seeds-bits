import { test, expect } from "@playwright/test";
import { openBannerFixture } from "../scripts/banner-layout-fixture.mjs";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 866 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
])
  for (const dark of [false, true])
    test(`compact banner and late notebook fit ${viewport.width}x${viewport.height}, ${dark ? "dark" : "light"}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openBannerFixture(page, { dark });
      await expect(page.locator("#remaining")).toHaveText("212");
      await expect(page.locator("#ad-space")).toHaveCSS("height", "50px");
      for (const zoom of [false, true]) {
        if (zoom)
          await page.addStyleTag({
            content: "body {font-size:22px} .action-label {font-size:20px}",
          });
        for (const id of ["undo", "hint"]) {
          await page.locator(`#${id}`).scrollIntoViewIfNeeded();
          await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 1 });
        }
        // In this cramped case both controls must be visible together, rather
        // than being reachable only one at a time through a scrolling sidebar.
        if (viewport.height === 320 && zoom) {
          await expect(page.locator("#undo")).toBeInViewport({ ratio: 1 });
          await expect(page.locator("#hint")).toBeInViewport({ ratio: 1 });
          expect(
            await page
              .locator(".game-actions")
              .evaluate(
                (panel) => panel.scrollHeight <= panel.clientHeight + 1,
              ),
          ).toBe(true);
        }
        const g = await page.evaluate(() => {
          const rect = (s: string) =>
            document.querySelector(s)!.getBoundingClientRect().toJSON();
          return {
            ad: rect("#ad-space"),
            footer: rect("footer"),
            viewport: rect("#viewport"),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        await page.screenshot({
          path: `test-results/banner-adaptation/${viewport.width}-${viewport.height}-${dark ? "dark" : "light"}-${zoom ? "large" : "normal"}.png`,
        });
        expect(g.ad.bottom).toBeLessThanOrEqual(viewport.height - 24);
        expect(g.footer.bottom).toBeLessThanOrEqual(g.ad.y - 7);
        expect(g.viewport.height).toBeGreaterThan(60);
        expect(g.overflow).toBeLessThanOrEqual(1);
      }
    });

test("navigation inset is counted once above the compact ad", async ({
  page,
}) => {
  await openBannerFixture(page);
  const bottoms: number[] = [];
  for (const inset of [0, 48]) {
    await page.evaluate(
      (inset) =>
        document.documentElement.style.setProperty(
          "--safe-area-inset-bottom",
          `${inset}px`,
        ),
      inset,
    );
    await expect
      .poll(() => page.evaluate(() => (window as any).bannerCalls.at(-1)?.y))
      .toBe(844 - inset - 4 - 50);
    bottoms.push(
      (await page.locator("footer").boundingBox())!.y +
        (await page.locator("footer").boundingBox())!.height,
    );
  }
  expect(bottoms[0] - bottoms[1]).toBeCloseTo(48, 0);
});

test("native CSS height follows WebView scaling, including sizes below 45 CSS px", async ({
  page,
}) => {
  await openBannerFixture(page);
  for (const height of [40, 80, 50]) {
    await page.evaluate(
      (height) => (window as any).bannerSizeListener({ height }),
      height,
    );
    await expect(page.locator("#ad-space")).toHaveCSS("height", `${height}px`);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
      )
      .toBe(true);
    const ad = await page.locator("#ad-space").boundingBox();
    const footer = await page.locator("footer").boundingBox();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(ad!.y - 7);
  }
});

test("without ads the controls use only the system inset and ordinary footer padding", async ({
  page,
}) => {
  await openBannerFixture(page, { ads: false });
  await expect(page.locator("#ad-space")).toBeHidden();
  const bottoms: number[] = [];
  for (const inset of [0, 48]) {
    await page.evaluate(
      (inset) =>
        document.documentElement.style.setProperty(
          "--safe-area-inset-bottom",
          `${inset}px`,
        ),
      inset,
    );
    const footer = await page.locator("footer").boundingBox();
    bottoms.push(footer!.y + footer!.height);
  }
  expect(bottoms[0] - bottoms[1]).toBeCloseTo(48, 0);
  expect(bottoms[1]).toBeCloseTo(844 - 48, 0);
});
