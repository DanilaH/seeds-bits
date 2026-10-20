import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    "5199",
    "--bind",
    "127.0.0.1",
    "--directory",
    "/tmp/seeds051-audit-apk",
  ],
  { stdio: "ignore" },
);
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({
  executablePath: "/tmp/seeds-audit-chromium",
  args: ["--no-sandbox"],
});
const fixture = JSON.parse(
    readFileSync("/tmp/seeds051-partial-save-fixture.json", "utf8"),
  ),
  rows = [];
for (const n of process.env.REPEAT
  ? [0, 75, 0, 75, 0, 75]
  : [0, 25, 50, 75, 100]) {
  const p = {
    ...fixture,
    sessions: Object.fromEntries(Object.entries(fixture.sessions).slice(0, n)),
    active: "classic",
  };
  p.sessions.classic = {
    rules: 1,
    current: { board: Array(180).fill(5), moves: 0, additions: 0, scroll: 0 },
    history: [],
  };
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }),
    page = await c.newPage();
  await page.addInitScript((p) => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    try {
      localStorage.setItem("seeds-bits.progress.v2", JSON.stringify(p));
      window.seedResult = "ok";
    } catch (e) {
      window.seedResult = e.name;
    }
  }, p);
  const t = performance.now();
  await page.goto("http://127.0.0.1:5199");
  await page.locator("#resume").click();
  const startupMs = performance.now() - t,
    seedResult = await page.evaluate(() => window.seedResult);
  const data = {
    unfinished: n,
    bytes: JSON.stringify(p).length,
    seedResult,
    startupMs: Math.round(startupMs),
  };
  if (seedResult === "ok") {
    await page.evaluate(() => {
      window.tasks = [];
      window.writeDurations = [];
      new PerformanceObserver((l) =>
        window.tasks.push(...l.getEntries().map((x) => x.duration)),
      ).observe({ entryTypes: ["longtask"] });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        const t = performance.now();
        try {
          return original.call(this, k, v);
        } finally {
          if (k === "seeds-bits.progress.v2")
            window.writeDurations.push({
              ms: performance.now() - t,
              bytes: v.length,
            });
        }
      };
    });
    for (let i = 0; i < 5; i++) {
      await page.locator("#board button").nth(0).click();
      await page.locator("#board button").nth(1).click();
      await page.waitForFunction(
        (n) => document.querySelector("#remaining").textContent === String(n),
        178 - i * 2,
      );
    }
    await page.waitForTimeout(300);
    Object.assign(
      data,
      await page.evaluate(() => ({
        tasks: window.tasks,
        writes: window.writeDurations,
        saveFailed: !document.querySelector("#save-notice").hidden,
      })),
    );
  }
  rows.push(data);
  await c.close();
}
await b.close();
server.kill();
writeFileSync(
  process.env.REPEAT
    ? "docs/audit-0.5.1/storage-performance-repeat.json"
    : "docs/audit-0.5.1/storage-performance.json",
  JSON.stringify(rows, null, 2),
);
console.log(rows);
