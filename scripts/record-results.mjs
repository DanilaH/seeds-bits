import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const out = "test-results/result-scenes";
await mkdir(out, { recursive: true });
const vite = await createServer({
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const report = {
  source: process.env.GITHUB_SHA,
  method:
    "Real completion actions, explicit progress fixture, native service doubles; physical motor and subjective sound quality not measured",
  cases: [],
};
async function zoom(page, scale) {
  await page.evaluate((scale) => {
    const nodes = [...document.querySelectorAll("body *")];
    const sizes = nodes.map((e) => parseFloat(getComputedStyle(e).fontSize));
    nodes.forEach((e, i) => (e.style.fontSize = sizes[i] * scale + "px"));
  }, scale);
  await page.waitForTimeout(250);
}
async function visible(page, selector) {
  return page.locator(selector).evaluateAll((es) =>
    es
      .filter((e) => e.getBoundingClientRect().width && !e.hidden)
      .map((e) => {
        const r = e.getBoundingClientRect();
        const points = [
          [r.x + r.width / 2, r.y + 8],
          [r.x + r.width / 2, r.bottom - 8],
        ];
        return {
          id: e.id,
          height: r.height,
          hit: points.every(([x, y]) => {
            const t = document.elementFromPoint(x, y);
            return t === e || e.contains(t);
          }),
        };
      }),
  );
}
try {
  for (const [profile, viewport, dark, scale, reduced] of [
    ["phone", { width: 390, height: 844 }, false, 1, false],
    ["small-dark", { width: 320, height: 568 }, true, 1, false],
    ["landscape", { width: 844, height: 390 }, false, 1, false],
    ["short-large", { width: 568, height: 320 }, true, 1.5, true],
    ["text200", { width: 360, height: 640 }, true, 2, true],
  ])
    for (const kind of [
      "task",
      "page",
      "book",
      "classic-0",
      "classic-1",
      "classic-2",
    ]) {
      const name = profile + "-" + kind;
      const context = await browser.newContext({
        viewport,
        locale: "ru-RU",
        reducedMotion: reduced ? "reduce" : "no-preference",
        recordVideo: { dir: out, size: viewport },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const entry = {
        name,
        viewport,
        dark,
        scale,
        reduced,
        errors: [],
        frames: [],
      };
      report.cases.push(entry);
      page.on("pageerror", (e) => entry.errors.push(String(e)));
      const classic = kind.startsWith("classic");
      const active = classic
        ? "classic"
        : "book-v1-" + (kind === "book" ? 24 : kind === "page" ? 6 : 1);
      const prior = Array.from(
        { length: kind === "book" ? 23 : kind === "page" ? 5 : 0 },
        (_, i) => "book-v1-" + (i + 1),
      );
      const snap = {
        rules: 1,
        current: {
          board: [5, 5],
          moves: classic ? 43 : 0,
          additions: classic ? 6 : 0,
          scroll: 0,
        },
        history: [],
      };
      const progress = {
        version: 3,
        active,
        sessions: { [active]: snap },
        hints: classic ? { classic: 3 } : {},
        done: prior,
        seen: [],
        meta: {
          version: 2,
          wallet: 0,
          since: "2026-11-01",
          completed: prior.length,
          unassisted: prior.length,
          attempts: { [active]: { id: "result-record", completed: false } },
        },
      };
      if (classic) {
        const { newClassicRun, takeGeneratedClassic } =
          await vite.ssrLoadModule("/src/classic-generator.ts");
        const run = newClassicRun(980 + Number(kind.at(-1)));
        takeGeneratedClassic(run, "result-record", Number(kind.at(-1)));
        progress.meta.classicRun = run;
      }
      try {
        await page.addInitScript(
          ({ progress, dark }) => {
            localStorage.setItem(
              "seeds-bits.progress.v2",
              JSON.stringify(progress),
            );
            localStorage.setItem(
              "seeds-bits.settings.v1",
              JSON.stringify({
                tutorialDone: true,
                theme: dark ? "dark" : "light",
                vibration: true,
                sound: false,
                reminders: false,
              }),
            );
            window.resultPulses = [];
            Object.defineProperty(navigator, "vibrate", {
              value: (p) => {
                window.resultPulses.push(p);
                return true;
              },
            });
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
          { progress, dark },
        );
        await page.goto("http://127.0.0.1:5188");
        await page.locator("#resume").click();
        await page.locator('[data-index="0"]').click();
        await page.locator('[data-index="1"]').click();
        await expect(page.locator("#win")).toBeVisible();
        await expect(page.locator("#win")).toHaveAttribute(
          "data-result-kind",
          classic ? "classic" : kind,
        );
        if (scale !== 1) await zoom(page, scale);
        // Reproduce the reported 44 / 6 / 3 wrap; each value shares one baseline
        // and the statistics group shares the title's centre at every font size.
        entry.statistics = await page
          .locator("#win-stats")
          .evaluate((stats) => {
            const group = stats.getBoundingClientRect();
            const title = document
              .querySelector("#win h1")
              .getBoundingClientRect();
            return {
              centreDelta: Math.abs(
                group.x + group.width / 2 - title.x - title.width / 2,
              ),
              items: [...stats.children].map((cell) => {
                const r = cell.getBoundingClientRect();
                return {
                  width: r.width,
                  top: cell.querySelector("strong").getBoundingClientRect().top,
                  value: cell.querySelector("strong").textContent,
                  overflow: cell.scrollWidth > cell.clientWidth + 1,
                };
              }),
            };
          });
        expect(entry.statistics.centreDelta).toBeLessThan(1);
        const stats = entry.statistics.items;
        expect(stats).toHaveLength(3);
        expect(
          Math.max(...stats.map((x) => x.top)) -
            Math.min(...stats.map((x) => x.top)),
        ).toBeLessThan(1);
        expect(
          Math.max(...stats.map((x) => x.width)) -
            Math.min(...stats.map((x) => x.width)),
        ).toBeLessThan(1);
        expect(stats.some((x) => x.overflow)).toBe(false);
        if (classic)
          expect(stats.map((x) => x.value)).toEqual(["44", "6", "3"]);
        const selectors = classic ? "#result-next > button" : "#play-again";
        entry.actions = await visible(page, selectors);
        expect(entry.actions.every((x) => x.hit && x.height >= 44)).toBe(true);
        entry.heading = await page.locator("#win h1").innerText();
        for (const [label, delay] of [
          ["entry", 0],
          ["accent", 150],
          ["settled", 650],
        ]) {
          if (delay) await page.waitForTimeout(delay);
          const file = name + "--" + label + ".png";
          await page.screenshot({ path: out + "/" + file });
          entry.frames.push(file);
        }
        entry.controls = await page
          .locator("#result-next > button")
          .evaluateAll((es) =>
            es.map((e) => ({
              id: e.id,
              disabled: e.disabled,
              text: e.innerText,
            })),
          );
        entry.pulses = await page.evaluate(() => window.resultPulses);
        if (classic) {
          expect(
            entry.controls.find((x) => x.id === "classic-easier").disabled,
          ).toBe(kind === "classic-0");
          expect(
            entry.controls.find((x) => x.id === "classic-harder").disabled,
          ).toBe(kind === "classic-2");
        }
        await page.locator("#play-again").click();
        await expect(page.locator("#win")).toBeHidden();
        if (!reduced) {
          await page.waitForTimeout(100);
          expect(await page.locator(".result-seed-burst").count()).toBe(0);
        }
        if (classic) {
          await expect(page.locator("#game-difficulty")).toBeVisible();
          expect(
            await page
              .locator(".result-field-art")
              .evaluate((el) => el.getAnimations({ subtree: true }).length),
          ).toBe(0);
        }
        entry.status = "passed";
      } catch (e) {
        entry.status = "failed";
        entry.failure = String(e);
        await page.screenshot({ path: out + "/" + name + "--failure.png" });
      }
      const video = page.video();
      await context.close();
      if (video) await video.saveAs(out + "/" + name + ".webm");
      console.log(
        JSON.stringify({ name, status: entry.status, failure: entry.failure }),
      );
    }
  // The month needs actual dates in its opening viewport, not only the series card.
  for (const [name, viewport, scale] of [
    ["wide", { width: 844, height: 390 }, 1],
    ["short", { width: 568, height: 320 }, 1],
    ["wide-large", { width: 844, height: 390 }, 1.5],
  ]) {
    const page = await browser.newPage({ viewport, locale: "ru-RU" });
    await page.addInitScript(() =>
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      ),
    );
    await page.goto("http://127.0.0.1:5188");
    await page.locator("#calendar-open").click();
    if (scale !== 1) await zoom(page, scale);
    const dates = await visible(page, ".calendar [data-game]");
    expect(dates.some((x) => x.hit)).toBe(true);
    await page.screenshot({ path: out + "/calendar-" + name + ".png" });
    await page.close();
  }
} finally {
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  await browser.close();
  await vite.close();
}
if (report.cases.some((c) => c.status !== "passed" || c.errors.length))
  process.exitCode = 1;
