import { expect, test, type Page } from "@playwright/test";
import { addNumbers, checkPair, occupied, removePair } from "../src/core";
import { key } from "./help-test-utils";

const cell = (page: Page, i: number) => page.locator(`#board button[data-index="${i}"]`);
const field = (entries: Record<number, number>) => Array.from({
  length: Math.max(...Object.keys(entries).map(Number)) + 1,
}, (_, i) => entries[i] ?? 0);
const snapshot = (page: Page) => page.evaluate(key => {
  const save = JSON.parse(localStorage.getItem(key)!);
  return save.sessions[save.active].current;
}, key);

async function open(page: Page, board: number[], active = "classic", theme = "dark", sound?: boolean) {
  await page.addInitScript(({ key, board, active, theme, sound }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem("seeds-bits.feel-pilot.v1", JSON.stringify({profile: "baseline", pack: "dry"}));
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({
      tutorialDone: true, sound, vibration: false, theme, languageChoice: "en",
    }));
    localStorage.setItem(key, JSON.stringify({
      version: 3, active, done: [], seen: [], hints: {},
      sessions: {[active]: {rules: 1, current: {board, moves: 0, additions: 0, scroll: 0}, history: []}},
    }));
  }, {key, board, active, theme, sound});
  await page.goto("/");
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
}

async function move(page: Page, a: number, b: number) {
  await cell(page, a).click();
  await cell(page, b).click();
}

test("a second legal pair can start in the same turn without selecting a profile", async ({page}) => {
  const board = field({0:2, 1:8, 2:4, 3:4, 4:1, 5:9});
  await open(page, board);
  const acceptedInSameTurn = await page.evaluate(() => {
    const at = (index: number) => document.querySelector<HTMLButtonElement>(`#board button[data-index="${index}"]`)!;
    at(0).click();
    at(1).click();
    at(2).click();
    const selected = at(2).classList.contains("selected");
    at(3).click();
    return selected;
  });
  expect(acceptedInSameTurn).toBe(true);
  const after = removePair(removePair(board, 0, 1), 2, 3);
  await expect.poll(async () => (await snapshot(page)).board).toEqual(after);
  await expect(page.locator("#remaining")).toHaveText(String(occupied(after)));
});

test("a tap during a two-row Feel slide selects the live surviving digit", async ({page}) => {
  const board = field({8:6, 9:4, 18:7, 19:3, 20:2, 21:8});
  await open(page, board);
  const duringSlide = await page.evaluate(() => {
    const at = (index: number) => document.querySelector<HTMLButtonElement>(`#board button[data-index="${index}"]`)!;
    at(8).click();
    at(9).click();
    const survivor = at(0);
    survivor.click();
    return {number: survivor.textContent, selected: survivor.classList.contains("selected"),
      index: survivor.dataset.index,
      ghosts: document.querySelectorAll(".feel-erase-layer span").length,
      rows: document.querySelectorAll(".collapsed-row").length};
  });
  expect(duringSlide).toEqual({number: "7", selected: true, index: "0", ghosts: 2, rows: 2});
  await cell(page, 1).click();
  await expect.poll(async () => (await snapshot(page)).moves).toBe(2);
  await page.locator("#undo").click();
  await expect.poll(async () => (await snapshot(page)).board).toEqual(removePair(board, 8, 9));
  await page.locator("#undo").click();
  await expect.poll(async () => (await snapshot(page)).board).toEqual(board);
});

test("twelve quick moves survive a reload and an Undo", async ({page}) => {
  const board = Array.from({length: 108}, () => 1);
  await open(page, board);
  const accepted = await page.evaluate(() => {
    for (let i = 0; i < 12; i++) {
      // Keep at least one digit per row so the rapid burst exercises only stable hitboxes.
      const index = Math.floor(i / 3) * 9 + 2 * (i % 3);
      document.querySelector<HTMLButtonElement>(`#board button[data-index="${index}"]`)!.click();
      document.querySelector<HTMLButtonElement>(`#board button[data-index="${index + 1}"]`)!.click();
    }
    return document.querySelector("#remaining")!.textContent;
  });
  expect(accepted).toBe("84");
  await expect.poll(async () => (await snapshot(page)).moves).toBe(12);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#undo").click();
  await expect.poll(async () => (await snapshot(page)).moves).toBe(11);
});

test("reduced motion preserves Add and Undo with the normal settings screen", async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await page.emulateMedia({reducedMotion: "reduce"});
  const board = [1, 2, 3];
  await open(page, board, "classic", "light", false);
  await page.locator("#add").click();
  await expect.poll(async () => (await snapshot(page)).board).toEqual(addNumbers(board));
  await expect(page.locator(".feel-erase-layer, .pair-wave, .collapsed-row")).toHaveCount(0);
  await page.locator("#undo").click();
  await expect.poll(async () => (await snapshot(page)).board).toEqual(board);
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await expect(page.locator("#core-feel-profile, #core-feel-pack")).toHaveCount(0);
  await expect(page.locator("#sound")).not.toBeChecked();
  await expect(page.locator("#vibration")).not.toBeChecked();
  await expect(page.locator("#magnet, #plan").locator("visible=true")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#core-feel-profile, #core-feel-pack")).toHaveCount(0);
  expect(await snapshot(page)).toMatchObject({board, moves: 0, additions: 0});
});

test("recorded sound plays by default offline, pauses and preserves independent opt-outs", async ({page, context}) => {
  await page.addInitScript(() => {
    const stats = {decoded: 0, plays: 0, suspends: 0};
    Object.assign(window, {feelAudioStats: stats});
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function (data) {
      const result = await decode.call(this, data);
      stats.decoded++;
      return result;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      stats.plays++;
      start.apply(this, args);
    };
    const suspend = AudioContext.prototype.suspend;
    AudioContext.prototype.suspend = function () {
      stats.suspends++;
      return suspend.call(this);
    };
  });
  const board = field({0:2, 1:8, 2:4, 3:4, 4:1, 5:9});
  await open(page, board, "classic", "light");
  const stats = () => page.evaluate(() => (window as unknown as {
    feelAudioStats: {decoded: number; plays: number; suspends: number};
  }).feelAudioStats);
  await expect.poll(async () => (await stats()).decoded).toBe(1);
  await context.setOffline(true);
  const initial = await stats();
  await move(page, 0, 1);
  await expect.poll(async () => (await stats()).plays).toBeGreaterThan(initial.plays);
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {configurable:true, value:true});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await stats();
  expect(paused.suspends).toBeGreaterThan(initial.suspends);
  await cell(page, 2).click();
  expect((await stats()).plays).toBe(paused.plays);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {configurable:true, value:false});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await expect(page.locator("#sound")).toBeChecked();
  await expect(page.locator("#core-feel-profile, #core-feel-pack")).toHaveCount(0);
  await page.locator("#sound").uncheck();
  await page.locator("#vibration").check();
  await expect(page.locator("#sound")).not.toBeChecked();
  await expect(page.locator("#vibration")).toBeChecked();
  const muted = await stats();
  await page.locator("#settings-back").click();
  await page.locator("#resume").click();
  await move(page, 2, 3);
  expect((await stats()).plays).toBe(muted.plays);
  expect((await stats()).decoded).toBe(1);
  await context.setOffline(false);
  await page.reload();
  await page.locator("#settings-open").click();
  await expect(page.locator("#sound")).not.toBeChecked();
  await expect(page.locator("#vibration")).toBeChecked();
});

for (const active of ["book-v1-4", "daily-v1-2026-11-19"]) {
  test(`clears a diagonal and awards the same completion once in ${active}`, async ({page}) => {
    const board = field({0:1, 10:9, 11:5, 12:5});
    expect(checkPair(board, 0, 10).ok).toBe(true);
    await open(page, board, active);
    await move(page, 0, 10);
    await expect(page.locator(".feel-erase-layer")).toHaveCount(0);
    await move(page, 2, 3);
    await expect(page.locator("#win")).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).board).toEqual([]);
    const done = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).done, key);
    expect(done.filter((id: string) => id === active)).toHaveLength(1);
  });
}
