import { test, expect } from "@playwright/test";
const KEY = "seeds-bits.progress.v2";
const snapshot = (board: number[]) => ({
  board,
  scroll: 0,
  moves: 0,
  additions: 0,
});
const state = () => ({
  version: 2,
  active: "classic",
  sessions: { classic: { rules: 1, current: snapshot([5, 5]), history: [] } },
  done: ["book-v1-1"],
  seen: [],
  hints: {},
  meta: {
    version: 1,
    since: "2026-10-20T00:00:00Z",
    attempts: { classic: { id: "audit-1", completed: false } },
    completed: 5,
    unassisted: 3,
  },
});
async function seed(page: any, p: any = state()) {
  await page.addInitScript(
    ({ key, p }: any) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "yes");
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true }),
        );
        localStorage.setItem(key, JSON.stringify(p));
      }
    },
    { key: KEY, p },
  );
}
async function data(page: any) {
  return page.evaluate(
    (k: string) => JSON.parse(localStorage.getItem(k)!),
    KEY,
  );
}
async function pair(page: any) {
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#undo")).toBeEnabled();
}
// These are independent expectations; failures are audit findings, not release tests to relax.
test("A01 damage isolated to metadata does not discard valid tasks and boards", async ({
  page,
}) => {
  const p = state();
  p.meta.completed = -1;
  await seed(page, p);
  await page.goto("/");
  await page.locator("#progress-open").click();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k + ".recovery")!).done,
      KEY,
    ),
  ).toEqual(["book-v1-1"]);
  console.log("CORRUPT_META", await page.locator("#collection").innerText());
  await page.screenshot({
    animations: "disabled",
    path: "test-results/repairs041/corrupt-meta.png",
  });
  await expect(page.locator(".progress-stats dd").first()).toHaveText(
    "1 из 2400",
  );
});
test("A02 unsupported future metadata is not overwritten by ordinary interaction", async ({
  page,
}) => {
  const p = state();
  p.meta.version = 99;
  await seed(page, p);
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await page.waitForTimeout(300);
  const actual = await data(page);
  console.log("FUTURE_SCHEMA", actual.meta);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k + ".recovery")!).meta.version,
      KEY,
    ),
  ).toBe(99);
  expect(actual.meta.version).toBe(99);
});
test("A03 failed save must not open a newly selected task as if persisted", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2") throw Error("quota");
      orig.call(this, k, v);
    };
  });
  await page.locator("#book-mode").click();
  await page.locator('[data-game="book-v1-2"]').click();
  await page.waitForTimeout(200);
  console.log("SWITCH_FAILURE", {
    mode: await page.locator("#mode").textContent(),
    saved: (await data(page)).active,
    warning: await page.locator("#save-notice").innerText(),
  });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/repairs041/switch-save-failed.png",
  });
  await expect(page.locator("#dialog")).toBeVisible();
});
test("A04 finished result, reload and restart count exactly once per attempt", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.locator("#resume").click();
  await pair(page);
  await expect(page.locator("#undo")).toBeHidden();
  await expect(page.locator("#win-stats")).toBeVisible();
  await page.reload();
  await page.locator("#progress-open").click();
  await expect(page.locator(".progress-stats dd")).toHaveText([
    "1 из 2400",
    "0",
    "6",
    "4",
  ]);
  await page.locator("#close").click();
  await page.locator("#play-again").click();
  await expect(page.locator("#remaining")).toHaveText("28");
  expect((await data(page)).meta.attempts.classic.completed).toBe(false);
  expect((await data(page)).meta.completed).toBe(6);
});
test("A05 record of solved daily remains in statistics when device clock moves backward", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00"));
  const p = state();
  p.done.push("daily-v1-2026-10-20");
  await seed(page, p);
  await page.goto("/");
  await page.locator("#progress-open").click();
  console.log(
    "CLOCK_ROLLBACK",
    await page.locator(".progress-stats").innerText(),
  );
  await expect(page.locator(".progress-stats dd").nth(1)).toHaveText("1");
});
test("A06 midnight calendar refresh preserves keyboard focus on the current control", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T23:59:59") });
  await seed(page);
  await page.goto("/");
  await page.locator("#calendar-open").click();
  await page.locator('[data-game="daily-v1-2026-10-10"]').focus();
  await page.clock.fastForward(2000);
  expect(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("data-game"),
    ),
  ).toBe("daily-v1-2026-10-10");
});
test("A07 completed first notebook leads to next volume and keeps reachable replay and never awards unique progress twice", async ({
  page,
}) => {
  const p: any = state();
  p.active = "book-v1-24";
  p.sessions["book-v1-24"] = {
    rules: 1,
    current: snapshot([5, 5]),
    history: [],
  };
  p.done = Array.from({ length: 23 }, (_, i) => `book-v1-${i + 1}`);
  await seed(page, p);
  await page.goto("/");
  await page.locator("#resume").click();
  await pair(page);
  await expect(page.locator("#play-again")).toHaveText("Следующая тетрадь");
  await page.locator("#play-again").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 2 · задача 1");
  await page.locator("#book-top").click();
  await page.locator('[data-volume="0"]').click();
  await expect(page.locator(".task.done")).toHaveCount(24);
  await page.locator('[data-game="book-v1-24"]').click();
  await expect(page.locator("#win")).toBeHidden();
  expect((await data(page)).done.length).toBe(24);
});
test("A08 offline already loaded APK web assets remain playable and save/reload", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.goto("/");
  await context.setOffline(true);
  await page.locator("#resume").click();
  await pair(page);
  expect((await data(page)).meta.completed).toBe(6);
  await context.setOffline(false);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#win")).toBeVisible();
});
test("A09 reduced motion has no running decorative animations during selection and menus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  await page.locator("#menu").click();
  await page.locator("#progress-open").click();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});

test("A10 portrait, landscape, dark and enlarged type screens are reachable; capture target sizes", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const measurements: any[] = [];
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [568, 320],
    [600, 320],
    [844, 390],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    measurements.push(
      await page.evaluate(() => ({
        w: innerWidth,
        h: innerHeight,
        menuScroll:
          document.querySelector("#dialog")!.scrollHeight >
          document.querySelector("#dialog")!.clientHeight,
        targets: [...document.querySelectorAll("#menu-content button")].map(
          (e) => ({
            id: e.id,
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
            font: getComputedStyle(e).fontSize,
          }),
        ),
      })),
    );
    await expect(page.locator("#settings-open")).toBeVisible();
    await page.locator("#progress-open").click();
    await expect(page.locator("#progress-trophies")).toBeVisible();
    expect(
      await page
        .locator("#dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.locator("#collection-back").click();
    if (w === 320 || w === 390)
      await page.screenshot({
        animations: "disabled",
        path: `test-results/repairs041/home-${w}.png`,
      });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await page.locator("#settings-back").click();
  await page.locator("#progress-open").click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/repairs041/progress-dark.png",
  });
  await page.locator("#collection-back").click();
  await page.locator("#calendar-open").click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/repairs041/calendar-dark.png",
  });
  await page.locator("#collection-back").click();
  await page.evaluate(() => {
    for (const e of document.querySelectorAll<HTMLElement>("#dialog *")) {
      const px = parseFloat(getComputedStyle(e).fontSize);
      e.dataset.size = String(px);
    }
    for (const e of document.querySelectorAll<HTMLElement>("#dialog *"))
      e.style.fontSize = Number(e.dataset.size) * 1.5 + "px";
  });
  await page.locator("#progress-open").click();
  await page.locator("#progress-trophies").click();
  await expect(page.locator("#collection h2")).toBeVisible();
  console.log("LAYOUT_MEASUREMENTS", JSON.stringify(measurements));
});
test("A11 scrolling a long board during pair animations preserves nodes and undo", async ({
  page,
}) => {
  const p: any = state();
  p.sessions.classic.current = snapshot(Array(1800).fill(1));
  await seed(page, p);
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    (window as any).survivor = document.querySelector('[data-index="30"]');
    (window as any).longTasks = [];
    new PerformanceObserver((l) =>
      (window as any).longTasks.push(...l.getEntries().map((e) => e.duration)),
    ).observe({ entryTypes: ["longtask"] });
  });
  for (let i = 0; i < 15; i++) {
    const before = 1800 - i * 2;
    await page.locator("#board button").nth(0).click();
    await page.locator("#board button").nth(1).click();
    await expect(page.locator("#remaining")).toHaveText(String(before - 2));
    await expect(page.locator("#undo")).toBeEnabled();
  }
  expect(await page.evaluate(() => (window as any).survivor.isConnected)).toBe(
    true,
  );
  await page.locator("#viewport").evaluate((e) => (e.scrollTop = 1300));
  await page.locator("#menu").click();
  await page.locator("#progress-open").click();
  await page.locator("#close").click();
  expect(
    await page.locator("#viewport").evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(1000);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("1772");
  console.log(
    "LONG_TASKS_MS",
    await page.evaluate(() => (window as any).longTasks),
  );
});
test("A12 fast contradictory inputs during removal cannot create extra result or lose board", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.locator("#resume").click();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    for (const sel of [
      '[data-index="0"]',
      '[data-index="1"]',
      "#undo",
      "#menu",
      "#play-again",
      "#hint",
      "#book-top",
    ])
      (document.querySelector(sel) as HTMLElement).click();
  });
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#undo")).toBeEnabled();
  expect((await data(page)).meta.completed).toBe(6);
  expect(errors).toEqual([]);
});
test("A13 no forced audio; enabling sound creates feedback, disabling stops new sounds", async ({
  page,
}) => {
  const p = state();
  p.sessions.classic.current = snapshot([5, 5, 5, 5]);
  await seed(page, p);
  const removePair = async () => {
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#remaining")).toHaveText("2");
    await expect(page.locator("#undo")).toBeEnabled();
  };
  await page.addInitScript(() => {
    (window as any).tones = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() {
        (window as any).tones++;
        return super.createOscillator();
      }
    };
  });
  await page.goto("/");
  await page.locator("#resume").click();
  await removePair();
  expect(await page.evaluate(() => (window as any).tones)).toBe(0);
  await page.locator("#undo").click();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#sound").check();
  await page.locator("#close").click();
  await removePair();
  expect(await page.evaluate(() => (window as any).tones)).toBeGreaterThan(0);
  await page.locator("#undo").click();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#sound").uncheck();
  const tonesBefore = await page.evaluate(() => (window as any).tones);
  await page.locator("#close").click();
  await removePair();
  expect(await page.evaluate(() => (window as any).tones)).toBe(tonesBefore);
});
test("A14 old tab cannot discard new statistics, and reload latest recovers them", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.goto("/");
  await page.locator("#resume").click();
  const stale = await context.newPage();
  await stale.goto("/");
  await stale.locator("#resume").click();
  await pair(page);
  await stale.locator('[data-index="0"]').click();
  await stale.locator('[data-index="1"]').click();
  await expect(stale.locator("#save-notice")).toContainText("другой вкладке");
  await stale.locator("#load-latest").click();
  await expect(stale.locator("#dialog")).toBeVisible();
  await stale.locator("#progress-open").click();
  await expect(stale.locator(".progress-stats dd").nth(2)).toHaveText("6");
});
test("A15 solved final available day leads back to usable archive without future access", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2025-01-01T12:00:00"));
  const p: any = state();
  p.active = "daily-v1-2025-01-01";
  p.sessions[p.active] = { rules: 1, current: snapshot([5, 5]), history: [] };
  await seed(page, p);
  await page.goto("/");
  await page.locator("#resume").click();
  await pair(page);
  await page.locator("#play-again").click();
  await expect(
    page.locator('[data-game="daily-v1-2025-01-02"]'),
  ).toBeDisabled();
  await expect(page.locator('[data-game="daily-v1-2025-01-01"]')).toHaveClass(
    /done/,
  );
  await page.locator("#today-task").click();
  await expect(page.locator("#win")).toBeHidden();
  expect(
    (await data(page)).done.filter((id: string) => id.startsWith("daily"))
      .length,
  ).toBe(1);
});
test("A16 long saved history retains responsiveness and measures actual save cost", async ({
  page,
}) => {
  const p: any = state();
  p.sessions.classic.current = snapshot(Array(1800).fill(1));
  p.sessions.classic.history = Array.from({ length: 800 }, () =>
    snapshot(Array(1800).fill(1)),
  );
  await seed(page, p);
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    (window as any).auditDurations = [];
    (window as any).saveDurations = [];
    new PerformanceObserver((l) =>
      (window as any).auditDurations.push(
        ...l.getEntries().map((e) => e.duration),
      ),
    ).observe({ entryTypes: ["longtask"] });
    const old = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const t = performance.now();
      old.call(this, k, v);
      if (k === "seeds-bits.progress.v2")
        (window as any).saveDurations.push({
          ms: performance.now() - t,
          bytes: v.length,
        });
    };
  });
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#remaining")).toHaveText("1798");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.waitForTimeout(150);
  console.log(
    "HEAVY_HISTORY",
    await page.evaluate(() => ({
      longTasks: (window as any).auditDurations,
      saves: (window as any).saveDurations,
    })),
  );
  expect((await data(page)).sessions.classic.packedHistory.length).toBe(801);
});
test("A17 accessibility contrast and motion timing measurements on actual built UI", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  const results: any[] = [];
  for (const dark of [false, true]) {
    await page.locator("#settings-open").click();
    await page.locator("#dark").setChecked(dark);
    await page.locator("#settings-back").click();
    results.push(
      await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        paper: getComputedStyle(document.querySelector("#dialog")!)
          .backgroundColor,
        labels: [
          ...document.querySelectorAll(
            "#menu-content .text-button,#resume-context,.mode-link small",
          ),
        ].map((e) => ({
          text: e.textContent,
          color: getComputedStyle(e).color,
          size: getComputedStyle(e).fontSize,
        })),
      })),
    );
  }
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  console.log(
    "ANIMATIONS",
    await page.evaluate(() =>
      document.getAnimations().map((a) => ({
        duration: a.effect?.getTiming().duration,
        frames: (a.effect as KeyframeEffect)?.getKeyframes(),
      })),
    ),
  );
  console.log("CONTRAST_INPUT", JSON.stringify(results));
});

test("failed switch can retry without lost attempt or rapid-click double transition", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreWrites = () =>
      (Storage.prototype.setItem = original);
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2") throw Error("quota");
      original.call(this, k, v);
    };
  });
  await page.locator("#book-mode").click();
  await page.locator('[data-game="book-v1-2"]').click();
  await expect(page.locator("#save-notice")).toBeVisible();
  expect((await data(page)).active).toBe("classic");
  await page.evaluate(() => (window as any).restoreWrites());
  await page.locator("#retry-save").click();
  await expect(page.locator("#save-notice")).toBeHidden();
  await page.evaluate(() => {
    (document.querySelector('[data-game="book-v1-2"]') as HTMLElement).click();
    (document.querySelector('[data-game="book-v1-3"]') as HTMLElement).click();
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#dialog")).toBeHidden();
  expect((await data(page)).active).toBe("book-v1-2");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь · задача 2");
});

test("backup recovery is explicit and survives reload", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.evaluate((key) => {
    const p = JSON.parse(localStorage.getItem(key)!);
    p.done = ["book-v1-1", "book-v1-2"];
    localStorage.setItem(key + ".recovery", JSON.stringify(p));
  }, KEY);
  await page.reload();
  await page.locator("#restore-backup").click();
  await expect(page.locator("#book-count")).toHaveText("2 из 2400 решено");
  expect((await data(page)).done).toEqual(["book-v1-1", "book-v1-2"]);
});

test("compact home keeps settings within first viewport and touch targets at least 44px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page);
  await page.goto("/");
  await expect(page.locator("#dialog")).toBeVisible();
  expect(
    await page
      .locator("#dialog")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
  ).toBe(true);
  expect(
    await page
      .locator("#settings-open")
      .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  expect(
    await page.locator(".home-links button").evaluateAll((es) =>
      // Animated translation may yield 43.999996 for a 44 CSS-pixel target.
      es.every(
        (e) => Math.round(e.getBoundingClientRect().height * 100) / 100 >= 44,
      ),
    ),
  ).toBe(true);
});
