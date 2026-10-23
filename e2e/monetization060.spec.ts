import { test, expect, type Page } from "@playwright/test";
const key = "seeds-bits.progress.v2";
async function install(
  page: Page,
  opts: {
    exhausted?: boolean;
    outcome?: string;
    pending?: boolean;
    won?: boolean;
  } = {},
) {
  await page.addInitScript(
    ({ key, opts }) => {
      const w = window as any;
      w.adsCalls = [];
      w.adsAcks = [];
      w.adsEvents = [];
      w.adsListeners = [];
      w.bannerCalls = [];
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
                  board: opts.won ? [] : Array(18).fill(5),
                  moves: opts.won ? 9 : 0,
                  additions: 0,
                  scroll: 0,
                },
                history: [],
              },
            },
            hints: {},
            done: [],
            seen: [],
            meta: {
              version: 1,
              since: "2026-10-20",
              completed: opts.won ? 1 : 0,
              unassisted: 0,
              attempts: {
                classic: {
                  id: "attempt-060",
                  completed: !!opts.won,
                  hintBonus: 0,
                  hintKeys: opts.exhausted ? ["one", "two", "three"] : [],
                },
              },
            },
          }),
        );
      }
      const receipt = { token: "native-reward-060", attempt: "attempt-060" };
      w.__SEEDS_ADS_TEST__ = {
        initialize: async () => ({
          enabled: true,
          test: true,
          reward: opts.pending && !localStorage.ack060 ? receipt : undefined,
        }),
        addListener: async (_: any, f: any) => {
          w.adsListeners.push(f);
          return { remove: async () => {} };
        },
        banner: async (o: any) => {
          w.bannerCalls.push(o);
        },
        preload: async () => {},
        acknowledge: async (o: any) => {
          w.adsAcks.push(o.token);
          localStorage.ack060 = "1";
        },
        report: async (o: any) => {
          w.adsEvents.push(o);
        },
        pending: async () => ({}),
        show: async (o: any) => {
          w.adsCalls.push(o);
          if (opts.outcome === "error") throw Error("unavailable");
          if (opts.outcome === "unavailable" || o.kind === "interstitial")
            return { status: "unavailable" };
          const ad = document.createElement("button");
          ad.id = "fake-ad";
          ad.textContent = "Закрыть тестовую рекламу";
          ad.style.cssText = "position:fixed;inset:0;z-index:99999";
          document.body.append(ad);
          await new Promise<void>((r) => (ad.onclick = () => r()));
          ad.remove();
          if (opts.outcome === "closed")
            return { shown: true, status: "closed" };
          for (const f of w.adsListeners) {
            f(receipt);
            f(receipt);
          }
          return { shown: true, status: "closed", reward: receipt };
        },
      };
    },
    { key, opts },
  );
  await page.goto("/");
  await page.locator("#resume").click();
}
async function offer(page: Page) {
  await page.locator("#hint").click();
  await expect(page.locator("#hint-offer")).toBeVisible();
}
test("reward is explicit, pauses input, granted once, persists and is acknowledged after saving", async ({
  page,
}) => {
  await install(page, { exhausted: true });
  await offer(page);
  expect(await page.evaluate(() => (window as any).adsCalls.length)).toBe(0);
  await page.locator("#watch-hints").click();
  await expect(page.locator("#fake-ad")).toBeVisible();
  expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(true);
  await page.locator("#fake-ad").click();
  await expect(page.locator("#hint-label")).toContainText("3");
  await expect
    .poll(() => page.evaluate(() => (window as any).adsAcks.length))
    .toBeGreaterThan(0);
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(p.meta.attempts.classic.hintBonus).toBe(3);
  expect(p.meta.rewardReceipts).toEqual(["native-reward-060"]);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#hint-label")).toContainText("3");
});
for (const outcome of ["closed", "unavailable", "error"])
  test(`reward ${outcome} leaves budget intact and UI playable`, async ({
    page,
  }) => {
    await install(page, { exhausted: true, outcome });
    await offer(page);
    await page.locator("#watch-hints").click();
    if (outcome === "closed") await page.locator("#fake-ad").click();
    await expect(page.locator("#status")).toContainText(
      outcome === "closed" ? "не начислены" : "недоступна",
    );
    await expect(page.locator("#hint-label")).toContainText("0");
    expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(false);
    await page.locator("#board button").nth(0).click();
    await page.locator("#board button").nth(1).click();
    await expect(page.locator("#remaining")).toHaveText("16");
  });
test("pending native reward is recovered on boot and never doubled on reload", async ({
  page,
}) => {
  await install(page, { exhausted: true, pending: true });
  await expect(page.locator("#hint-label")).toContainText("3");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#hint-label")).toContainText("3");
});
test("failed reward save retains native receipt until retry and recovery", async ({
  page,
}) => {
  await install(page, { exhausted: true });
  await offer(page);
  // Fail only after the pre-ad save; award storage must precede native acknowledgment.
  await page.locator("#watch-hints").click();
  await expect(page.locator("#fake-ad")).toBeVisible();
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2") throw Error("full");
      return orig.call(this, k, v);
    };
  });
  await page.locator("#fake-ad").click();
  await expect(page.locator("#save-notice")).toBeVisible();
  expect(await page.evaluate(() => (window as any).adsAcks.length)).toBe(0);
});
test("banner reserves space in both orientations and hides in menus and tutorial", async ({
  page,
}) => {
  await install(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
    )
    .toBe(true);
  const geometry = await page.evaluate(() => ({
    ad: document.querySelector("#ad-space")!.getBoundingClientRect().toJSON(),
    footer: document.querySelector("footer")!.getBoundingClientRect().toJSON(),
  }));
  expect(geometry.footer.bottom).toBeLessThanOrEqual(geometry.ad.y - 8);
  await page.locator("#menu").click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
    )
    .toBe(false);
  await page.locator("#resume").click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
    )
    .toBe(true);
  await expect(page.locator("#ad-space")).toBeVisible();
  await page.locator("#menu").click();
  await page.locator("#learn").click();
  await expect(page.locator("#ad-space")).toBeHidden();
});
test("unavailable interstitial does not block next party and only runs after result action", async ({
  page,
}) => {
  await install(page, { won: true });
  expect(await page.evaluate(() => (window as any).adsCalls.length)).toBe(0);
  await page.locator("#play-again").click();
  await expect(page.locator("#board button").first()).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).adsCalls.map((o: any) => o.kind)),
  ).toEqual(["interstitial"]);
});
test("native safe-area changes reposition the banner and preserve the control gap", async ({
  page,
}) => {
  await install(page);
  await page.evaluate(() => {
    const s = document.documentElement.style;
    s.setProperty("--safe-area-inset-top", "32px");
    s.setProperty("--safe-area-inset-bottom", "36px");
    s.setProperty("--safe-area-inset-left", "24px");
    s.setProperty("--safe-area-inset-right", "20px");
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).bannerCalls.at(-1)?.y))
    .toBe(732);
  const g = await page.evaluate(() => ({
    ad: document.querySelector("#ad-space")!.getBoundingClientRect().toJSON(),
    footer: document.querySelector("footer")!.getBoundingClientRect().toJSON(),
    header: document.querySelector("header")!.getBoundingClientRect().toJSON(),
  }));
  expect(g.header.y).toBeGreaterThanOrEqual(32);
  expect(g.ad.x).toBeGreaterThanOrEqual(24);
  expect(g.ad.bottom).toBeLessThanOrEqual(844 - 36);
  expect(g.footer.bottom).toBeLessThanOrEqual(g.ad.y - 8);
  await page.screenshot({ path: "test-results/ads-safe-area-portrait.png" });
});
test("banner shelf fits short phones and landscape with safe insets, in both themes", async ({
  page,
}) => {
  await install(page);
  await page.addStyleTag({
    content:
      '#ad-space::after { content: "Баннер · проверка размещения"; display: grid; place-items: center; height: 100%; background: #dfe7e3; color: #293c37; font: 14px sans-serif; }',
  });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [568, 320],
    [640, 360],
    [844, 390],
    [768, 1024],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    for (const dark of [false, true]) {
      await page.evaluate((dark) => {
        const root = document.documentElement;
        root.dataset.theme = dark ? "dark" : "light";
        for (const [side, value] of Object.entries({
          top: 28,
          bottom: 32,
          left: 24,
          right: 20,
        }))
          root.style.setProperty(`--safe-area-inset-${side}`, `${value}px`);
      }, dark);
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
        )
        .toBe(true);
      const g = await page.evaluate(() => {
        const rect = (s: string) =>
          document.querySelector(s)!.getBoundingClientRect().toJSON();
        return {
          ad: rect("#ad-space"),
          footer: rect("footer"),
          game: rect(".game"),
          paper: getComputedStyle(document.documentElement)
            .getPropertyValue("--paper")
            .trim(),
          background: getComputedStyle(document.querySelector("#app")!)
            .backgroundColor,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(g.overflow).toBeLessThanOrEqual(1);
      expect(g.ad.width).toBeGreaterThanOrEqual(250);
      expect(g.ad.height).toBeGreaterThanOrEqual(50);
      expect(g.ad.bottom).toBeLessThanOrEqual(height - 32);
      expect(g.ad.x).toBeGreaterThanOrEqual(24);
      expect(g.ad.right).toBeLessThanOrEqual(width - 20);
      expect(g.footer.bottom).toBeLessThanOrEqual(g.ad.y - 8);
      await expect(page.locator("#hint")).toBeInViewport({ ratio: 1 });
      await expect(page.locator("#undo")).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector("#app")!)
              .backgroundColor ===
            getComputedStyle(document.querySelector(".game")!).backgroundColor,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/banner-shelf/${width}-${height}-${dark ? "dark" : "light"}.png`,
        animations: "disabled",
      });
    }
  }
  await page.locator("#menu").click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
    )
    .toBe(false);
  await page.locator("#resume").click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).bannerCalls.at(-1)?.visible),
    )
    .toBe(true);
});
test("analytics starts once on gameplay, not on opening home or returning to a saved attempt", async ({
  page,
}) => {
  await install(page);
  expect(
    await page.evaluate(
      () =>
        (window as any).adsEvents.filter((e: any) => e.name === "game_start")
          .length,
    ),
  ).toBe(0);
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  expect(
    await page.evaluate(
      () =>
        (window as any).adsEvents.filter((e: any) => e.name === "game_start")
          .length,
    ),
  ).toBe(1);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#board button").nth(0).click();
  expect(
    await page.evaluate(
      () =>
        (window as any).adsEvents.filter((e: any) => e.name === "game_start")
          .length,
    ),
  ).toBe(0);
});
