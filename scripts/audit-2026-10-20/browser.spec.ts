import { test, expect } from "@playwright/test";
const snap = (board: number[]) => ({
  board,
  scroll: 0,
  moves: 0,
  additions: 0,
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
    }
  });
});
async function start(page: any) {
  await page.goto("/");
  await page.locator("#resume").click();
}
test("corrupt save warning is visible in initial menu and survives resume", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("seeds-bits.progress.v2", "{broken"),
  );
  await page.goto("/");
  await expect(page.locator("#dialog")).toBeVisible();
  const dialogWarning = await page.locator("#dialog").innerText();
  console.log(
    "CORRUPT_INITIAL",
    JSON.stringify({
      dialogWarning,
      status: await page.locator("#status").innerText(),
    }),
  );
  expect(dialogWarning).toContain("не удалось");
});
test("winning move then undo and reload keeps actual board and historical completion", async ({
  page,
}) => {
  await page.addInitScript(
    (s) => {
      if (!localStorage.getItem("seeds-bits.progress.v2"))
        localStorage.setItem(
          "seeds-bits.progress.v2",
          JSON.stringify({
            version: 2,
            active: "book-v1-1",
            sessions: { "book-v1-1": { rules: 1, current: s, history: [] } },
            done: [],
            seen: [],
            hints: {},
          }),
        );
    },
    snap([5, 5]),
  );
  await start(page);
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await expect(page.locator("#win")).toBeHidden();
  const p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("seeds-bits.progress.v2")!),
  );
  expect(p.done).toContain("book-v1-1");
});
test("simultaneous pair, undo, menu and mode presses cannot corrupt board", async ({
  page,
}) => {
  await start(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluate(() => {
    for (const id of [
      '[data-index="0"]',
      '[data-index="9"]',
      "#undo",
      "#menu",
      "#book-top",
      "#add",
    ])
      (document.querySelector(id) as HTMLElement).click();
  });
  await expect(page.locator("#remaining")).toHaveText("26");
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("26");
  expect(errors).toEqual([]);
});
test("reduced motion disables board and interface animations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.locator('[data-index="0"]').click();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});
test("200 percent text and 320px viewport keep footer controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  await page.addStyleTag({ content: "html {font-size:200% !important}" });
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  const m = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    field: document.querySelector("#viewport")!.getBoundingClientRect().height,
  }));
  console.log("LARGE_TEXT", JSON.stringify(m));
  expect(m.width).toBeLessThanOrEqual(m.viewport);
  expect(m.field).toBeGreaterThan(60);
});
test("hint with no history and dead board offers a reachable restart", async ({
  page,
}) => {
  await page.addInitScript(
    (s) =>
      localStorage.setItem(
        "seeds-bits.progress.v2",
        JSON.stringify({
          version: 2,
          active: "book-v1-1",
          sessions: { "book-v1-1": { rules: 1, current: s, history: [] } },
          done: [],
          seen: [],
          hints: {},
        }),
      ),
    snap([1, 2]),
  );
  await start(page);
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText("решения нет");
  await page.locator("#restart-task").click();
  await expect(page.locator("#remaining")).not.toHaveText("2");
});
test("keyboard arrow stays in grid and focus survives two collapses", async ({
  page,
}) => {
  await page.addInitScript(
    (s) =>
      localStorage.setItem(
        "seeds-bits.session.v1",
        JSON.stringify({ rules: 1, current: s, history: [] }),
      ),
    snap([5, 5, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 3, 3]),
  );
  await start(page);
  for (let n = 0; n < 2; n++) {
    await page.locator("#board button").first().focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.locator("#remaining")).toHaveText(String(4 - n * 2));
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("#board") !== null,
      ),
    ).toBe(true);
  }
});
test("settings changes in another tab do not silently reset theme", async ({
  page,
  context,
}) => {
  await start(page);
  await page.locator("#hint").click();
  await page.waitForTimeout(250);
  const second = await context.newPage();
  await second.goto("/");
  await second.locator("#settings-open").click();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await page.waitForTimeout(150);
  await second.locator("#sound").check();
  await second.waitForTimeout(250);
  const s = await second.evaluate(() =>
    JSON.parse(localStorage.getItem("seeds-bits.settings.v1")!),
  );
  console.log("TWO_TAB_PREFS", JSON.stringify(s));
  expect(s.theme).toBe("dark");
});
test("corrupt save warning visibility is independently measured after boot", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("seeds-bits.progress.v2", "{broken"),
  );
  await page.goto("/");
  await page.waitForTimeout(300);
  console.log(
    "WARNING_DETAIL",
    JSON.stringify(
      await page.evaluate(() => ({
        inert: (document.querySelector("#app") as HTMLElement).inert,
        status: document.querySelector("#status")!.textContent,
        dialog: document.querySelector("#dialog")!.textContent,
        noticeHidden: (document.querySelector("#save-notice") as HTMLElement)
          .hidden,
      })),
    ),
  );
  await page.screenshot({
    path: "docs/audit-2026-10-20/corrupt-save-menu.png",
  });
  await page.locator("#resume").click();
  await expect(page.locator("#status")).toContainText("не удалось прочитать");
  await page.locator('[data-index="0"]').click();
  console.log(
    "WARNING_AFTER_SELECTION",
    await page.locator("#status").textContent(),
  );
});
test("future hard daily gives truthful fallback but blocks input during synchronous search", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2028-03-19T12:00:00+05:00"));
  await page.goto("/");
  await page.locator("#daily-mode").click();
  await page.locator("#today-task").click();
  const timing = await page.evaluate(async () => {
    const start = performance.now();
    const tick = new Promise<number>((resolve) =>
      setTimeout(() => resolve(performance.now() - start), 0),
    );
    (document.querySelector("#hint") as HTMLElement).click();
    return {
      blockedMs: await tick,
      status: document.querySelector("#status")!.textContent,
      undoDisabled: (document.querySelector("#undo") as HTMLButtonElement)
        .disabled,
    };
  });
  console.log("HARD_DAILY", JSON.stringify(timing));
  await expect(page.locator("#status")).toContainText("Не удалось быстро");
  await page.screenshot({ path: "docs/audit-2026-10-20/hard-daily.png" });
});
