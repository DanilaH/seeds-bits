// Exercise the built public bundle; URL QA overrides and paid old rights must stay dormant.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

const out = 'test-results/store-baseline';
const key = 'seeds-bits.progress.v2';
const cases = [];
await mkdir(out, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
let browser;
try {
  browser = await chromium.launch(process.env.SEEDS_CHROMIUM
    ? { executablePath: process.env.SEEDS_CHROMIUM, args: ['--no-sandbox'] } : {});
  for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
    for (const dark of [false, true]) {
      const name = `${viewport.width}x${viewport.height}-${dark ? 'dark' : 'light'}`;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ key, dark }) => {
        if (sessionStorage.storeSeeded) return;
        sessionStorage.storeSeeded = '1';
        const board = [5, 5, 5, 5, 5, 5];
        const intent = kind => ({ version: 1, id: kind + '-intent', offer: 'saved-offer',
          product: kind + '_1', task: 'classic', attempt: 'store-attempt', rules: 1,
          algorithm: 'saved-v1', board, pair: [0, 1], after: [0, 0, 5, 5, 5, 5] });
        const help = { version: 1, assisted: true,
          magnet: { id: 'owned-magnet', intent: intent('magnet'), applications: [] },
          plan: { id: 'owned-plan', intent: intent('plan'), applications: [] } };
        localStorage.setItem('seeds-bits.settings.v1', JSON.stringify({ tutorialDone: true, theme: dark ? 'dark' : 'light', sound: false }));
        localStorage.setItem(key, JSON.stringify({ version: 3, active: 'classic',
          sessions: { classic: { rules: 1, current: { board, scroll: 0, moves: 0, additions: 0 }, history: [] } },
          hints: {}, done: [], seen: [], meta: { version: 2, wallet: 4, since: '2026-11-13', completed: 0,
            unassisted: 0, attempts: { classic: { id: 'store-attempt', completed: false, help } },
            help: { version: 1, install: 'store-install', inventory: { magnet: 2, plan: 3 },
              demo: { magnet: true, plan: true }, assignments: [] } } }));
      }, { key, dark });
      const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
      const plain = async () => {
        await expect(page.locator('#magnet')).toBeHidden();
        await expect(page.locator('#plan')).toBeHidden();
        await expect(page.locator('#plan-rail')).toBeHidden();
        assert.deepEqual(await page.locator('footer button:not([hidden])').evaluateAll(ns => ns.map(n => n.id)), ['undo', 'hint', 'add']);
      };
      await page.goto('http://127.0.0.1:4173/?qa=all');
      await page.locator('#resume').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', dark ? 'dark' : 'light');
      await plain();
      await expect(page.locator('#remaining')).toHaveText('6');
      await expect(page.locator('.hinted')).toHaveCount(0);
      const before = await saved();
      assert.deepEqual(before.meta.help.inventory, { magnet: 2, plan: 3 });
      assert(before.meta.help.assignments.some(a => a.experiment === 'seeds-help-base-v1' && !a.qa && a.variant === 'control'));
      assert(!before.meta.help.assignments.some(a => a.qa));
      await page.locator('#hint').click();
      await expect(page.locator('.hinted')).toHaveCount(2);
      const pair = await page.locator('#board .hinted').evaluateAll(ns => ns.map(n => n.dataset.index));
      for (const index of pair) await page.locator(`#board [data-index="${index}"]`).click();
      await expect(page.locator('#remaining')).toHaveText('4');
      await page.locator('#undo').click();
      await expect(page.locator('#remaining')).toHaveText('6');
      await page.locator('#add').click();
      await expect(page.locator('#remaining')).toHaveText('12');
      await page.locator('#undo').click();
      await expect(page.locator('#remaining')).toHaveText('6');
      await expect.poll(async () => (await saved()).sessions.classic.current.board.filter(Boolean).length).toBe(6);
      await page.reload();
      await page.locator('#resume').click();
      await plain();
      await expect(page.locator('#remaining')).toHaveText('6');
      const after = await saved();
      assert.deepEqual(after.meta.help.inventory, before.meta.help.inventory);
      assert.deepEqual(after.meta.attempts.classic.help, before.meta.attempts.classic.help);
      assert.equal(after.meta.wallet, 4);
      await page.locator('#menu').click();
      await expect(page.locator('#qa-help-tools, #qa-lab, #qa-trials-lab, #qa-shuffle-lab, #qa-help-scene')).toHaveCount(0);
      await page.screenshot({ path: `${out}/${name}.png` });
      assert.deepEqual(errors, []);
      cases.push({ name, passed: true, publicAssignment: true, urlOverrideIgnored: true,
        rightsAndStockRetained: true, hintPairUndoAddReload: true, pageErrors: errors });
      await context.close();
    }
  }
  console.log(`Public production baseline: ${cases.length} browser contracts passed`);
} finally {
  await writeFile(`${out}/acceptance.json`, JSON.stringify({ environment: 'Chromium, actual Vite production bundle; no live SDK', cases }, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
