import { chromium } from "@playwright/test";
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";

// Frame exact production captures in CSS, keeping every UI pixel in view.
// No marketing copy is drawn onto the screenshots.
const root = "test-results/store";
const out = `${root}/ready`;
mkdirSync(out, { recursive: true });
const captures = JSON.parse(readFileSync(`${root}/capture.json`, "utf8"));
if (captures.errors.length) throw Error("Source capture has page errors");
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const manifest = [];
try {
  for (const capture of captures.captures) {
    const tablet = capture.name.startsWith("tablet");
    const width = tablet ? 960 : 540;
    const height = tablet ? 540 : 960;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const data = readFileSync(`${root}/raw/${capture.name}.png`).toString(
      "base64",
    );
    const background = capture.dark
      ? "radial-gradient(ellipse at 15% 10%, #5b8476aa, transparent 65%), linear-gradient(145deg, #385e55, #203d39 65%, #386b64)"
      : "radial-gradient(ellipse at 15% 10%, #ffffffb8, transparent 65%), linear-gradient(145deg, #edf6e9, #c6e0d4 65%, #98c9c2)";
    await page.setContent(`<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      body { display: grid; place-items: center; background: ${background}; }
      img { display: block; width: ${tablet ? 864 : 468}px; height: auto;
        border-radius: 14px; box-shadow: 0 16px 45px #183c3829; }
      </style><img alt="Интерфейс игры Семечки" src="data:image/png;base64,${data}"></html>`);
    await page.locator("img").evaluate((img) => img.decode());
    const geometry = await page.locator("img").evaluate((img) => {
      const r = img.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    });
    if (
      geometry.x < 0 ||
      geometry.y < 0 ||
      geometry.x + geometry.width > width ||
      geometry.y + geometry.height > height
    )
      throw Error(`Cropped screenshot: ${capture.name}`);
    if (
      Math.abs(
        geometry.width / geometry.height -
          geometry.naturalWidth / geometry.naturalHeight,
      ) > 0.0001
    )
      throw Error(`Distorted screenshot: ${capture.name}`);
    const file = `${out}/${capture.name}.png`;
    await page.screenshot({ path: file });
    const bytes = statSync(file).size;
    if (bytes > 5_000_000)
      throw Error(`Image exceeds store upload limit: ${file}`);
    manifest.push({
      file: `${capture.name}.png`,
      width: width * 2,
      height: height * 2,
      bytes,
      dark: capture.dark,
      geometry,
    });
    await context.close();
  }
  copyFileSync("store/icon-512.png", `${out}/icon-512.png`);
  writeFileSync(
    `${root}/media.json`,
    JSON.stringify(
      {
        method:
          "CSS gradient framing, no slogans; unchanged complete production UI captures",
        screenshots: manifest,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
