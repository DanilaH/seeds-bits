import { test, expect, type Page } from "@playwright/test";

async function lastTask(page: Page) {
  await page.addInitScript(() => {
    const id = "book-v1-24";
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({
        tutorialDone: true,
        vibration: true,
        sound: false,
        reminders: false,
      }),
    );
    localStorage.setItem(
      "seeds-bits.progress.v2",
      JSON.stringify({
        version: 3,
        active: id,
        sessions: {
          [id]: {
            rules: 1,
            current: { board: [5, 5], moves: 0, additions: 0, scroll: 0 },
            history: [],
          },
        },
        done: Array.from({ length: 23 }, (_, i) => "book-v1-" + (i + 1)),
        hints: {},
        seen: [],
        meta: {
          version: 2,
          wallet: 0,
          since: "2026-11-01",
          completed: 23,
          unassisted: 23,
          attempts: { [id]: { id: "book-feedback", completed: false } },
        },
      }),
    );
    const w = window as any;
    w.resultPulses = [];
    Object.defineProperty(navigator, "vibrate", {
      value: (p: unknown) => {
        w.resultPulses.push(p);
        return true;
      },
    });
  });
  await page.goto("/");
  await page.locator("#resume").click();
}
test("book celebration waits for a successful save and is not replayed on menu return", async ({
  page,
}) => {
  await lastTask(page);
  await page.evaluate(() => {
    const w = window as any;
    w.resultSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("seeds-bits"))
        throw new DOMException("full", "QuotaExceededError");
      return w.resultSetItem.call(this, k, v);
    };
  });
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toHaveAttribute(
    "data-result-kind",
    "book",
  );
  await expect(page.locator("#save-notice")).toBeVisible();
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () =>
        (window as any).resultPulses.filter(
          (p: unknown) => String(p) === "30,42,38,52,54",
        ).length,
    ),
  ).toBe(0);
  await page.evaluate(
    () => (Storage.prototype.setItem = (window as any).resultSetItem),
  );
  await page.locator("#retry-save").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).resultPulses.filter(
            (p: unknown) => String(p) === "30,42,38,52,54",
          ).length,
      ),
    )
    .toBe(1);
  // A second render/menu return must not celebrate the same saved completion.
  await page.locator("#menu").click();
  await page.locator("#resume").click();
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () =>
        (window as any).resultPulses.filter(
          (p: unknown) => String(p) === "30,42,38,52,54",
        ).length,
    ),
  ).toBe(1);
});
test("next notebook is immediately usable and cancels the local celebration", async ({
  page,
}) => {
  await lastTask(page);
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toHaveAttribute(
    "data-result-kind",
    "book",
  );
  await expect(page.locator("#play-again")).toBeEnabled();
  const hit = await page.locator("#play-again").evaluate((e) => {
    const r = e.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return t === e || e.contains(t);
  });
  expect(hit).toBe(true);
  await page.locator("#play-again").click();
  await expect(page.locator("#win")).toBeHidden();
  await expect(page.locator("#mode")).toContainText("Тетрадь 2");
  expect(await page.locator(".result-seed-burst").count()).toBe(0);
  expect(
    await page
      .locator(".result-cover")
      .evaluateAll((es) => es.flatMap((e) => e.getAnimations()).length),
  ).toBe(0);
});
