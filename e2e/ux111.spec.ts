import { test, expect, type Page } from "@playwright/test";
const key = "seeds-bits.progress.v2";
async function seed(
  page: Page,
  permission: "grant" | "deny" | "error" | "hang" = "grant",
) {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, permission }) => {
      const w = window as any;
      w.permission111 = false;
      w.__SEEDS_ENGAGEMENT_TEST__ = {
        configuration: async () => ({
          available: true,
          granted: w.permission111,
        }),
        requestNotifications: async () => {
          if (permission === "hang") return new Promise(() => {});
          if (permission === "error") throw new Error("native_unavailable");
          w.permission111 = permission === "grant";
          return { available: true, granted: w.permission111 };
        },
        addListener: async () => ({ remove: async () => {} }),
        openNotificationSettings: async () => {},
      };
      if (sessionStorage.seed111) return;
      sessionStorage.seed111 = "1";
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true, reminders: true }),
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          active: "classic",
          sessions: {
            classic: {
              rules: 1,
              current: {
                board: [1, 1, 2, 8, 3, 7],
                moves: 0,
                additions: 0,
                scroll: 0,
              },
              history: [],
            },
          },
          done: [],
          hints: {},
          seen: [],
        }),
      );
    },
    { key, permission },
  );
  await page.goto("/");
}
async function hintedMove(page: Page) {
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  const pair = await page
    .locator(".hinted")
    .evaluateAll((ns) => ns.map((n) => (n as HTMLElement).dataset.index));
  for (const i of pair) await page.locator(`[data-index="${i}"]`).click();
}
test("continuing a notebook retains the latest unfinished task, also after relaunch", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#book-mode").click();
  for (const task of [4, 5]) {
    await page.locator(`[data-game="book-v1-${task}"]`).click();
    await hintedMove(page);
    await page.locator("#book-top").click();
  }
  await expect(page.locator("#continue-book")).toHaveText(
    "Продолжить · задача 5",
  );
  await page.locator("#continue-book").click();
  await expect(page.locator("#mode")).toContainText("задача 5");
  await page.reload();
  await page.locator("#book-mode").click();
  await expect(page.locator("#continue-book")).toContainText("задача 5");
});
test("leaving the first lesson for a notebook is remembered", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#book-top").click();
  await page.locator("#continue-book").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#lesson")).toBeHidden();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
});
test("Back and Close remain reachable after scrolling every long section", async ({
  page,
}) => {
  await seed(page);
  for (const route of [
    "book-mode",
    "calendar-open",
    "progress-open",
    "settings-open",
  ]) {
    await page.locator(`#${route}`).click();
    await page
      .locator("#dialog")
      .evaluate((e) => (e.scrollTop = e.scrollHeight));
    const heading = page.locator(".dialog-head .screen-heading");
    await expect(heading).toBeInViewport();
    await expect(
      heading.getByRole("button", { name: "Назад", exact: true }),
    ).toBeInViewport();
    await expect(page.locator("#close")).toBeInViewport();
    await heading.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(page.locator("#menu-content")).toBeVisible();
  }
});
test("restart belongs to the current-game menu and cancelling preserves the board", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#menu").click();
  await page.locator("#new").click();
  await expect(page.locator("#confirm-content")).toBeVisible();
  await page.locator("#cancel-new").click();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("4");
});
for (const state of ["grant", "deny", "error", "hang"] as const)
  test(`notification ${state} always leaves usable navigation`, async ({
    page,
  }) => {
    await seed(page, state);
    await page.locator("#settings-open").click();
    await page.locator("#notification-permission-request").click();
    if (state === "hang") await page.waitForTimeout(20500);
    if (state === "error" || state === "hang") {
      await expect(page.locator("#reminder-permission")).toContainText(
        "Не удалось открыть",
      );
      await expect(
        page.locator("#notification-permission-request"),
      ).toBeEnabled();
    } else if (state === "deny")
      await expect(page.locator("#reminders")).not.toBeChecked();
    else
      await expect(page.locator("#reminder-permission")).toHaveText(
        "Напоминание включено.",
      );
    await page.locator("#settings-back").click();
    await page.locator("#resume").click();
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#remaining")).toHaveText("4");
  });
test("invalid raw data is preserved without offering a guaranteed failing restore", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate((k) => localStorage.setItem(k, "{broken"), key);
  await page.reload();
  await expect(page.locator("#read-notice")).toBeVisible();
  await expect(page.locator("#restore-backup")).toBeHidden();
  expect(
    await page.evaluate((k) => localStorage.getItem(k + ".recovery"), key),
  ).toBe("{broken");
});
test("a usable recovery copy survives a damaged primary save", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.done = ["book-v1-1"];
    localStorage.setItem(k + ".recovery", JSON.stringify(p));
    localStorage.setItem(k, "{broken");
  }, key);
  await page.reload();
  await page.locator("#restore-backup").click();
  await expect(page.locator("#book-count")).toHaveText("1 из 2400 решено");
  expect(
    await page.evaluate((k) => localStorage.getItem(k + ".damaged"), key),
  ).toBe("{broken");
});
test("today's result names the actual archived destination", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k)!);
    p.active = "daily-v1-2026-11-11";
    p.sessions[p.active] = {
      rules: 1,
      current: { board: [5, 5], moves: 0, additions: 0, scroll: 0 },
      history: [],
    };
    p.done = [5, 6, 7, 8, 9, 10].map(
      (d) => `daily-v1-2026-11-${String(d).padStart(2, "0")}`,
    );
    localStorage.setItem(k, JSON.stringify(p));
  }, key);
  await page.reload();
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#play-again")).toHaveText(
    "Задача из архива · 04.11.2026",
  );
  await page.locator("#play-again").click();
  await expect(page.locator("#mode")).toContainText("04.11.2026");
});
test("landscape enlarged action text gets whole words and reachable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await seed(page);
  await page.locator("#resume").click();
  await page
    .locator("footer .action-label, #undo span")
    .evaluateAll((ns) =>
      ns.forEach((n) => ((n as HTMLElement).style.fontSize = "20px")),
    );
  await expect(page.locator(".game")).toHaveClass(/stacked-actions/);
  for (const id of ["hint", "undo", "add"]) {
    const b = page.locator(`#${id}`);
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeInViewport();
  }
});
