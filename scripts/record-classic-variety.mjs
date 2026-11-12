// Scripted real browser interaction, not a human playtest. No analytics/ad service.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
const out = path.resolve("test-results/classic-variety");
await fs.mkdir(out, { recursive: true });
const catalog = JSON.parse(
  await fs.readFile("src/classic-catalog.json", "utf8"),
);
const proofs = JSON.parse(
  await fs.readFile("scripts/classic-variety/proofs.json", "utf8"),
);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5183",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
const report = {
  source: process.env.GITHUB_SHA,
  method:
    "Real scripted UI, deterministic local shuffle seed; proof-guided moves, not human experience evidence",
  cases: [],
};
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5183")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.SEEDS_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  for (const [name, viewport, theme, reducedMotion] of [
    ["phone", { width: 390, height: 844 }, "light", "no-preference"],
    ["small-dark", { width: 320, height: 568 }, "dark", "reduce"],
    ["landscape", { width: 844, height: 390 }, "light", "reduce"],
  ]) {
    const context = await browser.newContext({
      viewport,
      locale: "ru-RU",
      reducedMotion,
      recordVideo: { dir: out, size: viewport },
    });
    const page = await context.newPage();
    const entry = { name, viewport, theme, errors: [], deals: [], frames: [] };
    report.cases.push(entry);
    page.on("pageerror", (error) => entry.errors.push(String(error)));
    await page.addInitScript(
      ({ theme }) => {
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true, theme, vibration: false }),
        );
        localStorage.setItem(
          "seeds-bits.progress.v2",
          JSON.stringify({
            version: 3,
            active: "classic",
            sessions: {
              classic: {
                rules: 1,
                current: {
                  board: "1234567891111213141516171819".split("").map(Number),
                  moves: 0,
                  additions: 0,
                  scroll: 0,
                },
                history: [],
              },
            },
            hints: {},
            done: [],
            seen: [],
            meta: {
              version: 2,
              wallet: 0,
              since: "2026-11-12",
              completed: 0,
              unassisted: 0,
              attempts: {
                classic: { id: "classic-recording", completed: false },
              },
              classicDeals: { version: 1, seed: 73, bag: [], recent: [] },
            },
          }),
        );
      },
      { theme },
    );
    await page.goto("http://127.0.0.1:5183");
    const shot = async (label) => {
      const file = `${name}-${label}.png`;
      await page.screenshot({ path: path.join(out, file) });
      entry.frames.push(file);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error(`${name}: overflow at ${label}`);
    };
    await page.locator("#resume").click();
    await page.waitForTimeout(600);
    await shot("before");
    for (let n = 0; n < 4; n++) {
      await page.locator("#menu").click();
      if (n === 0) await shot("menu");
      await page.locator("#next-classic").click();
      await expect(page.locator("#dialog")).not.toBeVisible();
      const deal = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("seeds-bits.progress.v2")).meta
            .classicDeals.current,
      );
      entry.deals.push({ ...deal, family: catalog[deal.id].family });
      await page.waitForTimeout(950);
      await shot(catalog[deal.id].family);
    }
    // The last deal is untouched; demonstrate one independently certified real pair.
    const id = entry.deals.at(-1).id,
      pair = proofs[id][0];
    await page.locator(`[data-index="${pair[0]}"]`).click();
    await page.waitForTimeout(300);
    await page.locator(`[data-index="${pair[1]}"]`).click();
    await expect(page.locator("#undo")).toBeEnabled();
    await page.waitForTimeout(500);
    await page.locator("#menu").click();
    await page.locator("#next-classic").click();
    await shot("confirm");
    await page.waitForTimeout(500);
    await page.locator("#cancel-new").click();
    await page.locator("#resume").click();
    await page.waitForTimeout(400);
    if (entry.errors.length) throw Error(JSON.stringify(entry.errors));
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, `${name}.webm`));
  }
} finally {
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser?.close();
  server.kill();
}
console.log(JSON.stringify(report));
