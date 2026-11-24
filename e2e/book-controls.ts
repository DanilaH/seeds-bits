import type { Page } from "@playwright/test";

export async function openBookPicker(page: Page) {
  const picker = page.locator("#other-books");
  if (await picker.getAttribute("open") === null) {
    await picker.locator(":scope > summary").click();
  }
}
