import { chromium } from "@playwright/test";
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";

// Frame exact production captures in CSS, keeping every UI pixel in view.
// Short factual captions sit outside the untouched game captures.
const root = "test-results/store";
const out = `${root}/ready`;
mkdirSync(out, { recursive: true });
const captures = JSON.parse(readFileSync(`${root}/capture.json`, "utf8"));
if (captures.errors.length) throw Error("Source capture has page errors");
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const captions = {
  "phone-01-pairs": "Убирайте одинаковые числа и пары с суммой 10",
  "phone-02-books": "2 400 задач в 100 тетрадях",
  "phone-03-calendar": "Ежедневные задачи с архивом с января 2025 года",
  "phone-04-jars": "Найденные пары пополняют коллекцию баночек",
  "phone-05-dark": "Тёмная тема для игрового поля и меню",
  "tablet-01-pairs": "Убирайте одинаковые числа и пары с суммой 10",
  "tablet-02-books": "В больших задачах поле прокручивается",
  "tablet-03-dark": "Тёмная тема для игрового поля и меню",
  "tablet-04-library": "2 400 задач в 100 тетрадях",
  "tablet-05-progress": "Прогресс классики — в коллекции баночек",
};
const manifest = [];
try {
  for (const capture of captures.captures) {
    const tablet = capture.name.startsWith("tablet");
    const caption = captions[capture.name];
    if (!caption) throw Error(`Missing caption: ${capture.name}`);
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
      figure { margin: 0; display: flex; flex-direction: column; align-items: center;
        gap: ${tablet ? 16 : 20}px; width: ${tablet ? 880 : 504}px; }
      img { display: block; width: ${tablet ? 768 : 468}px; height: auto;
        border-radius: 14px; box-shadow: 0 16px 45px #183c3829; }
      figcaption { font: 400 ${tablet ? 18 : 16}px/1.4 Arial, sans-serif;
        color: ${capture.dark ? "#e1eee7" : "#304e44"}; text-align: center; white-space: nowrap; }
      </style><figure><img alt="Интерфейс игры Семечки" src="data:image/png;base64,${data}"><figcaption>${caption}</figcaption></figure></html>`);
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
    const captionGeometry = await page.locator("figcaption").evaluate((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height,
        fits: element.scrollWidth <= element.clientWidth };
    });
    if (!captionGeometry.fits || captionGeometry.x < 0 || captionGeometry.y < geometry.y + geometry.height ||
      captionGeometry.x + captionGeometry.width > width || captionGeometry.y + captionGeometry.height > height)
      throw Error(`Caption does not fit: ${capture.name}`);
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
      caption,
      captionGeometry,
    });
    await context.close();
  }
  copyFileSync("store/icon-512.png", `${out}/icon-512.png`);
  writeFileSync(
    `${root}/media.json`,
    JSON.stringify(
      {
        method:
          "CSS gradient framing with short factual captions below unchanged complete production UI captures",
        screenshots: manifest,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
