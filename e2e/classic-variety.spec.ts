import { test, expect, type Page } from "@playwright/test";
import {
  classicCatalog,
  newClassicDeals,
  takeClassicDeal,
} from "../src/classic-deals";
import { fresh, metadata, startAttempt } from "../src/progress";
import proofs from "../scripts/classic-variety/proofs.json" with { type: "json" };
const key = "seeds-bits.progress.v2";
async function saved(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    key,
  );
}
async function boot(page: Page, family?: string) {
  const p = fresh(),
    m = metadata(p);
  if (family) {
    startAttempt(p, "classic");
    m.classicDeals = newClassicDeals(73);
    m.classicDeals.bag = [
      classicCatalog.findIndex((entry) => entry.family === family),
    ];
    p.sessions.classic = takeClassicDeal(m.classicDeals, m.attempts.classic.id);
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
}
async function move(page: Page, pair: number[]) {
  await page.locator(`[data-index="${pair[0]}"]`).click();
  await page.locator(`[data-index="${pair[1]}"]`).click();
}
test("new fields rotate, while resume, mode changes and relaunch retain the deal", async ({
  page,
}) => {
  await boot(page);
  const legacy = (await saved(page)).sessions.classic;
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  expect((await saved(page)).sessions.classic).toEqual(legacy);
  const ids: number[] = [];
  for (let n = 0; n < 9; n++) {
    await page.locator("#next-classic").click();
    await expect(page.locator("#dialog")).not.toBeVisible();
    const p = await saved(page);
    ids.push(p.meta.classicDeals.current.id);
    await expect(page.locator("#hint")).toBeEnabled();
    await page.reload();
    expect((await saved(page)).sessions.classic.current.board).toEqual(
      p.sessions.classic.current.board,
    );
    await page.locator("#book-mode").click();
    await page.locator('[data-game="book-v1-1"]').click();
    await page.locator("#menu").click();
    await page.locator("#classic-mode").click();
    expect((await saved(page)).sessions.classic.current.board).toEqual(
      p.sessions.classic.current.board,
    );
    await page.locator("#menu").click();
  }
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(ids.map((id) => classicCatalog[id].family)).size).toBe(4);
});
test("cancel is inert; restart repeats its layout without repaying seeds or consuming a deal", async ({
  page,
}) => {
  await boot(page, "bridges");
  const initial = await saved(page);
  const id = initial.meta.classicDeals.current.id;
  const pair = proofs[id][0]!;
  await page.locator("#resume").click();
  await move(page, pair);
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  const moved = await saved(page);
  await page.locator("#next-classic").click();
  await expect(page.locator("#confirm-new")).toHaveText("Открыть другое поле");
  await page.locator("#cancel-new").click();
  expect((await saved(page)).sessions).toEqual(moved.sessions);
  expect((await saved(page)).meta.classicDeals).toEqual(
    moved.meta.classicDeals,
  );
  await page.locator("#new").click();
  await expect(page.locator("#confirm-new")).toHaveText("Начать заново");
  await page.locator("#confirm-new").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const restarted = await saved(page);
  expect(restarted.sessions.classic.current.board).toEqual(
    initial.sessions.classic.current.board,
  );
  expect(restarted.meta.classicDeals.bag).toEqual(moved.meta.classicDeals.bag);
  expect(restarted.meta.classicDeals.recent).toEqual(
    moved.meta.classicDeals.recent,
  );
  expect(restarted.meta.attempts.classic.id).not.toBe(
    moved.meta.attempts.classic.id,
  );
  await move(page, pair);
  await expect(page.locator("#undo")).toBeEnabled();
  expect((await saved(page)).jars.seeds).toBe(moved.jars.seeds);
});
test("failed replacement leaves the previous game and rotation intact, retry remains usable", async ({
  page,
}) => {
  await boot(page, "dense");
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
  await page.locator("#next-classic").click();
  await expect(page.locator("#retry-save")).toBeVisible();
  expect((await saved(page)).sessions.classic).toEqual(before.sessions.classic);
  expect((await saved(page)).meta.classicDeals).toEqual(
    before.meta.classicDeals,
  );
  await page.evaluate(() => (window as any).restoreStorage());
  await page.locator("#retry-save").click();
  await expect(page.locator("#retry-save")).toBeHidden();
  expect((await saved(page)).meta.classicDeals).toEqual(
    before.meta.classicDeals,
  );
  await page.locator("#next-classic").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect((await saved(page)).meta.classicDeals.recent).toHaveLength(2);
});
test("a full addition game clears through the real UI, and the result opens the next field", async ({
  page,
}) => {
  await boot(page, "addition");
  const p = await saved(page),
    id = p.meta.classicDeals.current.id;
  await page.locator("#resume").click();
  for (const [n, action] of proofs[id].entries()) {
    if (action === null) {
      await expect(page.locator("#add")).toHaveAttribute(
        "aria-disabled",
        "false",
      );
      await page.locator("#add").click();
    } else await move(page, action);
    if (n < proofs[id].length - 1)
      await expect(page.locator("#undo")).toBeEnabled();
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect
    .poll(async () => (await saved(page)).meta.attempts.classic.completed)
    .toBe(true);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#play-again").click();
  await expect(page.locator("#win")).not.toBeVisible();
  const next = await saved(page);
  expect(next.meta.classicDeals.current.id).not.toBe(id);
  expect(next.meta.completed).toBe(1);
  expect(next.sessions.classic.current.moves).toBe(0);
  await expect(page.locator("#hint")).toBeEnabled();
});
for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
])
  test(`classic actions and confirmation fit ${viewport.width}x${viewport.height} with large text`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await boot(page, "bridges");
    await page.addStyleTag({ content: "body {font-size: 22px}" });
    for (const selector of ["#resume", "#next-classic"]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      const rect = await page.locator(selector).boundingBox();
      expect(rect!.width).toBeGreaterThan(100);
      expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.locator("#resume").click();
    const p = await saved(page);
    await move(page, proofs[p.meta.classicDeals.current.id][0]!);
    await expect(page.locator("#undo")).toBeEnabled();
    await page.locator("#menu").click();
    await page.locator("#next-classic").click();
    await expect(page.locator("#confirm-new")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#cancel-new").click();
    await expect(page.locator("#resume")).toBeVisible();
  });
