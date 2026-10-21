import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const out = "test-results/regression-061",
  key = "seeds-bits.progress.v2";
mkdirSync(out, { recursive: true });
const report = (name: string, data: any) =>
  writeFileSync(`${out}/${name}.json`, JSON.stringify(data, null, 2));
async function boot(page: Page, exhausted = true, extra: any = {}) {
  await page.route(/\/src\/platform\.ts$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export * from '/src/platform.ts?audit-original';export async function listenAppState(f){window.auditAppState=f;}export async function listenBack(f){window.auditBack=f;}`,
    }),
  );
  await page.addInitScript(
    ({ key, exhausted, extra }) => {
      const w = window as any;
      w.calls = [];
      w.acks = [];
      w.events = [];
      w.banners = [];
      w.rewardListeners = [];
      if (!sessionStorage.seeded) {
        sessionStorage.seeded = "1";
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true, sound: true }),
        );
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 3,
            active: "classic",
            sessions: {
              classic: {
                rules: 1,
                current: {
                  board: Array(36).fill(5),
                  moves: 0,
                  additions: 0,
                  scroll: 0,
                },
                history: [],
              },
            },
            hints: {},
            seen: [],
            done: [],
            meta: {
              version: 1,
              since: "2026-10-21",
              completed: 0,
              unassisted: 0,
              attempts: {
                classic: {
                  id: "audit-attempt",
                  completed: false,
                  hintKeys: exhausted ? ["a", "b", "c"] : [],
                  hintBonus: 0,
                },
              },
            },
          }),
        );
      }
      w.__SEEDS_ADS_TEST__ = {
        initialize: async () => ({
          enabled: true,
          test: true,
          ...(extra.orphan
            ? { reward: { token: "orphan", attempt: "lost-old-attempt" } }
            : {}),
        }),
        addListener: async (_: any, f: any) => {
          w.rewardListeners.push(f);
          return { remove: async () => {} };
        },
        banner: async (o: any) => w.banners.push(o),
        preload: async () => {},
        report: async (o: any) => w.events.push(o),
        pending: async () => ({}),
        acknowledge: async (o: any) => {
          w.acks.push(o);
        },
        show: async (o: any) => {
          w.calls.push(o);
          if (extra.unavailable) return { status: "unavailable" };
          return new Promise((resolve) => (w.finishAd = resolve));
        },
      };
    },
    { key, exhausted, extra },
  );
  await page.goto("/");
  await page.locator("#resume").click();
}
async function reveal(page: Page) {
  await page.locator("#hint").click();
  await expect(page.locator("#hint-offer")).toBeVisible();
}
test("R01 native background state must not be overridden by visible document event", async ({
  page,
}) => {
  await boot(page, false);
  await page.evaluate(() => {
    (window as any).auditAppState(false);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.locator("#board button").nth(0).dispatchEvent("click");
  await page.locator("#board button").nth(1).dispatchEvent("click");
  await page.waitForTimeout(300);
  const moves = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).sessions.classic.current.moves,
    key,
  );
  report("R01-lifecycle", { movesWhileNativeBackground: moves });
  expect(moves).toBe(0);
});
test("R02 duplicate native callback after acknowledgment must not grant another reward", async ({
  page,
}) => {
  await boot(page);
  await reveal(page);
  await page.locator("#watch-hints").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).calls.length))
    .toBe(1);
  await page.evaluate(() => {
    for (const f of (window as any).rewardListeners)
      f({ token: "receipt-A", attempt: "audit-attempt" });
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).acks.length))
    .toBeGreaterThan(0);
  // A duplicate delivery of the same receipt remains idempotent; N01 checks native token generation.
  await page.evaluate(() => {
    for (const f of (window as any).rewardListeners)
      f({ token: "receipt-A", attempt: "audit-attempt" });
  });
  await expect
    .poll(() =>
      page.evaluate(
        (k) =>
          JSON.parse(localStorage.getItem(k)!).meta.attempts.classic.hintBonus,
        key,
      ),
    )
    .toBe(3);
  const bonus = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).meta.attempts.classic.hintBonus,
    key,
  );
  report("R02-reward-after-ack", {
    bonus,
    expected: 3,
    nativeTokenGeneration: "requires native harness confirmation",
  });
  expect(bonus).toBe(3);
});
test("R03 saving failure before watching must leave retry reachable", async ({
  page,
}) => {
  await boot(page);
  await reveal(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2") throw Error("disk full");
      return original.call(this, k, v);
    };
  });
  await page.locator("#watch-hints").click();
  await expect(page.locator("#save-notice")).toBeVisible();
  expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(false);
  expect(await page.evaluate(() => (window as any).calls.length)).toBe(0);
  await page.locator("#menu").click();
  await expect(page.locator("#dialog")).toBeVisible();
});
test("R04 hardware back during pre-ad save must not open unrelated modal", async ({
  page,
}) => {
  await boot(page);
  await reveal(page);
  await page.evaluate(async () => {
    let release: any;
    const ready = new Promise<void>((r) => {
      (window as any).lockReady = r;
    });
    (window as any).heldLock = navigator.locks.request(
      "seeds-save",
      async () => {
        (window as any).lockReady();
        await new Promise((r) => (release = r));
      },
    );
    (window as any).releaseLock = () => release();
    await ready;
  });
  await page.locator("#watch-hints").click();
  await page.evaluate(() => (window as any).auditBack());
  const opened = await page.locator("#dialog").isVisible();
  report("R04-back-before-ad", {
    mainMenuOpenedDuringRewardRequest: opened,
    appInert: await page.locator("#app").evaluate((e) => e.inert),
  });
  await page.evaluate(() => (window as any).releaseLock());
  expect(opened).toBe(false);
});
test("R05 successful reward restores budget even if native acknowledgment rejects", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    (window as any).__SEEDS_ADS_TEST__.acknowledge = async () => {
      throw Error("native ack failed");
    };
  });
  await reveal(page);
  await page.locator("#watch-hints").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).calls.length))
    .toBe(1);
  await page.evaluate(() =>
    (window as any).finishAd({
      status: "closed",
      shown: true,
      reward: { token: "retained", attempt: "audit-attempt" },
    }),
  );
  await expect(page.locator("#hint-label")).toContainText("3");
  expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(false);
});
test("R06 typography and banner reservations across viewport matrix", async ({
  page,
}) => {
  await boot(page, false);
  const results = [];
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [568, 320],
    [844, 390],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        "--safe-area-inset-top",
        "28px",
      );
      document.documentElement.style.setProperty(
        "--safe-area-inset-bottom",
        "32px",
      );
      document.documentElement.style.setProperty(
        "--safe-area-inset-left",
        "20px",
      );
      document.documentElement.style.setProperty(
        "--safe-area-inset-right",
        "20px",
      );
    });
    await page.waitForTimeout(100);
    results.push(
      await page.evaluate(() => {
        const rect = (s: string) =>
          document.querySelector(s)!.getBoundingClientRect().toJSON();
        return {
          w: innerWidth,
          h: innerHeight,
          overflow: document.documentElement.scrollWidth - innerWidth,
          footer: rect("footer"),
          board: rect("#viewport"),
          ad: rect("#ad-space"),
          banner: (window as any).banners.at(-1),
        };
      }),
    );
  }
  report("R06-layout-matrix", results);
  expect(results.every((r) => r.overflow <= 1)).toBe(true);
  expect(results.every((r) => r.board.height > 80)).toBe(true);
});
test("R07 hint repeats cost no credits across undo and reload", async ({
  page,
}) => {
  await boot(page, false);
  await page.locator("#hint").click();
  await expect(page.locator("#hint-label")).toContainText("2");
  const ids = await page
    .locator(".hinted")
    .evaluateAll((es) =>
      es.map((e) => Number((e as HTMLElement).dataset.index)),
    );
  await page.locator(`[data-index="${ids[0]}"]`).click();
  await page.locator(`[data-index="${ids[1]}"]`).click();
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  const beforeReload = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  const uiBefore = await page.locator("#remaining").textContent();
  await page.reload();
  await page.locator("#resume").click();
  const restored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  await page.locator("#hint").click();
  const after = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  report("R07-immediate-undo-reload", {
    uiBefore,
    storedMovesBefore: beforeReload.sessions.classic.current.moves,
    restoredMoves: restored.sessions.classic.current.moves,
    storedBoardBefore: beforeReload.sessions.classic.current.board,
    restoredBoard: restored.sessions.classic.current.board,
    keysBefore: beforeReload.meta.attempts.classic.hintKeys,
    keysAfter: after.meta.attempts.classic.hintKeys,
  });
  await expect(page.locator("#hint-label")).toContainText("2");
});
test("R08 actual browser quota accepts the legitimate heavy-hint save", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  let data: string;
  try {
    data = readFileSync("/tmp/regression061-heavy-hints.json", "utf8");
  } catch {
    test.skip(true, "Generate with model.audit.ts first");
    return;
  }
  await page.goto("/");
  const result = await page.evaluate(
    ({ key, data }) => {
      try {
        localStorage.clear();
        localStorage.setItem(key, data);
        return { ok: true, chars: data.length };
      } catch (e) {
        return { ok: false, chars: data.length, error: String(e) };
      }
    },
    { key, data },
  );
  report("R08-browser-quota", result);
  expect(result.ok).toBe(true);
});

test("R09 earned reward for an orphaned attempt goes to current attempt", async ({
  page,
}) => {
  await boot(page, true, { orphan: true });
  await expect(page.locator("#hint-label")).toContainText("3");
  expect(await page.evaluate(() => (window as any).acks.length)).toBe(1);
});
test("R10 repeated watch clicks start exactly one fullscreen request", async ({
  page,
}) => {
  await boot(page);
  await reveal(page);
  await page.evaluate(() => {
    const b = document.getElementById("watch-hints") as HTMLButtonElement;
    b.click();
    b.click();
    b.click();
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).calls.length))
    .toBe(1);
  await page.evaluate(() => (window as any).finishAd({ status: "closed" }));
  expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(false);
});
test("R11 ad dismissal during native background does not re-enable gameplay", async ({
  page,
}) => {
  await boot(page);
  await reveal(page);
  await page.locator("#watch-hints").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).calls.length))
    .toBe(1);
  await page.evaluate(() => {
    (window as any).auditAppState(false);
    (window as any).finishAd({ status: "closed" });
  });
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await page.waitForTimeout(200);
  await expect(page.locator("#remaining")).toHaveText("36");
  await page.evaluate(() => (window as any).auditAppState(true));
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#remaining")).toHaveText("34");
});
test("R12 enlarged hint offer remains dismissible in short landscape", async ({
  page,
}) => {
  await boot(page);
  await page.setViewportSize({ width: 568, height: 320 });
  await page.addStyleTag({ content: "body{font-size:200%}" });
  await reveal(page);
  await page.locator("#cancel-hints").click();
  await expect(page.locator("#hint-offer")).toBeHidden();
  await page.screenshot({
    path: "test-results/regression061/enlarged-landscape.png",
  });
});

test("R13 repeat hint is free after confirmed undo persistence", async ({
  page,
}) => {
  await boot(page, false);
  await page.locator("#hint").click();
  const ids = await page
    .locator(".hinted")
    .evaluateAll((es) =>
      es.map((e) => Number((e as HTMLElement).dataset.index)),
    );
  await page.locator(`[data-index="${ids[0]}"]`).click();
  await page.locator(`[data-index="${ids[1]}"]`).click();
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  await expect
    .poll(() =>
      page.evaluate(
        (k) =>
          JSON.parse(localStorage.getItem(k)!).sessions.classic.current.moves,
        key,
      ),
    )
    .toBe(0);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  await expect(page.locator("#hint-label")).toContainText("2");
});
