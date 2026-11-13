import { test, expect, type Page } from "@playwright/test";
import { install, key } from "./help-test-utils";
const state = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
test.use({ video: process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off" });
async function plain(page: Page) {
  await expect(page.locator("#magnet")).toBeHidden();
  await expect(page.locator("#plan")).toBeHidden();
  await expect(page.locator("#plan-rail")).toBeHidden();
  expect(
    await page
      .locator("footer button:not([hidden])")
      .evaluateAll((ns) => ns.map((n) => n.id)),
  ).toEqual(["undo", "hint", "add"]);
}
test("Paused build hides owned assistants and plan guidance, preserves rights and uses ordinary hints", async ({
  page,
}) => {
  await install(page, "ready", "all");
  await page.locator("#menu").click();
  await page.locator("#qa-magnet-scene").click();
  await page.locator("#magnet").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#plan").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
  const before = await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.meta.help.inventory = { magnet: 2, plan: 3 };
    p.meta.wallet = 4;
    localStorage.setItem(k, JSON.stringify(p));
    return p;
  }, key);
  await page.goto("/?qa=baseline");
  await page.locator("#resume").click();
  await plain(page);
  await expect(page.locator(".hinted")).toHaveCount(0);
  let after = await state(page);
  expect(after.sessions.classic).toEqual(before.sessions.classic);
  expect(after.meta.attempts.classic.help).toEqual(
    before.meta.attempts.classic.help,
  );
  expect(after.meta.help.inventory).toEqual({ magnet: 2, plan: 3 });
  expect(after.meta.help.demo).toEqual(before.meta.help.demo);
  await page.locator("#menu").click();
  for (const id of [
    "qa-help-tools",
    "qa-lab",
    "qa-trials-lab",
    "qa-shuffle-lab",
    "qa-help-scene",
  ])
    await expect(page.locator("#" + id)).toHaveCount(0);
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  after = await state(page);
  expect(after.meta.attempts.classic.hintKeys).toHaveLength(1);
  expect(after.meta.wallet).toBe(4);
  await plain(page);
  const pair = await page
    .locator("#board .hinted")
    .evaluateAll((ns) =>
      ns.map((n) => Number((n as HTMLElement).dataset.index)),
    );
  for (const n of pair)
    await page.locator(`#board [data-index="${n}"]`).click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await plain(page);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("6");
  await plain(page);
  await page.locator("#add").click();
  await expect(page.locator("#remaining")).toHaveText("12");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("6");
  await plain(page);
  await page.goto("/?qa=all");
  await page.locator("#resume").click();
  await page.locator("#magnet").click();
  await expect(page.locator("#watch-hints")).toHaveText("Повторить бесплатно");
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
  after = await state(page);
  expect(after.meta.help.inventory).toEqual({ magnet: 2, plan: 3 });
  expect(after.meta.attempts.classic.help.plan).toEqual(
    before.meta.attempts.classic.help.plan,
  );
});
for (const kind of ["magnet", "plan"])
  test(`Paused build stores a pending ${kind} reward without exposing or applying it`, async ({
    page,
  }) => {
    await install(page, "ready", "baseline");
    const before = (await state(page)).sessions.classic;
    await page.evaluate(
      (kind) =>
        localStorage.setItem(
          "nativeHelp",
          JSON.stringify({
            version: 1,
            token: "pending-" + kind,
            attempt: "help-attempt",
            product: kind + "_1",
            intent_id: "old-" + kind,
            offer_id: "offer",
            ad_session_id: "session",
          }),
        ),
      kind,
    );
    await page.reload();
    await page.locator("#resume").click();
    await expect
      .poll(async () => (await state(page)).meta.help.inventory[kind])
      .toBe(1);
    await plain(page);
    expect((await state(page)).sessions.classic).toEqual(before);
    expect(await page.evaluate(() => (window as any).acks.length)).toBe(1);
    await expect(page.locator(".assist-ghost")).toHaveCount(0);
    await page.reload();
    await page.locator("#resume").click();
    expect((await state(page)).meta.help.inventory[kind]).toBe(1);
    await plain(page);
  });
test("Paused build keeps ordinary rewarded hints and automatic reveal", async ({
  page,
}) => {
  await install(page, "ready", "baseline");
  await plain(page);
  await expect(page.locator("#hint-count")).not.toContainText("+3");
  await page.locator("#hint").click();
  await page.locator("#watch-hints").click();
  await page.locator("#qa-ad").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  expect((await state(page)).meta.wallet).toBe(2);
  await plain(page);
});
test("Paused result hides assistant labels and starts a short task without the new ad route", async ({
  page,
}) => {
  await install(page, "ready", "baseline");
  await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.sessions.classic.current.board = [];
    p.meta.attempts.classic.completed = true;
    p.meta.attempts.classic.help = { version: 1, assisted: true };
    localStorage.setItem(k, JSON.stringify(p));
  }, key);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#result-assistance")).toBeHidden();
  await page.evaluate(() => {
    const w = window as any;
    w.__SEEDS_ADS_TEST__.show = async (o: any) => {
      w.requests.push(o);
      return { status: "skipped", reason: "not_loaded" };
    };
  });
  await page.locator("#try-notebook").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
  expect(await page.evaluate(() => (window as any).requests.length)).toBe(0);
});
