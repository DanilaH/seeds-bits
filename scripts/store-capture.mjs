import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const out = "test-results/store";
mkdirSync(out + "/raw", { recursive: true });
const root = resolve("dist");
const server = createServer((req, res) => {
  const path = resolve(
    root,
    "." + (req.url === "/" ? "/index.html" : req.url.split("?")[0]),
  );
  if (!path.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(5197, "127.0.0.1", r));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const captures = [];
async function capture(name, viewport, action, dark = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ dark }) => {
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({
          tutorialDone: true,
          sound: false,
          vibration: false,
          theme: dark ? "dark" : "light",
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
                board: [
                  2, 7, 5, 3, 4, 9, 1, 6, 3, 5, 8, 4, 6, 2, 9, 1, 7, 5, 3, 6, 8,
                  2, 4, 9, 5, 1, 7, 3,
                ],
                moves: 0,
                additions: 0,
                scroll: 0,
              },
              history: [],
            },
          },
          done: [
            "book-v1-1",
            "book-v1-2",
            "book-v1-3",
            ...Array.from(
              { length: 6 },
              (_, i) => `daily-v1-2026-10-0${i + 1}`,
            ),
          ],
          hints: {},
          seen: [],
          meta: {
            version: 1,
            since: "2026-10-01",
            completed: 12,
            unassisted: 8,
            attempts: { classic: { id: "store-demo", completed: false } },
          },
          jars: {
            version: 1,
            seeds: 340,
            wins: 3,
            attempt: "store-demo",
            highWater: 0,
          },
        }),
      );
    },
    { dark },
  );
  await page.goto("http://127.0.0.1:5197");
  await page.locator("#resume").waitFor({ state: "visible" });
  if (
    (await page.evaluate(() => document.documentElement.dataset.theme)) !==
    (dark ? "dark" : "light")
  )
    throw Error("Unexpected theme for " + name);
  await action(page);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  if (overflow) throw Error("Horizontal overflow " + name);
  await page.screenshot({ path: `${out}/raw/${name}.png` });
  captures.push({ name, viewport, dark });
  await context.close();
}
try {
  const phone = { width: 390, height: 640 },
    tablet = { width: 960, height: 440 };
  const game = async (p) => {
    await p.locator("#resume").click();
    await p.locator("#hint").click();
    await p.waitForFunction(
      () => document.querySelectorAll(".hinted").length === 2,
    );
  };
  const book = async (p) => {
    await p.locator("#book-mode").click();
    await p.locator('[data-game="book-v1-4"]').waitFor();
  };
  const calendar = async (p) => {
    await p.locator("#calendar-open").click();
    await p.locator(".calendar").waitFor();
  };
  const jars = async (p) => {
    await p.locator("#trophies-mode").click();
    await p.locator(".jar-shelf").waitFor();
    await p.locator(".jar-collection").scrollIntoViewIfNeeded();
  };
  await capture("phone-01-pairs", phone, game);
  await capture("phone-02-books", phone, book);
  await capture("phone-03-calendar", phone, calendar);
  await capture("phone-04-jars", phone, jars);
  await capture("phone-05-dark", phone, game, true);
  await capture("tablet-01-pairs", tablet, game);
  await capture("tablet-02-books", tablet, async (p) => {
    await p.locator("#book-mode").click();
    await p.locator("#book-chapter").selectOption("9");
    await p.locator('[data-volume="99"]').click();
    await p.locator('[data-game="book-v1-2400"]').click();
    await p.waitForFunction(() => !document.querySelector("#dialog").open);
  });
  await capture("tablet-03-dark", tablet, game, true);
  writeFileSync(
    out + "/capture.json",
    JSON.stringify(
      {
        method:
          "production web UI, achievable demonstration saves; not a native SDK/device test",
        captures,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
