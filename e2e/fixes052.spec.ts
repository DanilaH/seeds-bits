import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const out = "test-results/fixes052",
  key = "seeds-bits.progress.v2";
mkdirSync(out, { recursive: true });
const snap = (board: number[]) => ({
  rules: 1,
  current: { board, moves: 0, additions: 0, scroll: 0 },
  history: [],
});
async function seed(
  page: any,
  active = "classic",
  board = [5, 5, 5, 5],
  done: string[] = [],
  seeds = 0,
) {
  await page.addInitScript(
    ({ active, board, done, seeds, key }: any) => {
      if (sessionStorage.seeded) return;
      sessionStorage.seeded = "1";
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true, sound: true }),
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          active,
          sessions: {
            [active]: {
              rules: 1,
              current: { board, moves: 0, additions: 0, scroll: 0 },
              history: [],
            },
          },
          done,
          seen: [],
          hints: {},
          meta: {
            version: 1,
            since: "2026-10-20",
            completed: done.length,
            unassisted: 0,
            attempts: { [active]: { id: "audit", completed: false } },
          },
          jars: { version: 1, seeds, wins: 0, highWater: 0, attempt: "audit" },
        }),
      );
    },
    { active, board, done, seeds, key },
  );
}
const save = (name: string, value: any) =>
  writeFileSync(`${out}/${name}.json`, JSON.stringify(value, null, 2));
async function boot(page: any) {
  await page.goto("/");
  await page.locator("#resume").click();
}
async function pair(page: any) {
  await page.locator("#board button").nth(0).click();
  await page.locator("#board button").nth(1).click();
}
test("F01 second notebook completed page uses local page number", async ({
  page,
}) => {
  await seed(
    page,
    "book-v1-30",
    [5, 5],
    Array.from({ length: 5 }, (_, i) => `book-v1-${i + 25}`),
  );
  await boot(page);
  await pair(page);
  await expect(page.locator("#win")).toBeVisible();
  const award = await page.locator("#award").innerText();
  save("page-number", { award, expected: "Страница 1 завершена" });
  await page.screenshot({ path: out + "/page-number.png" });
  expect(award).toBe("✓ Страница 1 завершена");
});
test("F02 book chunk failure is visible in open modal and retry clears loading", async ({
  page,
}) => {
  await seed(page);
  let blocked = true;
  await page.route("**/*notebook-extra*", (r) =>
    blocked ? r.abort() : r.continue(),
  );
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator('[data-volume="1"]').click();
  await page.locator('[data-game="book-v1-25"]').click();
  await page.waitForTimeout(300);
  await expect(page.locator("#book-load-error")).toContainText("Не удалось");
  await expect(page.locator("#collection")).not.toContainText(
    "Открываю тетрадь…",
  );
  await page.screenshot({ path: out + "/chunk-failure.png" });
  blocked = false;
  await page.getByRole("button", { name: "Сохранить и перезагрузить" }).click();
  await expect(page.locator("#book-mode")).toBeVisible();
  await page.locator("#book-mode").click();
  await page.locator('[data-volume="1"]').click();
  await page.locator('[data-game="book-v1-25"]').click();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 2 · задача 1");
});
test("F03 completed volume filter does not silently reset when changing section", async ({
  page,
}) => {
  await seed(
    page,
    "classic",
    [5, 5],
    Array.from({ length: 24 }, (_, i) => `book-v1-${i + 1}`),
  );
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator("#book-filter").selectOption("done");
  await page.locator("#book-chapter").selectOption("9");
  save("filter", {
    value: await page.locator("#book-filter").inputValue(),
    covers: await page.locator("[data-volume]").count(),
  });
  expect(await page.locator("#book-filter").inputValue()).toBe("done");
});
test("F04 calendar 2028 leap-day and 2125 trophies", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2028-06-20T12:00:00"));
  await seed(page);
  await page.goto("/");
  await page.locator("#calendar-open").click();
  if (
    !(await page
      .locator("#calendar-picker")
      .evaluate((e: HTMLDetailsElement) => e.open))
  )
    await page.locator("#calendar-picker summary").click();
  await page.locator("#calendar-month").selectOption("02");
  await expect(page.locator('[data-game="daily-v1-2028-02-29"]')).toBeEnabled();
  await expect(page.locator('[data-game="daily-v1-2028-02-30"]')).toHaveCount(
    0,
  );
  await page.clock.setFixedTime(new Date("2125-06-20T12:00:00"));
  await page.locator("#collection-back").click();
  await page.locator("#progress-open").click();
  await page.locator("#progress-trophies").click();
  await page.locator("#trophies-mode").click();
  await page.locator("#trophy-year").selectOption("2125");
  const n = await page.locator("[data-month]").count();
  save("long-calendar", { year: 2125, months: n });
  expect(n).toBe(6);
});
test("F05 rotation during flights settles rewards and leaves no particles", async ({
  page,
}) => {
  await seed(page, "classic", Array(40).fill(5), [], 22);
  await boot(page);
  await pair(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1200);
  await expect(page.locator(".flying-seed")).toHaveCount(0);
  await expect(page.locator("#jar-meter")).toHaveAttribute("data-filled", "0");
  await expect(page.locator("#jar-meter")).toHaveAttribute(
    "data-capacity",
    "60",
  );
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(p.jars.seeds).toBe(24);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("38");
});
test("F06 collection pagination retains all jars across pages", async ({
  page,
}) => {
  await seed(page, "classic", [5, 5], [], 100000);
  await page.goto("/");
  await page.locator("#progress-open").click();
  await page.locator("#progress-trophies").click();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    seen.push(...(await page.locator(".jar-keepsake small").allTextContents()));
    if (await page.locator("#older-jars").isDisabled()) break;
    await page.locator("#older-jars").click();
  }
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.some((s) => s.endsWith("· 1"))).toBe(true);
  save("jar-pages", { count: seen.length, unique: new Set(seen).size });
});
test("F07 enlarged body text and save failure in short landscape remain reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await seed(page, "classic", Array(90).fill(5));
  await boot(page);
  await page.addStyleTag({ content: "body {font-size:200%}" });
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2")
        throw new DOMException("full", "QuotaExceededError");
      return orig.call(this, k, v);
    };
  });
  await pair(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await page.screenshot({ path: out + "/landscape-save-failure.png" });
  const metrics = await page.evaluate(() =>
    Object.fromEntries(
      ["viewport", "save-notice", "menu", "retry-save", "undo"].map((id) => {
        const r = document.getElementById(id)!.getBoundingClientRect();
        return [
          id,
          {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          },
        ];
      }),
    ),
  );
  save("landscape-save-failure", metrics);
  expect(metrics.viewport.height).toBeGreaterThan(100);
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  await expect(page.locator("#dialog")).toBeVisible();
});
test("F08 navigation stress and tab conflict never silently overwrite", async ({
  page,
  context,
}) => {
  await seed(page);
  await boot(page);
  const other = await context.newPage();
  await other.goto("/");
  await other.locator("#resume").click();
  await pair(page);
  await pair(other);
  await expect(other.locator("#save-notice")).toContainText("другой вкладке");
  await expect(page.locator("#undo")).toBeEnabled();
  for (let i = 0; i < 15; i++) {
    await page.locator("#menu").click();
    await page.locator("#book-mode").click();
    await page.locator("#collection-back").click();
    await page.locator("#resume").click();
  }
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(p.sessions.classic.current.moves).toBe(1);
  expect(p.jars.seeds).toBe(2);
});
test("F09 dead notebook controls do not overlap sidebar metadata", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await seed(page, "book-v1-25", [1, 2]);
  await boot(page);
  await page.screenshot({ path: out + "/dead-landscape.png" });
  const m = await page.evaluate(() => {
    const a = document.querySelector(".status-wrap")!.getBoundingClientRect(),
      b = document.querySelector("#page-progress")!.getBoundingClientRect();
    return {
      statusTop: a.top,
      pageBottom: b.bottom,
      overlap: a.top < b.bottom,
    };
  });
  save("dead-landscape", m);
  expect(m.overlap).toBe(false);
});
test("F10 ordinary text save failure does not overlap jar and mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await seed(page, "classic", Array(90).fill(5));
  await boot(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "seeds-bits.progress.v2")
        throw new DOMException("full", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await pair(page);
  await expect(page.locator("#save-notice")).toBeVisible();
  await page.screenshot({ path: out + "/normal-save-failure.png" });
  const m = await page.evaluate(() => {
    const a = document.querySelector(".status-wrap")!.getBoundingClientRect(),
      b = document.querySelector(".game-meta")!.getBoundingClientRect();
    return {
      statusTop: a.top,
      modeBottom: b.bottom,
      overlap: a.top < b.bottom,
    };
  });
  save("normal-save-failure", m);
  expect(m.overlap).toBe(false);
});
test("F11 offscreen hint can scroll to second number in landscape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const b = Array(540).fill(0);
  b[0] = b[539] = 5;
  await seed(page, "classic", b);
  await boot(page);
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await expect(page.locator("#hint-jump")).toBeVisible();
  await page.screenshot({ path: out + "/hint-landscape.png" });
  save(
    "hint-hit-target",
    await page.locator("#hint-jump").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        hit: document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.outerHTML.slice(0, 200),
        parentOverflow: getComputedStyle(el.parentElement!).overflow,
      };
    }),
  );
  await page.locator("#hint-jump").click({ timeout: 1500 });
  await expect(page.locator('[data-index="539"]')).toBeInViewport();
  await page.screenshot({ path: out + "/hint-landscape.png" });
});
test("F12 doubling every text size keeps menu and play reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await seed(page);
  await boot(page);
  await page.evaluate(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        "button, p, label, h1, h2, h3, strong, small, #mode, #page-progress",
      ),
    ];
    const sizes = targets.map((e) => parseFloat(getComputedStyle(e).fontSize));
    targets.forEach((e, i) => (e.style.fontSize = sizes[i] * 2 + "px"));
  });
  await page.screenshot({ path: out + "/enlarged-landscape.png" });
  const m = await page.evaluate(() => {
    const a = document.querySelector(".status-wrap")!.getBoundingClientRect(),
      b = document.querySelector(".game-meta")!.getBoundingClientRect();
    return {
      statusTop: a.top,
      modeBottom: b.bottom,
      overlap: a.top < b.bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  save("enlarged-landscape", m);
  await page.locator("#menu").click();
  await expect(page.locator("#dialog")).toBeVisible();
  expect(m.overlap).toBe(false);
});
for (const [w, h] of [
  [390, 844],
  [844, 390],
  [1280, 800],
])
  test(`F13 hint hit test ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const board = Array(540).fill(0);
    board[0] = board[539] = 5;
    await seed(page, "classic", board);
    await boot(page);
    await page.locator("#hint").click();
    await expect(page.locator(".hinted")).toHaveCount(2);
    const m = await page.locator("#hint-jump").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        w: innerWidth,
        h: innerHeight,
        label: el.textContent,
        hitsButton: hit === el || el.contains(hit),
        hitTag: hit?.tagName,
      };
    });
    save(`hint-${w}`, m);
    await page.screenshot({ path: out + `/hint-${w}.png` });
    expect(m.hitsButton).toBe(true);
  });
test("F14 fresh reload recovers blocked notebook chunk", async ({ page }) => {
  await seed(page);
  let blocked = true;
  await page.route("**/*notebook-extra*", (r) =>
    blocked ? r.abort() : r.continue(),
  );
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator('[data-volume="1"]').click();
  await page.locator('[data-game="book-v1-25"]').click();
  await page.waitForTimeout(250);
  blocked = false;
  await page.reload();
  await page.locator("#book-mode").click();
  await page.locator('[data-volume="1"]').click();
  await page.locator('[data-game="book-v1-25"]').click();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 2 · задача 1");
});
