import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { install, key } from "../e2e/help-test-utils.ts";
import fs from "node:fs/promises";
const project = process.env.SEEDS_AUDIT_PROJECT ?? process.cwd(),
  label = process.argv[2] ?? "after",
  base = process.env.SEEDS_UI_EVIDENCE ?? "test-results/help-ui",
  out = base + "/" + label;
await fs.mkdir(out, { recursive: true });
const server = await createServer({
  root: project,
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM,
  args: ["--no-sandbox"],
});
const wait = (page) => page.waitForTimeout(750);
const words = [];
for (const profile of ["magnet", "plan", "a3", "trials", "shuffle"]) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5188",
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: out + "/raw", size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await install(page, "ready", profile);
  await page.locator("#menu").click();
  await page
    .locator(
      ["trials", "shuffle"].includes(profile) ? "#qa-lab" : "#qa-help-scene",
    )
    .click();
  await wait(page);
  const snap = (name) => page.screenshot({ path: out + "/" + name + ".png" });
  if (profile === "magnet" || profile === "plan" || profile === "a3") {
    const trigger = profile === "a3" ? "hint" : profile;
    await snap(profile + "-board");
    await page.locator("#" + trigger).click();
    await expect(page.locator("#hint-offer")).toBeVisible();
    await wait(page);
    await snap(profile + "-offer");
    words.push({
      profile,
      words: (await page.locator("#hint-offer").innerText())
        .split(/\s+/)
        .filter(Boolean).length,
    });
    await page.locator("#watch-hints").click();
    if (profile === "a3") {
      await expect(page.locator("#qa-ad")).toBeVisible();
      await page.waitForTimeout(400);
      await page.locator("#qa-ad").click();
      await wait(page);
      await snap("hint-auto");
    } else if (profile === "magnet") {
      await expect(page.locator("#remaining")).toHaveText("4");
      await wait(page);
      await snap("magnet-applied");
      await page.locator("#undo").click();
      await wait(page);
      await snap("magnet-undo");
      await page.locator("#magnet").click();
      await wait(page);
      await page.locator("#watch-hints").click();
      await wait(page);
      for (const [a, b] of [
        [4, 15],
        [2, 16],
      ]) {
        await page.locator(`[data-index="${a}"]`).click();
        await page.locator(`[data-index="${b}"]`).click();
        await wait(page);
      }
      await page.waitForTimeout(900);
      await snap("magnet-finish");
    } else {
      await wait(page);
      await snap("plan-step-1");
      await page.locator('[data-index="0"]').click();
      await page.locator('[data-index="1"]').click();
      await wait(page);
      await snap("plan-step-2");
      await page.locator("#undo").click();
      await wait(page);
      await snap("plan-undo");
      const p = await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)),
        key,
      );
      for (const [a, b] of p.meta.attempts.classic.help.plan.intent.proof) {
        await page.locator(`[data-index="${a}"]`).click();
        await page.locator(`[data-index="${b}"]`).click();
        await wait(page);
      }
      await page.waitForTimeout(900);
      await snap("plan-finish");
    }
  } else if (profile === "trials") {
    await snap("trials-start");
    await page.locator("#lab-task").selectOption("trial-2");
    for (const pair of [[4, 5], null, [0, 9], [3, 6], null, [1, 9], [2, 10]]) {
      if (pair) {
        for (const n of pair)
          await page.locator(`[data-lab-index="${n}"]`).click();
      } else await page.locator("#lab-add").click();
      await page.waitForTimeout(300);
    }
    await wait(page);
    await snap("trials-stopped");
    await page.locator("#lab-bonus").click();
    await wait(page);
    await snap("trials-mock");
    await page.locator("#lab-earn").click();
    await wait(page);
    await snap("trials-extra");
    await page.locator("#lab-undo").click();
    await wait(page);
    await snap("trials-replay");
  } else {
    await snap("shuffle-start");
    await page.locator("#shuffle-preview").click();
    await wait(page);
    await snap("shuffle-preview");
    await page.locator("#shuffle-confirm").click();
    await wait(page);
    await snap("shuffle-applied");
    const p = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("seeds-bits.lab.shuffle.v1")),
    );
    for (const n of p.entitlement.proof.pair)
      await page.locator(`[data-shuffle-index="${n}"]`).click();
    await wait(page);
    await snap("shuffle-move");
    await page.locator("#lab-undo").click();
    await wait(page);
    await page.locator("#lab-undo").click();
    await wait(page);
    await snap("shuffle-undo");
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({
    content: "footer .action,.help-lab button{font-size:22px!important}",
  });
  await wait(page);
  await snap(profile + "-large-text");
  const video = page.video();
  await context.close();
  await fs.rename(await video.path(), out + "/" + profile + ".webm");
}
await fs.writeFile(out + "/offer-words.json", JSON.stringify(words, null, 2));
await browser.close();
await server.close();
console.log(JSON.stringify(words));
