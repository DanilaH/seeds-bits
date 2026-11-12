import { test, expect, type Page } from "@playwright/test";
import {
  classicCatalog,
  newClassicDeals,
  takeClassicDeal,
} from "../src/classic-deals";
import {
  newClassicRun,
  solveClassic,
  takeGeneratedClassic,
  type ClassicDifficulty,
} from "../src/classic-generator";
import { classic } from "../src/core";
import { fresh, metadata, startAttempt } from "../src/progress";
const key = "seeds-bits.progress.v2";
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), key);
async function boot(
  page: Page,
  level: ClassicDifficulty = 1,
  completed = false,
  legacy = false,
) {
  const p = fresh(),
    m = metadata(p);
  startAttempt(p, "classic");
  if (legacy) {
    m.classicDeals = newClassicDeals(73);
    m.classicDeals.bag = [
      classicCatalog.findIndex((entry) => entry.family === "bridges"),
    ];
    p.sessions.classic = takeClassicDeal(m.classicDeals, m.attempts.classic.id);
  } else {
    m.classicRun = newClassicRun(73);
    p.sessions.classic = takeGeneratedClassic(
      m.classicRun,
      m.attempts.classic.id,
      level,
    );
  }
  if (completed) {
    p.sessions.classic.current.board = [];
    p.sessions.classic.current.moves = 14;
    m.attempts.classic.completed = true;
    m.completed = 1;
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, p }) => {
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(p));
    },
    { key, p },
  );
  await page.goto("/");
  await expect(page.locator("#next-classic")).toBeVisible();
  return p;
}
async function move(page: Page, pair: number[]) {
  await page.locator(`[data-index="${pair[0]}"]`).click();
  await page.locator(`[data-index="${pair[1]}"]`).click();
}

test("legacy games remain intact; new games generate normal fields and retain them on resume", async ({
  page,
}) => {
  const initial = await boot(page, 1, false, true);
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  expect((await saved(page)).sessions.classic.current.board).toEqual(
    initial.sessions.classic.current.board,
  );
  const fields = new Set<string>();
  for (let n = 0; n < 9; n++) {
    await page.locator("#next-classic").click();
    await expect(page.locator("#dialog")).not.toBeVisible();
    const p = await saved(page),
      board = p.sessions.classic.current.board;
    expect([...board].sort()).toEqual(classic().sort());
    expect(p.meta.classicRun.difficulty).toBe(1);
    expect(p.meta.classicDeals).toBeUndefined();
    fields.add(board.join(""));
    await page.reload();
    expect((await saved(page)).sessions.classic.current.board).toEqual(board);
    await page.locator("#book-mode").click();
    await page.locator('[data-game="book-v1-1"]').click();
    await page.locator("#menu").click();
    await page.locator("#classic-mode").click();
    expect((await saved(page)).sessions.classic.current.board).toEqual(board);
    await page.locator("#menu").click();
  }
  expect(fields.size).toBe(9);
});

test("cancel retains the band; restart repeats the generated field without repaying seeds", async ({
  page,
}) => {
  const initial = await boot(page, 2);
  const proof = solveClassic(initial.sessions.classic.current.board, 2, 6000)!;
  await page.locator("#resume").click();
  await move(page, proof[0]!);
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  const moved = await saved(page);
  await page.locator("#menu-easier").click();
  await expect(page.locator("#confirm-new")).toHaveText("Начать новую партию");
  await page.locator("#cancel-new").click();
  expect((await saved(page)).sessions).toEqual(moved.sessions);
  expect((await saved(page)).meta.classicRun).toEqual(moved.meta.classicRun);
  await page.locator("#new").click();
  await expect(page.locator("#confirm-new")).toHaveText("Начать заново");
  await page.locator("#confirm-new").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const restarted = await saved(page);
  expect(restarted.sessions.classic.current.board).toEqual(
    initial.sessions.classic.current.board,
  );
  expect(restarted.meta.classicRun.recent).toEqual(
    moved.meta.classicRun.recent,
  );
  expect(restarted.meta.classicRun.difficulty).toBe(2);
  expect(restarted.meta.classicRun.current.attempt).not.toBe(
    moved.meta.classicRun.current.attempt,
  );
  await move(page, proof[0]!);
  await expect(page.locator("#undo")).toBeEnabled();
  expect((await saved(page)).jars.seeds).toBe(moved.jars.seeds);
});

test("failed replacement leaves the game, generator and chosen band intact", async ({
  page,
}) => {
  await boot(page, 2);
  const before = await saved(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () =>
      (Storage.prototype.setItem = original);
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith(key))
        throw new DOMException("Full", "QuotaExceededError");
      original.call(this, k, v);
    };
  }, key);
  await page.locator("#menu-easier").click();
  await expect(page.locator("#retry-save")).toBeVisible();
  expect((await saved(page)).sessions.classic).toEqual(before.sessions.classic);
  expect((await saved(page)).meta.classicRun).toEqual(before.meta.classicRun);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.locator("#retry-save").click();
  await expect(page.locator("#retry-save")).toBeHidden();
  expect((await saved(page)).meta.classicRun).toEqual(before.meta.classicRun);
  await page.locator("#menu-easier").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect((await saved(page)).meta.classicRun.difficulty).toBe(1);
  expect((await saved(page)).meta.classicRun.recent).toHaveLength(2);
});

for (const level of [0, 1, 2] as ClassicDifficulty[])
  test(`result choices enforce boundary ${level}`, async ({ page }) => {
    await boot(page, level, true);
    await page.locator("#resume").click();
    await expect(page.locator("#win")).toBeVisible();
    for (const [id, disabled] of [
      ["classic-easier", level === 0],
      ["classic-harder", level === 2],
    ] as const) {
      await expect(page.locator(`#${id}`)).toBeVisible();
      if (disabled) {
        await expect(page.locator(`#${id}`)).toBeDisabled();
        const before = await saved(page);
        await page
          .locator(`#${id}`)
          .evaluate((b) => (b as HTMLButtonElement).click());
        expect((await saved(page)).meta.classicRun).toEqual(
          before.meta.classicRun,
        );
      } else await expect(page.locator(`#${id}`)).toBeEnabled();
    }
    const action = level === 2 ? "classic-easier" : "classic-harder";
    await page.locator(`#${action}`).click();
    await expect(page.locator("#win")).toBeHidden();
    const selected = (await saved(page)).meta.classicRun.difficulty;
    expect(selected).toBe(level === 2 ? 1 : level + 1);
    await page.reload();
    expect((await saved(page)).meta.classicRun.difficulty).toBe(selected);
  });

test("generated hard game clears through the UI and same-band play stays hard", async ({
  page,
}) => {
  const initial = await boot(page, 2);
  const proof = solveClassic(initial.sessions.classic.current.board, 2, 6000)!;
  await page.locator("#resume").click();
  let additions = 0;
  for (const [n, action] of proof.entries()) {
    if (action === null) {
      await expect(page.locator("#add")).toHaveAttribute(
        "aria-disabled",
        "false",
      );
      await page.locator("#add").click();
      additions++;
    } else await move(page, action);
    if (n < proof.length - 1) await expect(page.locator("#undo")).toBeEnabled();
  }
  expect(additions).toBeGreaterThan(0);
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#classic-harder")).toBeDisabled();
  await page.locator("#play-again").click();
  await expect(page.locator("#win")).toBeHidden();
  const p = await saved(page);
  expect(p.meta.classicRun.difficulty).toBe(2);
  expect(p.sessions.classic.current.board).not.toEqual(
    initial.sessions.classic.current.board,
  );
  expect(p.meta.completed).toBe(1);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
])
  for (const theme of ["light", "dark"])
    test(`result fits one row at ${viewport.width}x${viewport.height}, ${theme}, large text`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await boot(page, 1, true);
      await page.locator("#resume").click();
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.addStyleTag({ content: "body {font-size:22px}" });
      await page.locator("#result-next").scrollIntoViewIfNeeded();
      const rects = await Promise.all(
        ["classic-easier", "play-again", "classic-harder"].map((id) =>
          page.locator(`#${id}`).boundingBox(),
        ),
      );
      for (const rect of rects) {
        expect(rect!.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(rect!.y - rects[0]!.y)).toBeLessThan(1);
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width);
      }
      const colors = await page
        .locator("#result-next > button")
        .evaluateAll((buttons) =>
          buttons.map((b) => getComputedStyle(b).backgroundColor),
        );
      expect(new Set(colors).size).toBe(3);
      for (const id of ["classic-easier", "classic-harder"]) {
        expect(
          await page.locator(`#${id}`).evaluate((button) => {
            const text = document.createRange();
            text.selectNodeContents(button);
            return (
              text.getClientRects().length === 1 &&
              button.scrollWidth <= button.clientWidth
            );
          }),
        ).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/classic-difficulty/${viewport.width}-${theme}.png`,
      });
    });
