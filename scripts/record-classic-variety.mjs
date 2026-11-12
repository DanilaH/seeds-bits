// Real UI captures with explicit completed-result fixtures, not a human playtest.
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
const out = path.resolve("test-results/classic-variety");
await fs.mkdir(out, { recursive: true });
const vite = await createServer({
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
});
await vite.listen();
const { fresh, metadata, startAttempt } =
  await vite.ssrLoadModule("/src/progress.ts");
const { newClassicRun, takeGeneratedClassic } = await vite.ssrLoadModule(
  "/src/classic-generator.ts",
);
const key = "seeds-bits.progress.v2";
const report = {
  source: process.env.GITHUB_SHA,
  method:
    "Completed-result fixtures followed by real next-game UI actions; no human difficulty claim",
  cases: [],
};
let browser;
try {
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
      recordVideo: { dir: out, size: viewport },
    });
    const page = await context.newPage();
    const entry = { name, viewport, theme, errors: [], frames: [] };
    report.cases.push(entry);
    page.on("pageerror", (error) => entry.errors.push(String(error)));
    await page.goto("http://127.0.0.1:5183/");
    for (const level of [0, 1, 2]) {
      const p = fresh(),
        m = metadata(p);
      startAttempt(p, "classic");
      m.classicRun = newClassicRun(110 + level);
      p.sessions.classic = takeGeneratedClassic(
        m.classicRun,
        m.attempts.classic.id,
        level,
      );
      p.sessions.classic.current.board = [];
      p.sessions.classic.current.moves = 14;
      m.attempts.classic.completed = true;
      m.completed = 1;
      await page.evaluate(
        ({ key, p, theme }) => {
          localStorage.setItem(key, JSON.stringify(p));
          localStorage.setItem(
            "seeds-bits.settings.v1",
            JSON.stringify({ tutorialDone: true, theme }),
          );
        },
        { key, p, theme },
      );
      await page.reload();
      await page.locator("#resume").click();
      await expect(page.locator("#win")).toBeVisible();
      await page.locator("#result-next").scrollIntoViewIfNeeded();
      const result = `${name}-result-${level}.png`;
      await page.screenshot({ path: path.join(out, result) });
      entry.frames.push(result);
      await page.locator("#play-again").click();
      await expect(page.locator("#win")).toBeHidden();
      await expect(page.locator("#remaining")).toHaveText(
        String([18, 28, 27][level]),
      );
      const game = `${name}-game-${level}.png`;
      await page.screenshot({ path: path.join(out, game) });
      entry.frames.push(game);
    }
    expect(entry.errors).toEqual([]);
    await context.close();
    const video = page.video();
    if (video) await video.saveAs(path.join(out, `${name}.webm`));
  }
} finally {
  await browser?.close();
  await vite.close();
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    cases: report.cases.length,
    errors: report.cases.flatMap((c) => c.errors),
  }),
);
