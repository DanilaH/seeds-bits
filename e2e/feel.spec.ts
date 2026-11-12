import { test, expect, type Page } from "@playwright/test";
const key = "seeds-bits.progress.v2",
  prefs = "seeds-bits.settings.v1";
async function seed(
  page: Page,
  options: {
    mode?: string;
    meter?: number;
    vibration?: boolean;
    large?: boolean;
    board?: number[];
    history?: any[];
  } = {},
) {
  await page.clock.setFixedTime(new Date("2026-11-09T12:00:00"));
  await page.addInitScript(
    ({ key, prefs, o }) => {
      const w = window as any;
      w.pulses = [];
      w.effects = [];
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (p: any) => {
          w.pulses.push(p);
          return true;
        },
      });
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames: any, opts: any) {
        w.effects.push({
          target: this.id || this.className,
          duration: typeof opts === "number" ? opts : opts?.duration,
          index: (this as HTMLElement).dataset?.index,
        });
        return animate.call(this, frames, opts);
      };
      if (!sessionStorage.feel) {
        sessionStorage.feel = "1";
        const active = o.mode || "classic";
        const board = o.large
          ? Array.from({ length: 900 }, (_, i) =>
              Math.floor(i / 9) % 2 ? 3 + ((i % 9) % 2) : 1 + ((i % 9) % 2),
            )
          : o.board || [5, 5, 5, 5];
        localStorage.setItem(
          prefs,
          JSON.stringify({
            tutorialDone: true,
            sound: false,
            vibration: o.vibration,
          }),
        );
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 3,
            active,
            sessions: {
              [active]: {
                rules: 1,
                current: { board, moves: 0, additions: 0, scroll: 0 },
                history: o.history || [],
              },
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
              attempts: { [active]: { id: "feel-test", completed: false } },
            },
            jars: {
              version: 2,
              seeds: (o.meter ?? 320) + 20,
              meter: o.meter ?? 320,
              wins: 3,
              attempt: "feel-test",
              highWater: 0,
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
        report: async () => {},
        show: async () => ({ status: "unavailable" }),
      };
      w.__SEEDS_ENGAGEMENT_TEST__ = {
        configuration: async () => ({ available: true, granted: true }),
        requestNotifications: async () => ({ available: true, granted: true }),
        addListener: async () => ({ remove: async () => {} }),
      };
    },
    { key, prefs, o: options },
  );
  await page.goto("/");
  await expect(page.locator("#resume")).toBeVisible();
}
async function resetEvents(page: Page) {
  await page.evaluate(() => {
    (window as any).pulses = [];
    (window as any).effects = [];
  });
}
async function pulses(page: Page) {
  return page.evaluate(() =>
    (window as any).pulses.filter((x: any) => x !== 0),
  );
}
async function removePair(page: Page) {
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#skip")).toBeEnabled();
}
async function saved(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}

test("new vibration default, explicit opt-out and the enable preview survive persistence", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#settings-open").click();
  await expect(page.locator("#vibration")).toBeChecked();
  await page.locator("#vibration").uncheck();
  await resetEvents(page);
  await page.locator("#settings-back").click();
  await page.locator("#resume").click();
  await removePair(page);
  await page.waitForTimeout(850);
  expect(await pulses(page)).toEqual([]);
  await page.reload();
  await page.locator("#settings-open").click();
  await expect(page.locator("#vibration")).not.toBeChecked();
  await resetEvents(page);
  await page.locator("#vibration").check();
  await expect.poll(() => pulses(page)).toEqual([14]);
});

test("touch contact is visible without activating a button; cancellation clears it", async ({
  page,
}) => {
  await seed(page);
  const c = await page.context().newCDPSession(page);
  const b = (await page.locator("#book-mode").boundingBox())!;
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await expect(page.locator("#book-mode")).toHaveClass(/is-pressed/);
  await expect(page.locator("#menu-content")).toBeVisible();
  await c.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(page.locator(".is-pressed")).toHaveCount(0);
  await expect(page.locator("#menu-content")).toBeVisible();
});

for (const mode of ["book-v1-1", "daily-v1-2026-11-09"])
  test(`${mode} presents one saved reward, full jar and correct accessible capacity`, async ({
    page,
  }) => {
    await seed(page, { mode, board: [5, 5], meter: 320 });
    await page.locator("#resume").click();
    await resetEvents(page);
    await removePair(page);
    await expect(page.locator("#result-gains")).toContainText("В баночку:");
    await expect(page.locator("#jar-percent")).toHaveText("100%");
    await expect(page.locator("#jar-meter")).toHaveAttribute(
      "aria-label",
      /140 из 140/,
    );
    await expect
      .poll(
        async () =>
          (await pulses(page)).filter(
            (x: any) =>
              Array.isArray(x) &&
              x.join(",") ===
                (mode.startsWith("book") ? "18,35,24" : "34,45,42,55,62"),
          ).length,
      )
      .toBe(1);
    await expect(page.locator("#jar-name")).toHaveText("Баночка 5");
    const total = (await saved(page)).jars.meter;
    await expect(page.locator("#jar-meter")).toHaveAttribute(
      "data-filled",
      String(total - 324),
    );
    await page.reload();
    await resetEvents(page);
    await page.locator("#resume").click();
    await page.waitForTimeout(1700);
    expect((await pulses(page)).filter((x: any) => Array.isArray(x))).toEqual(
      [],
    );
  });

test("unsaved completion stays quiet, successful retry celebrates once", async ({
  page,
}) => {
  await seed(page, { mode: "book-v1-1", board: [5, 5] });
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).failFeel = true;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2" && (window as any).failFeel)
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await removePair(page);
  await page.waitForTimeout(300);
  expect(
    (await pulses(page)).filter(
      (x: any) => Array.isArray(x) && x.join(",") === "18,35,24",
    ),
  ).toEqual([]);
  await expect(page.locator("#seed-flights i")).toHaveCount(0);
  await page.evaluate(() => ((window as any).failFeel = false));
  await page.locator("#retry-save").click();
  await expect
    .poll(
      async () =>
        (await pulses(page)).filter(
          (x: any) => Array.isArray(x) && x.length === 5,
        ).length,
    )
    .toBe(1);
  const amount = (await saved(page)).jars.seeds;
  await page.waitForTimeout(800);
  expect((await saved(page)).jars.seeds).toBe(amount);
});

test("leaving a rewarded result settles counters and cancels late tactile arrivals", async ({
  page,
}) => {
  await seed(page, { mode: "book-v1-1", board: [5, 5] });
  await page.locator("#resume").click();
  await removePair(page);
  await expect(page.locator("#seed-flights i")).toHaveCount(2);
  await page.locator("#menu").click();
  await resetEvents(page);
  await page.waitForTimeout(1600);
  expect(await pulses(page)).toEqual([]);
  await expect(page.locator("#seed-flights i")).toHaveCount(0);
  await page.locator("#resume").click();
  await page.waitForTimeout(200);
  expect((await saved(page)).jars.meter).toBe(324);
  await expect(page.locator("#jar-name")).toHaveText("Баночка 5");
});

test("large addition animates a bounded visible portion and preserves all 1800 cells", async ({
  page,
}) => {
  await seed(page, { large: true });
  await page.locator("#resume").click();
  await resetEvents(page);
  await page.locator("#add").click();
  await expect(page.locator("#remaining")).toHaveText("1800");
  await page.waitForTimeout(1400);
  const effects = await page.evaluate(() =>
    (window as any).effects.filter(
      (e: any) => e.duration === 220 && e.index !== undefined,
    ),
  );
  expect(effects.length).toBeGreaterThan(0);
  expect(effects.length).toBeLessThanOrEqual(54);
});

test("undo flashes exactly the removed pair after a whole row disappears", async ({
  page,
}) => {
  const board = [
    5,
    5,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...Array.from({ length: 36 }, (_, i) => (i % 9) + 1),
  ];
  await seed(page, { board });
  await page.locator("#resume").click();
  await removePair(page);
  await page.waitForTimeout(800);
  await resetEvents(page);
  await page.locator("#undo").click();
  const effects = await page.evaluate(() =>
    (window as any).effects.filter(
      (e: any) => e.duration === 220 && e.index !== undefined,
    ),
  );
  expect(effects.map((x: any) => x.index)).toEqual(["0", "1"]);
  await expect
    .poll(() =>
      page.evaluate(async (key) => {
        const p = await import("/src/progress.ts");
        return p.readProgress(localStorage.getItem(key)).sessions.classic
          .current.board;
      }, key),
    )
    .toEqual(board);
});

test("background settles particles without playing old contacts on return", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#resume").click();
  await removePair(page);
  await page.evaluate(() => {
    (window as any).__hidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => (window as any).__hidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await resetEvents(page);
  await page.waitForTimeout(850);
  await expect(page.locator("#seed-flights i")).toHaveCount(0);
  expect(await pulses(page)).toEqual([]);
  await page.evaluate(() => {
    (window as any).__hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  expect(await pulses(page)).toEqual([]);
  expect((await saved(page)).jars.meter).toBe(322);
});

test("reduced motion retains the reward and one tactile result without animated travel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, { mode: "book-v1-1", board: [5, 5] });
  await page.locator("#resume").click();
  await resetEvents(page);
  await removePair(page);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
  await expect(page.locator("#seed-flights i")).toHaveCount(0);
  expect((await saved(page)).jars.meter).toBe(324);
  expect(
    (await pulses(page)).filter(
      (x: any) => Array.isArray(x) && x.join(",") === "18,35,24",
    ),
  ).toHaveLength(1);
});

test("press feedback preserves a touch at the edge of a navigation button", async ({
  page,
}) => {
  await seed(page);
  const c = await page.context().newCDPSession(page);
  const b = (await page.locator("#book-mode").boundingBox())!;
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + 0.7, y: b.y + b.height / 2 }],
  });
  await page.waitForTimeout(100);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#collection")).toBeVisible();
  await expect(page.locator(".dialog-head .screen-heading h2")).toHaveText(
    "Тетради",
  );
});

const fullPattern = "26,64,30,46,18";
test("slow save holds the full jar through its spill instead of shaking the next jar", async ({
  page,
}) => {
  await seed(page, { meter: 22 });
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const state = window as any;
    const request = navigator.locks.request.bind(navigator.locks) as any;
    state.holdJarSave = true;
    (navigator.locks as any).request = (...args: any[]) => {
      if (args[0] === "seeds-save" && state.holdJarSave)
        return new Promise((resolve) => {
          state.releaseJarSave = () => {
            state.holdJarSave = false;
            resolve(request(...args));
          };
        });
      return request(...args);
    };
  });
  await removePair(page);
  await expect(page.locator("#jar-meter")).toHaveAttribute("data-full", "true");
  await page.waitForTimeout(600);
  await expect(page.locator("#jar-spill")).toHaveCount(0);
  await page.evaluate(() => (window as any).releaseJarSave());
  await expect(page.locator("#jar-spill i")).toHaveCount(24);
  await page.waitForTimeout(900);
  await expect(page.locator("#jar-percent")).toHaveText("100%");
  await expect(page.locator("#jar-name")).toHaveText("Баночка 1");
  await expect(page.locator("#jar-name")).toHaveText("Баночка 2");
});
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`full jar spills once from its mouth and settles at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seed(page, { meter: 22 });
    await page.locator("#resume").click();
    await resetEvents(page);
    const caption = await page.locator(".jar-caption").boundingBox();
    await removePair(page);
    await expect(page.locator("#jar-spill i")).toHaveCount(24);
    await expect
      .poll(
        async () =>
          (await pulses(page)).filter((p: any) => String(p) === fullPattern)
            .length,
      )
      .toBe(1);
    const geometry = await page.evaluate(() => {
      const glass = document
        .querySelector("#jar-glass")!
        .getBoundingClientRect();
      const layer = document.querySelector("#jar-spill")!;
      const paths = [...layer.children].map((piece) => {
        const frames = (
          piece.getAnimations()[0].effect as KeyframeEffect
        ).getKeyframes();
        const first = new DOMMatrixReadOnly(frames[0].transform as string);
        const last = new DOMMatrixReadOnly(frames.at(-1)!.transform as string);
        return { x: first.m41, y: first.m42, endY: last.m42 };
      });
      return {
        paths,
        glass: { x: glass.x, top: glass.top, width: glass.width },
        height: innerHeight,
        pointerEvents: getComputedStyle(layer).pointerEvents,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry.pointerEvents).toBe("none");
    expect(geometry.overflow).toBe(false);
    expect(
      geometry.paths.every(
        (p) =>
          Math.abs(p.x - (geometry.glass.x + geometry.glass.width / 2)) < 20 &&
          Math.abs(p.y - geometry.glass.top) < 15 &&
          p.endY > geometry.height,
      ),
    ).toBe(true);
    expect(await page.locator(".jar-caption").boundingBox()).toEqual(caption);
    await expect(page.locator("#jar-spill")).toHaveCount(0);
    await expect(page.locator("#jar-name")).toHaveText("Баночка 2");
    await page.reload();
    await page.locator("#resume").click();
    await resetEvents(page);
    await page.waitForTimeout(1400);
    await expect(page.locator("#jar-spill")).toHaveCount(0);
    expect(
      (await pulses(page)).filter((p: any) => String(p) === fullPattern),
    ).toHaveLength(0);
  });

test("full jar cancellation removes its layer and cannot restart in the menu", async ({
  page,
}) => {
  await seed(page, { meter: 22 });
  await page.locator("#resume").click();
  await removePair(page);
  await expect(page.locator("#jar-spill i")).toHaveCount(24);
  await page.locator("#menu").click();
  await resetEvents(page);
  await expect(page.locator("#jar-spill")).toHaveCount(0);
  await page.waitForTimeout(1400);
  expect(await pulses(page)).toEqual([]);
  await page.locator("#resume").click();
  await expect(page.locator("#jar-name")).toHaveText("Баночка 2");
  await expect(page.locator("#jar-spill")).toHaveCount(0);
});

test("reduced motion and failed saves do not start a full jar spill", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, { meter: 22 });
  await page.locator("#resume").click();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "seeds-bits.progress.v2")
        throw new DOMException("Full", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await resetEvents(page);
  await removePair(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator("#jar-spill")).toHaveCount(0);
  expect(
    (await pulses(page)).filter((p: any) => String(p) === fullPattern),
  ).toHaveLength(0);
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
});

test("a saved full jar respects reduced motion and explicit vibration opt-out", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, { meter: 22, vibration: false });
  await page.locator("#resume").click();
  await resetEvents(page);
  await removePair(page);
  await page.waitForTimeout(300);
  expect((await saved(page)).jars.meter).toBe(24);
  await expect(page.locator("#jar-spill")).toHaveCount(0);
  expect(await pulses(page)).toEqual([]);
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
});

test("rotation cancels the spill instead of leaving trajectories over a new layout", async ({
  page,
}) => {
  await seed(page, { meter: 22 });
  await page.locator("#resume").click();
  await removePair(page);
  await expect(page.locator("#jar-spill i")).toHaveCount(24);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#jar-spill")).toHaveCount(0);
  await page.waitForTimeout(600);
  await expect(page.locator("#jar-spill")).toHaveCount(0);
});
