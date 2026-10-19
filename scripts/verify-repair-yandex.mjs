import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5196",
    "--mode",
    "yandex",
  ],
  { stdio: "pipe" },
);
await new Promise((r) =>
  server.stdout.on("data", (d) => {
    if (String(d).includes("Local:")) r();
  }),
);
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM,
  args: ["--no-sandbox"],
});
const result = [];
for (const kind of ["resolved", "rejected", "pending"]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/sdk.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.YaGames={init:()=>${kind === "pending" ? "new Promise(()=>{})" : kind === "rejected" ? 'Promise.reject(new Error("mock outage"))' : "Promise.resolve({features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}}})"}};`,
    }),
  );
  await page.goto("http://127.0.0.1:5196");
  await page.waitForTimeout(kind === "pending" ? 6000 : 300);
  result.push({
    kind,
    ...(await page.evaluate(() => ({
      inert: document.querySelector("#app").inert,
      status: document.querySelector("#status").textContent,
      lessonHidden: document.querySelector("#lesson").hidden,
    }))),
  });
  await context.close();
}
writeFileSync(
  "docs/repairs-2026-10-20/yandex-results.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
await browser.close();
server.kill();
