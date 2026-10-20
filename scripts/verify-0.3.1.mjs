import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "docs/repairs-0.3.1";
mkdirSync(out, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5199",
  ],
  { stdio: "pipe" },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (String(d).includes("Local:")) resolve();
    });
    server.on("error", reject);
    server.on("exit", () => reject(Error("preview exited")));
  });
  browser = await chromium.launch({
    executablePath: process.env.SEEDS_CHROMIUM,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
  await page.clock.setFixedTime(new Date("2028-03-19T12:00:00+05:00"));
  await page.goto("http://127.0.0.1:5199");
  await page.locator("#daily-mode").click();
  await page.locator("#today-task").click();
  const t = Date.now();
  await page.locator("#hint").click();
  await page.waitForSelector(".hinted");
  const hintMs = Date.now() - t,
    highlighted = await page.locator(".hinted").count();
  if (highlighted !== 2) throw Error("No verified pair");
  await page.screenshot({
    animations: "disabled",
    path: out + "/hard-daily-fixed.png",
  });
  await context.close();
  const warningContext = await browser.newContext({
      viewport: { width: 320, height: 568 },
    }),
    warningPage = await warningContext.newPage();
  await warningPage.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    localStorage.setItem("seeds-bits.progress.v2", "{broken");
  });
  await warningPage.goto("http://127.0.0.1:5199");
  await warningPage.waitForSelector("#read-notice");
  await warningPage.screenshot({
    animations: "disabled",
    path: out + "/warning-menu.png",
  });
  await warningPage.locator("#resume").click();
  await warningPage.screenshot({
    animations: "disabled",
    path: out + "/warning-game.png",
  });
  const fieldHeight = await warningPage
    .locator("#viewport")
    .evaluate((e) => e.getBoundingClientRect().height);
  if (fieldHeight <= 0) throw Error("Warning collapsed the board");
  const result = {
    productionWorker: true,
    highlighted,
    hintMs,
    fieldHeight,
    errors,
  };
  writeFileSync(
    out + "/production-smoke.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (errors.length) throw Error("Page errors");
} finally {
  await browser?.close();
  server.kill();
}
