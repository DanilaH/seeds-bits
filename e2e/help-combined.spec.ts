import { test, expect, type Page } from "@playwright/test";
import { install, key } from "./help-test-utils";
test.use({ video: process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off" });
const state = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
test("All QA: switching from a separate profile preserves the existing board and saved stock", async ({
  page,
}) => {
  await install(page, "ready", "magnet");
  const before = await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.meta.help.inventory = { magnet: 3, plan: 4 };
    p.meta.help.demo = { magnet: true, plan: true };
    p.meta.wallet = 5;
    localStorage.setItem(k, JSON.stringify(p));
    return { board: p.sessions.classic, install: p.meta.help.install };
  }, key);
  await page.goto("/?qa=all");
  await page.locator("#resume").click();
  const after = await state(page);
  expect(after.sessions.classic).toEqual(before.board);
  expect(after.meta.help.install).toBe(before.install);
  expect(after.meta.help.inventory).toEqual({ magnet: 3, plan: 4 });
  expect(after.meta.help.demo).toEqual({ magnet: true, plan: true });
  expect(after.meta.wallet).toBe(5);
  await page.locator("#menu").click();
  await expect(page.locator("#qa-trials-lab")).toBeVisible();
  await expect(page.locator("#qa-shuffle-lab")).toBeVisible();
});
async function scene(page: Page, kind = "magnet") {
  await install(page, "ready", "all");
  await page.locator("#menu").click();
  await page.locator(`#qa-${kind}-scene`).click();
}
async function fitFooter(page: Page) {
  const errors = await page.locator("footer").evaluate((root) => {
    const buttons = [
        ...root.querySelectorAll<HTMLButtonElement>("button"),
      ].filter((n) => !n.hidden && n.getBoundingClientRect().width),
      errors: string[] = [];
    for (const button of buttons) {
      const box = button.getBoundingClientRect(),
        walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects())
          if (
            r.x < box.x - 1 ||
            r.right > box.right + 1 ||
            r.y < box.y - 1 ||
            r.bottom > box.bottom + 1
          )
            errors.push("overflow " + button.id);
        for (const word of n.textContent.matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(n, word.index!);
          r.setEnd(n, word.index! + word[0].length);
          if (r.getClientRects().length > 1)
            errors.push("broken word " + word[0]);
        }
      }
    }
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i].getBoundingClientRect(),
          b = buttons[j].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
        )
          errors.push("overlap");
      }
    return errors;
  });
  expect(errors).toEqual([]);
}
test("All QA: Magnet and Plan share one attempt, Undo/replay/reload retain both entitlements", async ({
  page,
}) => {
  await scene(page);
  await expect(page.locator("#magnet")).toBeVisible();
  await expect(page.locator("#plan")).toBeVisible();
  await page.locator("#magnet").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#plan").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
  let p = await state(page);
  const paid = p.meta.attempts.classic.help,
    proof = paid.plan.intent.proof;
  for (const n of proof[0])
    await page.locator(`#board [data-index="${n}"]`).click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("6");
  await expect(page.locator("#plan-rail")).toContainText("План на паузе");
  await page.locator("#magnet").click();
  await expect(page.locator("#watch-hints")).toHaveText("Повторить бесплатно");
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
  p = await state(page);
  expect(p.meta.help.demo).toEqual({ magnet: true, plan: true });
  expect(p.meta.attempts.classic.help.magnet.id).toBe(paid.magnet.id);
  expect(p.meta.attempts.classic.help.plan.id).toBe(paid.plan.id);
  expect(
    p.meta.help.assignments.some(
      (a: any) => a.experiment === "seeds-all-qa-v1" && a.qa,
    ),
  ).toBe(true);
  for (const [step, pair] of proof.entries()) {
    for (const n of pair)
      await page.locator(`#board [data-index="${n}"]`).click();
    await expect(page.locator("#remaining")).toHaveText(
      String(4 - 2 * (step + 1)),
    );
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#result-assistance")).toHaveText(
    "С Планом и Магнитом",
  );
  await page.evaluate(() => {
    const w = window as any;
    w.__SEEDS_ADS_TEST__.show = async (o: any) => {
      w.requests.push(o);
      return { status: "skipped", reason: "cooldown" };
    };
  });
  await page.locator("#try-notebook").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
  expect(
    await page.evaluate(
      () =>
        (window as any).requests.filter((r: any) => r.kind === "interstitial")
          .length,
    ),
  ).toBe(1);
});
test("All QA: both lab modes remain playable and saved without replacing Classic", async ({
  page,
}) => {
  await install(page, "ready", "all");
  const classic = (await state(page)).sessions.classic;
  await page.locator("#menu").click();
  await page.locator("#qa-trials-lab").click();
  await page.locator("#lab-add").click();
  await expect(page.locator("#lab-budget")).toHaveText("Добавлений: 1");
  await page.locator("#lab-close").click();
  await page.locator("#qa-shuffle-lab").click();
  await page.locator("#shuffle-preview").click();
  await page.locator("#shuffle-confirm").click();
  await expect(page.locator("#shuffle-board .lab-guided")).toHaveCount(2);
  await page.locator("#lab-close").click();
  await page.locator("#qa-trials-lab").click();
  await expect(page.locator("#lab-budget")).toHaveText("Добавлений: 1");
  await page.locator("#lab-close").click();
  expect((await state(page)).sessions.classic).toEqual(classic);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  await page.locator("#qa-shuffle-lab").click();
  await expect(page.locator("#shuffle-board .lab-guided")).toHaveCount(2);
  await page.locator("#lab-close").click();
  await page.locator("#qa-trials-lab").click();
  await expect(page.locator("#lab-budget")).toHaveText("Добавлений: 1");
});
test("All QA: rewarded hint still reveals automatically and leaves two credits", async ({
  page,
}) => {
  await scene(page, "a3");
  await expect(page.locator("#hint-count")).toContainText("+3");
  await page.locator("#hint").click();
  await page.locator("#watch-hints").click();
  await page.locator("#qa-ad").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  expect((await state(page)).meta.wallet).toBe(2);
});
for (const [width, height] of [
  [390, 844],
  [320, 568],
  [568, 320],
])
  for (const theme of ["light", "dark"])
    test(`All QA: five actions fit ${width}×${height} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await scene(page);
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await expect(page.locator("footer button:not([hidden])")).toHaveCount(5);
      for (const large of [false, true]) {
        if (large)
          await page.addStyleTag({
            content: "footer .action{font-size:22px!important}",
          });
        await page.waitForTimeout(100);
        await fitFooter(page);
        const footer = (await page.locator("footer").boundingBox())!;
        expect(footer.y + footer.height).toBeGreaterThanOrEqual(height - 120);
        for (const id of ["magnet", "plan"]) {
          const box = (await page.locator("#" + id).boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
        }
      }
    });
