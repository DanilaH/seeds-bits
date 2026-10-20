import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) =>
  page.addInitScript(() => {
    if (!localStorage.getItem("seeds-bits.settings.v1"))
      localStorage.setItem(
        "seeds-bits.settings.v1",
        JSON.stringify({ tutorialDone: true }),
      );
  }),
);
test("corrupt save notice remains visible until dismissed and original bytes are backed up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("corrupt")) {
      sessionStorage.setItem("corrupt", "1");
      localStorage.setItem("seeds-bits.progress.v2", "{broken");
    }
  });
  await page.goto("/");
  await expect(page.locator("#dialog #read-notice")).toBeVisible();
  await expect(page.locator("#read-notice")).toContainText(
    "не удалось прочитать",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("seeds-bits.progress.v2.recovery"),
    ),
  ).toBe("{broken");
  await page.locator("#resume").click();
  await page.locator('[data-index="0"]').click();
  await expect(page.locator("#read-notice")).toBeVisible();
  await page.locator("#menu").click();
  await expect(page.locator("#dialog #read-notice")).toBeVisible();
  await page.locator("#read-notice button").click();
  await expect(page.locator("#read-notice")).toBeHidden();
});
test("different settings fields merge across tabs and update both interfaces", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.locator("#resume").click();
  await page.locator("#hint").click();
  await page.waitForTimeout(250);
  const other = await context.newPage();
  await other.goto("/");
  await other.locator("#settings-open").click();
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await page.locator("#dark").check();
  await other.locator("#sound").check();
  await expect(page.locator("#sound")).toBeChecked();
  await expect(other.locator("#dark")).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("seeds-bits.settings.v1")!),
      ),
    )
    .toMatchObject({ theme: "dark", sound: true });
  await other.reload();
  await other.locator("#settings-open").click();
  await expect(other.locator("#dark")).toBeChecked();
  await expect(other.locator("#sound")).toBeChecked();
});
for (const date of ["2028-03-19", "2028-08-16"])
  test(`hard daily ${date} has responsive verified hints through completion`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(date + "T12:00:00+05:00"));
    await page.goto("/");
    await page.locator("#daily-mode").click();
    await page.locator("#today-task").click();
    for (let n = 0; n < 20 && (await page.locator("#win").isHidden()); n++) {
      const blocked = await page.evaluate(async () => {
        const t = performance.now();
        const timer = new Promise<number>((r) =>
          setTimeout(() => r(performance.now() - t), 0),
        );
        (document.querySelector("#hint") as HTMLElement).click();
        return timer;
      });
      expect(blocked).toBeLessThan(300);
      await expect(page.locator(".hinted")).toHaveCount(2);
      await page.locator(".hinted").first().click();
      await page.locator(".hinted").last().click();
      await expect(page.locator("#skip")).toBeEnabled();
    }
    await expect(page.locator("#win")).toBeVisible();
  });
test("late worker result cannot affect another task", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(data: any) {
        setTimeout(() => super.postMessage(data), 600);
      }
    };
  });
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator('[data-game="book-v1-1"]').click();
  await page.locator("#hint").click();
  await page.locator("#book-top").click();
  await page.locator('[data-game="book-v1-2"]').click();
  await page.waitForTimeout(900);
  await expect(page.locator(".hinted")).toHaveCount(0);
  await expect(page.locator("#hint")).toBeEnabled();
});
test("unavailable worker provides usable fallback without nonexistent undo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw Error("unavailable");
      }
    } as any;
  });
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator('[data-game="book-v1-1"]').click();
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText("Попробуйте ещё раз");
  await expect(page.locator("#status")).not.toContainText("отменить");
  await expect(page.locator("#hint")).toBeEnabled();
});
test("background and resume during pair animation preserve the next playable row", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "seeds-bits.session.v1",
      JSON.stringify({
        rules: 1,
        current: {
          board: [5, 5, 0, 0, 0, 0, 0, 0, 0, 4, 4],
          scroll: 0,
          moves: 0,
          additions: 0,
        },
        history: [],
      }),
    ),
  );
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => {
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      get: () => hidden,
      configurable: true,
    });
    (document.querySelector('[data-index="0"]') as HTMLElement).click();
    (document.querySelector('[data-index="1"]') as HTMLElement).click();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    setTimeout(() => {
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    }, 15);
  });
  await expect(page.locator("#remaining")).toHaveText("2");
  await expect(page.locator("#board button")).toHaveText(["4", "4"]);
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
});
