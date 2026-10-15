import { test, expect } from "@playwright/test";
test("complete tutorial, remove a pair, undo, restore and change theme", async ({
  page,
}) => {
  await page.goto("/");
  const clickCell = (i: number) => page.locator(`[data-index="${i}"]`).click();
  for (const [a, b] of [
    [0, 1],
    [0, 1],
    [0, 3],
    [0, 20],
    [8, 9],
  ]) {
    await clickCell(a);
    await clickCell(b);
    await page.getByRole("button", { name: "Дальше", exact: true }).click();
  }
  await page.locator("#add").click();
  await page.locator("#undo").click();
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  await expect(page.locator("#remaining")).toHaveText("28");
  await clickCell(0);
  await clickCell(9);
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.reload();
  await expect(page.locator("#remaining")).toHaveText("26");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("28");
  await page.locator("#theme").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await page.locator("#add").click({ force: true });
  await expect(page.locator("#status")).toContainText("ещё есть пары");
  await page.screenshot({ path: "test-results/dark-mobile.png" });
});
test("adds only when stuck, restores partial rows and rejects blocked pair", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: { board: [1, 2, 0], scroll: 0, additions: 0, moves: 0 },
        history: [],
      }),
    );
  });
  await page.goto("/");
  await page.locator("#add").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await page.locator("#add").click();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="3"]').click();
  await expect(page.locator("#status")).toContainText("препятствие");
  await expect(page.locator("#remaining")).toHaveText("4");
});
test("win state and quick repeated clicks", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: { board: [5, 5], scroll: 0, additions: 0, moves: 0 },
        history: [],
      }),
    );
  });
  await page.goto("/");
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').dblclick();
  await expect(page.locator("#win")).toBeVisible();
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("2");
  await expect(page.locator("#win")).toBeHidden();
});
test("light layout has no horizontal overflow at narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#skip").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/light-mobile.png" });
});
