import { test, expect } from "@playwright/test";
const key = "seeds-bits.progress.v2";
async function start(page: any, seeds = 0) {
  await page.addInitScript(
    ({ key, seeds }: any) => {
      if (sessionStorage.getItem("050")) return;
      sessionStorage.setItem("050", "1");
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          active: "classic",
          sessions: {
            classic: {
              rules: 1,
              current: {
                board: [5, 5, 5, 5],
                moves: 0,
                additions: 0,
                scroll: 0,
              },
              history: [],
            },
          },
          hints: {},
          done: ["book-v1-1"],
          seen: [],
          meta: {
            version: 1,
            since: "2026-10-20",
            attempts: { classic: { id: "test", completed: false } },
            completed: 0,
            unassisted: 0,
          },
          jars: { version: 1, seeds, wins: 0, attempt: "test", highWater: 0 },
        }),
      );
    },
    { key, seeds },
  );
  await page.goto("/");
}
async function pair(page: any) {
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#undo")).toBeEnabled();
}
test("jar fills with flights, never blocks next move, survives undo/reload and records one win", async ({
  page,
}) => {
  await start(page, 22);
  await page.locator("#resume").click();
  await pair(page);
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.locator("#undo").click();
  await pair(page);
  await pair(page);
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#jar-percent")).toContainText("2/60");
  await expect(page.locator("footer")).toBeHidden();
  await page.reload();
  await page.locator("#resume").click();
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(p.jars.seeds).toBe(26);
  expect(p.jars.wins).toBe(1);
  expect(p.version).toBe(4);
  await expect(page.locator("#jar-percent")).toContainText("2/60");
  await page.locator("#jar-meter").click();
  await expect(page.locator(".jar-keepsake")).toHaveCount(1);
});
test("archive exposes January 2025 and keeps future dates closed in 2028", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2028-06-20T12:00:00"));
  await start(page);
  await page.locator("#calendar-open").click();
  await page.locator("#calendar-year").selectOption("2025");
  await page.locator("#calendar-month").selectOption("01");
  await expect(page.locator('[data-game="daily-v1-2025-01-01"]')).toBeEnabled();
  await page.locator('[data-game="daily-v1-2025-01-01"]').click();
  await expect(page.locator("#dialog")).toBeHidden();
  await page.locator("#menu").click();
  await page.locator("#calendar-open").click();
  await expect(
    page.locator('[data-game="daily-v1-2028-06-21"]'),
  ).toBeDisabled();
  await page.locator("#collection-back").click();
  await page.locator("#trophies-mode").click();
  await page.locator("#trophy-year").selectOption("2025");
  await expect(page.locator("[data-month]")).toHaveCount(12);
});
test("100 notebooks remain navigable and final huge board has legible digits, working hints and undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  await page.locator("#book-mode").click();
  await expect(page.locator('[data-game="book-v1-1"].task')).toHaveClass(
    /done/,
  );
  await page.locator("#book-chapter").selectOption("9");
  await page.locator('[data-volume="99"]').click();
  await page.locator('[data-game="book-v1-2400"]').click();
  await expect(page.locator("#dialog")).toBeHidden();
  const n = Number(await page.locator("#remaining").textContent());
  expect(n).toBeGreaterThan(400);
  expect(
    await page
      .locator("#board button")
      .first()
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(20);
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  const ids = await page
    .locator(".hinted")
    .evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.index));
  await page.evaluate(
    (ids) =>
      ids.forEach((i) =>
        (document.querySelector(`[data-index="${i}"]`) as HTMLElement).click(),
      ),
    ids,
  );
  await expect(page.locator("#remaining")).toHaveText(String(n - 2));
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText(String(n));
  await page.locator("#viewport").evaluate((e) => (e.scrollTop = 1200));
  await page.locator("#menu").click();
  await page.locator("#resume").click();
  expect(
    await page.locator("#viewport").evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(1100);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(n));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/050-large.png" });
});
test("reduced motion suppresses flight frames and small classic layout stays usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page, 12);
  await page.locator("#resume").click();
  await pair(page);
  await expect(page.locator("#jar-percent")).toContainText("14/24");
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  expect(
    await page.locator("#viewport").evaluate((e) => e.clientHeight),
  ).toBeGreaterThan(100);
  await page.screenshot({ path: "test-results/050-classic.png" });
});
test("decorative seed flights stay bounded and clear on background without losing earned seeds", async ({
  page,
}) => {
  await start(page);
  await page.locator("#resume").click();
  await page.evaluate(() => {
    (document.querySelector('[data-index="0"]') as HTMLElement).click();
    (document.querySelector('[data-index="1"]') as HTMLElement).click();
  });
  await expect(page.locator(".flying-seed")).toHaveCount(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      get: () => true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".flying-seed")).toHaveCount(0);
  await expect(page.locator("#jar-percent")).toContainText("2/24");
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).jars.seeds,
        key,
      ),
    )
    .toBe(2);
});
