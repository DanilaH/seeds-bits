import { test, expect, type Page } from "@playwright/test";
const key = "seeds-bits.progress.v2";
async function seed(
  page: Page,
  options: {
    daily?: boolean;
    run?: number;
    review?: boolean;
    entry?: boolean;
    large?: boolean;
    denied?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00"));
  await page.addInitScript(
    ({ key, options }) => {
      const w = window as any;
      w.engagementCalls = [];
      w.adShows = [];
      w.permission = false;
      if (!sessionStorage.seed110) {
        sessionStorage.seed110 = "1";
        const snap = (board: number[]) => ({
          rules: 1,
          current: { board, moves: 0, additions: 0, scroll: 0 },
          history: [],
        });
        const active = options.daily ? "daily-v1-2026-11-08" : "classic";
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true }),
        );
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 3,
            active,
            sessions: {
              classic: snap(
                options.large
                  ? Array(900).fill(5)
                  : options.review
                    ? [5, 5]
                    : [5, 5, 5, 5, 5, 5],
              ),
              "daily-v1-2026-11-08": snap([5, 5]),
            },
            hints: {},
            done: [],
            seen: [],
            meta: {
              version: 2,
              wallet: 4,
              since: "2026-11-01",
              completed: 0,
              unassisted: 0,
              attempts: {
                classic: { id: "classic110", completed: false },
                "daily-v1-2026-11-08": { id: "daily110", completed: false },
              },
              daily: options.run
                ? {
                    lastDay: "2026-11-07",
                    count: options.run,
                    best: options.run,
                    reward: 0,
                  }
                : undefined,
              engagement: options.review
                ? { sessions: 1, activeMs: 600000, reviewAttempts: 0 }
                : undefined,
            },
          }),
        );
      }
      w.__SEEDS_ADS_TEST__ = {
        initialize: async () => ({ enabled: true, test: true }),
        addListener: async () => ({ remove: async () => {} }),
        preload: async () => {},
        banner: async () => {},
        pending: async () => ({}),
        acknowledge: async () => {},
        report: async (o: any) => {
          w.engagementCalls.push(o);
        },
        show: async (o: any) => {
          w.adShows.push(o);
          return { status: "unavailable" };
        },
      };
      w.__SEEDS_ENGAGEMENT_TEST__ = {
        configuration: async () => ({
          available: true,
          granted: w.permission,
          entry: options.entry && !sessionStorage.entryUsed,
        }),
        requestNotifications: async () => {
          w.engagementCalls.push({ name: "permission_request" });
          w.permission = !options.denied;
          return { available: true, granted: w.permission };
        },
        openNotificationSettings: async () => {
          w.engagementCalls.push({ name: "system_notification_settings" });
        },
        review: async () => {
          w.engagementCalls.push({ name: "native_review" });
          return { status: "finished" };
        },
        addListener: async () => ({ remove: async () => {} }),
      };
      sessionStorage.entryUsed = "1";
      // The first cold configuration is explicitly returned once, not on subsequent reloads.
      if (options.entry && !sessionStorage.didEntry) {
        sessionStorage.didEntry = "1";
        w.__SEEDS_ENGAGEMENT_TEST__.configuration = async () => ({
          available: true,
          granted: false,
          entry: true,
        });
      }
    },
    { key, options },
  );
  await page.goto("/");
}
async function stored(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function remove(page: Page) {
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#remaining")).toHaveText("0");
}

test("daily completion, streak and wallet stay atomic across a failed save and retry", async ({
  page,
}) => {
  await seed(page, { daily: true, run: 6 });
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).failDailySave = true;
    Storage.prototype.setItem = function (name, value) {
      if (name === "seeds-bits.progress.v2" && (window as any).failDailySave)
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, name, value);
    };
  });
  await remove(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator("#result-gains")).toHaveText(
    "Награда ожидает сохранения",
  );
  const before = await stored(page);
  expect(before.done).not.toContain("daily-v1-2026-11-08");
  expect(before.meta.daily.count).toBe(6);
  expect(before.meta.wallet).toBe(4);
  await page.evaluate(() => {
    (window as any).failDailySave = false;
  });
  await page.locator("#retry-save").click();
  await expect(page.locator("#save-notice")).toBeHidden();
  await expect(page.locator("#result-gains")).toContainText("+3 подсказки");
  await expect.poll(async () => (await stored(page)).meta.wallet).toBe(7);
  const after = await stored(page);
  expect(after.done).toContain("daily-v1-2026-11-08");
  expect(after.meta.daily.count).toBe(7);
  expect(after.jars.seeds).toBe(4);
  await page.reload();
  await page.locator("#resume").click();
  expect((await stored(page)).meta.wallet).toBe(7);
  expect((await stored(page)).meta.daily.count).toBe(7);
  expect((await stored(page)).jars.seeds).toBe(4);
});

test("sticky classic hint is free after deselection, reload and undo", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  const indices = await page
    .locator(".hinted")
    .evaluateAll((ns) => ns.map((n) => (n as HTMLElement).dataset.index));
  await page.locator("#board button").last().click();
  await page.locator("#hint").click();
  expect(
    await page
      .locator(".hinted")
      .evaluateAll((ns) => ns.map((n) => (n as HTMLElement).dataset.index)),
  ).toEqual(indices);
  expect((await stored(page)).meta.attempts.classic.hintKeys).toHaveLength(1);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  await page.locator(".hinted").first().click();
  await page.locator(".hinted").last().click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#undo").click();
  await page.locator("#hint").click();
  expect((await stored(page)).meta.attempts.classic.hintKeys).toHaveLength(1);
  expect((await stored(page)).meta.wallet).toBe(4);
});
for (const [run, reward] of [
  [2, 1],
  [6, 3],
  [9, 0],
  [13, 3],
])
  test(`daily series ${run} → ${run + 1} rewards ${reward} once`, async ({
    page,
  }) => {
    await seed(page, { daily: true, run });
    await page.locator("#resume").click();
    await remove(page);
    await expect
      .poll(async () => (await stored(page)).meta.wallet)
      .toBe(4 + reward);
    const saved = await stored(page);
    expect(saved.meta.daily.count).toBe(run + 1);
    expect(saved.jars.seeds).toBe(4);
    await page.reload();
    await page.locator("#resume").click();
    expect((await stored(page)).meta.wallet).toBe(4 + reward);
    await page.locator("#menu").click();
    await page.locator("#calendar-open").click();
    await expect(page.locator(".run-heading")).toContainText(`${run + 1}`);
    await page.locator("#today-task").click();
    const solution = await page.evaluate(
      async () =>
        (await import("/src/puzzles.ts")).daily("2026-11-08").solution,
    );
    for (const pair of solution) {
      await page.locator(`[data-index="${pair.a}"]`).click();
      await page.locator(`[data-index="${pair.b}"]`).click();
      await expect(page.locator("#skip")).toBeEnabled();
    }
    await expect(page.locator("#win")).toBeVisible();
    expect((await stored(page)).meta.wallet).toBe(4 + reward);
    expect((await stored(page)).jars.seeds).toBe(4);
  });
test("notification permission is voluntary and persists only after explicit opt-in", async ({
  page,
}) => {
  await seed(page, { daily: true });
  await page.locator("#resume").click();
  await remove(page);
  expect(
    await page.evaluate(() =>
      (window as any).engagementCalls.some(
        (o: any) => o.name === "permission_request",
      ),
    ),
  ).toBe(false);
  await page.locator("#result-reminder").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("seeds-bits.settings.v1")!).reminders,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        (window as any).engagementCalls.filter(
          (o: any) => o.name === "permission_request",
        ).length,
    ),
  ).toBe(1);
  await expect(page.locator("#result-reminder")).toBeHidden();
});
test("cold reminder opens today's task and preserves another mode without an ad", async ({
  page,
}) => {
  await seed(page, { entry: true });
  await expect(page.locator("#mode")).toContainText("08.11.2026");
  await expect(page.locator("#dialog")).toBeHidden();
  expect((await stored(page)).sessions.classic.current.board).toEqual([
    5, 5, 5, 5, 5, 5,
  ]);
  expect(await page.evaluate(() => (window as any).adShows)).toEqual([]);
});
test("review follows a saved eligible result, skips the next ad and is not a submitted-rating event", async ({
  page,
}) => {
  await seed(page, { review: true });
  await page.locator("#resume").click();
  await remove(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).engagementCalls.filter(
            (o: any) => o.name === "native_review",
          ).length,
      ),
    )
    .toBe(1);
  expect((await stored(page)).meta.engagement.reviewAttempts).toBe(1);
  expect(
    await page.evaluate(() =>
      (window as any).engagementCalls.some(
        (o: any) => o.name === "review_submitted",
      ),
    ),
  ).toBe(false);
  await page.locator("#play-again").click();
  expect(await page.evaluate(() => (window as any).adShows)).toEqual([]);
  await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.sessions.classic.current.board = [5, 5];
    p.sessions.classic.packedHistory = [];
    localStorage.setItem(k, JSON.stringify(p));
  }, key);
  await page.reload();
  await page.locator("#resume").click();
  await remove(page);
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(
      () =>
        (window as any).engagementCalls.filter(
          (o: any) => o.name === "native_review",
        ).length,
    ),
  ).toBe(0);
});
test("large board has one Tab stop and arrow navigation retains a quick exit", async ({
  page,
}) => {
  await seed(page, { large: true });
  await page.locator("#resume").click();
  await expect(page.locator('#board button[tabindex="0"]')).toHaveCount(1);
  await page.locator('#board button[tabindex="0"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-index="9"]')).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page
      .locator("#board")
      .evaluate((n) => n.contains(document.activeElement)),
  ).toBe(false);
});
test("saturated optional audio recovers after suspend even if ended callbacks are missing", async ({
  page,
}) => {
  await seed(page);
  const count = await page.evaluate(async () => {
    let made = 0;
    const param = {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      linearRampToValueAtTime() {},
    };
    (window as any).AudioContext = class {
      state = "running";
      currentTime = 0;
      destination = {};
      resume() {
        this.state = "running";
        return Promise.resolve();
      }
      suspend() {
        this.state = "suspended";
        return Promise.resolve();
      }
      createOscillator() {
        made++;
        return {
          type: "sine",
          frequency: param,
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
          onended: null,
        };
      }
      createGain() {
        return { gain: param, connect() {}, disconnect() {} };
      }
    };
    const sound = await import("/src/sound.ts");
    for (let i = 0; i < 6; i++) sound.playSound("pair", true);
    sound.blockSound(true);
    sound.blockSound(false);
    sound.playSound("pair", true);
    return made;
  });
  expect(count).toBe(7);
});

test("denied notifications leave reminders off and provide a system settings route", async ({
  page,
}) => {
  await seed(page, { denied: true });
  await page.locator("#settings-open").click();
  await page.locator("#reminders").check();
  await expect(page.locator("#reminders")).not.toBeChecked();
  await expect(page.locator("#reminder-permission")).toContainText(
    "отключены в Android",
  );
  await page.locator("#notification-system-settings").click();
  expect(
    await page.evaluate(() =>
      (window as any).engagementCalls.some(
        (o: any) => o.name === "system_notification_settings",
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("seeds-bits.settings.v1")!).reminders,
    ),
  ).toBe(false);
});

test("slow review preparation keeps input usable and cannot interrupt a new party", async ({
  page,
}) => {
  await seed(page, { review: true });
  await page.evaluate(() => {
    (window as any).prepared = false;
    (window as any).__SEEDS_ENGAGEMENT_TEST__.prepareReview = async () => {
      (window as any).prepared = true;
      await new Promise((r) => setTimeout(r, 1200));
      return { status: "ready" };
    };
  });
  await page.locator("#resume").click();
  await remove(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).prepared))
    .toBe(true);
  expect(await page.locator("#app").evaluate((n) => n.inert)).toBe(false);
  await page.locator("#play-again").click();
  await expect(page.locator("#remaining")).toHaveText("28");
  await page.waitForTimeout(1400);
  expect(
    await page.evaluate(
      () =>
        (window as any).engagementCalls.filter(
          (o: any) => o.name === "native_review",
        ).length,
    ),
  ).toBe(0);
});
