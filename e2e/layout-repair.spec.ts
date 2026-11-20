import {test, expect, type Page} from "@playwright/test";
import {key} from "./help-test-utils";

async function textScale(page: Page, scale: number) {
  await page.evaluate(scale => {
    const elements = [...document.querySelectorAll<HTMLElement>("body *")];
    for (const el of elements) if (el.dataset.layoutBase !== undefined)
      el.style.fontSize = el.dataset.layoutBase;
    const sizes = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    elements.forEach((el, i) => {
      el.dataset.layoutBase ??= el.style.fontSize;
      el.style.fontSize = `${sizes[i] * scale}px`;
    });
  }, scale);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function rawClick(page: Page, selector: string) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return {x, y, reachable: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && el.contains(document.elementFromPoint(x, y))};
  });
  if (!point.reachable) await page.screenshot({path:"test-results/layout-unreachable.png"});
  expect(point.reachable, `${selector} ${JSON.stringify(point)}`).toBe(true);
  await page.mouse.click(point.x, point.y);
}
async function digit(page: Page, index: number) {
  const selector = `#board [data-index="${index}"]`;
  // Only scroll the field, never the containing page or lesson instructions.
  await page.locator(selector).evaluate(el => {
    const view = document.getElementById("viewport")!, r = el.getBoundingClientRect(), v = view.getBoundingClientRect();
    if (r.top < v.top) view.scrollBy({top: r.top - v.top, behavior: "instant"});
    else if (r.bottom > v.bottom) view.scrollBy({top: r.bottom - v.bottom, behavior: "instant"});
  });
  await rawClick(page, selector);
}
const top = (page: Page) => page.locator("#viewport").evaluate(el => el.getBoundingClientRect().top);
async function seed(page: Page, board: number[]) {
  await page.addInitScript(({key, board}) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({tutorialDone: true}));
    localStorage.setItem(key, JSON.stringify({version:3, active:"classic", sessions:{classic:{rules:1,current:{board,scroll:0,moves:0,additions:0},history:[]}},hints:{},seen:[],done:[]}));
  }, {key, board});
  await page.goto("/");
  await page.locator("#resume").click();
}

for (const [width, height] of [[320,568], [390,844], [568,320], [844,390]]) {
  for (const scale of [1, 1.5, 2]) {
    test(`LAYOUT-01: both lessons keep their field at ${width}x${height}, text ${scale}`, async ({page}) => {
      await page.setViewportSize({width, height});
      await page.emulateMedia({reducedMotion:"reduce"});
      await page.goto("/");
      await expect(page.locator("#lesson")).toBeVisible();
      await textScale(page, scale);
      expect(await page.locator("#lesson-title").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      for (let step = 0; step < 2; step++) {
        const before = await top(page);
        const heightBefore = await page.locator("#viewport").evaluate(el => el.clientHeight);
        if (step === 0) await page.screenshot({path:`test-results/layout-repair/${width}-${height}-${scale}-lesson-before.png`});
        await digit(page, 0); await digit(page, 1);
        await expect(page.locator("#lesson-next")).toBeVisible();
        expect(Math.abs(await top(page) - before)).toBeLessThanOrEqual(1);
        expect(Math.abs(await page.locator("#viewport").evaluate(el => el.clientHeight) - heightBefore)).toBeLessThanOrEqual(1);
        if (step === 0) await page.screenshot({path:`test-results/layout-repair/${width}-${height}-${scale}-lesson-after.png`});
        if (step === 1) await expect(page.locator("#lesson-quick")).toBeVisible();
        await rawClick(page, "#lesson-next");
        if (step === 0) {
          await expect(page.locator("#lesson-step")).toHaveText("2 / 2");
          expect(Math.abs(await top(page) - before)).toBeLessThanOrEqual(1);
          await page.screenshot({path:`test-results/layout-repair/${width}-${height}-${scale}-lesson-next.png`});
        }
      }
      await page.locator("#menu").click(); await page.locator("#learn").click();
      await textScale(page, scale);
      for (const [step, a, b] of [[1,0,1],[2,0,1],[3,0,3],[4,0,20],[5,8,9]]) {
        await expect(page.locator("#lesson-step")).toHaveText(`${step} / 6`);
        const before = await top(page);
        await digit(page, a); await digit(page, b);
        await expect(page.locator("#lesson-next")).toBeVisible();
        expect(Math.abs(await top(page) - before)).toBeLessThanOrEqual(1);
        await rawClick(page, "#lesson-next");
        expect(Math.abs(await top(page) - before)).toBeLessThanOrEqual(1);
      }
      await expect(page.locator("#lesson-step")).toHaveText("6 / 6");
      await rawClick(page, "#add"); await rawClick(page, "#undo");
      await expect(page.locator("#remaining")).toHaveText("2");
      await rawClick(page, "#lesson-next");
      await expect(page.locator("#lesson")).toBeHidden();
    });
  }
}

for (const [width, height, scale] of [[390,844,1.5],[568,320,2],[320,568,2]]) {
  test(`LAYOUT-02: distant hint owns its space at ${width}x${height}, text ${scale}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:"reduce"});
    const board = Array.from({length:180}, (_, i) => i % 9 === 0 ? 0 : 1);
    board[0] = board[171] = 5;
    await seed(page, board); await textScale(page, scale);
    const before = await page.locator("#viewport").boundingBox();
    await page.screenshot({path:`test-results/layout-repair/${width}-${height}-hint-before.png`});
    await page.locator("#hint").click();
    const jump = page.locator("#hint-jump");
    await expect(jump).toBeVisible();
    const after = await page.locator("#viewport").boundingBox();
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    const intercepted = () => page.evaluate(() => {
      const v = document.getElementById("viewport")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>("#board button")].filter(el => {
        const r = el.getBoundingClientRect(), x = r.x + r.width/2, y = r.y + r.height/2;
        return y >= v.top && y < v.bottom && !el.contains(document.elementFromPoint(x,y));
      }).map(el => el.dataset.index);
    });
    expect(await intercepted()).toEqual([]);
    await page.screenshot({path:`test-results/layout-repair/${width}-${height}-hint-shown.png`});
    await rawClick(page,"#hint-jump");
    await expect(jump).toBeHidden();
    await page.screenshot({path:`test-results/layout-repair/${width}-${height}-hint-arrived.png`});
    expect(await intercepted()).toEqual([]);
    await digit(page, 171);
    await expect(jump).toHaveText("↑ Вторая цифра выше");
    await rawClick(page,"#hint-jump");
    await expect(jump).toBeHidden();
    await page.locator("#viewport").evaluate(el => el.scrollTo({top:el.scrollHeight,behavior:"instant"}));
    await expect(jump).toBeVisible();
    await rawClick(page,"#hint-jump");
    await expect(jump).toBeHidden();
    await page.locator("#menu").click(); await page.locator("#book-mode").click();
    await expect(jump).toBeHidden();
  });
}

test("LAYOUT-03: failed save owns one bounded notice and retry preserves the move", async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.emulateMedia({reducedMotion:"reduce"});
  const board = Array(90).fill(1); board[0] = board[1] = 5;
  await seed(page, board); await textScale(page, 2);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    (window as any).restoreSave = () => Storage.prototype.setItem = set;
    Storage.prototype.setItem = function(k,v) {
      if (k === "seeds-bits.progress.v2") throw new DOMException("full","QuotaExceededError");
      return set.call(this,k,v);
    };
  });
  await digit(page,0); await digit(page,1);
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator("#status")).toBeHidden();
  expect(await page.locator("#save-warning").evaluate(el => el.clientHeight >= parseFloat(getComputedStyle(el).fontSize))).toBe(true);
  const height = await page.locator("#viewport").evaluate(el => el.clientHeight);
  const row = await page.locator("#board .cell").first().evaluate(el => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(row);
  // End the injected fault at the user's retry, not while queued saves settle.
  await page.locator("#retry-save").evaluate(el => el.addEventListener("click", () => (window as any).restoreSave(), {once:true,capture:true}));
  await rawClick(page, "#retry-save");
  await expect(page.locator("#save-notice")).toBeHidden();
  await expect(page.locator("#remaining")).toHaveText("88");
  await page.reload(); await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText("88");
});

test("LAYOUT-04: privacy links and jar captions wrap at 200%", async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await seed(page,[5,5]);
  await page.locator("#menu").click(); await page.locator("#settings-open").click();
  await textScale(page,2);
  expect(await page.locator("#privacy-open").evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.locator("#privacy-open").click();
  await textScale(page,2);
  const link = page.getByRole("link",{name:"Политика конфиденциальности",exact:true});
  await link.scrollIntoViewIfNeeded();
  expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await link.focus(); await expect(link).toBeFocused();
  await page.locator("#privacy-back").click(); await page.locator("#settings-back").click(); await page.locator("#progress-open").click();
  for (const [width,height] of [[320,568],[768,1024],[844,390]]) {
    await page.setViewportSize({width,height}); await textScale(page,2);
    const overflow = await page.locator(".progress-hero").evaluate(el => [...el.querySelectorAll<HTMLElement>(".hero-kicker,.hero-value,.hero-count,.fine")].filter(child => child.scrollWidth > child.clientWidth+1).map(child => ({text:child.textContent,width:child.clientWidth,scroll:child.scrollWidth})));
    expect(overflow, `${width}x${height}`).toEqual([]);
  }
});
