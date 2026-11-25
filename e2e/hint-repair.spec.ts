import { test, expect, type Page } from "@playwright/test";
import { bookV5Fixture } from "./content-v5-fixture";
import { commit, removePair } from "../src/core";
import { packSession } from "../src/history-codec";
import { puzzleSession } from "../src/puzzles";

const id = "book-v1-1821", key = "seeds-bits.progress.v2";
const task = bookV5Fixture(id);
const original = puzzleSession(task);
const forked = commit(original, removePair(task.board, 2, 3), "pair", 0);
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
const cell = (page: Page, i: number) => page.locator(`#board button[data-index="${i}"]`);
const hinted = (page: Page) => page.locator("#board .hinted");

async function open(page: Page, session = original) {
  const save = { version:9, active:id, done:[], hints:{}, seen:[], bookRevisions:{[id]:5},
    sessions:{[id]:packSession(session)} };
  await page.addInitScript(({key, save}) => {
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}));
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
  }, {key,save});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(process.env.SEEDS_BASELINE_HINT ?? "/");
  await page.locator("#resume").click();
}

for (const [width,height] of [[320,568],[390,844]]) {
  test(`audited alternative gives a verified hint after reload at ${width}×${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await open(page);
    await cell(page,2).click();
    await cell(page,3).click();
    await expect.poll(async ()=>(await stored(page)).sessions[id].current.board).toEqual(forked.current.board);
    await page.reload();
    await page.locator("#resume").click();
    const before = await stored(page);
    await page.locator("#hint").click();
    if (process.env.SEEDS_BASELINE_HINT) {
      await expect(page.locator("#status")).toContainText("Пока не удалось проверить");
      expect((await stored(page)).sessions[id]).toEqual(before.sessions[id]);
      await expect(hinted(page)).toHaveCount(0);
      return;
    }
    await expect(hinted(page)).toHaveCount(2);
    const [a,b] = await hinted(page).evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.index)));
    const next = removePair(forked.current.board,a,b);
    await expect(page.locator("#recover-task")).toBeHidden();
    const after = await stored(page);
    expect(after.sessions[id].packedHistory).toEqual(before.sessions[id].packedHistory);
    expect(after.hints[id]).toBe(1);
    if (await page.locator("#hint-jump").isVisible()) await page.locator("#hint-jump").click();
    await cell(page,a).click();
    await cell(page,b).click();
    await expect.poll(async ()=>(await stored(page)).sessions[id].current.board).toEqual(next);
    await page.locator("#undo").click();
    await expect.poll(async ()=>(await stored(page)).sessions[id].current.board).toEqual(forked.current.board);
    await page.locator("#hint").click();
    await expect(hinted(page)).toHaveCount(2);
    expect(await hinted(page).evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.index)))).toEqual([a,b]);
  });
}

test("worker UNKNOWN and proven dead never spend a hint or restore the field", async ({page}) => {
  const withoutHistory = { ...forked, history: [] };
  await open(page, withoutHistory);
  const before = await stored(page);
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText("Пока не удалось проверить");
  await expect(hinted(page)).toHaveCount(0);
  expect((await stored(page)).hints).toEqual(before.hints);
  expect((await stored(page)).sessions[id].current.board).toEqual(before.sessions[id].current.board);
  await page.evaluate(({key,id})=>{
    const save = JSON.parse(localStorage.getItem(key)!);
    save.sessions[id].current.board = [1,2];
    localStorage.setItem(key, JSON.stringify(save));
  },{key,id});
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText("Из этой позиции решения нет");
  await expect(page.locator("#restart-task")).toBeVisible();
  await expect(hinted(page)).toHaveCount(0);
  expect((await stored(page)).hints).toEqual(before.hints);
});

test("Undo discards an already computed worker reply before it reaches the game", async ({page}) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(script: string | URL, options?: WorkerOptions) {
        super(script, options);
        if (!String(script).includes("advice-worker")) return;
        this.addEventListener("message", event => {
          event.stopImmediatePropagation();
          (window as any).releaseAdvice = () => this.onmessage?.(event);
        });
      }
    };
  });
  await open(page, forked);
  await page.locator("#hint").click();
  await page.waitForFunction(() => Boolean((window as any).releaseAdvice));
  await page.locator("#undo").click();
  await expect.poll(async ()=>(await stored(page)).sessions[id].current.board).toEqual(task.board);
  await page.evaluate(()=>(window as any).releaseAdvice());
  await expect(hinted(page)).toHaveCount(0);
  await expect(page.locator("#hint")).toBeEnabled();
  expect((await stored(page)).hints[id]).toBeUndefined();
});
