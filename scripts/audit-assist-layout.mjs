import { chromium } from "@playwright/test";
import { install } from "../e2e/help-test-utils.ts";
import fs from "node:fs/promises";
import { createServer } from "vite";
const server = await createServer({
  root: process.env.SEEDS_AUDIT_PROJECT ?? process.cwd(),
  server: { host: "127.0.0.1", port: 5187, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM,
  args: ["--no-sandbox"],
});
const records = [];
for (const profile of ["magnet", "plan", "a3", "trials", "shuffle"]) {
  const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5187",
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await install(page, "ready", profile);
  await page.locator("#menu").click();
  if (["magnet", "plan", "a3"].includes(profile))
    await page.locator("#qa-help-scene").click();
  else await page.locator("#qa-lab").click();
  for (const [width, height, font] of [
    [390, 844, 1],
    [320, 568, 1],
    [568, 320, 1],
    [320, 568, 1.5],
    [568, 320, 1.5],
  ]) {
    await page.setViewportSize({ width, height });
    if (font > 1)
      await page.addStyleTag({
        content:
          "footer button{font-size:21px!important}.help-lab button,.help-lab p{font-size:22px!important}",
      });
    await page.waitForTimeout(100);
    const result = await page.evaluate(() => {
      const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
      const buttons = [
        ...(modal ?? document).querySelectorAll(
          modal ? "button" : "footer button",
        ),
      ].filter(
        (b) =>
          b.getBoundingClientRect().width && b.getBoundingClientRect().height,
      );
      const rect = (r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      });
      const overflow = [];
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = walker.nextNode())) {
          if (!t.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(t);
          for (const tr of range.getClientRects())
            if (
              tr.width &&
              (tr.x < r.x - 1 ||
                tr.right > r.right + 1 ||
                tr.y < r.y - 1 ||
                tr.bottom > r.bottom + 1)
            )
              overflow.push({
                id: b.id,
                text: t.textContent,
                button: rect(r),
                textBox: rect(tr),
              });
        }
      }
      const overlaps = [];
      for (let i = 0; i < buttons.length; i++)
        for (let j = i + 1; j < buttons.length; j++) {
          const a = buttons[i].getBoundingClientRect(),
            b = buttons[j].getBoundingClientRect();
          if (
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          )
            overlaps.push([buttons[i].id, buttons[j].id]);
        }
      return { overflow, overlaps };
    });
    records.push({ profile, width, height, font, ...result });
  }
  await context.close();
}
await browser.close();
await server.close();
const out = process.env.SEEDS_UI_EVIDENCE ?? "test-results/help-ui";
await fs.mkdir(out, { recursive: true });
await fs.writeFile(
  `${out}/${process.argv[2] ?? "after"}-layout.json`,
  JSON.stringify(records, null, 2),
);
console.log(
  JSON.stringify(
    records.filter((r) => r.overflow.length || r.overlaps.length),
    null,
    2,
  ),
);
