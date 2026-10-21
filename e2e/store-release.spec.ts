import { test, expect } from "@playwright/test";
test("privacy is readable offline and returns to settings without overlapping screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    ),
  );
  await page.goto("/");
  await page.locator("#settings-open").click();
  await page.locator("#privacy-open").click();
  await expect(page.locator("#collection")).toContainText("AppMetrica");
  await expect(page.locator("#collection")).toContainText(
    "хранятся на устройстве",
  );
  await expect(page.locator("#settings-panel")).toBeHidden();
  expect(
    await page
      .locator("#collection h2")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await expect(page.locator("#collection a").first()).toHaveAttribute(
    "href",
    "https://github.com/DanilaH/seeds-bits/blob/main/store/PRIVACY.md",
  );
  await page.locator("#privacy-back").click();
  await expect(page.locator("#settings-panel")).toBeVisible();
  await expect(page.locator("#collection")).toBeHidden();
  await page.locator("#settings-back").click();
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
});
