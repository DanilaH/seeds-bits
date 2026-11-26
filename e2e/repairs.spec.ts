import { installLegacyClassic } from "./restore-game";
import { returnToGame } from "./restore-game";
import { test, expect } from "@playwright/test";
import { notebook } from "../src/puzzles";
import { removePair } from "../src/core";
const settings = "seeds-bits.settings.v1",
  progress = "seeds-bits.progress.v2";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("seeds-bits.settings.v1"))
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
  });
});
async function start(page: any) {
  await installLegacyClassic(page);
  await page.goto("/");
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
}
async function pair(page: any, a: number, b: number) {
  await page.locator(`[data-index="${a}"]`).click();
  await page.locator(`[data-index="${b}"]`).click();
  await expect(page.locator("#skip")).toBeEnabled();
}
test("selection preserves nodes and keyboard focus survives a removed pair", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    (window as any).node = document.querySelector('[data-index="3"]');
  });
  await page.locator('[data-index="0"]').focus();
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(
      () => (window as any).node === document.querySelector('[data-index="3"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("#remaining")).toHaveText("26");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("#board") !== null,
    ),
  ).toBe(true);
});
test("landscape tutorial buttons remain reachable at every step", async ({
  page,
}) => {
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await installLegacyClassic(page);
    await page.goto("/");
    await page.locator("#learn").click();
    for (const [a, b] of [
      [0, 1],
      [0, 1],
      [0, 3],
      [0, 20],
      [8, 9],
    ]) {
      await pair(page, a, b);
      await page.locator("#lesson-next").click();
    }
    await page.locator("#add").click();
    await page.locator("#undo").click();
    await page.locator("#lesson-next").click();
    await expect(page.locator("#remaining")).toHaveText("28");
  }
});
test("failed save stays visible while settings are open", async ({ page }) => {
  await installLegacyClassic(page);
  await page.goto("/");
  await page.locator("#settings-open").click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  const sound = page.locator("#sound");
  await sound.setChecked(!(await sound.isChecked()));
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator("#retry-save")).toBeVisible();
  await page.locator("#settings-back").click();
  await expect(page.locator("#dialog #save-notice")).toBeVisible();
});
test("stale tab cannot overwrite a newer game", async ({ page, context }) => {
  await start(page);
  const writer = await context.newPage();
  await start(writer);
  await pair(writer,0,9);
  const moves = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("seeds-bits.progress.v2")!).sessions.classic.current.moves,
  );
  await expect.poll(moves).toBe(1);
  await page.bringToFront();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await expect(page.locator("#load-latest")).toBeVisible();
  expect(await moves()).toBe(1);
  await page.locator("#load-latest").click();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
});
test("all 24 notebook games finish by following reliable hints", async ({
  page,
}) => {
  test.setTimeout(300000);
  await installLegacyClassic(page);
  await page.goto("/");
  for (let n = 1; n <= 24; n++) {
    if (n > 1) await page.locator("#menu").click();
    await page.locator("#book-mode").click();
    await page.locator(`[data-game="book-v1-${n}"]`).click();
    await expect(page.locator("#dialog")).not.toBeVisible();
    await expect(page.locator("#mode")).toHaveText(`Тетрадь 1 · задача ${n}`);
    for (let move = 0; move < 20; move++) {
      if ((await page.locator("#remaining").textContent()) === "0") break;
      await page.locator("#hint").click();
      await expect(page.locator(".hinted")).toHaveCount(2);
      const ids = await page
        .locator(".hinted")
        .evaluateAll((es) =>
          es.map((e) => Number((e as HTMLElement).dataset.index)),
        );
      expect(ids).toHaveLength(2);
      const before = Number(await page.locator("#remaining").textContent());
      await page.evaluate(([a, b]) => {
        (document.querySelector(`[data-index="${a}"]`) as HTMLElement).click();
        (document.querySelector(`[data-index="${b}"]`) as HTMLElement).click();
      }, ids);
      await expect(page.locator("#skip")).toBeEnabled();
      await expect(
        page.locator("#remaining"),
        `task ${n} move ${move}, ids ${ids}`,
      ).toHaveText(String(before - 2));
    }
    await expect(page.locator("#remaining")).toHaveText("0");
  }
});
test("dead puzzle offers a recovery to a solvable position", async ({
  page,
}) => {
  let board = notebook[6].board;
  const history = [];
  for (const [a, b] of [
    [2, 22],
    [7, 25],
    [9, 10],
  ]) {
    history.push({ board, scroll: 0, moves: history.length, additions: 0 });
    board = removePair(board, a, b);
  }
  await page.addInitScript(
    (p) => localStorage.setItem("seeds-bits.progress.v2", JSON.stringify(p)),
    {
      version: 2,
      active: "book-v1-7",
      sessions: {
        "book-v1-7": {
          rules: 1,
          current: { board, scroll: 0, moves: 3, additions: 0 },
          history,
        },
      },
      done: [],
      seen: [],
      hints: {},
    },
  );
  await start(page);
  await page.locator("#hint").click();
  await expect(page.locator("#recover-task")).toHaveText("Отменить 1 ход");
  await page.locator("#recover-task").click();
  await expect(page.locator("#remaining")).toHaveText("10");
  await expect(page.locator(".hinted")).toHaveCount(0);
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  const ids = await page
    .locator(".hinted")
    .evaluateAll((es) =>
      es.map((e) => Number((e as HTMLElement).dataset.index)),
    );
  expect(ids).not.toEqual([9, 10]);
});
test("next skips completed tasks and explicit replay remains playable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.progress.v2",
      JSON.stringify({
        version: 2,
        active: "book-v1-1",
        sessions: {
          "book-v1-1": {
            rules: 1,
            current: { board: [5, 5], scroll: 0, moves: 0, additions: 0 },
            history: [],
          },
          "book-v1-2": {
            rules: 1,
            current: { board: [], scroll: 0, moves: 4, additions: 0 },
            history: [],
          },
        },
        done: ["book-v1-2"],
        seen: [],
        hints: {},
      }),
    ),
  );
  await start(page);
  await pair(page, 0, 1);
  await page.locator("#play-again").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 3");
  await page.locator("#book-top").click();
  await page.locator('[data-game="book-v1-2"]').click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 2");
  await expect(page.locator("#win")).toBeHidden();
});
test("fast selection retains the moving cell instead of replacing it", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: {
          board: [5, 5, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 6],
          scroll: 0,
          moves: 0,
          additions: 0,
        },
        history: [],
      }),
    ),
  );
  await start(page);
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    const play = Animation.prototype.play;
    (window as any).moving = [];
    const recorded = new WeakSet<Animation>();
    const observe = (a: Animation) => {
      const effect = a.effect;
      if (!recorded.has(a) && effect instanceof KeyframeEffect &&
          effect.target?.matches("#board button.cell") &&
          effect.getKeyframes().some(frame => frame.translate && frame.translate !== "0 0")) {
        recorded.add(a);
        a.pause();
        (window as any).moving.push(a);
      }
    };
    Element.prototype.animate = function (...args) {
      const a = original.apply(this, args);
      observe(a);
      return a;
    };
    Animation.prototype.play = function () { play.call(this); observe(this); };
  });
  await pair(page, 0, 1);
  await expect.poll(() => page.evaluate(() => (window as any).moving.length)).toBeGreaterThan(0);
  await page.evaluate(() =>
    (document.querySelector('[data-index="0"]') as HTMLElement).click(),
  );
  expect(
    await page.evaluate(() =>
      (window as any).moving.length > 0 &&
      (window as any).moving.every((a: any) => a.effect.target.isConnected),
    ),
  ).toBe(true);
});
