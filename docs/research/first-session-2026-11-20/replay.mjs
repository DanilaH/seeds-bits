import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = process.env.SEEDS_UX_OUT || "test-results/first-session";
const origin = process.env.SEEDS_UX_URL || "http://127.0.0.1:5184";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const states = [];
async function fresh() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Yekaterinburg",
    locale: "ru-RU",
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date("2026-11-20T08:00:00Z"));
  await p.goto(origin);
  await p.waitForSelector("#app:not([inert])");
  return p;
}
async function tap(p, sel) {
  await p.locator(sel).first().click();
  await p.waitForTimeout(200);
}
async function pair(p, a, b) {
  await tap(p, '[data-index="' + a + '"]');
  await tap(p, '[data-index="' + b + '"]');
}
async function state(p, name, shot = false) {
  const row = await p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const visible = (e) =>
      !!e &&
      !!e.getClientRects().length &&
      getComputedStyle(e).visibility !== "hidden";
    const root = q("dialog[open]") || q(".game");
    const text = (sel) => {
      const el = q(sel);
      return visible(el) ? el.innerText.trim() : null;
    };
    const game = JSON.parse(
      localStorage.getItem("seeds-bits.progress.v2") || "null",
    );
    return {
      screen: root.dataset.screen || "game",
      active: game?.active,
      mode: text("#mode"),
      status: text("#status"),
      lesson: text("#lesson-text"),
      feedback: text("#lesson-feedback"),
      remaining: text("#remaining"),
      buttons: [...root.querySelectorAll("button")]
        .filter(visible)
        .filter((el) => !el.hasAttribute("data-index"))
        .map((el) => [
          el.id,
          el.innerText.trim() || el.getAttribute("aria-label"),
        ])
        .filter(([id]) => id),
      body: root.innerText.trim().replaceAll(/\n+/g, " | ").slice(0, 1000),
      done: game?.done,
      seen: game?.seen,
    };
  });
  states.push({ name, ...row });
  if (shot) await p.screenshot({ path: path.join(out, name + ".png") });
}
async function solve(p, id) {
  const moves = await p.evaluate(async (id) => {
    const { notebook, daily } = await import("/src/puzzles.ts");
    return (
      id.startsWith("daily")
        ? daily(id.slice(9))
        : notebook.find((n) => n.id === id)
    ).solution;
  }, id);
  for (const { a, b } of moves) await pair(p, a, b);
  await p.locator("#win").waitFor();
}
try {
  const p = await fresh();
  await state(p, "first-launch", true);
  await pair(p, 0, 1);
  await tap(p, "#lesson-next");
  await state(p, "short-sum", true);
  await pair(p, 0, 1);
  await state(p, "mode-choice", true);
  await tap(p, "#lesson-quick");
  await state(p, "first-book", true);
  await pair(p, 8, 17);
  await state(p, "book-one-move");
  await tap(p, "#menu");
  await state(p, "menu-from-book", true);
  await tap(p, "#daily-mode");
  await state(p, "today", true);
  await tap(p, "#menu");
  await tap(p, "#book-mode");
  await state(p, "notebook-index", true);
  await tap(p, "#continue-book");
  await state(p, "book-return");
  for (const [a, b] of [
    [4, 5],
    [9, 11],
    [7, 14],
  ]) {
    await pair(p, a, b);
    await state(p, "book-pair-" + a + "-" + b);
  }
  await p.locator("#win").waitFor();
  await state(p, "book-result", true);
  await tap(p, "#play-again");
  await state(p, "book-next");
  await tap(p, "#menu");
  await tap(p, "#daily-mode");
  await solve(p, "daily-v1-2026-11-20");
  await state(p, "today-result", true);
  await tap(p, "#play-again");
  await state(p, "from-daily-result", true);
  await tap(p, "#menu");
  await tap(p, "#calendar-open");
  await state(p, "calendar", true);
  await tap(p, "#close");
  const c = await fresh();
  await tap(c, "#skip");
  await state(c, "skip-to-classic", true);
  await tap(c, "#menu");
  await tap(c, "#learn");
  for (const [i, [a, b]] of [
    [0, 1],
    [0, 1],
    [0, 3],
    [0, 20],
    [8, 9],
  ].entries()) {
    await state(c, "full-step-" + (i + 1), i === 2 || i === 4);
    await pair(c, a, b);
    await tap(c, "#lesson-next");
  }
  await tap(c, "#add");
  await tap(c, "#undo");
  await tap(c, "#lesson-next");
  await state(c, "full-to-game");
  const edges = [];
  for (const reversed of [false, true]) {
    await tap(c, "#menu");
    await tap(c, "#learn");
    for (const [a, b] of [
      [0, 1],
      [0, 1],
      [0, 3],
      [0, 20],
    ]) {
      await pair(c, a, b);
      await tap(c, "#lesson-next");
    }
    await c.evaluate(() => {
      window.uxPaths = [];
      const paths = document.querySelector("#paths");
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (node.nodeName.toLowerCase() === "path")
              window.uxPaths.push(node.getAttribute("d"));
          }
      }).observe(paths, { childList: true });
    });
    await pair(c, ...(reversed ? [9, 8] : [8, 9]));
    edges.push({
      order: reversed ? [9, 8] : [8, 9],
      paths: await c.evaluate(() => [...new Set(window.uxPaths)]),
      feedback: await c.locator("#lesson-feedback").innerText(),
    });
    await tap(c, "#skip");
  }
  const model = await c.evaluate(async () => {
    const { checkPair, pairs, removePair } = await import("/src/core.ts");
    const { notebook } = await import("/src/puzzles.ts");
    const starter = notebook[0].board;
    // Count complete trajectories, distinguishing distinct first moves even if later positions converge.
    const routes = [];
    function visit(board, steps) {
      if (!board.some(Boolean)) {
        routes.push(steps);
        return;
      }
      for (const move of pairs(board)) {
        const ar = Math.floor(move.a / 9),
          br = Math.floor(move.b / 9),
          ac = move.a % 9,
          bc = move.b % 9;
        const gap =
          move.kind === "straight" &&
          Math.max(Math.abs(ar - br), Math.abs(ac - bc)) > 1;
        visit(removePair(board, move.a, move.b), [...steps, { ...move, gap }]);
      }
    }
    visit(starter, []);
    const checks = [
      {
        name: "gap",
        board: [1, 2, 1, 4, 0, 6],
        test: [
          [3, 5],
          [5, 3],
          [0, 2],
        ],
      },
      {
        name: "edge",
        board: [2, 1, 2, 0, 0, 0, 0, 6, 0, 0, 4, 3],
        test: [
          [7, 10],
          [10, 7],
          [0, 2],
        ],
      },
      {
        name: "edge-blocked",
        board: [2, 1, 2, 0, 0, 0, 0, 6, 9, 0, 4, 3],
        test: [
          [7, 10],
          [10, 7],
        ],
      },
      {
        name: "independent-gap",
        board: [2, 1, 2, 7, 0, 0, 3],
        test: [
          [3, 6],
          [6, 3],
          [0, 2],
        ],
      },
      {
        name: "independent",
        board: [2, 1, 2, 0, 0, 0, 3, 0, 0, 0, 0, 7, 4],
        test: [
          [6, 11],
          [11, 6],
          [0, 2],
        ],
      },
    ].map((f) => ({
      ...f,
      available: pairs(f.board),
      expected: f.test.map(([a, b]) => checkPair(f.board, a, b)),
    }));
    return {
      starter,
      legalStart: pairs(starter),
      total: routes.length,
      withReading: routes.filter((r) => r.some((m) => m.kind === "reading"))
        .length,
      withStraightGap: routes.filter((r) => r.some((m) => m.gap)).length,
      example: routes[0],
      checks,
    };
  });
  await writeFile(
    path.join(out, "evidence.json"),
    JSON.stringify(
      {
        source: "2e7f30f5407aa00ec6ec766ec0b5f0a166eec338",
        date: "2026-11-20",
        scope:
          "Chromium, 390x844 CSS px, reduced motion, two clean browser profiles, programmatic ordinary clicks. Daily solution read from game fixture. No human cohort.",
        states,
        model,
        edges,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    states.map((s) => [s.name, s.active, s.mode, s.remaining, s.status]),
  );
  console.log(
    "model",
    model.total,
    model.withReading,
    model.withStraightGap,
    model.checks.map((f) => [f.name, f.available.length, f.expected]),
  );
} finally {
  await browser.close();
}
