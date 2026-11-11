import { test, expect, type Page } from "@playwright/test";
const key = "seeds-bits.progress.v2";
test("narrow portrait text zoom keeps action labels and hit targets inside the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await install(page);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("body *")];
    const sizes = nodes.map((e) => parseFloat(getComputedStyle(e).fontSize));
    nodes.forEach((e, i) => (e.style.fontSize = sizes[i] * 1.5 + "px"));
  });
  await expect(page.locator(".game")).toHaveClass(/stacked-actions/);
  for (const id of ["undo", "hint", "add"]) {
    const bounds = await page.locator("#" + id).boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(641);
    expect(
      await page.locator("#" + id).evaluate((e) => {
        const label =
          e.querySelector(".action-label") ?? e.querySelector("span")!;
        return label.scrollWidth <= label.clientWidth + 1;
      }),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await page.locator("#resume").click();
  await expect(page.locator(".game")).not.toHaveClass(/stacked-actions/);
});
async function install(page: Page) {
  await page.addInitScript(
    ({ key }) => {
      const w = window as any;
      if (!localStorage.productSeed) {
        localStorage.productSeed = "1";
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true, sound: false }),
        );
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 3,
            active: "classic",
            sessions: {
              classic: {
                rules: 1,
                current: { board: [5, 5], moves: 0, additions: 0, scroll: 0 },
                history: [],
              },
            },
            hints: {},
            done: [],
            seen: [],
            meta: {
              version: 2,
              wallet: 0,
              since: "2026-11-01",
              completed: 0,
              unassisted: 0,
              attempts: {
                classic: { id: "product-attempt", completed: false },
              },
            },
          }),
        );
      }
      w.productEvents = [];
      w.productAcks = [];
      w.failComplete = false;
      w.failAll = false;
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (
          k === key &&
          (w.failAll ||
            (w.failComplete && JSON.parse(v).meta?.attempts.classic.completed))
        )
          throw new DOMException("Injected test fault", "QuotaExceededError");
        return write.call(this, k, v);
      };
      const listeners: Function[] = [];
      w.rewardListeners = listeners;
      w.__SEEDS_ADS_TEST__ = {
        initialize: async () => ({ enabled: true, test: true }),
        preload: async () => {},
        banner: async () => {},
        pending: async () => ({}),
        show: async () => ({ status: "unavailable" }),
        acknowledge: async ({ token }: any) => w.productAcks.push(token),
        addListener: async (name: string, fn: Function) => {
          if (name === "reward") listeners.push(fn);
          return { remove: async () => {} };
        },
        report: async (event: any) => {
          if (localStorage.productOffline === "1")
            throw Error("Injected bridge failure");
          w.productEvents.push({
            ...event,
            persisted: JSON.parse(localStorage.getItem(key)!).meta,
          });
          return { accepted: true };
        },
      };
    },
    { key },
  );
  await page.goto("/");
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await page.locator("#resume").click();
}
async function finish(page: Page) {
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
}
const events = (page: Page, name: string) =>
  page.evaluate(
    (name) => (window as any).productEvents.filter((e: any) => e.name === name),
    name,
  );

test("completion waits for durable state, retry and replay cannot grant twice", async ({
  page,
}) => {
  await install(page);
  await page.evaluate(() => {
    (window as any).failComplete = true;
  });
  await finish(page);
  await expect(page.locator("#retry-save")).toBeVisible();
  expect(await events(page, "game_complete")).toHaveLength(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).meta.completed,
      key,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    (window as any).failComplete = false;
  });
  await page.locator("#retry-save").click();
  await expect
    .poll(async () => (await events(page, "game_complete")).length)
    .toBe(1);
  const [done] = await events(page, "game_complete");
  expect(done.data.attempt).toBe("product-attempt");
  expect(done.data.task).toBe("classic");
  expect(done.data.event_id).toBeTruthy();
  expect(done.persisted.completed).toBe(1);
  expect((await events(page, "game_start"))[0].data.launch).toBe(
    done.data.launch,
  );
  expect((await events(page, "game_start"))[0].data.attempt).toBe(
    done.data.attempt,
  );
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  expect(await events(page, "game_complete")).toHaveLength(1);
  expect(await events(page, "save_recovered")).toHaveLength(1);
});

test("process interruption after a failed write restores the durable board, not a phantom win", async ({
  page,
}) => {
  await install(page);
  await page.evaluate(() => {
    (window as any).failComplete = true;
  });
  await finish(page);
  await expect(page.locator("#retry-save")).toBeVisible();
  await page.reload();
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await finish(page);
  await expect
    .poll(async () => (await events(page, "game_complete")).length)
    .toBe(1);
  expect((await events(page, "game_complete"))[0].persisted.completed).toBe(1);
});

test("queued completion survives bridge failure and restart with its original ID", async ({
  page,
}) => {
  await install(page);
  await page.evaluate(() => (localStorage.productOffline = "1"));
  await finish(page);
  const pending = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)!).meta.analytics.find(
        (e: any) => e.name === "game_complete",
      ),
    key,
  );
  expect(pending.id).toBeTruthy();
  await page.evaluate(() => (localStorage.productOffline = "0"));
  await page.reload();
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await page.locator("#settings-open").click();
  await page.locator("#sound").check();
  await expect
    .poll(async () => (await events(page, "game_complete")).length)
    .toBe(1);
  expect((await events(page, "game_complete"))[0].data.event_id).toBe(
    pending.id,
  );
  expect((await events(page, "game_complete"))[0].data.launch).toBe(
    pending.data.launch,
  );
  expect((await events(page, "game_complete"))[0].data.occurred_at).toBe(
    pending.data.occurred_at,
  );
});

test("reward redelivery across a failed game write is acknowledged only after one durable grant", async ({
  page,
}) => {
  await install(page);
  await page.evaluate(() => {
    const w = window as any;
    w.failAll = true;
    w.rewardListeners[0]({
      token: "product-earned",
      attempt: "product-attempt",
    });
  });
  await expect(page.locator("#retry-save")).toBeVisible();
  expect(await page.evaluate(() => (window as any).productAcks)).toEqual([]);
  await page.evaluate(() => {
    const w = window as any;
    w.failAll = false;
    w.rewardListeners[0]({
      token: "product-earned",
      attempt: "product-attempt",
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).meta.wallet,
        key,
      ),
    )
    .toBe(3);
  await expect
    .poll(() => page.evaluate(() => (window as any).productAcks.length))
    .toBe(1);
  await page.evaluate(() => {
    const w = window as any;
    w.rewardListeners[0]({
      token: "product-earned",
      attempt: "replaced-attempt",
    });
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).productAcks.length))
    .toBe(2);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).meta.wallet,
      key,
    ),
  ).toBe(3);
  expect(await events(page, "hint_reward_granted")).toHaveLength(1);
});

test("short first task is optional, persists tutorial exit and explains a revealed pair", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  for (let step = 0; step < 2; step++) {
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#lesson-next")).toBeVisible();
    if (step === 0) await page.locator("#lesson-next").click();
  }
  await page.locator("#lesson-quick").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText(/Одинаковые цифры|= 10/);
  await page.reload();
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#lesson")).toBeHidden();
  await page.locator("#resume").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
});
