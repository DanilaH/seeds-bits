import { test, expect } from "@playwright/test";
test("home hides board, layouts fit and modes survive settings and restart", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#resume")).toBeVisible();
  await expect(page.locator("#board")).toBeHidden();
  await page.screenshot({
    path: "test-results/home-light.png",
    animations: "disabled",
  });
  await page.locator("#book-mode").click();
  await page.screenshot({
    path: "test-results/book-light.png",
    animations: "disabled",
  });
  await page.locator('[data-game="book-v1-1"]').click();
  await expect(page.locator("#add")).toBeHidden();
  await expect(page.locator("#page-progress")).toHaveAttribute(
    "aria-label",
    "Тетрадь 1 · стр. 1, задача 1 из 6",
  );
  await page.screenshot({
    path: "test-results/task-light.png",
    animations: "disabled",
  });
  await page.locator("#menu").click();
  for (const width of [320, 360, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 740 });
    for (const id of ["book-mode", "calendar-open", "trophies-mode"]) {
      await page.locator("#" + id).click();
      expect(
        await page
          .locator("#dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      await page.locator("#collection-back").click();
    }
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({
    path: "test-results/home-desktop.png",
    animations: "disabled",
  });
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await page.locator("#settings-back").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/home-dark.png",
    animations: "disabled",
  });
  await page.locator("#resume").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь · задача 1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#new").click();
  await expect(page.locator("#remaining")).toHaveText("8");
});
