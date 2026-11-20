import { expect, test } from "@playwright/test";
import { addNumbers, pairs } from "../src/core";
import { generateClassic, newClassicRun } from "../src/classic-generator";
import fixture from "../docs/porting/2026-11-20/double-add.json" with { type: "json" };
import { install, key } from "./help-test-utils";

test("a generated ordinary board needs two consecutive Adds to restore moves", async ({page}) => {
  const start = generateClassic(newClassicRun(fixture.seed), 1).board;
  expect(start).toEqual(fixture.start);
  await page.addInitScript(board => {
    if (localStorage.getItem("seeds-bits.settings.v1")) return;
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({tutorialDone: true}));
    localStorage.setItem("seeds-bits.session.v1", JSON.stringify({
      rules: 1, current: { board, moves: 0, additions: 0, scroll: 0 }, history: [],
    }));
  }, start);
  await page.goto("/");
  await page.locator("#resume").click();
  let remaining = start.length;
  for (const [a, b] of fixture.steps) {
    await page.locator(`#board [data-index="${a}"]`).click();
    await page.locator(`#board [data-index="${b}"]`).click();
    remaining -= 2;
    await expect(page.locator("#remaining")).toHaveText(String(remaining));
    await expect(page.locator("#undo")).toBeEnabled();
  }
  const add = page.locator("#add");
  const hint = page.locator("#hint");
  const board = () => page.evaluate(k =>
    JSON.parse(localStorage.getItem(k)!).sessions.classic.current.board, key);
  await expect.poll(board).toEqual(fixture.stuck);
  await expect(hint).toBeDisabled();
  await expect(add).toHaveAttribute("aria-label", "Добавить 8 цифр");
  await add.click();
  await expect.poll(board).toEqual(fixture.after);
  await expect(hint).toBeDisabled();
  await expect(add).toHaveAttribute("aria-label", "Добавить 16 цифр");
  await add.click();
  await expect.poll(board).toEqual(addNumbers(fixture.after));
  expect(pairs(await board())).toHaveLength(fixture.pairsAfterSecondAdd);
  await expect(hint).toBeEnabled();
});

test("a dead end remains playable with an exhausted hint wallet and five prior Adds", async ({page}) => {
  await install(page, "ready");
  await page.evaluate(k => {
    const progress = JSON.parse(localStorage.getItem(k)!);
    progress.version = 3;
    progress.sessions.classic = {
      rules: 1, current: { board: [1, 9, 3, 4], scroll: 0, moves: 0, additions: 5 },
      history: [],
    };
    localStorage.setItem(k, JSON.stringify(progress));
  }, key);
  await page.reload();
  await page.locator("#resume").click();
  const add = page.locator("#add");
  const hint = page.locator("#hint");
  await expect(add).toHaveAttribute("aria-disabled", "true");
  await add.click({force: true});
  await expect(page.locator("#status")).toContainText("ещё есть пары");
  await hint.click();
  await expect(page.locator("#watch-hints")).toBeVisible();
  await page.keyboard.press("Escape");
  for (const index of [0, 1]) {
    await page.locator(`#board [data-index="${index}"]`).click();
  }
  await expect(hint).toBeDisabled();
  await expect(page.locator("#watch-hints")).toBeHidden();
  const uses = () => page.evaluate(k =>
    JSON.parse(localStorage.getItem(k)!).sessions.classic.current.additions, key);
  for (const [label, expected] of [["Добавить 2 цифры", 6], ["Добавить 4 цифры", 7]] as const) {
    await expect(add).toHaveAttribute("aria-label", label);
    await add.click();
    await expect.poll(uses).toBe(expected);
  }
  const budget = await page.evaluate(k => {
    const progress = JSON.parse(localStorage.getItem(k)!);
    return {
      wallet: progress.meta.wallet,
      debits: progress.meta.attempts.classic.hintKeys,
      adRequests: (window as Window & {requests?: unknown[]}).requests,
    };
  }, key);
  expect(budget).toEqual({wallet: 0, debits: ["used1", "used2", "used3"], adRequests: []});
});
