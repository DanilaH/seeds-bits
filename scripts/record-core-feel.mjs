import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.SEEDS_FEEL_URL ?? "http://127.0.0.1:5191";
const output = path.resolve(process.argv[2] ?? "test-results/core-feel-video");
const staging = await fs.mkdtemp(path.join(os.tmpdir(), "seeds-feel-video-"));
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM,
  args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});
const board = [
  6, 4, 2, 0, 2, 1, 9, 3, 3,
  4, 4, 8, 2, 1, 9, 5, 5, 0,
  4, 6, 8, 2, 3, 7, 5, 5, 0,
];
const route = [
  [0, 2, 2],           // Values cannot pair.
  [0, 18, 18],         // The middle digit blocks the route.
  [0, 1], [2, 4],     // Sum of ten, then a gap.
  [5, 6], [7, 8],     // Remove the first row.
  ["undo"], [7, 8],
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 1], [2, 3], [4, 5], [6, 7],
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(ms, 0)));
const ffmpeg = (...args) => {
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], {stdio: "inherit"});
  if (result.status !== 0) throw new Error("ffmpeg failed");
};

async function fixture() {
  const context = await browser.newContext({
    viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true,
    locale: "ru-RU",
  });
  const page = await context.newPage();
  await page.addInitScript(({ board }) => {
    const key = "seeds-bits.progress.v2";
    if (!localStorage.getItem(key)) {
      localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({
        tutorialDone: true, vibration: false, theme: "dark", languageChoice: "ru",
      }));
      localStorage.setItem(key, JSON.stringify({
        version: 3, active: "classic", done: [], seen: [], hints: {},
        sessions: {classic: {rules: 1, current: {board, moves: 0, additions: 0, scroll: 0}, history: []}},
      }));
    }
    // Capture the actual application mix. The original destination remains live.
    const streams = new Map();
    const originalConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (this.context instanceof AudioContext && destination === this.context.destination) {
        let stream = streams.get(this.context);
        if (!stream) {
          stream = this.context.createMediaStreamDestination();
          streams.set(this.context, stream);
        }
        originalConnect.call(this, stream);
      }
      return originalConnect.call(this, destination, ...args);
    };
    let recorder, chunks;
    window.recordFeelSound = () => {
      const stream = [...streams.values()].at(-1);
      if (!stream) throw new Error("No connected application audio");
      chunks = [];
      recorder = new MediaRecorder(stream.stream, {mimeType: "audio/webm;codecs=opus"});
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.start();
      return Date.now();
    };
    window.finishFeelSound = () => new Promise(resolve => {
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, {type: "audio/webm"}));
      };
      recorder.stop();
    });
  }, {board});
  await page.goto(baseURL);
  await page.locator("#resume").click();
  await page.locator("#dialog").waitFor({state: "hidden"});
  const get = index => page.locator(`#board button[data-index="${index}"]`);
  await page.waitForFunction(() => performance.getEntriesByType("resource")
    .some(resource => /seeds-foley(?:-[^/]+)?[.]ogg$/.test(resource.name)));
  await sleep(350);
  // Two taps warm the native audio graph and leave the starting board intact.
  await get(0).tap();
  await sleep(90);
  await get(0).tap();
  await sleep(350);
  return {context, page, get};
}

try {
  await fs.mkdir(output, {recursive: true});
  const {context, page, get} = await fixture();
  const dir = staging;
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let firstFrame;
  const captureReady = new Promise(resolve => { firstFrame = resolve; });
  cdp.on("Page.screencastFrame", ({data, metadata, sessionId}) => {
    const file = path.join(dir, `${frames.length}.jpg`);
    frames.push({time: metadata.timestamp, file, saved: fs.writeFile(file, Buffer.from(data, "base64"))});
    firstFrame();
    void cdp.send("Page.screencastFrameAck", {sessionId}).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {format: "jpeg", quality: 90, everyNthFrame: 1});
  await captureReady;
  const audioStart = await page.evaluate(() => window.recordFeelSound());
  let at = audioStart + 440;
  let maxTapDrift = 0;
  let remaining = board.filter(Boolean).length;
  for (const [move, steps] of route.entries()) {
    for (const [index, step] of steps.entries()) {
      const scheduled = at + 165 * index;
      await sleep(scheduled - Date.now());
      const target = step === "undo" ? page.locator("#undo") : get(step);
      try {
        await target.click({force: true, timeout: 1500});
      } catch (error) {
        throw new Error(`Action ${move + 1}, input ${step}`, {cause: error});
      }
      maxTapDrift = Math.max(maxTapDrift, Date.now() - scheduled);
    }
    remaining += steps.length === 1 ? 2 : steps.length === 2 ? -2 : 0;
    await page.waitForFunction(count =>
      document.querySelector("#remaining").textContent === String(count), remaining, {timeout: 1100});
    at += steps.length > 2 ? 670 : 500;
  }
  await page.locator("#win").waitFor({state: "visible", timeout: 2500});
  const clipLength = (at - audioStart + 1300) / 1000;
  await sleep(audioStart + clipLength * 1000 - Date.now());
  const wallEnd = Date.now() / 1000;
  const audio = path.join(dir, "mix.webm");
  const b64 = await page.evaluate(() => window.finishFeelSound());
  await fs.writeFile(audio, Buffer.from(b64, "base64"));
  await cdp.send("Page.stopScreencast");
  await Promise.all(frames.map(frame => frame.saved));
  if (frames.length < 30) throw new Error("Too few frames");
  const originalStart = frames[0].time;
  const timeline = frames.map(({file, time}, index) =>
    `file '${file}'\nduration ${Math.max(.001, (frames[index + 1]?.time ?? wallEnd) - time).toFixed(6)}`);
  timeline.push(`file '${frames.at(-1).file}'`);
  const sequence = path.join(dir, "sequence.ffconcat");
  await fs.writeFile(sequence, ["ffconcat version 1.0", ...timeline].join("\n") + "\n");
  const audioOffset = (audioStart / 1000 - originalStart).toFixed(5);
  const target = path.join(output, "seeds-foley-gameplay.mp4");
  ffmpeg("-f", "concat", "-safe", "0", "-i", sequence, "-itsoffset", audioOffset, "-i", audio,
    "-map", "0:v", "-map", "1:a", "-vf", "fps=60,scale=780:1688:flags=lanczos",
    "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-af", "apad",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", String(clipLength), target);
  console.log(frames.length, `audio alignment ${audioOffset}s, max tap drift ${maxTapDrift}ms`, target);
  await context.close();
} finally {
  await browser.close();
  await fs.rm(staging, {force: true, recursive: true});
}
