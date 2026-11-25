import { expect, type Page } from "@playwright/test";
import { classic } from "../src/core";

const key = "seeds-bits.progress.v2";

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
  if (level !== undefined) await sheet.locator(`[data-classic-level="${level}"]`).click();
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
