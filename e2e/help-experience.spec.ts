import { test, expect, type Page } from "@playwright/test";
import { install, key } from "./help-test-utils";
test.use({ video: process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off" });
async function scene(page: Page, profile: string) {
  await install(page, "ready", profile);
  await page.locator("#menu").click();
  await page
    .locator(
      ["trials", "shuffle"].includes(profile) ? "#qa-lab" : "#qa-help-scene",
    )
    .click();
}
async function fit(page: Page, root: string) {
  const result = await page.locator(root).evaluate((root) => {
    const buttons = [
      ...root.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height;
    });
    const errors: string[] = [];
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const word of n.textContent!.matchAll(/\S+/g)) {
          const wholeWord = document.createRange();
          wholeWord.setStart(n, word.index!);
          wholeWord.setEnd(n, word.index! + word[0].length);
          if (wholeWord.getClientRects().length > 1)
            errors.push(`word broken in ${b.id}: ${word[0]}`);
        }
        for (const t of range.getClientRects())
          if (
            t.width &&
            (t.x < r.x - 1 ||
              t.right > r.right + 1 ||
              t.y < r.y - 1 ||
              t.bottom > r.bottom + 1)
          )
            errors.push(
              `text outside ${b.id || b.getAttribute("data-lab-index") || b.getAttribute("data-shuffle-index")}: ${n.textContent}`,
            );
      }
    }
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i].getBoundingClientRect(),
          b = buttons[j].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
        )
          errors.push(`overlap ${buttons[i].id} / ${buttons[j].id}`);
      }
    return errors;
  });
  expect(result).toEqual([]);
}
async function zoom(page: Page, large: boolean) {
  if (large)
    await page.addStyleTag({
      content: large
        ? "footer .action{font-size:22px!important}#hint-offer p,#hint-offer button,.help-lab button,.help-lab p{font-size:22px!important}"
        : "",
    });
  await page.waitForTimeout(80);
}
for (const profile of ["a3", "magnet", "plan"])
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ])
    test(`help labels, prices and initial controls fit ${profile} ${width}×${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await scene(page, profile);
      for (const large of [false, true]) {
        await zoom(page, large);
        await fit(page, "footer");
        await page.locator(profile === "a3" ? "#hint" : "#" + profile).click();
        await expect(page.locator("#hint-offer")).toBeVisible();
        await fit(page, "#hint-offer");
        if (profile === "magnet") {
          const copy = (await page
            .locator("#hint-offer .hint-copy")
            .boundingBox())!;
          for (const grid of await page
            .locator("#help-preview .help-grid")
            .all()) {
            const rect = (await grid.boundingBox())!;
            expect(rect.y).toBeGreaterThanOrEqual(copy.y - 1);
            expect(rect.y + rect.height).toBeLessThanOrEqual(
              copy.y + copy.height + 1,
            );
          }
        }
        const text = await page.locator("#hint-offer").innerText();
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(48);
        await expect(page.locator("#help-details")).not.toHaveAttribute(
          "open",
          "",
        );
        for (const id of ["watch-hints", "cancel-hints"]) {
          const r = (await page.locator("#" + id).boundingBox())!;
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
        }
        if (profile === "a3")
          await expect(page.locator("#help-pack")).toContainText("+2 в запас");
        else
          await expect(page.locator("#help-undo")).toContainText("бесплатно");
        await page.locator("#cancel-hints").click();
      }
    });
for (const profile of ["trials", "shuffle"])
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ])
    test(`lab text and digit hit areas do not overlap ${profile} ${width}×${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await scene(page, profile);
      await zoom(page, true);
      await fit(page, "#help-lab");
      if (profile === "shuffle") {
        await page.locator("#shuffle-preview").click();
        await fit(page, "#help-lab");
        await page.locator("#shuffle-confirm").scrollIntoViewIfNeeded();
        await page.locator("#shuffle-confirm").click();
        await fit(page, "#help-lab");
      } else {
        await expect(page.locator("#lab-add")).toBeEnabled();
        await page.locator("#lab-add").click();
        await expect(page.locator("#lab-budget")).toHaveText("Добавлений: 1");
        await fit(page, "#help-lab");
        await page.locator("#lab-undo").click();
        await expect(page.locator("#lab-budget")).toHaveText("Добавлений: 2");
      }
    });
test("Magnet feedback is after save, bounded and cancellable by immediate Undo", async ({
  page,
}) => {
  await scene(page, "magnet");
  await page.locator("#magnet").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await expect(page.locator(".assist-ghost")).toHaveCount(2);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("6");
  await expect(page.locator(".assist-ghost")).toHaveCount(0);
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(p.meta.help.demo.magnet).toBe(true);
  expect(p.meta.attempts.classic.help.assisted).toBe(true);
});
test("A failed durable Magnet write has no success motion or demo debit", async ({
  page,
}) => {
  await scene(page, "magnet");
  await page.locator("#magnet").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (
        k === "seeds-bits.progress.v2" &&
        JSON.parse(v).sessions.classic.current.assists
      )
        throw Error("disk");
      return original.call(this, k, v);
    };
  });
  await page.locator("#watch-hints").click();
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator(".assist-ghost")).toHaveCount(0);
  await expect(page.locator("#remaining")).toHaveText("6");
});
test("Plan teaches one real player step at a time and Undo restores progress, not charges", async ({
  page,
}) => {
  await scene(page, "plan");
  await page.locator("#plan").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#plan-rail .done")).toHaveCount(1);
  await expect(page.locator("#plan-rail .current")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#plan-rail .current")).toHaveText("1");
});
test("Reduced motion leaves Magnet instant and all controls live", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await scene(page, "magnet");
  await page.locator("#magnet").click();
  await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  await expect(page.locator(".assist-ghost")).toHaveCount(0);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("6");
});
test("Shuffle motion never moves digit hit regions and accepts the next pair while settling", async ({
  page,
}) => {
  await scene(page, "shuffle");
  await page.locator("#shuffle-preview").click();
  await page.locator("#shuffle-confirm").click();
  await expect(page.locator("#shuffle-board .lab-guided")).toHaveCount(2);
  const cells = page.locator("#shuffle-board .lab-guided");
  const boxes = await cells.evaluateAll((ns) =>
    ns.map((n) => ({
      rect: n.getBoundingClientRect().toJSON(),
      transform: getComputedStyle(n).transform,
    })),
  );
  expect(boxes.every((x) => x.transform === "none")).toBe(true);
  for (const { rect } of boxes)
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page.locator("#shuffle-count")).toHaveText("Цифр: 4");
  await page.locator("#lab-undo").click();
  await expect(page.locator("#shuffle-count")).toHaveText("Цифр: 6");
});
test("Sound off also silences new lab feedback", async ({ page }) => {
  await install(page, "ready", "shuffle");
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("seeds-bits.settings.v1")!);
    p.sound = false;
    p.vibration = false;
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify(p));
  });
  await page.reload();
  await page.evaluate(() => {
    const Original = window.AudioContext;
    (window as any).audioCreations = 0;
    window.AudioContext = class extends Original {
      constructor(...args: any[]) {
        super(...args);
        (window as any).audioCreations++;
      }
    };
  });
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  await page.locator("#qa-lab").click();
  await page.locator("#shuffle-preview").click();
  await page.locator("#shuffle-confirm").click();
  await expect(page.locator("#shuffle-count")).toHaveText("Цифр: 6");
  await page.locator("#lab-undo").click();
  await expect(page.locator("#shuffle-count")).toHaveText("Цифр: 6");
  expect(await page.evaluate(() => (window as any).audioCreations)).toBe(0);
});
test("Plan tone rises only as the real player advances the paid path", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as any).tones = [];
    window.AudioContext = class extends Original {
      createOscillator() {
        const osc = super.createOscillator(),
          original = osc.frequency.setValueAtTime.bind(osc.frequency);
        osc.frequency.setValueAtTime = (v, t) => {
          (window as any).tones.push(v);
          return original(v, t);
        };
        return osc;
      }
    };
  });
  await install(page, "ready", "plan");
  await page.evaluate(() => {
    const k = "seeds-bits.settings.v1",
      s = JSON.parse(localStorage.getItem(k)!);
    s.sound = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload();
  await page.locator("#resume").click();
  await page.locator("#menu").click();
  await page.locator("#qa-help-scene").click();
  await page.locator("#plan").click();
  expect(await page.evaluate(() => (window as any).tones.includes(440))).toBe(
    false,
  );
  await page.locator("#watch-hints").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).tones.includes(440)))
    .toBe(true);
  for (const pair of [
    [0, 1],
    [0, 1],
  ]) {
    for (const n of pair) await page.locator(`[data-index="${n}"]`).click();
    await expect(page.locator("#undo")).toBeEnabled();
  }
  await expect(page.locator("#plan-count")).toHaveText("3/3");
  const target = [440, 440 * 2 ** (2 / 12), 440 * 2 ** (4 / 12)];
  await expect
    .poll(() =>
      page.evaluate(
        (target) =>
          target.every((v) =>
            (window as any).tones.some((n: number) => Math.abs(n - v) < 0.001),
          ),
        target,
      ),
    )
    .toBe(true);
});

test("Repeated offer acceptance during slow readiness starts one video and resumes once", async ({
  page,
}) => {
  await scene(page, "a3");
  await page.locator("#hint").click();
  await page.evaluate(() => {
    const w = window as any,
      original = w.__SEEDS_ADS_TEST__.readiness;
    w.__SEEDS_ADS_TEST__.readiness = async () => {
      await new Promise((r) => setTimeout(r, 180));
      return original();
    };
    const b = document.getElementById("watch-hints") as HTMLButtonElement;
    b.click();
    b.click();
    b.click();
  });
  await expect(page.locator("#qa-ad")).toBeVisible();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).requests.length)).toBe(1);
  await page.locator("#qa-ad").click();
  await expect(page.locator(".hinted")).toHaveCount(2);
  await expect
    .poll(() => page.locator("#app").evaluate((e) => (e as HTMLElement).inert))
    .toBe(false);
  expect(await page.evaluate(() => (window as any).requests.length)).toBe(1);
});
