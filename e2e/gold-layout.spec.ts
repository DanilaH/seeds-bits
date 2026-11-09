import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "test-results/gold-layout";
mkdirSync(out, { recursive: true });
async function seed(
  page: Page,
  o: {
    wallet?: number;
    active?: string;
    completed?: number;
    dark?: boolean;
    ads?: boolean;
    exhausted?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date("2026-11-09T12:00:00"));
  await page.addInitScript((o) => {
    if (!sessionStorage.gold) {
      sessionStorage.gold = "1";
      const active = o.active || "book-v1-1";
      const snap = {
        rules: 1,
        current: { board: [5, 5, 5, 5], moves: 0, additions: 0, scroll: 0 },
        history: [],
      };
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({
          tutorialDone: true,
          theme: o.dark ? "dark" : "light",
          reminders: true,
          vibration: true,
        }),
      );
      localStorage.setItem(
        "seeds-bits.progress.v2",
        JSON.stringify({
          version: 3,
          active,
          sessions: { [active]: snap },
          hints: {},
          done: Array.from(
            { length: o.completed || 0 },
            (_, i) => `daily-v1-2026-10-${String(i + 1).padStart(2, "0")}`,
          ),
          seen: [],
          meta: {
            version: 2,
            wallet: o.wallet ?? 4,
            since: "2026-10-01",
            completed: 0,
            unassisted: 0,
            attempts: {
              [active]: {
                id: "gold-test",
                completed: false,
                ...(o.exhausted
                  ? { hintKeys: ["used-a", "used-b", "used-c"] }
                  : {}),
              },
            },
          },
          jars: {
            version: 2,
            seeds: 340,
            meter: 320,
            wins: 3,
            attempt: "gold-test",
            highWater: 0,
          },
        }),
      );
    }
    const w = window as any;
    w.__SEEDS_ADS_TEST__ = {
      initialize: async () => ({ enabled: o.ads !== false, test: true }),
      addListener: async () => ({ remove: async () => {} }),
      preload: async () => {},
      banner: async () => {},
      pending: async () => ({}),
      acknowledge: async () => {},
      report: async () => {},
      show: async () => ({ status: "unavailable" }),
    };
    w.__SEEDS_ENGAGEMENT_TEST__ = {
      configuration: async () => ({ available: true, granted: true }),
      addListener: async () => ({ remove: async () => {} }),
    };
  }, o);
  await page.goto("/");
  await expect(page.locator("#resume")).toBeVisible();
}
async function pair(page: Page) {
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#skip")).toBeEnabled();
}
async function textOverflow(page: Page) {
  return page.evaluate(() => {
    const scope =
      document.querySelector<HTMLDialogElement>("dialog[open]") ||
      document.querySelector(".game")!;
    const failures: string[] = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (!text) continue;
      const el = node.parentElement!;
      if (
        !el.checkVisibility({ checkVisibilityCSS: true }) ||
        el.closest("svg, .trophy-confetti, select, [aria-hidden='true']")
      )
        continue;
      if (
        getComputedStyle(el).textOverflow === "ellipsis" &&
        getComputedStyle(el).overflow === "hidden"
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (
        el.classList.contains("action-label") &&
        parseFloat(getComputedStyle(el).fontSize) <= 14 &&
        range.getClientRects().length > 1
      )
        failures.push("wrapped action label: " + text);
      let block: HTMLElement | null = el;
      while (
        block &&
        ["inline", "contents"].includes(getComputedStyle(block).display)
      )
        block = block.parentElement;
      if (!block) continue;
      const box = block.getBoundingClientRect();
      if (!box.width) continue;
      for (const r of range.getClientRects()) {
        if (
          r.width > 0 &&
          (r.left < box.left - 1.1 || r.right > box.right + 1.1)
        ) {
          failures.push(
            `${block.id || block.className}: ${text.slice(0, 90)} (${Math.round(r.width)}/${Math.round(box.width)})`,
          );
          break;
        }
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 1)
      failures.push("document overflow");
    if (scope.scrollWidth > scope.clientWidth + 1)
      failures.push("scope overflow");
    return failures;
  });
}

test("counters stay on one line and the jar does not move at 100% or next jar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { wallet: 999999 });
  await page.locator("#resume").click();
  await expect(page.locator("#hint")).toHaveAttribute("aria-label", /1000002/);
  await expect(page.locator("#hint-count")).toHaveText("999+");
  await expect(page.locator("#hint .action-label")).toHaveText("Подсказка");
  await page.evaluate(() => {
    (window as any).jarBoxes = [];
    const end = performance.now() + 2300;
    const sample = () => {
      const jar = document.querySelector("#jar-glass")!.getBoundingClientRect();
      const caption = document
        .querySelector(".jar-caption")!
        .getBoundingClientRect();
      (window as any).jarBoxes.push([
        jar.x,
        jar.y,
        caption.x,
        caption.y,
        caption.width,
        caption.height,
      ]);
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    sample();
  });
  await pair(page);
  await pair(page);
  await expect(page.locator("#jar-meter")).toHaveAttribute("data-full", "true");
  await expect(page.locator("#jar-percent")).toHaveText("100%");
  await expect(page.locator("#jar-meter")).toHaveAttribute(
    "aria-label",
    /собрана/,
  );
  await expect(page.locator("#jar-name")).toHaveText("Баночка 5");
  await page.waitForTimeout(1200);
  const ranges = await page.evaluate(() => {
    const a = (window as any).jarBoxes as number[][];
    return a[0].map(
      (_, i) =>
        Math.max(...a.map((b) => b[i])) - Math.min(...a.map((b) => b[i])),
    );
  });
  // The glass has an intentional transform pop. Text geometry is entirely stable.
  expect(ranges.slice(2)).toEqual([0, 0, 0, 0]);
  expect(await textOverflow(page)).toEqual([]);
});

for (const [completed, tier] of [
  [6, 1],
  [13, 2],
  [30, 3],
])
  test(`saved daily target ${completed + 1} fills metal tier ${tier} once`, async ({
    page,
  }) => {
    await seed(page, { active: "daily-v1-2026-10-31", completed });
    await page.locator("#resume").click();
    await pair(page);
    await pair(page);
    await expect(page.locator(".trophy-confetti")).toHaveCount(1);
    await expect(page.locator(`#award [data-tier="${tier}"]`)).toHaveClass(
      /earned/,
    );
    await page.waitForTimeout(240); // Finish the result-sheet entrance; medal pop uses transforms only.
    const geometry = await page.locator("#award .trophy-marks").boundingBox();
    await expect(page.locator(".trophy-confetti")).toHaveCount(0);
    expect(await page.locator("#award .trophy-marks").boundingBox()).toEqual(
      geometry,
    );
    const ids = await page
      .locator("#award [id]")
      .evaluateAll((es) => es.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    await page.screenshot({
      path: `${out}/result-tier-${tier}.png`,
      animations: "disabled",
    });
    await page.reload();
    await page.locator("#resume").click();
    await page.waitForTimeout(1000);
    await expect(page.locator(".trophy-confetti")).toHaveCount(0);
    await expect(page.locator(`#award [data-tier="${tier}"]`)).toHaveClass(
      /earned/,
    );
  });

test("reduced motion keeps medals, no burst; failed save celebrates only after retry and cancels on navigation", async ({
  page,
}) => {
  await seed(page, { active: "daily-v1-2026-10-31", completed: 6 });
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    (window as any).failGold = true;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2" && (window as any).failGold)
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await pair(page);
  await pair(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator(".trophy-confetti")).toHaveCount(0);
  await page.evaluate(() => ((window as any).failGold = false));
  await page.locator("#retry-save").click();
  await expect(page.locator(".trophy-confetti")).toHaveCount(1);
  await page.locator("#menu").click();
  await expect(page.locator(".trophy-confetti")).toHaveCount(0);
});

test("all screens contain their text with ads, themes, narrow landscape and tablets", async ({
  browser,
}) => {
  test.setTimeout(240000);
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
      });
      const page = await context.newPage();
      await seed(page, { dark });
      const check = async (name: string) => {
        await page.waitForTimeout(60);
        const failures = await textOverflow(page);
        report.push({ width, height, dark, screen: name, failures });
        await page.screenshot({
          path: `${out}/${name}-${width}-${height}-${dark ? "dark" : "light"}.png`,
          animations: "disabled",
        });
      };
      await check("home");
      await page.locator("#settings-open").click();
      await check("settings");
      await page.locator("#privacy-open").click();
      await check("privacy");
      await page.locator("#privacy-back").click();
      await page.locator("#settings-back").click();
      await page.locator("#progress-open").click();
      await check("progress");
      await page.locator("#progress-trophies").click();
      await check("jars");
      await page.locator("#trophies-mode").click();
      await check("trophies");
      await page.locator("[data-month]").first().click();
      await check("calendar");
      await page.locator("#calendar-picker summary").click();
      await check("month-picker");
      for (let back = 0; back < 3; back++)
        await page.locator("#collection-back").click();
      await expect(page.locator("#menu-content")).toBeVisible();
      await page.locator("#book-mode").click();
      await check("books");
      await page.locator("#book-filter").selectOption("done");
      await check("book-empty");
      await page.locator("#book-filter-reset").click();
      await page.locator("#continue-book").click();
      await check("game");
      await pair(page);
      await pair(page);
      await check("result");
      await page.locator("#menu").click();
      await page.locator("#classic-mode").click();
      await check("classic");
      await context.close();
    }
  writeFileSync(`${out}/text-matrix.json`, JSON.stringify(report, null, 2));
  expect(report.filter((r) => r.failures.length)).toEqual([]);
});

test("reduced motion earns gold without particles and keeps the button reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { active: "daily-v1-2026-10-31", completed: 30 });
  await page.locator("#resume").click();
  await pair(page);
  await pair(page);
  await expect(page.locator('#award [data-tier="3"]')).toHaveClass(/earned/);
  await expect(page.locator(".trophy-confetti")).toHaveCount(0);
  await page.locator("#play-again").scrollIntoViewIfNeeded();
  await expect(page.locator("#play-again")).toBeInViewport();
  expect(await textOverflow(page)).toEqual([]);
});

test("enlarged text remains contained in screens and game controls", async ({
  browser,
}) => {
  const report: any[] = [];
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await seed(page, { wallet: 96 });
    const check = async (screen: string) => {
      await page.evaluate(() => {
        const scope =
          document.querySelector("dialog[open]") ||
          document.querySelector(".game")!;
        const fonts = [...scope.querySelectorAll<HTMLElement>("*")]
          .filter((e) => !e.closest("svg"))
          .map(
            (e) => [e, parseFloat(getComputedStyle(e).fontSize) * 1.5] as const,
          );
        for (const [e, size] of fonts) {
          e.dataset.goldFont = e.style.fontSize;
          e.style.fontSize = size + "px";
        }
      });
      const failures = await textOverflow(page);
      report.push({ width, height, screen, failures });
      await page.screenshot({
        path: `${out}/large-text-${screen}-${width}.png`,
        animations: "disabled",
      });
      await page.evaluate(() => {
        for (const e of document.querySelectorAll<HTMLElement>(
          "[data-gold-font]",
        )) {
          e.style.fontSize = e.dataset.goldFont!;
          delete e.dataset.goldFont;
        }
      });
    };
    await check("home");
    await page.locator("#settings-open").click();
    await check("settings");
    await page.locator("#settings-back").click();
    await page.locator("#progress-open").click();
    await check("progress");
    await page.locator("#progress-trophies").click();
    await page.locator("#trophies-mode").click();
    await check("trophies");
    await page.locator("[data-month]").first().click();
    await check("calendar");
    for (let i = 0; i < 3; i++) await page.locator("#collection-back").click();
    await page.locator("#resume").click();
    await check("game");
    await context.close();
  }
  writeFileSync(
    `${out}/large-text-matrix.json`,
    JSON.stringify(report, null, 2),
  );
  expect(report.filter((r) => r.failures.length)).toEqual([]);
});

test("hint offer, restart confirmation and every lesson contain their text", async ({
  browser,
}) => {
  const report: any[] = [];
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await seed(page, { active: "classic", wallet: 0, exhausted: true });
    const check = async (screen: string) => {
      const failures = await textOverflow(page);
      report.push({ width, height, screen, failures });
      await page.screenshot({
        path: `${out}/${screen}-${width}.png`,
        animations: "disabled",
      });
    };
    await page.locator("#resume").click();
    await page.locator("#hint").click();
    await expect(page.locator("#hint-offer")).toBeVisible();
    await check("hint-offer");
    await page.locator("#cancel-hints").click();
    await pair(page); // Restart confirmation belongs to a game with actual progress.
    await page.locator("#menu").click();
    await page.locator("#settings-open").click();
    await page.locator("#new").click();
    await check("restart-confirm");
    await page.locator("#cancel-new").click();
    await page.locator("#settings-back").click();
    await page.locator("#learn").click();
    let n = 0;
    for (const [a, b] of [
      [0, 1],
      [0, 1],
      [0, 3],
      [0, 20],
      [8, 9],
    ]) {
      await check("lesson-" + ++n);
      await page.locator(`[data-index="${a}"]`).click();
      await page.locator(`[data-index="${b}"]`).click();
      await page.locator("#lesson-next").click();
    }
    await check("lesson-6");
    await page.locator("#add").click();
    await page.locator("#undo").click();
    await page.locator("#lesson-next").click();
    await context.close();
  }
  writeFileSync(`${out}/other-states.json`, JSON.stringify(report, null, 2));
  expect(report.filter((r) => r.failures.length)).toEqual([]);
});

test("two reward lines keep their space while a failed save is retried", async ({
  page,
}) => {
  await seed(page, { active: "daily-v1-2026-11-09" });
  await page.evaluate(() => {
    const key = "seeds-bits.progress.v2",
      p = JSON.parse(localStorage.getItem(key)!);
    const prefs = "seeds-bits.settings.v1";
    localStorage.setItem(
      prefs,
      JSON.stringify({
        ...JSON.parse(localStorage.getItem(prefs)!),
        reminders: false,
      }),
    );
    p.meta.daily = { lastDay: "2026-11-08", count: 6, best: 6, reward: 0 };
    p.done = Array.from({ length: 6 }, (_, i) => `daily-v1-2026-11-0${i + 3}`);
    localStorage.setItem(key, JSON.stringify(p));
  });
  await page.reload();
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    (window as any).failGold = true;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2" && (window as any).failGold)
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await pair(page);
  await pair(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await page.waitForTimeout(250);
  const position = () =>
    page.evaluate(() => {
      const b = document.querySelector("#play-again")!.getBoundingClientRect(),
        w = document.querySelector("#win")!.getBoundingClientRect();
      return b.top - w.top;
    });
  const before = await position();
  await page.evaluate(() => ((window as any).failGold = false));
  await page.locator("#retry-save").click();
  await expect(page.locator("#result-gains")).toContainText("+3 подсказки");
  await expect(page.locator("#play-again")).toBeInViewport({ ratio: 1 });
  expect(Math.abs((await position()) - before)).toBeLessThan(1);
});
