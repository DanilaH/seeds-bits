import { openClassicNew, continueClassic } from "./restore-game";
import { test, expect, type Page } from "@playwright/test";
import {
  classicCatalog,
  newClassicDeals,
  takeClassicDeal,
} from "../src/classic-deals";
import {
  CLASSIC_START_COUNTS,
  generateClassic,
  newClassicRun,

  takeGeneratedClassic,
  type ClassicDifficulty,
} from "../src/classic-generator";
import { classic, commit, occupied, pairs, removePair } from "../src/core";
import { fresh, metadata, startAttempt } from "../src/progress";
const key = "seeds-bits.progress.v2";
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), key);
async function boot(
  page: Page,
  level: ClassicDifficulty = 1,
  completed = false,
  legacy = false,
  prepare?: (progress: ReturnType<typeof fresh>) => void,
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
  prepare?.(p);
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
  await expect(page.locator("#classic-mode")).toBeVisible();
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
  const sizes = new Set<number>();
  for (let n = 0; n < 9; n++) {
    await openClassicNew(page);
    await expect(page.locator("#classic-new-sheet")).toBeVisible();
    await page.locator('#classic-new-sheet [data-classic-level="1"]').click();
    await page.locator("#confirm-new").click();
    await expect(page.locator("#dialog")).not.toBeVisible();
    const p = await saved(page),
      board = p.sessions.classic.current.board;
    const digits = board.filter(Boolean);
    expect(CLASSIC_START_COUNTS[1]).toContain(digits.length);
    sizes.add(digits.length);
    if (digits.length === 28) expect(digits.sort()).toEqual(classic().sort());
    expect(p.meta.classicRun.difficulty).toBe(1);
    expect(p.meta.classicDeals).toBeUndefined();
    fields.add(board.join(""));
    await page.reload();
    expect((await saved(page)).sessions.classic.current.board).toEqual(board);
    await page.locator("#book-mode").click();
    await page.locator('[data-game="book-v1-1"]').click();
    await page.locator("#menu").click();
    await continueClassic(page);
    expect((await saved(page)).sessions.classic.current.board).toEqual(board);
    await page.locator("#menu").click();
  }
  expect(fields.size).toBe(9);
  expect(sizes).toEqual(new Set(CLASSIC_START_COUNTS[1]));
});

test("cancel retains the band; restart repeats the generated field without repaying seeds", async ({
  page,
}) => {
  const initial = await boot(page, 2);
  const proof = generateClassic(newClassicRun(73), 2).proof;
  await page.locator("#resume").click();
  await move(page, proof[0]!);
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  const moved = await saved(page);
  await openClassicNew(page,1);
  await expect(page.locator("#confirm-new")).toHaveText("Начать новую партию");
  await page.locator("#cancel-new").click();
  expect((await saved(page)).sessions).toEqual(moved.sessions);
  expect((await saved(page)).meta.classicRun).toEqual(moved.meta.classicRun);
  await page.locator("#settings-open").click();
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
  await openClassicNew(page,1);
  await page.locator("#confirm-new").click();
  await expect(page.locator("#retry-save")).toBeVisible();
  expect((await saved(page)).sessions.classic).toEqual(before.sessions.classic);
  expect((await saved(page)).meta.classicRun).toEqual(before.meta.classicRun);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.locator("#retry-save").click();
  await expect(page.locator("#retry-save")).toBeHidden();
  expect((await saved(page)).meta.classicRun).toEqual(before.meta.classicRun);
  await page.locator("#cancel-new").click();
  await openClassicNew(page,1);
  await page.locator("#confirm-new").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect((await saved(page)).meta.classicRun.difficulty).toBe(1);
  expect((await saved(page)).meta.classicRun.recent).toHaveLength(2);
});

for (const level of [0, 1, 2, 3] as ClassicDifficulty[])
  test(`completed Classic uses Home and a new difficulty selection ${level}`, async ({page})=>{
    await boot(page,level,true);
    await expect(page.locator("#resume")).toHaveText("Начать");
    await expect(page.locator("#classic-mode")).toBeVisible();
    const requested = level===3?2:level+1;
    await openClassicNew(page,requested);
    await expect(page.locator("#dialog")).toBeHidden();
    expect((await saved(page)).meta.classicRun.difficulty).toBe(requested);
    await page.reload();
    expect((await saved(page)).meta.classicRun.difficulty).toBe(requested);
  });

test("generated hard game clears through the UI and same-band play stays hard", async ({
  page,
}) => {
  const initial = await boot(page, 2);
  const deal = generateClassic(newClassicRun(73), 2);
  const proof = deal.choice
    ? [...deal.proof.slice(0, deal.choice.at), ...deal.choice.alternative]
    : deal.proof;
  await page.locator("#resume").click();
  for (const [n, action] of proof.entries()) {
    if (action === null) {
      await expect(page.locator("#add")).toHaveAttribute(
        "aria-disabled",
        "false",
      );
      await page.locator("#add").click();
    } else await move(page, action);
    if (n < proof.length - 1) await expect(page.locator("#undo")).toBeEnabled();
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#result-actions button:visible")).toHaveCount(2);
  await page.locator("#result-home").click();
  await expect(page.locator("#dialog")).toBeVisible();
  await openClassicNew(page,2);
  await expect(page.locator("#win")).toBeHidden();
  const p = await saved(page);
  expect(p.meta.classicRun.difficulty).toBe(2);
  expect(p.sessions.classic.current.board).not.toEqual(
    initial.sessions.classic.current.board,
  );
  expect(p.meta.completed).toBe(1);
});

for (const viewport of [{width:320,height:568},{width:844,height:390}])
  for (const theme of ["light","dark"])
    test(`only Classic result action fits enlarged ${viewport.width}×${viewport.height} ${theme}`, async ({page})=>{
      await page.setViewportSize(viewport);
      const complete = await boot(page,1);
      // Use a real final pair so completed Classic is never resumed from Home.
      await page.evaluate(({key,complete})=>{
        complete.sessions.classic.current.board=[5,5];
        localStorage.setItem(key,JSON.stringify(complete));
      },{key,complete});
      await page.reload();
      await page.locator("#resume").click();
      await move(page,[0,1]);
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.addStyleTag({content:"body{font-size:22px}"});
      await expect(page.locator("#result-actions button:visible")).toHaveCount(2);
      await expect(page.locator("#play-again")).toBeInViewport();
      await expect(page.locator("#result-home")).toHaveText("В меню");
    });
test("Expert keeps its scroll, move and Undo after restarting above a 50px banner", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const original = await boot(page, 3);
  await page.locator("#resume").click();
  const viewport = page.locator("#viewport");
  const edgeState = () => viewport.evaluate(e => [
    e.hasAttribute("data-scroll-above"),
    e.hasAttribute("data-scroll-below"),
    getComputedStyle(e).maskImage !== "none",
  ]);
  const regular = await viewport.evaluate(e => [e.clientHeight, e.scrollHeight]);
  await page.evaluate(() => document.documentElement.classList.add("has-mobile-ads"));
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.classList.add("has-mobile-ads");
    }, { once: true });
  });
  const reserved = await viewport.evaluate(e => [e.clientHeight, e.scrollHeight]);
  expect(reserved[1]).toBeGreaterThan(reserved[0]);
  await expect(page.locator(".status-wrap")).toHaveCSS("height", "48px");
  await expect(page.locator("#status")).toHaveCSS("font-size", "14px");
  await expect.poll(edgeState).toEqual([false, true, true]);
  await viewport.evaluate(e => e.scrollTop = (e.scrollHeight - e.clientHeight) / 2);
  await expect.poll(edgeState).toEqual([true, true, true]);
  await viewport.evaluate(e => e.scrollTop = e.scrollHeight);
  await expect.poll(edgeState).toEqual([true, false, true]);
  const board = original.sessions.classic.current.board;
  const count = occupied(board);
  const visible = await page.locator("#board").evaluate(board =>
    [...board.querySelectorAll<HTMLButtonElement>("button[data-index]")].filter(cell =>
      !cell.disabled && cell.getBoundingClientRect().top >=
        document.querySelector("#viewport")!.getBoundingClientRect().top).map(cell => Number(cell.dataset.index)),
  );
  const bottom = pairs(board).reverse().find(({ a, b }) => visible.includes(a) && visible.includes(b))!;
  expect(bottom).toBeDefined();
  await move(page, [bottom.a, bottom.b]);
  await expect(page.locator("#remaining")).toHaveText(String(count - 2));
  const scroll = await viewport.evaluate(e => e.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await page.locator("#menu").click();
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(count - 2));
  expect(await viewport.evaluate(e => e.scrollTop)).toBe(scroll);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText(String(count));
  await expect.poll(async () => (await saved(page)).sessions.classic.current.board).toEqual(board);
  await page.screenshot({ path: "test-results/classic-difficulty/expert-320-reserved.png" });
  await test.info().attach("viewport", {
    body: JSON.stringify({ regular, reserved }), contentType: "application/json",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(edgeState).toEqual([false, false, false]);
});

test("Expert Add copies the certified remainder, saves it and preserves Undo on reload", async ({ page }) => {
  const { board, proof: witness } = generateClassic(newClassicRun(73), 3, { size: 81, sparse: true });
  const original = await boot(page, 3, false, false, progress => {
    let session = progress.sessions.classic;
    session.current.board = board;
    const run = metadata(progress).classicRun!;
    run.current!.board = board;
    run.recent = [board.join("")];
    for (const action of witness) {
      if (!action) break;
      session = commit(session, removePair(session.current.board, ...action), "pair", 0);
    }
    progress.sessions.classic = session;
  });
  const beforeAdd = original.sessions.classic.current.board;
  const digits = beforeAdd.filter(Boolean);
  expect(digits.length % 2).toBe(1);
  await page.locator("#resume").click();
  await expect(page.locator("#add")).toHaveAttribute("aria-disabled", "false");
  await page.locator("#add").click();
  await expect(page.locator("#remaining")).toHaveText(String(digits.length * 2));
  await page.locator("#menu").click();
  await page.reload();
  await page.locator("#resume").click();
  expect((await saved(page)).sessions.classic.current.board).toEqual([...beforeAdd, ...digits]);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText(String(digits.length));
  await expect.poll(async () => (await saved(page)).sessions.classic.current.board).toEqual(beforeAdd);
});
