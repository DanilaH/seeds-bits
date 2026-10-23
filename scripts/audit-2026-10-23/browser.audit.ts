import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { notebook, loadNotebook } from "../../src/puzzles";
const out = "test-results/audit-2026-10-23",
  key = "seeds-bits.progress.v2";
mkdirSync(out, { recursive: true });
function report(name: string, value: any) {
  writeFileSync(`${out}/${name}.json`, JSON.stringify(value, null, 2));
}
async function setup(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.auditSeeded) {
      sessionStorage.auditSeeded = "1";
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
    }
  });
  await page.goto("/");
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
}
async function snapshot(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png`, animations: "disabled" });
}
test("B01 production first launch, two-step onboarding and reload preserve a real move", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#lesson")).toBeVisible();
  for (let n = 0; n < 2; n++) {
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await page.locator("#lesson-next").click();
  }
  await expect(page.locator("#lesson")).toBeHidden();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("28");
  expect(errors).toEqual([]);
  report("B01-prod-onboarding", { errors, passed: true });
});
test("B02 production ignores development advertising injection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__SEEDS_ADS_TEST__ = {
      initialize: async () => {
        throw Error("DEV mock executed in release");
      },
    };
  });
  await setup(page);
  await page.locator("#resume").click();
  await expect(page.locator("html")).not.toHaveClass(/has-mobile-ads/);
  expect(await page.locator("#app").evaluate((e) => e.inert)).toBe(false);
  report("B02-release-no-mock", { passed: true });
});
test("B03 full screen matrix checks overflow and actual control hit targets in two themes", async ({
  browser,
}) => {
  const matrix: any[] = [];
  const problems: any[] = [];
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [568, 320],
    [667, 375],
    [844, 390],
    [1024, 600],
    [1280, 800],
    [800, 1280],
  ])
    for (const dark of [false, true]) {
      const c = await browser.newContext({
          viewport: { width: w, height: h },
          reducedMotion: "reduce",
        }),
        p = await c.newPage();
      await p.addInitScript(
        (dark) =>
          localStorage.setItem(
            "seeds-bits.settings.v1",
            JSON.stringify({
              tutorialDone: true,
              theme: dark ? "dark" : "light",
            }),
          ),
        dark,
      );
      for (const [screen, actions] of [
        ["home", []],
        ["book", ["#book-mode"]],
        ["calendar", ["#calendar-open"]],
        ["progress", ["#progress-open"]],
        ["jars", ["#progress-open", "#progress-trophies"]],
        [
          "trophies",
          ["#progress-open", "#progress-trophies", "#trophies-mode"],
        ],
        ["settings", ["#settings-open"]],
        ["privacy", ["#settings-open", "#privacy-open"]],
        ["game", ["#resume"]],
      ] as [string, string[]][]) {
        await p.goto("/");
        for (const action of actions) await p.locator(action).click();
        const geometry = await p.evaluate(() => {
          const dialog = document.querySelector<HTMLDialogElement>("#dialog")!,
            scope = dialog.open ? dialog : document.querySelector(".game")!;
          const blocked: any[] = [];
          for (const e of scope.querySelectorAll<HTMLElement>(
            "button:not(:disabled),select,summary",
          )) {
            const r = e.getBoundingClientRect();
            if (
              !r.width ||
              !r.height ||
              r.top < 0 ||
              r.bottom > innerHeight ||
              r.left < 0 ||
              r.right > innerWidth
            )
              continue;
            if (
              e.closest("[hidden]") ||
              !e.checkVisibility({
                checkVisibilityCSS: true,
                checkOpacity: true,
              })
            )
              continue;
            const clip = scope.getBoundingClientRect();
            if (
              r.top < clip.top ||
              r.bottom > clip.bottom ||
              r.left < clip.left ||
              r.right > clip.right
            )
              continue;
            const cx = (r.left + r.right) / 2,
              cy = (r.top + r.bottom) / 2;
            const hit = document.elementFromPoint(cx, cy);
            if (!hit || !(hit === e || e.contains(hit)))
              blocked.push({
                id: e.id,
                text: e.textContent?.slice(0, 40),
                rect: r.toJSON(),
                hit: hit?.outerHTML.slice(0, 150),
              });
          }
          return {
            documentOverflow:
              document.documentElement.scrollWidth > innerWidth + 1,
            scopeOverflow: scope.scrollWidth > scope.clientWidth + 1,
            blocked,
          };
        });
        const row = { w, h, dark, screen, ...geometry };
        matrix.push(row);
        if (
          geometry.documentOverflow ||
          geometry.scopeOverflow ||
          geometry.blocked.length
        ) {
          problems.push(row);
          await snapshot(p, `B03-${w}-${h}-${dark}-${screen}`);
        }
      }
      await c.close();
    }
  report("B03-layout-matrix", { screens: matrix.length, problems, matrix });
  expect(problems).toEqual([]);
});
test("B04 rapid play, open menus, cancel restart and return preserve board over 40 cycles", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  for (let i = 0; i < 40; i++) {
    await page.locator("#book-top").click();
    await page.locator("#collection-back").click();
    await expect(page.locator("#dialog")).toBeHidden();
    await page.locator("#menu").click();
    await page.locator("#settings-open").click();
    await page.locator("#new").click();
    await expect(page.locator("#confirm-content")).toBeVisible();
    await page.locator("#cancel-new").click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    if (await page.locator("#dialog").isVisible())
      await page.locator("#resume").click();
    await expect(page.locator("#remaining")).toHaveText("26");
  }
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
  report("B04-navigation", { cycles: 40, remaining: 26, passed: true });
});
test("B05 1800-cell saved board scroll, selection, row collapse and rotation retain move", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.largeSeeded) {
      sessionStorage.largeSeeded = "1";
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
      localStorage.setItem(
        "seeds-bits.session.v1",
        JSON.stringify({
          rules: 1,
          current: {
            board: Array(1800).fill(5),
            moves: 0,
            additions: 0,
            scroll: 0,
          },
          history: [],
        }),
      );
    }
  });
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator('[data-index="1798"]').click();
  await page.locator('[data-index="1799"]').click();
  await expect(page.locator("#remaining")).toHaveText("1798");
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator("#hint")).toBeInViewport();
  }
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("1798");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("1800");
  await snapshot(page, "B05-max-board");
  report("B05-max-board", { cells: 1800, passed: true });
});
test("B06 unavailable worker keeps actual built notebook playable and hint budget unchanged", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#book-mode").click();
  await page.locator("[data-game]").first().click();
  await expect(page.locator("#dialog")).toBeHidden();
  await page.route("**/advice-worker-*.js", (r) => r.abort());
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText(
    "Не удалось найти подсказку",
  );
  await expect(page.locator("#hint")).toBeEnabled();
  await page.locator('[data-index="4"]').click();
  await expect(page.locator(".cell.selected")).toHaveCount(1);
  report("B06-worker-failure", { passed: true });
});
test("B07 final largest notebook solves without hidden action controls or stale result", async ({
  page,
}) => {
  const flat = JSON.parse(
    readFileSync("src/notebook-extra.json", "utf8"),
  )[2375][1];
  const solution = [];
  for (let i = 0; i < flat.length; i += 3)
    solution.push({ a: flat[i], b: flat[i + 1] });
  await setup(page);
  await page.locator("#book-mode").click();
  await page.locator("#book-chapter").selectOption("9");
  await page.locator('[data-volume="99"]').click();
  await page.locator('[data-game="book-v1-2400"]').click();
  await expect(page.locator("#dialog")).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  let steps = 0;
  const start = Date.now();
  for (const pair of solution) {
    await page.locator(`[data-index="${pair.a}"]`).click();
    await page.locator(`[data-index="${pair.b}"]`).click();
    steps++;
    await expect(page.locator("#remaining")).toHaveText(
      String(solution.length * 2 - steps * 2),
    );
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#hint")).toBeHidden();
  await expect(page.locator("#undo")).toBeHidden();
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#win")).toBeVisible();
  await snapshot(page, "B07-largest-result");
  report("B07-largest", { steps, elapsedMs: Date.now() - start, passed: true });
});
test("B08 a corrupted nonexistent saved date cannot be played as a legitimate daily", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    localStorage.setItem(
      "seeds-bits.progress.v2",
      JSON.stringify({
        version: 3,
        active: "daily-v1-2026-13-01",
        sessions: {
          "daily-v1-2026-13-01": {
            rules: 1,
            current: { board: [5, 5], moves: 0, additions: 0, scroll: 0 },
            history: [],
          },
        },
        done: [],
        seen: [],
        hints: {},
      }),
    );
  });
  await page.goto("/");
  await page.locator("#resume").click();
  const mode = await page.locator("#mode").textContent();
  await snapshot(page, "B08-invalid-date");
  report("B08-invalid-date", {
    mode,
    expected: "invalid date recovered or blocked",
  });
  expect(mode).not.toContain("13.2026");
});
