// Real UI recording with prepared progress; not a human playtest or native motor evidence.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const out = path.resolve("test-results/jar-spill");
await fs.mkdir(out, { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5181"],
  { stdio: "ignore" },
);
let browser;
const report = {
  source: process.env.GITHUB_SHA,
  method:
    "Scripted real UI; prepared near-full jar, mock ads/analytics; browser vibration calls only",
  cases: [],
};
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5181")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.SEEDS_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  for (const [name, viewport, theme] of [
    ["portrait", { width: 390, height: 844 }, "light"],
    ["dark", { width: 390, height: 844 }, "dark"],
    ["landscape", { width: 844, height: 390 }, "light"],
  ]) {
    const context = await browser.newContext({
      viewport,
      locale: "ru-RU",
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: out, size: viewport },
    });
    const page = await context.newPage();
    const entry = { name, viewport, theme, errors: [] };
    report.cases.push(entry);
    page.on("pageerror", (error) => entry.errors.push(String(error)));
    await page.addInitScript(
      ({ theme }) => {
        window.jarPulses = [];
        Object.defineProperty(navigator, "vibrate", {
          value: (value) => {
            window.jarPulses.push(value);
            return true;
          },
        });
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({
            tutorialDone: true,
            sound: false,
            vibration: true,
            theme,
          }),
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
                  board: [5, 5, 1, 1, 3, 7, 4, 6, 8],
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
              wallet: 4,
              since: "2026-11-01",
              completed: 0,
              unassisted: 0,
              attempts: {
                classic: { id: "spill-recording", completed: false },
              },
            },
            jars: {
              version: 2,
              seeds: 342,
              meter: 322,
              wins: 3,
              attempt: "spill-recording",
              highWater: 0,
            },
          }),
        );
        window.__SEEDS_ADS_TEST__ = {
          initialize: async () => ({ enabled: true, test: true }),
          addListener: async () => ({ remove: async () => {} }),
          preload: async () => {},
          banner: async () => {},
          pending: async () => ({}),
          acknowledge: async () => {},
          report: async () => {},
          show: async () => ({ status: "unavailable" }),
        };
      },
      { theme },
    );
    await page.goto("http://127.0.0.1:5181");
    await page.locator("#resume").click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, name + "-before.png") });
    await page.locator("#board button").nth(0).click();
    await page.locator("#board button").nth(1).click();
    await page.waitForSelector("#jar-spill");
    entry.particles = await page.locator("#jar-spill i").count();
    await page.waitForTimeout(230);
    await page.screenshot({ path: path.join(out, name + "-spill.png") });
    await page.waitForTimeout(520);
    await page.screenshot({ path: path.join(out, name + "-fall.png") });
    await page.waitForSelector("#jar-spill", { state: "detached" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, name + "-after.png") });
    entry.pulses = await page.evaluate(() => window.jarPulses);
    entry.overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    entry.fullPulses = entry.pulses.filter(
      (value) => String(value) === "26,64,30,46,18",
    ).length;
    if (
      entry.particles !== 24 ||
      entry.fullPulses !== 1 ||
      entry.overflow ||
      entry.errors.length
    )
      throw Error(JSON.stringify(entry));
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, name + ".webm"));
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
