import { test, expect, type Page } from "@playwright/test";

async function install(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "seeds-bits.settings.v1",
      JSON.stringify({ tutorialDone: true }),
    );
    const w = window as any;
    w.__SEEDS_ADS_TEST__ = {
      initialize: async () => ({ enabled: true, test: true }),
      addListener: async () => ({ remove: async () => {} }),
      preload: async () => {},
      banner: async () => {},
      pending: async () => ({}),
      report: async () => {},
      acknowledge: async () => {},
      show: async () => ({ status: "unavailable" }),
    };
  });
  await page.goto("/");
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
}

// Explicit font stress, including labels with fixed px sizes. Reapply after a
// route change without multiplying fonts on nodes retained from the last route.
async function textScale(page: Page, scale: number) {
  await page.evaluate((scale) => {
    const w = window as any;
    const saved: WeakMap<HTMLElement, string> = (w.visualFonts ??=
      new WeakMap());
    const nodes = [...document.querySelectorAll<HTMLElement>("body *")];
    for (const e of nodes) if (saved.has(e)) e.style.fontSize = saved.get(e)!;
    const sizes = nodes.map((e) => parseFloat(getComputedStyle(e).fontSize));
    nodes.forEach((e, i) => {
      if (!saved.has(e)) saved.set(e, e.style.fontSize);
      e.style.fontSize = sizes[i] * scale + "px";
    });
  }, scale);
}

for (const [width, height, scale] of [
  [320, 568, 1],
  [568, 320, 1],
  [360, 640, 2],
]) {
  test(`headers and calendar stay inside their rail at ${width}x${height}, text ${scale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await install(page);
    for (const route of [
      "book-mode",
      "calendar-open",
      "progress-open",
      "settings-open",
    ]) {
      await page.locator("#" + route).click();
      await textScale(page, scale);
      const heading = page.locator(".dialog-head .screen-heading");
      const back = heading.getByRole("button", { name: "Назад", exact: true });
      const close = page.locator("#close");
      const a = (await back.boundingBox())!,
        b = (await close.boundingBox())!;
      expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(2);
      expect(b.x + b.width).toBeLessThanOrEqual(width - 8);
      expect(
        await heading
          .locator("h2")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      if (route === "calendar-open") {
        const today = (await page.locator("#today-task").boundingBox())!;
        expect(Math.abs(today.x - a.x)).toBeLessThan(1);
        expect(
          await page.locator(".calendar").evaluate((e) => {
            const rail = e.closest(".dialog-scroll")!.getBoundingClientRect();
            return [...e.children].every((c) => {
              const r = c.getBoundingClientRect();
              return (
                r.left >= rail.left - 1 &&
                r.right <= rail.right + 1 &&
                (!(c instanceof HTMLButtonElement) ||
                  (r.width >= 44 && r.height >= 44))
              );
            });
          }),
        ).toBe(true);
      }
      await page
        .locator(".dialog-scroll:not([hidden])")
        .evaluate((e) => (e.scrollTop = e.scrollHeight));
      await expect(back).toBeInViewport();
      await expect(close).toBeInViewport();
      expect(
        await page
          .locator(".dialog-scroll:not([hidden])")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      if (route === "progress-open") {
        await page.locator("#progress-trophies").click();
        await page.locator("#trophies-mode").click();
        await textScale(page, scale);
        expect(
          await page
            .locator(".dialog-scroll:not([hidden])")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        ).toBe(true);
        await page.locator("#collection-back").click();
      }
      await back.click();
    }
  });
}

test("enlarged digits stay inside their own grid row", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await install(page);
  await page.locator("#resume").click();
  await textScale(page, 1.5);
  expect(
    await page.locator("button.cell").evaluateAll((cells) =>
      cells.every((cell) => {
        const box = cell.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(cell.querySelector(".digit")!);
        const text = r.getBoundingClientRect();
        return text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
      }),
    ),
  ).toBe(true);
});

test("glyph-only text zoom fits the board and survives a removed first pair", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await install(page);
  await page.locator("#resume").click();
  await page.addStyleTag({ content: ".cell .digit { font-size: 36px }" });
  const fits = () =>
    page.locator("button.cell").evaluateAll((cells) =>
      cells.every((cell) => {
        const box = cell.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(cell.querySelector(".digit")!);
        const text = range.getBoundingClientRect();
        return text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
      }),
    );
  await expect.poll(fits).toBe(true);
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="9"]').click();
  await expect(page.locator("#remaining")).toHaveText("26");
  await expect.poll(fits).toBe(true);
  await page.setViewportSize({ width: 568, height: 320 });
  await expect.poll(fits).toBe(true);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("28");
  await expect.poll(fits).toBe(true);
});

test("oversized status text scrolls inside its region and leaves the board and actions usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await install(page);
  await page.locator("#resume").click();
  await page.locator("#status").evaluate((e) => {
    e.style.fontSize = "36px";
    e.textContent =
      "Не удалось сохранить партию. Повторите сохранение, чтобы не потерять найденные пары и полученные награды.";
  });
  const region = page.locator("#status");
  await expect
    .poll(() => region.evaluate((e) => e.scrollHeight > e.clientHeight))
    .toBe(true);
  expect(
    await region.evaluate((e) => {
      const box = e.getBoundingClientRect(),
        text = e;
      return [box.top - 2, box.bottom + 2].every(
        (y) =>
          !text.contains(document.elementFromPoint(box.x + box.width / 2, y)),
      );
    }),
  ).toBe(true);
  await region.evaluate((e) => (e.scrollTop = e.scrollHeight));
  expect(
    await region.evaluate((e) => {
      const text = e.firstChild!;
      const range = document.createRange();
      range.setStart(text, text.textContent!.length - 3);
      range.setEnd(text, text.textContent!.length);
      return (
        range.getBoundingClientRect().bottom <=
        e.getBoundingClientRect().bottom + 1
      );
    }),
  ).toBe(true);
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await textScale(page, 2);
  await expect(page.locator(".game")).toHaveClass(/stacked-actions/);
  const actions = page.locator(".game-actions");
  await expect
    .poll(() => actions.evaluate((e) => e.scrollHeight > e.clientHeight))
    .toBe(true);
  await page.locator("#hint").scrollIntoViewIfNeeded();
  await expect(page.locator("#hint")).toBeInViewport();
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
});

test("short landscape menu grows with its enlarged labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await install(page);
  await textScale(page, 1.5);
  for (const id of ["book-mode", "daily-mode"]) {
    const button = page.locator("#" + id);
    await button.scrollIntoViewIfNeeded();
    expect(
      await button.evaluate((e) => {
        const b = e.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(e.firstElementChild!);
        return [...range.getClientRects()].every(
          (t) => t.top >= b.top - 1 && t.bottom <= b.bottom + 1,
        );
      }),
    ).toBe(true);
  }
  await page.locator("#settings-open").click();
  await expect(page.locator("#settings-panel")).toBeVisible();
});

test("large-text hint offer keeps both whole buttons reachable by scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await install(page);
  await page.locator("#resume").click();
  for (let i = 0; i < 3; i++) {
    await page.locator("#hint").click();
    const pair = await page
      .locator(".hinted")
      .evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.index));
    expect(pair).toHaveLength(2);
    for (const index of pair)
      await page.locator(`[data-index="${index}"]`).click();
  }
  await page.locator("#hint").click();
  await textScale(page, 1.5);
  for (const id of ["watch-hints", "cancel-hints"]) {
    const button = page.locator("#" + id);
    await button.scrollIntoViewIfNeeded();
    // Scroll offsets are rounded to device pixels; test whole bounds with a
    // one CSS-pixel tolerance, then test the actual rendered text separately.
    const box = (await button.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(569);
    expect(
      await button.evaluate((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        const b = e.getBoundingClientRect();
        return [...r.getClientRects()].every(
          (t) => t.top >= b.top - 1 && t.bottom <= b.bottom + 1,
        );
      }),
    ).toBe(true);
  }
  await page.locator("#cancel-hints").click();
  await expect(page.locator("#hint-offer")).not.toBeVisible();
});
