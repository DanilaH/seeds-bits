import { expect, type Page } from "@playwright/test";
import { classic } from "../src/core";

const key = "seeds-bits.progress.v2";

/** Home resume persists the party before closing the modal and restoring scroll. */
export async function resumeStoredGame(page: Page) {
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
}

/** Fixtures for tests exercising the legacy, already assigned Classic board. */
export async function installLegacyClassic(page: Page) {
  await page.addInitScript(({key,board}) => {
    if (localStorage.getItem(key) || localStorage.getItem("seeds-bits.session.v1")) return;
    const prefs = JSON.parse(localStorage.getItem("seeds-bits.settings.v1") ?? "{}");
    if (!prefs.tutorialDone) return;
    localStorage.setItem(key,JSON.stringify({
      version:3,active:"classic",done:[],seen:[],hints:{},
      sessions:{classic:{rules:1,current:{board,scroll:0,moves:0,additions:0},history:[]}},
      meta:{version:2,since:"2026-11-24T00:00:00.000Z",completed:0,unassisted:0,wallet:0,
        attempts:{classic:{id:"legacy-fixture",completed:false}},
        classicRun:{version:1,seed:73,difficulty:1,recent:[board.join("")],current:{attempt:"legacy-fixture",board}}},
    }));
  }, {key,board:classic()});
}

export async function openClassicNew(page: Page, level?: number) {
  const sheet = page.locator("#classic-new-sheet");
  if (!(await sheet.isVisible())) await page.locator("#classic-mode").click();
  const newGame = page.locator("#next-classic");
  if (await newGame.isVisible()) await newGame.click();
  if (level !== undefined) {
    const previous = await page.evaluate(key =>
      JSON.parse(localStorage.getItem(key) ?? "{}").meta?.attempts?.classic?.id, key);
    await sheet.locator(`[data-classic-level="${level}"]`).click();
    // An unfinished party asks for confirmation. Otherwise the click only
    // starts an async transaction; a hidden old #win is not its commit barrier.
    if (await page.locator("#confirm-content").isVisible()) return;
    await expect.poll(() => page.evaluate(({key,previous}) => {
      const p = JSON.parse(localStorage.getItem(key) ?? "{}");
      return p.meta?.attempts?.classic?.id !== previous &&
        p.meta?.attempts?.classic?.completed === false &&
        p.sessions?.classic?.current?.board?.some(Boolean);
    }, {key,previous})).toBe(true);
    await expect(page.locator("#dialog")).toBeHidden();
  }
}
export async function continueClassic(page: Page) {
  await page.locator("#classic-mode").click();
  await page.locator("#classic-resume").click();
}
export async function returnToGame(page: Page) {
  const dialog = page.locator("#dialog");
  for (let depth=0;depth<6 && await dialog.isVisible();depth++) {
    const screen = await dialog.getAttribute("data-screen");
    if (screen === "home") {
      await page.locator("#resume").click();
      break;
    }
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("data-screen",screen ?? "");
  }
  await expect(dialog).toBeHidden();
}
export async function requestRestartFromSettings(page: Page) {
  if (!(await page.locator("#new").isVisible())) await page.locator("#settings-open").click();
  await page.locator("#new").click();
}
