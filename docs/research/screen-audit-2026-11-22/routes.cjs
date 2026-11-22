const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  require.resolve("playwright", { paths: [process.cwd()] }),
);
const payload = path.resolve(process.argv[2]),
  out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });
const records = [],
  screens = [],
  logs = [],
  faults = [];
const key = "seeds-bits.progress.v2";
const game = "https://audit.test/";
const stable = (p) =>
  p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
const $ = (p, s) => p.locator(s);
const tap = (p, s) => $(p, s).click({ timeout: 4000 });
const text = (p, s) => $(p, s).innerText();
const digit = (p, n) => tap(p, '#board [data-index="' + n + '"]');
const screen = (p, name) =>
  p.waitForFunction(
    (n) =>
      document.querySelector("#dialog").open &&
      document.querySelector("#dialog").dataset.screen === n,
    name,
    { timeout: 4000 },
  );
const field = async (p, id) => {
  await p.waitForFunction(
    (id) =>
      !document.querySelector("#dialog").open &&
      JSON.parse(localStorage.getItem("seeds-bits.progress.v2") || "{}")
        .active === id,
    id,
    { timeout: 4500 },
  );
  await stable(p);
};
const fixture = (active, board, extra = {}) => ({
  version: 3,
  active,
  done: [],
  seen: [],
  hints: {},
  sessions: {
    [active]: {
      rules: 1,
      current: { board, scroll: 0, moves: 0, additions: 0 },
      history: [],
    },
  },
  ...extra,
});
async function snapshot(p, scenario, name, shot = false) {
  await stable(p);
  const read = await p.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll("dialog[open]"));
    const root = dialogs.at(-1) || document.querySelector(".game");
    const visible = (e) =>
      e.getClientRects().length &&
      !e.closest("[hidden]") &&
      getComputedStyle(e).visibility !== "hidden";
    const controls = [...root.querySelectorAll("button,input,select,a,summary")]
      .filter(visible)
      .map((e) => ({
        key:
          e.id ||
          e.dataset.game ||
          e.dataset.month ||
          e.dataset.volume ||
          e.dataset.language ||
          e.tagName,
        label: e.getAttribute("aria-label") || e.innerText?.trim() || "",
        disabled: !!e.disabled || e.getAttribute("aria-disabled") === "true",
      }));
    return {
      lang: document.documentElement.lang,
      screen: root.dataset.screen || root.id || "field",
      mode: document.querySelector("#mode").textContent,
      rootWide: document.documentElement.scrollWidth - innerWidth,
      scrollY: window.scrollY,
      text: root.innerText.trim().slice(0, 7500),
      controls,
    };
  });
  screens.push({ scenario, name, ...read });
  if (shot)
    await p.screenshot({
      path: path.join(out, scenario + "-" + name + ".png"),
    });
}
function note(s, k, v) {
  records.push({ scenario: s, check: k, value: v });
}
async function route(s, lang, width, height, state, body, options = {}) {
  const c = await browser.newContext({
    locale: lang,
    timezoneId: "Asia/Yekaterinburg",
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  let deny = options.deny || false;
  await c.route(game + "**", (r) => {
    const pn = new URL(r.request().url()).pathname;
    if (deny && pn.includes("notebook-extra"))
      return r.fulfill({ status: 503, body: "offline" });
    const f = path.resolve(payload, "." + (pn === "/" ? "/index.html" : pn));
    return f.startsWith(payload + path.sep) && fs.existsSync(f)
      ? r.fulfill({ path: f })
      : r.fulfill({ status: 404, body: "" });
  });
  if (state || options.settings)
    await c.addInitScript(
      ({ state, settings }) => {
        if (sessionStorage.getItem("audit-seeded")) return;
        sessionStorage.setItem("audit-seeded", "1");
        if (state)
          localStorage.setItem("seeds-bits.progress.v2", JSON.stringify(state));
        localStorage.setItem(
          "seeds-bits.settings.v1",
          JSON.stringify(settings || { tutorialDone: true }),
        );
      },
      { state, settings: options.settings },
    );
  const p = await c.newPage();
  p.setDefaultTimeout(4500);
  p.on("pageerror", (e) => logs.push([s, String(e)]));
  await p.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
  try {
    await p.goto(game);
    await p.waitForFunction(() => !document.querySelector("#app").inert);
    await body(
      p,
      (n, shot) => snapshot(p, s, n, shot),
      (v) => {
        deny = v;
      },
    );
    note(s, "route", "completed");
  } catch (e) {
    faults.push([s, e.message]);
    await snapshot(p, s, "stopped", true).catch(() => {});
  } finally {
    await c.close();
  }
}
async function move(p, a, b) {
  const n = Number(await text(p, "#remaining"));
  await digit(p, a);
  await digit(p, b);
  await p.waitForFunction(
    (n) => Number(document.querySelector("#remaining").textContent) === n,
    n - 2,
    { timeout: 4000 },
  );
}
async function menu(p) {
  await tap(p, "#menu");
  await screen(p, "home");
}
async function resume(p) {
  await tap(p, "#resume");
  await p.waitForFunction(() => !document.querySelector("#dialog").open);
}
async function openCalendar(p) {
  await menu(p);
  await tap(p, "#calendar-open");
  await screen(p, "calendar");
}
async function first(p, snap) {
  await p.locator(".opening-copy").waitFor();
  await snap("first", true);
  await digit(p, 9);
  await digit(p, 8);
  await snap("mismatch");
  await digit(p, 8);
  await tap(p, "#hint");
  await p.waitForFunction(() => !!document.querySelector("#board .hinted"));
  await snap("hint");
  await move(p, 8, 17);
  await tap(p, "#undo");
  assert.equal(await text(p, "#remaining"), "8");
  await move(p, 8, 17);
  await move(p, 4, 5);
  await snap("gap");
  await move(p, 9, 11);
  await snap("edge", true);
  await move(p, 7, 14);
  await p.locator("#win h1").waitFor();
  await snap("result", true);
  await tap(p, "#play-again");
  await field(p, "book-v1-2");
  await move(p, 7, 15);
  const current = () =>
    p.evaluate(
      (k) =>
        JSON.parse(localStorage.getItem(k)).sessions["book-v1-2"].current.board,
      key,
    );
  const before = await current();
  await p.reload();
  await resume(p);
  await field(p, "book-v1-2");
  assert.deepEqual(await current(), before);
  await snap("resumed");
}
async function menuHub(p, snap) {
  await menu(p);
  await snap("pause", true);
  await tap(p, "#settings-open");
  await screen(p, "settings");
  await snap("settings", true);
  const initial = await p.locator("#dark").isChecked();
  await tap(p, "#dark");
  assert.notEqual(await p.locator("#dark").isChecked(), initial);
  for (const id of ["sound", "vibration"]) {
    const old = await p.locator("#" + id).isChecked();
    await tap(p, "#" + id);
    assert.notEqual(await p.locator("#" + id).isChecked(), old);
  }
  await tap(p, "#privacy-open");
  await screen(p, "privacy");
  await snap("privacy", true);
  note(
    "hub",
    "policy link",
    await p.locator("#collection a").evaluateAll((ls) => ls.map((e) => e.href)),
  );
  await tap(p, "#privacy-back");
  await screen(p, "settings");
  await tap(p, "#language-open");
  await snap("languages", true);
  for (const lang of ["en", "es", "tr", "pt-BR", "ru", "auto"]) {
    await tap(p, '[data-language="' + lang + '"]');
    await p.waitForFunction(
      (x) =>
        document
          .querySelector('[data-language="' + x + '"]')
          .getAttribute("aria-pressed") === "true",
      lang,
    );
    note("hub", "lang " + lang, await p.locator("html").getAttribute("lang"));
  }
  await p.keyboard.press("Escape");
  await tap(p, "#settings-back");
  await screen(p, "home");
  await tap(p, "#progress-open");
  await screen(p, "progress");
  await snap("progress", true);
  await tap(p, "#progress-trophies");
  await screen(p, "trophies");
  await snap("jars", true);
  await tap(p, "#trophies-mode");
  await snap("trophies", true);
  await p.locator("#trophy-year").selectOption("2025");
  await tap(p, '[data-month="2025-04"]');
  await screen(p, "calendar");
  await snap("calendar", true);
  assert.equal(await p.locator("#calendar-month").inputValue(), "04");
  await tap(p, "#next-month");
  assert.equal(await p.locator("#calendar-month").inputValue(), "05");
  await tap(p, "#prev-month");
  await tap(p, "#calendar-picker summary");
  await p.locator("#calendar-month").selectOption("02");
  assert.equal(await p.locator('[data-game^="daily-v1-2025-02-"]').count(), 28);
  await p.locator("details.explanation summary").first().click();
  await snap("calendar-rules");
  await tap(p, "#collection-back");
  await screen(p, "trophies");
  await tap(p, "#collection-back");
  await screen(p, "progress");
  await tap(p, "#progress-book");
  await screen(p, "book");
  await snap("books", true);
  await p.locator("#book-filter").selectOption("done");
  await snap("empty-filter");
  await tap(p, "#book-filter-reset");
  await tap(p, '[data-volume="1"]');
  await snap("book2");
  note(
    "hub",
    "book2 button and name",
    await p
      .locator('[data-game="book-v1-25"]')
      .evaluate((e) => [e.innerText, e.getAttribute("aria-label")]),
  );
  await tap(p, '[data-game="book-v1-25"]');
  await field(p, "book-v1-25");
  await snap("opened-book2");
  await menu(p);
  await tap(p, "#daily-mode");
  await field(p, "daily-v1-2026-11-22");
  await snap("daily", true);
  await openCalendar(p);
  assert.equal(
    await p.locator('[data-game="daily-v1-2026-11-23"]').isDisabled(),
    true,
  );
  await tap(p, '[data-game="daily-v1-2026-11-13"]');
  await field(p, "daily-v1-2026-11-13");
  await snap("archive", true);
}
async function course(p, snap) {
  await menu(p);
  await tap(p, "#learn");
  for (const [i, ab] of [
    [0, [0, 1]],
    [1, [0, 1]],
    [2, [0, 3]],
    [3, [0, 20]],
    [4, [8, 9]],
    [5, null],
  ]) {
    await snap("lesson-" + (i + 1), i === 4);
    if (ab) {
      await digit(p, ab[0]);
      await digit(p, ab[1]);
    } else {
      await tap(p, "#add");
      await tap(p, "#undo");
    }
    await p.locator("#lesson-next").waitFor();
    await tap(p, "#lesson-next");
  }
  await p.waitForFunction(() => document.querySelector("#lesson").hidden);
  await snap("course-end");
}
async function restart(p, snap) {
  await resume(p);
  await move(p, 0, 1);
  await menu(p);
  await tap(p, "#new");
  await screen(p, "confirm");
  await snap("confirm", true);
  await tap(p, "#cancel-new");
  await screen(p, "home");
  await resume(p);
  assert.equal(await text(p, "#remaining"), "2");
  await menu(p);
  await tap(p, "#new");
  await tap(p, "#confirm-new");
  await p.waitForFunction(() => !document.querySelector("#dialog").open);
  await snap("after-restart");
}
async function daily(p, snap) {
  await resume(p);
  await move(p, 0, 1);
  await p.locator("#win h1").waitFor();
  await snap("daily-result", true);
  const done = () =>
    p.evaluate((k) => JSON.parse(localStorage.getItem(k)).done, key);
  assert.ok((await done()).includes("daily-v1-2026-11-22"));
  await openCalendar(p);
  await snap("streak", true);
  note(
    "daily",
    "checked streak accessible name",
    await p
      .locator(".run-days [aria-label]")
      .first()
      .getAttribute("aria-label"),
  );
  await tap(p, "#today-task");
  await p.waitForFunction(() => !document.querySelector("#dialog").open);
  await snap("replay-today");
}
async function won(p, snap) {
  await resume(p);
  await move(p, 0, 1);
  await p.locator("#win h1").waitFor();
  await snap("result", true);
  const c = p.locator("#try-notebook");
  if (await c.isVisible()) {
    await c.click();
    await p.waitForFunction(() =>
      document.querySelector("#mode").textContent.includes("1"),
    );
    await snap("to-book");
  }
}
async function large(p, snap) {
  const s = await p.locator("html").getAttribute("lang");
  await p.evaluate(() => {
    document.documentElement.classList.add("has-mobile-ads");
    const all = [...document.querySelectorAll("body *")];
    const sizes = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
    all.forEach((e, i) => {
      if (e instanceof HTMLElement) e.style.fontSize = sizes[i] * 2 + "px";
    });
  });
  const geom = async (action) => {
    await stable(p);
    const v = await p.evaluate(() => {
      const g = document.querySelector("#page-progress"),
        text = g.querySelector(".opening-copy"),
        r = document.createRange();
      r.selectNodeContents(text);
      const rect = g.getBoundingClientRect(),
        lines = [...r.getClientRects()],
        field = document.querySelector("#viewport").getBoundingClientRect();
      const cells = [...document.querySelectorAll("#board button[data-index]")]
        .filter((e) => e.textContent.trim())
        .map((e) => {
          const b = e.getBoundingClientRect();
          return [
            e.dataset.index,
            e.contains(
              document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            ),
          ];
        });
      return {
        copy: text.textContent,
        top: Math.round(field.top),
        clipDown: Math.max(
          0,
          Math.round(Math.max(...lines.map((r) => r.bottom)) - rect.bottom),
        ),
        clipSide: Math.max(
          0,
          Math.round(Math.max(...lines.map((r) => r.right)) - rect.right),
        ),
        scrollRange: g.scrollHeight - g.clientHeight,
        cells,
      };
    });
    note("large-" + s, action, v);
    if (v.clipDown || action === "edge") await snap(action, true);
  };
  await geom("start");
  await digit(p, 9);
  await geom("first-tap");
  await digit(p, 8);
  await geom("error");
  await digit(p, 8);
  await move(p, 8, 17);
  await move(p, 4, 5);
  await geom("gap");
  await move(p, 9, 11);
  await geom("edge");
  await move(p, 7, 14);
  await p.locator("#win h1").waitFor();
  await snap("win", true);
  await tap(p, "#play-again");
  await field(p, "book-v1-2");
}
async function otherLocale(p, snap) {
  const s = await p.locator("html").getAttribute("lang");
  const capture = async (id) => {
    await stable(p);
    const mix = await p.evaluate(() => {
      const root =
        [...document.querySelectorAll("dialog[open]")].at(-1) ||
        document.querySelector(".game");
      const badStrings = (str) =>
        str
          .split("\n")
          .map((x) => x.trim())
          .filter((x) => /[а-яё]/i.test(x) && x !== "Русский");
      const labels = [...root.querySelectorAll("[aria-label]")]
        .filter((e) => e.checkVisibility() && !e.closest("[hidden]"))
        .map((e) => e.getAttribute("aria-label"))
        .filter((x) => /[а-яё]/i.test(x));
      return {
        visible: [...new Set(badStrings(root.innerText))],
        labels: [...new Set(labels)].slice(0, 9),
      };
    });
    note("copy-" + s, id, mix);
  };
  await screen(p, "home");
  await capture("home");
  await snap("home", s === "en");
  await tap(p, "#book-mode");
  await screen(p, "book");
  await capture("books");
  await tap(p, '[data-volume="1"]');
  await capture("book2");
  await tap(p, "#collection-back");
  await screen(p, "home");
  await tap(p, "#calendar-open");
  await screen(p, "calendar");
  await capture("calendar");
  note("copy-" + s, "medal", await text(p, ".next-count"));
  await snap("calendar", s === "en");
  await tap(p, "#collection-back");
  await tap(p, "#learn");
  for (const [i, ab] of [
    [0, [0, 1]],
    [1, [0, 1]],
    [2, [0, 3]],
    [3, [0, 20]],
    [4, [8, 9]],
    [5, null],
  ]) {
    await capture("lesson-" + (i + 1));
    if (ab) {
      await digit(p, ab[0]);
      await digit(p, ab[1]);
    } else {
      await tap(p, "#add");
      await tap(p, "#undo");
    }
    await capture("lesson-success-" + (i + 1));
    await tap(p, "#lesson-next");
  }
}
async function hintResume(p, snap) {
  await tap(p, "#hint");
  await p.waitForFunction(() => !!document.querySelector("#board .hinted"));
  const before = () =>
    p.evaluate(() => ({
      marks: [...document.querySelectorAll("#board .hinted")].map(
        (x) => x.dataset.index,
      ),
      copy: document.querySelector(".opening-copy").textContent,
    }));
  note("hint", "before", await before());
  await menu(p);
  await tap(p, "#settings-open");
  await tap(p, "#language-open");
  await tap(p, '[data-language="es"]');
  await p.waitForFunction(() => document.documentElement.lang === "es");
  await tap(p, "#language-close");
  await tap(p, "#settings-back");
  await resume(p);
  note("hint", "after", await before());
  await snap("after", true);
}

async function lateBookFailure(p, snap, toggle) {
  await tap(p, "#book-top");
  await tap(p, '[data-volume="1"]');
  await tap(p, '[data-game="book-v1-25"]');
  await p.locator("#book-load-error").waitFor();
  await snap("load-error", true);
  assert.equal(
    await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).active, key),
    "book-v1-1",
  );
  toggle(false);
  await Promise.all([p.waitForNavigation(), tap(p, "#book-load-error button")]);
  await screen(p, "home");
  await tap(p, "#book-mode");
  await tap(p, '[data-volume="1"]');
  await tap(p, '[data-game="book-v1-25"]');
  await field(p, "book-v1-25");
  await snap("recovered");
}
async function classicPlay(p, snap) {
  await resume(p);
  await snap("board", true);
  const before = await text(p, "#remaining");
  await tap(p, "#add");
  await p.waitForFunction(
    (n) =>
      Number(document.querySelector("#remaining").textContent) ===
      2 * Number(n),
    before,
  );
  await snap("add");
  await tap(p, "#hint");
  await p.waitForFunction(
    () => document.querySelectorAll("#board .hinted").length === 2,
  );
  await snap("hint");
  await tap(p, "#undo");
  assert.equal(await text(p, "#remaining"), before);
}
async function endState(p, snap) {
  const id = await p.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).active,
    key,
  );
  await resume(p);
  await move(p, 0, 1);
  await p.locator("#win h1").waitFor();
  await snap("completion", true);
  note(id, "next", await text(p, "#play-again"));
  await tap(p, "#play-again");
  const target = {
    "book-v1-24": "book-v1-25",
    "book-v1-6": "book-v1-7",
    "daily-v1-2026-11-21": "daily-v1-2026-11-22",
  }[id];
  await field(p, target);
  await snap("next");
}
async function deadEnd(p, snap) {
  await resume(p);
  await p.locator("#restart-task").waitFor();
  await snap("dead-end", true);
  await tap(p, "#restart-task");
  await screen(p, "confirm");
  await tap(p, "#cancel-new");
  await tap(p, "#undo");
  assert.equal(await text(p, "#remaining"), "4");
  await snap("undo");
}
async function rewardOffline(p, snap) {
  await resume(p);
  await tap(p, "#hint");
  await p.waitForFunction(
    () => document.querySelectorAll("#board .hinted").length === 2,
  );
  assert.equal(await p.locator("#hint-offer").isVisible(), false);
  await snap("hint-no-native");
  await move(p, 0, 1);
  await snap("returned");
}

async function menuAtScale(p, snap) {
  const lang = await p.locator("html").getAttribute("lang");
  async function measure(name, selectors) {
    await p.evaluate(() => {
      const es = [...document.querySelectorAll("body *")].filter(
        (e) => e instanceof HTMLElement,
      );
      for (const e of es)
        if (e.dataset.auditOriginal !== undefined)
          e.style.fontSize = e.dataset.auditOriginal;
      const sizes = es.map((e) => parseFloat(getComputedStyle(e).fontSize));
      es.forEach((e, i) => {
        e.dataset.auditOriginal = e.style.fontSize;
        e.style.fontSize = sizes[i] * 2 + "px";
      });
    });
    await stable(p);
    const hits = [];
    for (const sel of selectors) {
      const b = p.locator(sel).first();
      if (!(await b.isVisible())) continue;
      await b.evaluate((e) =>
        e.scrollIntoView({ block: "nearest", inline: "nearest" }),
      );
      await stable(p);
      hits.push(
        await b.evaluate((e, s) => {
          const box = e.getBoundingClientRect(),
            hit = document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            );
          const clipped = [];
          const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
          while (walk.nextNode()) {
            const n = walk.currentNode;
            if (!n.textContent.trim()) continue;
            const r = document.createRange();
            r.selectNodeContents(n);
            const rects = [...r.getClientRects()];
            for (const q of rects) {
              if (
                q.width > 0 &&
                (q.left < Math.max(0, box.left) - 2 ||
                  q.right > Math.min(innerWidth, box.right) + 2)
              )
                clipped.push(n.textContent.trim());
            }
          }
          return {
            s,
            hit: e.contains(hit),
            hitElement: hit?.id || hit?.tagName,
            overflowX: Math.max(
              0,
              document.documentElement.scrollWidth - innerWidth,
            ),
            spill: [...new Set(clipped)],
          };
        }, sel),
      );
    }
    note("menu200-" + lang, name, hits);
    if (hits.some((t) => !t.hit || t.spill.length)) await snap(name, true);
  }
  await menu(p);
  await measure("home", [
    "#resume",
    "#classic-mode",
    "#book-mode",
    "#daily-mode",
    "#calendar-open",
    "#settings-open",
    "#close",
  ]);
  await tap(p, "#settings-open");
  await measure("settings", [
    "#settings-back",
    "#close",
    "#language-open",
    "#privacy-open",
  ]);
  await tap(p, "#privacy-open");
  await measure("privacy", ["#privacy-back", "#close", "#collection a"]);
  await tap(p, "#privacy-back");
  await tap(p, "#language-open");
  await measure("languages", ["#language-close", '[data-language="pt-BR"]']);
  await tap(p, "#language-close");
  await tap(p, "#settings-back");
  await tap(p, "#book-mode");
  await measure("books", [
    "#collection-back",
    "#close",
    "#continue-book",
    '[data-volume="9"]',
    '[data-game="book-v1-24"]',
  ]);
  await tap(p, "#collection-back");
  await tap(p, "#progress-open");
  await measure("progress", [
    "#collection-back",
    "#progress-book",
    "#progress-trophies",
  ]);
  await tap(p, "#progress-trophies");
  await measure("jars", ["#jars-tab", "#trophies-mode", "#jar-play"]);
  await tap(p, "#trophies-mode");
  await measure("trophies", [
    "#jars-tab",
    "#trophies-mode",
    '[data-month="2026-11"]',
  ]);
  await tap(p, '[data-month="2026-11"]');
  await measure("calendar", [
    "#today-task",
    "#prev-month",
    "#calendar-picker summary",
    '[data-game="daily-v1-2026-11-22"]',
  ]);
  await tap(p, "#today-task");
  await measure("daily", [
    "#menu",
    "#book-top",
    "#undo",
    "#hint",
    "#board button[data-index]",
  ]);
  await snap("daily", false);
}

async function dailyLarge(p, snap) {
  const lang = await p.locator("html").getAttribute("lang");
  await menu(p);
  await tap(p, "#daily-mode");
  await field(p, "daily-v1-2026-11-22");
  async function probe(name) {
    await p.evaluate(() => {
      const all = [...document.querySelectorAll("body *")].filter(
        (e) => e instanceof HTMLElement,
      );
      all.forEach((e) => {
        if (e.dataset.auditOriginal !== undefined)
          e.style.fontSize = e.dataset.auditOriginal;
      });
      const sizes = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
      all.forEach((e, i) => {
        e.dataset.auditOriginal = e.style.fontSize;
        e.style.fontSize = sizes[i] * 2 + "px";
      });
    });
    await stable(p);
    const data = await p.evaluate(() => {
      const out = {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
      for (const id of ["mode", "board", "undo", "hint", "viewport"]) {
        const el = document.getElementById(id),
          b = el.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()];
        out[id] = {
          left: Math.round(b.left),
          right: Math.round(b.right),
          font: getComputedStyle(el).fontSize,
          text: id === "mode" ? el.textContent : undefined,
          textRight: Math.round(Math.max(...rects.map((r) => r.right))),
          whiteSpace: getComputedStyle(el).whiteSpace,
        };
      }
      return out;
    });
    note("direct-" + lang, name, data);
    if (name === "today" || lang === "es") await snap(name, true);
  }
  await probe("today");
  await openCalendar(p);
  await tap(p, '[data-game="daily-v1-2026-11-13"]');
  await field(p, "daily-v1-2026-11-13");
  await probe("archive");
  await tap(p, "#book-top");
  await tap(p, '[data-volume="1"]');
  await tap(p, '[data-game="book-v1-25"]');
  await field(p, "book-v1-25");
  await probe("book2");
}

let browser;
(async () => {
  browser = await chromium.launch({
    executablePath: process.env.SEEDS_CHROMIUM,
  });
  const jobs = [
    () => route("first-ru", "ru-RU", 390, 844, null, first),
    () => route("first-en", "en-US", 320, 568, null, first),
    () => route("hub-ru", "ru-RU", 390, 844, null, menuHub),
    () => route("hub-en", "en-US", 320, 568, null, menuHub),
    () => route("full-course", "ru-RU", 320, 568, null, course),
    () =>
      route(
        "restart",
        "ru-RU",
        390,
        844,
        fixture("book-v1-2", [3, 3, 4, 4]),
        restart,
      ),
    () =>
      route(
        "daily-en",
        "en-US",
        390,
        844,
        fixture("daily-v1-2026-11-22", [5, 5]),
        daily,
      ),
    () =>
      route("classic-win", "ru-RU", 320, 568, fixture("classic", [5, 5]), won),
  ];
  const langs = ["ru-RU", "en-US", "es-ES", "tr-TR", "pt-BR"];
  for (const lang of langs)
    jobs.push(() => route("large-" + lang, lang, 320, 568, null, large));
  for (const lang of langs.slice(1))
    jobs.push(() =>
      route(
        "copy-" + lang,
        lang,
        320,
        568,
        fixture("classic", [2, 2], {
          done: [
            "book-v1-1",
            "book-v1-25",
            ...Array.from(
              { length: 9 },
              (_, i) => "daily-v1-2026-11-" + String(i + 1).padStart(2, "0"),
            ),
          ],
        }),
        otherLocale,
      ),
    );
  jobs.push(() => route("hint-resume", "en-US", 320, 568, null, hintResume));
  const classic = fixture("classic", [1, 2, 3, 4, 1, 2, 3, 4, 2]);
  jobs.push(
    () =>
      route("late-book", "en-US", 320, 568, null, lateBookFailure, {
        deny: true,
      }),
    () => route("classic-play", "ru-RU", 390, 844, classic, classicPlay),
  );
  for (const n of [6, 24])
    jobs.push(() =>
      route(
        "end-book-" + n,
        "ru-RU",
        320,
        568,
        fixture("book-v1-" + n, [5, 5], {
          done: Array.from({ length: n - 1 }, (_, i) => "book-v1-" + (i + 1)),
        }),
        endState,
      ),
    );
  jobs.push(() =>
    route(
      "end-archive",
      "ru-RU",
      320,
      568,
      fixture("daily-v1-2026-11-21", [5, 5]),
      endState,
    ),
  );
  const dead = fixture("book-v1-1", [1, 2]);
  dead.sessions[dead.active].current.moves = 1;
  dead.sessions[dead.active].history.push({
    board: [1, 2, 5, 5],
    scroll: 0,
    moves: 0,
    additions: 0,
  });
  jobs.push(() => route("dead-end", "ru-RU", 320, 568, dead, deadEnd));
  const emptyHint = fixture("classic", [3, 3, 4, 4], {
    hints: { classic: 3 },
    meta: {
      version: 2,
      wallet: 0,
      since: "2026-11-10",
      completed: 0,
      unassisted: 0,
      attempts: {
        classic: {
          id: "exhausted",
          completed: false,
          hintKeys: ["used1", "used2", "used3"],
        },
      },
    },
  });
  jobs.push(() =>
    route("hint-no-native", "ru-RU", 320, 568, emptyHint, rewardOffline),
  );
  for (const lang of langs)
    jobs.push(() =>
      route("menu200-" + lang, lang, 320, 568, null, menuAtScale),
    );
  for (const lang of langs)
    jobs.push(() => route("direct-" + lang, lang, 320, 568, null, dailyLarge));
  try {
    for (let i = 0; i < jobs.length; i += 2)
      await Promise.all(jobs.slice(i, i + 2).map((f) => f()));
  } finally {
    if (faults.length || logs.length) process.exitCode = 1;
    fs.writeFileSync(
      path.join(out, "obs.json"),
      JSON.stringify(
        { browser: browser.version(), records, screens, logs, faults },
        null,
        2,
      ),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
