import { expect, type Page } from "@playwright/test";

export async function openBookPicker(page: Page) {
  const picker = page.locator('#dialog[data-screen="book-picker"][open]');
  if (!(await picker.isVisible())) await page.locator("#all-books").click();
  await expect(picker).toBeVisible();
}

export async function chooseBookVolume(page: Page, volume: number) {
  await openBookPicker(page);
  if (volume >= 100) await page.locator("#book-section-themes").click();
  else {
    await page.locator("#book-section-main").click();
    await page.locator(`[data-book-range="${Math.floor(volume / 20)}"]`).click();
  }
  await page.locator(`[data-volume="${volume}"]`).click();
}

export async function exposeBookFilter(page: Page) {
  await openBookPicker(page);
  const filter = page.locator("#book-filter");
  if (!(await filter.isVisible())) await page.locator("#toggle-book-filter").click();
  return filter;
}
