import { chromium } from "playwright";
import fs from "node:fs/promises";
const out = process.env.LAYOUT_OUT || "test-results/layout-browser";
const origin = process.env.LAYOUT_URL || "http://127.0.0.1:5182";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const matrix = [
  [390, 844, 1],
  [390, 844, 1.5],
  [390, 844, 2],
  [320, 568, 1],
  [320, 568, 1.5],
  [320, 568, 2],
  [568, 320, 1],
  [568, 320, 1.5],
  [568, 320, 2],
  [844, 390, 1],
  [844, 390, 2],
  [768, 1024, 2],
];
const chosen = process.env.LAYOUT_CASE;
const runs = matrix.filter((row) => !chosen || row.join("-") === chosen);
async function run([w, h, z]) {
  const key = [w, h, z].join("-"),
    rows = [],
    errors = [];
  const only = (process.env.LAYOUT_SECTIONS || "").split(",").filter(Boolean);
  const dir = out + "/" + key;
  await fs.mkdir(dir, { recursive: true });
  let p;
  async function newPage() {
    if (p) await p.close();
    p = await browser.newPage({
      viewport: { width: w, height: h },
      reducedMotion: "reduce",
    });
    p.setDefaultTimeout(2200);
    await p.addInitScript(() => {
      if (sessionStorage.layoutAds) {
        const state = { state: "unavailable", reason: "offline" };
        window.__SEEDS_ADS_TEST__ = {
          initialize: async () => ({
            enabled: true,
            test: true,
            readiness: state,
          }),
          readiness: async () => state,
          addListener: async () => ({ remove: async () => {} }),
          preload: async () => {},
          banner: async () => {},
          report: async () => ({ accepted: true }),
        };
      }
    });
  }
  async function scale() {
    if (z === 1) return;
    await p.evaluate((z) => {
      const all = [...document.querySelectorAll("body *")].filter(
        (e) =>
          e instanceof HTMLElement && !["SCRIPT", "STYLE"].includes(e.tagName),
      );
      for (const e of all)
        if (e.dataset.auditBase !== undefined) {
          e.style.fontSize = e.dataset.auditBase;
          delete e.dataset.auditBase;
        }
      const bases = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
      all.forEach((e, i) => {
        e.dataset.auditBase = e.style.fontSize;
        e.style.fontSize = bases[i] * z + "px";
      });
    }, z);
    await p.waitForTimeout(70);
  }
  async function go(fixture) {
    await newPage();
    await p.goto(origin + "/src/style.css?direct");
    await p.evaluate((f) => {
      localStorage.clear();
      if (f?.exhausted) sessionStorage.layoutAds = "1";
      if (f) {
        const id = f.id || "classic";
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify({ tutorialDone: true }),
        );
        localStorage.setItem(
          "seeds-bits.progress.v2",
          JSON.stringify({
            version: 3,
            active: id,
            sessions: {
              [id]: {
                rules: 1,
                current: {
                  board: f.board,
                  moves: f.moves || 0,
                  scroll: 0,
                  additions: 0,
                },
                history: f.history || [],
              },
            },
            hints: {},
            done: [],
            seen: [],
            meta: {
              version: 2,
              wallet: 0,
              since: "2026-11-01",
              completed: 0,
              unassisted: 0,
              attempts: {
                [id]: {
                  id: "layout-test",
                  completed: false,
                  hintKeys: f.exhausted ? ["one", "two", "three"] : [],
                },
              },
            },
          }),
        );
      }
    }, fixture || null);
    await p.goto(origin);
    await p.waitForSelector("#app:not([inert])");
    if (await p.locator("#resume").isVisible()) await click("#resume");
    await scale();
  }
  async function click(s) {
    const el = p.locator(s).first();
    try {
      await el.click();
    } catch (e) {
      if (
        (await p.locator("#lesson").isVisible()) &&
        (s.startsWith("[data-index") ||
          ["#lesson-next", "#add", "#undo", "#skip"].includes(s))
      ) {
        await snap("blocked-" + rows.length, true);
        errors.push({
          name: "tutorial-action-unreachable",
          selector: s,
          step: await p.locator("#lesson-step").textContent(),
          why: String(e).split("Call log:")[0],
        });
        await el.evaluate((e) => e.click());
      } else throw e;
    }
    await p.waitForTimeout(80);
  }
  const cell = (i) => '[data-index="' + i + '"]';
  async function snap(name, pic = false) {
    if (!["after-jump", "idle-8s", "privacy-link"].includes(name))
      await scale();
    const d = await p.evaluate(() => {
      const q = (s) => document.querySelector(s),
        round = (n) => Math.round(n * 10) / 10;
      const rect = (e) => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map(round);
      };
      const dims = {};
      for (const sel of [
        ".game",
        ".game-top",
        "#lesson",
        "#lesson-text",
        "#lesson-next",
        "#viewport",
        "#board-wrap",
        '[data-index="0"]',
        ".status-wrap",
        "#status",
        "#hint-jump",
        "footer",
        "#hint",
        "#win",
        "#play-again",
        "#dialog",
        ".dialog-scroll",
        "#hint-offer",
      ])
        dims[sel] = rect(q(sel));
      const board = q("#viewport").getBoundingClientRect(),
        jump = q("#hint-jump").getBoundingClientRect();
      const intersection = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      let hitCells = [];
      if (jump.width)
        for (const c of document.querySelectorAll("#board [data-index]")) {
          const cr = c.getBoundingClientRect(),
            x = cr.x + cr.width / 2,
            y = cr.y + cr.height / 2;
          if (
            intersection(cr, board) > 0 &&
            x >= jump.left &&
            x < jump.right &&
            y >= jump.top &&
            y < jump.bottom &&
            q("#hint-jump").contains(document.elementFromPoint(x, y))
          )
            hitCells.push({
              index: +c.dataset.index,
              value: c.textContent.trim(),
            });
        }
      const target = q('[data-index="171"]');
      const region = q("#hint-offer[open]") || q("#dialog[open]") || q(".game");
      const problems = [];
      for (const el of region.querySelectorAll(
        "button,summary,h1,h2,h3,p,label,select,strong,.action-label",
      )) {
        if (
          !el.getClientRects().length ||
          !el.textContent.trim() ||
          el.closest("#board")
        )
          continue;
        const box = el.getBoundingClientRect();
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2)
          problems.push({
            element: el.id || el.className || el.tagName,
            kind: "scrollWidth",
            width: el.clientWidth,
            actual: el.scrollWidth,
            text: el.textContent.trim().slice(0, 55),
          });
        if (box.right > innerWidth + 2 || box.left < -2)
          problems.push({
            element: el.id || el.className || el.tagName,
            kind: "outside-x",
            x: round(box.x),
            right: round(box.right),
            text: el.textContent.trim().slice(0, 55),
          });
      }
      const first = q('[data-index="0"]'),
        vr = rect(q("#viewport")),
        fr = rect(first),
        sr = rect(q("#status"));
      const collision = [];
      const st = q("#status");
      const tr = document.createRange();
      tr.selectNodeContents(st);
      for (const c of q("#board").querySelectorAll(".digit")) {
        if (!c.textContent.trim()) continue;
        const dr = document.createRange();
        dr.selectNodeContents(c);
        for (const r of tr.getClientRects())
          for (const g of dr.getClientRects())
            if (
              intersection(r, g) > 1 &&
              intersection(g, board) > 1 &&
              g.y < innerHeight &&
              g.bottom > 0
            ) {
              collision.push({
                cell: c.closest("[data-index]")?.dataset.index,
                text: c.textContent,
              });
              break;
            }
      }
      const jc = q("#hint-jump"),
        jr = jc.getBoundingClientRect(),
        jp = jr.width
          ? document.elementFromPoint(jr.x + jr.width / 2, jr.y + jr.height / 2)
          : null;
      return {
        jumpMidHit: jp?.closest("button")?.id || jp?.id || jp?.tagName || null,
        textCellCollisions: collision,
        statusRect: rect(st),
        saveRect: rect(q("#save-notice")),
        target: rect(target),
        vpScroll: q("#viewport").scrollTop,
        viewportScrollLimit:
          q("#viewport").scrollHeight - q("#viewport").clientHeight,
        hitTarget: target
          ? ((e) => e?.closest("[data-index]")?.dataset.index)(
              document.elementFromPoint(
                target.getBoundingClientRect().x + target.offsetWidth / 2,
                target.getBoundingClientRect().y + target.offsetHeight / 2,
              ),
            )
          : null,
        dims,
        docWidth: document.documentElement.scrollWidth,
        screen: [innerWidth, innerHeight],
        gameClass: q(".game").className,
        gameScroll: q(".game").scrollTop,
        visibleBoardHeight: Math.max(
          0,
          Math.min(innerHeight, vr[1] + vr[3]) - Math.max(0, vr[1]),
        ),
        firstY: fr?.[1],
        status: q("#status").textContent,
        lesson: q("#lesson-text").textContent,
        jump: q("#hint-jump").hidden ? "" : q("#hint-jump").textContent,
        intersectJumpBoard: round(intersection(board, jump)),
        hitCells,
        statusIntersectsBoard: round(
          intersection(board, q("#status").getBoundingClientRect()),
        ),
        problems,
      };
    });
    rows.push({ name, ...d });
    if (pic) await p.screenshot({ path: dir + "/" + name + ".png" });
  }
  async function section(name, fn) {
    if (only.length && !only.includes(name)) return;
    try {
      await fn();
    } catch (e) {
      errors.push({ name, why: String(e).slice(0, 240) });
      console.error(key, name, String(e).slice(0, 110));
    }
  }
  await section("first-launch", async () => {
    await go();
    await snap("short-1", true);
    await click(cell(0));
    await click(cell(1));
    await p.locator("#lesson-next").waitFor();
    await snap("short-1-done", true);
    await click("#lesson-next");
    await snap("short-2", true);
    await click(cell(0));
    await click(cell(1));
    await p.locator("#lesson-next").waitFor();
    await snap("short-2-done", true);
  });
  await section("full-tutorial", async () => {
    await go();
    await click("#skip");
    await click("#menu");
    await click("#learn");
    const pairs = [
      [0, 1],
      [0, 1],
      [0, 3],
      [0, 20],
      [8, 9],
    ];
    for (let i = 0; i < pairs.length; i++) {
      await snap("lesson-" + (i + 1));
      await click(cell(pairs[i][0]));
      await click(cell(pairs[i][1]));
      await p.locator("#lesson-next").waitFor();
      await snap("lesson-" + (i + 1) + "-done");
      await click("#lesson-next");
    }
    await snap("lesson-6");
    await click("#add");
    await snap("lesson-6-add");
    await click("#undo");
    await snap("lesson-6-done");
    await click("#lesson-next");
  });
  await section("near-hint", async () => {
    await go({ board: [5, 5, 1, 2, 3], moves: 1 });
    await snap("classic");
    await click("#hint");
    await p.locator(".hinted").first().waitFor();
    await snap("near-hint");
    await click(cell(3));
    await snap("other-selection");
    await click(cell(4));
    await snap("invalid-pair");
    await click("#menu");
    await snap("home");
    await click("#settings-open");
    await snap("settings", w === 320 && z === 2);
    await click("#privacy-open");
    await snap("privacy", w === 320 && z === 2);
    if (w === 320 && z === 2) {
      await p
        .locator("#collection a")
        .last()
        .evaluate((el) =>
          el.scrollIntoView({ block: "end", behavior: "instant" }),
        );
      await p.waitForTimeout(100);
      await snap("privacy-link", true);
    }
    await click("#privacy-back");
    await click("#close");
    await click("#menu");
    await click("#new");
    await p.locator("#confirm-content").waitFor();
    await snap("restart-confirm");
    await click("#cancel-new");
  });
  await section("menus", async () => {
    await go({ board: [5, 5] });
    await click("#menu");
    await click("#progress-open");
    await snap("progress");
    await click("#progress-trophies");
    await snap("jars");
    await click("#trophies-mode");
    await snap("trophies");
    await click("#close");
    await click("#menu");
    await click("#calendar-open");
    await snap("calendar", w === 320 && z === 2);
    await click("#calendar-picker summary");
    await snap("calendar-picker");
    await click("#today-task");
    await snap("daily");
    await click("#hint");
    await p.waitForTimeout(500);
    await snap("daily-hint");
    await click("#menu");
    await click("#book-mode");
    await snap("book", w === 320 && z === 2);
    await click("#continue-book");
    await snap("book-game");
    await click("#hint");
    await p.waitForTimeout(500);
    await snap("book-hint");
  });
  await section("long-hint", async () => {
    const board = Array.from({ length: 180 }, (_, i) => (i % 9 === 0 ? 0 : 1));
    board[0] = board[171] = 5;
    await go({ board });
    await snap("distant-before");
    await click("#hint");
    await p.waitForSelector("#hint-jump:visible");
    await snap("distant-hint", true);
    if ((w === 390 && z === 1.5) || (w === 320 && z === 2)) {
      await p.waitForTimeout(8000);
      await snap("idle-8s", true);
    }
    await click("#hint-jump");
    await p.waitForTimeout(350);
    await snap("after-jump", true);
    await p.waitForTimeout(900);
    await snap("after-jump-settled");
    if (await p.locator("#hint-jump").isVisible()) {
      await click("#hint-jump");
      await p.waitForTimeout(600);
      await snap("jump-repeat");
    }
    await p.setViewportSize({ width: h, height: w });
    await p.waitForTimeout(150);
    await snap("rotated");
    await p.setViewportSize({ width: w, height: h });
  });
  await section("teach", async () => {
    const board = Array(27).fill(0);
    board[0] = board[18] = 5;
    board[20] = 1;
    board[21] = 2;
    await go({ board });
    await click(cell(0));
    await click(cell(18));
    await p.waitForTimeout(250);
    await snap("teach-gap");
    await click(cell(2));
    await snap("teach-next");
  });
  await section("recovery", async () => {
    const seed = await fs.readFile("src/notebook.json", "utf8");
    const task = JSON.parse(seed)[6];
    let board = task.board;
    const history = [];
    for (const [a, b] of [
      [2, 22],
      [7, 25],
      [9, 10],
    ]) {
      history.push({ board, scroll: 0, moves: history.length, additions: 0 });
      const next = [...board];
      next[a] = next[b] = 0;
      board = next.filter((_, i) =>
        next
          .slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9)
          .some(Boolean),
      );
    }
    await go({ id: "book-v1-7", board, history, moves: 3 });
    await click("#hint");
    await p.locator("#recover-task").waitFor();
    await snap("task-recovery", w === 320 && z === 2);
    await click("#recover-task");
    await snap("after-recovery");
  });
  await section("save-error", async () => {
    const board = Array(90).fill(1);
    board[0] = board[1] = 5;
    await go({ board });
    await snap("before-save-warning");
    await p.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === "seeds-bits.progress.v2")
          throw new DOMException("full", "QuotaExceededError");
        return original.call(this, k, v);
      };
    });
    await click(cell(0));
    await click(cell(1));
    await p.locator("#save-notice").waitFor();
    await snap("save-warning", z === 2);
  });
  await section("offer", async () => {
    await go({ board: [5, 5, 1], exhausted: true });
    await click("#hint");
    await p.waitForSelector("#hint-offer[open]");
    await snap("hint-offer");
    await click("#close-hints");
  });
  for (const id of [
    "classic",
    "book-v1-1",
    "daily-v1-" + new Date().toISOString().slice(0, 10),
  ])
    await section("result-" + id, async () => {
      await go({ id, board: [5, 5] });
      await click(cell(0));
      await click(cell(1));
      await p.waitForSelector("#win:visible");
      await snap("result-" + id, w === 320 && z === 2);
      await p.locator("#play-again").scrollIntoViewIfNeeded();
      await snap("result-action-" + id);
    });
  await fs.writeFile(dir + "/data.json", JSON.stringify({ key, rows, errors }));
  await p.close();
  console.log(key, rows.length, errors.length);
}
try {
  for (let i = 0; i < runs.length; i += 2)
    await Promise.all(runs.slice(i, i + 2).map(run));
} finally {
  await browser.close();
}
