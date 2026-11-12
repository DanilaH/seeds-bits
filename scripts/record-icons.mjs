// Before/after: actual UI and production SVG renderer, prepared local saves, no human playtest.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const label = process.env.ICON_LABEL || "after";
const root = process.env.SEEDS_ICON_ROOT || process.cwd();
const out = path.resolve("test-results/icon-polish", label);
await fs.mkdir(out, { recursive: true });
const server = spawn(
  process.execPath,
  [
    path.resolve("node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5182",
    "--strictPort",
  ],
  { cwd: root, stdio: "ignore" },
);
const report = {
  source: process.env.ICON_SOURCE || process.env.GITHUB_SHA,
  label,
  method:
    "Actual browser UI plus isolated production-SVG gallery; prepared saves, mock ads/analytics, reduced motion",
  cases: [],
};
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5182")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.SEEDS_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  for (const [name, viewport, theme] of [
    ["phone", { width: 390, height: 844 }, "light"],
    ["small-dark", { width: 320, height: 568 }, "dark"],
    ["landscape", { width: 844, height: 390 }, "light"],
  ]) {
    const context = await browser.newContext({
      viewport,
      locale: "ru-RU",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const entry = { name, viewport, theme, errors: [], frames: [] };
    report.cases.push(entry);
    page.on("pageerror", (error) => entry.errors.push(String(error)));
    await page.addInitScript(
      ({ theme }) => {
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({
            tutorialDone: true,
            theme,
            sound: false,
            vibration: false,
          }),
        );
        const done = Array.from({ length: 12 }, (_, m) =>
          Array.from(
            { length: 7 },
            (_, d) =>
              `daily-v1-2025-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`,
          ),
        ).flat();
        localStorage.setItem(
          "seeds-bits.progress.v2",
          JSON.stringify({
            version: 3,
            active: "classic",
            sessions: {
              classic: {
                rules: 1,
                current: {
                  board: [5, 5, 1, 1],
                  moves: 0,
                  additions: 0,
                  scroll: 0,
                },
                history: [],
              },
            },
            hints: {},
            done,
            seen: [],
            meta: {
              version: 2,
              wallet: 4,
              completed: 84,
              unassisted: 12,
              since: "2026-11-01",
              attempts: { classic: { id: "icon-review", completed: false } },
            },
            jars: {
              version: 2,
              seeds: 120,
              meter: 100,
              wins: 3,
              attempt: "icon-review",
              highWater: 0,
            },
          }),
        );
        window.__SEEDS_ADS_TEST__ = {
          initialize: async () => ({ enabled: false, test: true }),
          addListener: async () => ({ remove: async () => {} }),
          pending: async () => ({}),
          preload: async () => {},
          banner: async () => {},
          report: async () => {},
        };
      },
      { theme },
    );
    const shot = async (screen) => {
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      entry.frames.push({ screen, overflow });
      await page.screenshot({ path: path.join(out, `${name}-${screen}.png`) });
      if (overflow) throw Error(`${name}/${screen} overflows`);
    };
    await page.goto("http://127.0.0.1:5182");
    await shot("home");
    await page.locator("#resume").click();
    await shot("game");
    await page.locator("#menu").click();
    await page.locator("#settings-open").click();
    await shot("settings");
    await page.locator("#settings-back").click();
    await page.locator("#progress-open").click();
    await page.locator("#progress-trophies").click();
    await page.locator("#trophies-mode").click();
    await page.locator("#trophy-year").selectOption("2025");
    await shot("medals");
    if (name !== "landscape") {
      await page.setViewportSize({ width: 660, height: 1200 });
      for (const [gallery, months, columns, width] of [
        ["all", Array.from({ length: 12 }, (_, i) => i + 1), 3, 630],
        ["detail", [3, 5, 10, 11], 2, 390],
      ]) {
        await page.evaluate(
          async ({ months, columns, width, theme }) => {
            const { trophyMark } = await import("/src/trophies.ts");
            document
              .querySelectorAll("dialog[open]")
              .forEach((dialog) => dialog.close());
            document.querySelector("#app").style.display = "none";
            document.querySelector("#icon-gallery")?.remove();
            const host = document.createElement("section");
            host.id = "icon-gallery";
            host.style.cssText = `width:${width}px;padding:18px;background:var(--paper);color:var(--ink)`;
            const controls = [
              ["#menu", "Меню"],
              ["#book-top", "Тетрадь"],
              ["#undo", "Отмена"],
              ["#hint", "Подсказка"],
              ["#add", "Добавить"],
            ];
            const strip = controls
              .map(
                ([selector, title]) =>
                  `<div><button class="plain" tabindex="-1">${document.querySelector(selector + " svg")?.outerHTML || document.querySelector(selector + " .menu-lines")?.outerHTML || ""}</button><small>${title}</small></div>`,
              )
              .join("");
            const names = [
              "Январь",
              "Февраль",
              "Март",
              "Апрель",
              "Май",
              "Июнь",
              "Июль",
              "Август",
              "Сентябрь",
              "Октябрь",
              "Ноябрь",
              "Декабрь",
            ];
            host.innerHTML = `<div class="icon-controls">${strip}</div><div class="icon-grid" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">${months.map((month, i) => `<article><h3>${names[month - 1]}</h3>${trophyMark(`2025-${String(month).padStart(2, "0")}`, [4, 7, 14, 30][i % 4], 30)}</article>`).join("")}</div>`;
            if (!document.querySelector("#icon-gallery-style")) {
              const style = document.createElement("style");
              style.id = "icon-gallery-style";
              style.textContent =
                "#icon-gallery *{box-sizing:border-box}#icon-gallery .icon-grid{display:grid;gap:20px 12px}#icon-gallery h3{font-size:14px;font-weight:500;text-align:center;margin:0 0 8px}#icon-gallery .trophy-display.has-next{grid-template-columns:minmax(0,1fr)}#icon-gallery .next-medal,#icon-gallery .metal-name,#icon-gallery .metal-count,#icon-gallery .medal-note{display:none}#icon-gallery .icon-controls{display:grid;grid-template-columns:repeat(5,1fr);text-align:center;padding-bottom:18px;margin-bottom:22px;border-bottom:1px solid var(--line)}#icon-gallery button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;min-height:44px;margin:auto;padding:0}#icon-gallery small{font-size:10px}";
              document.head.append(style);
            }
            document.documentElement.dataset.theme = theme;
            document.body.append(host);
          },
          { months, columns, width, theme },
        );
        await page.locator("#icon-gallery").screenshot({
          path: path.join(out, `${name}-gallery-${gallery}.png`),
        });
      }
    }
    if (entry.errors.length) throw Error(JSON.stringify(entry.errors));
    await context.close();
  }
} finally {
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser?.close();
  if (server.exitCode === null) {
    const ended = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await ended;
  }
}
console.log(JSON.stringify(report));
