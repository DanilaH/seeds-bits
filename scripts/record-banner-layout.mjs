// Real browser layout, deterministic SDK double. No live ad/network claim.
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { openBannerFixture } from "./banner-layout-fixture.mjs";

const out = path.resolve("test-results/banner-layout");
await mkdir(out, { recursive: true });
const before = process.env.SEEDS_BANNER_BEFORE_ROOT;
if (!before) throw new Error("A pinned before checkout is required");
const report = {
  method:
    "Real UI using notebook 91 task 1 and a native ad geometry double; no live ad or phone-install claim",
  cases: [],
};
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
try {
  for (const [phase, root] of [
    ["before", before],
    ["after", process.cwd()],
  ]) {
    const vite = await createServer({
      root,
      configFile: path.join(root, "vite.config.ts"),
      server: { host: "127.0.0.1", port: 5189, strictPort: true },
    });
    await vite.listen();
    try {
      const source = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      for (const [name, viewport, dark, large] of [
        ["phone", { width: 390, height: 866 }, false, false],
        ["small-dark", { width: 320, height: 568 }, true, false],
        ["landscape", { width: 844, height: 390 }, false, false],
        ["short-large", { width: 568, height: 320 }, true, true],
      ]) {
        const context = await browser.newContext({
          viewport,
          reducedMotion: "reduce",
          locale: "ru-RU",
        });
        const page = await context.newPage();
        const item = { phase, source, name, viewport, dark, large, errors: [] };
        report.cases.push(item);
        page.on("pageerror", (e) => item.errors.push(String(e)));
        await openBannerFixture(page, { url: "http://127.0.0.1:5189/", dark });
        await expect(page.locator("#remaining")).toHaveText("212");
        if (large)
          await page.addStyleTag({
            content: "body {font-size:22px} .action-label {font-size:20px}",
          });
        await expect
          .poll(() => page.evaluate(() => window.bannerCalls.at(-1)?.visible))
          .toBe(true);
        await page.locator("#hint").scrollIntoViewIfNeeded();
        item.geometry = await page.evaluate(() => {
          const rect = (s) =>
            document.querySelector(s).getBoundingClientRect().toJSON();
          return {
            ad: rect("#ad-space"),
            controls: rect("footer"),
            boardViewport: rect("#viewport"),
            systemBottom: 24,
          };
        });
        item.screen = `${name}-${phase}.png`;
        await page.screenshot({ path: path.join(out, item.screen) });
        await page.addStyleTag({
          content:
            '#ad-space::after {content:"Макет места для баннера";display:grid;place-items:center;height:100%;box-sizing:border-box;border:1px dashed #687f74;background:#e1e9e4;color:#293c37;font:12px sans-serif}',
        });
        item.slotScreen = `${name}-${phase}-slot.png`;
        await page.screenshot({ path: path.join(out, item.slotScreen) });
        expect(item.errors).toEqual([]);
        await context.close();
      }
    } finally {
      await vite.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(
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
