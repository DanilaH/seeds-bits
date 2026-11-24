import {expect, test, type Page} from "@playwright/test";
import {occupied, removePair} from "../src/core";
import {key} from "./help-test-utils";

const boardOf = (entries: Record<number, number>) =>
  Array.from({length: Math.max(...Object.keys(entries).map(Number)) + 1}, (_, i) => entries[i] ?? 0);
const digit = (page: Page, i: number) => page.locator(`#board button[data-index="${i}"]`);
const viewportTop = (page: Page) => page.locator("#viewport").evaluate(el => el.getBoundingClientRect().top);
async function open(page: Page, board: number[], active = "classic", done: string[] = []) {
  await page.addInitScript(({key, board, active, done}) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({tutorialDone:true}));
    localStorage.setItem(key, JSON.stringify({
      version:3, active, done, seen:[], hints:{},
      sessions:{[active]:{rules:1, current:{board,moves:0,additions:0,scroll:0}, history:[]}},
    }));
  }, {key, board, active, done});
  await page.goto("/");
  await page.locator("#resume").click();
}
const savedBoard = (page: Page) => page.evaluate(key => {
  const state = JSON.parse(localStorage.getItem(key)!);
  return state.sessions[state.active].current.board as number[];
}, key);

for (const [name, entries, endpoints, blockers] of [
  ["horizontal", {0:3, 2:8, 4:2, 5:3}, [0,5], [2,4]],
  ["vertical", {2:3, 11:8, 20:2, 29:3}, [2,29], [11,20]],
  ["diagonal down-right", {0:3, 10:8, 20:2, 30:3}, [0,30], [10,20]],
  ["diagonal down-left", {7:3, 15:8, 23:2, 31:3}, [7,31], [15,23]],
  ["one blocker across edge", {8:6, 9:8, 10:4}, [8,10], [9]],
  ["two blockers across edge", {7:6, 8:2, 9:8, 10:4}, [7,10], [8,9]],
  ["vertical ignores off-path blockers", {0:3, 1:4, 9:8, 18:3}, [0,18], [9]],
] as const) {
  for (const reverse of [false,true]) {
    test(`outlines only the attempted ${name} path, reverse=${reverse}`, async ({page}) => {
      const [a,b] = reverse ? [...endpoints].reverse() : endpoints;
      const board = boardOf(entries);
      const mode = name.startsWith("one blocker") ? "book-v1-4" : name.startsWith("two blockers") ? "daily-v1-2026-11-19" : "classic";
      await page.clock.install();
      await open(page, board, mode);
      await digit(page,a).click();
      const top = await viewportTop(page);
      await digit(page,b).click();
      const outlined = page.locator("#board .pair-blocker");
      expect(await outlined.evaluateAll(nodes=>nodes.map(e=>Number((e as HTMLElement).dataset.index)))).toEqual(blockers);
      const wave = page.locator('.pair-wave[data-kind="blocked"]');
      await expect(wave.locator(".pair-wave-cell").first()).toHaveAttribute("data-wave-index", String(a));
      await expect(wave.locator(".pair-wave-impact")).toHaveAttribute("data-wave-index", String(reverse ? blockers.at(-1) : blockers[0]));
      await expect(wave.locator(".pair-wave-cell").last()).toHaveClass(/pair-wave-impact/);
      await expect(digit(page,b)).toHaveClass(/selected/);
      expect(await viewportTop(page)).toBeCloseTo(top, 0);
      expect(await savedBoard(page)).toEqual(board);
      if (reverse) await digit(page,b).click();
      else await page.clock.fastForward(900);
      await expect(outlined).toHaveCount(0);
      await expect(wave).toHaveCount(0);
    });
  }
}

for (const [name, entries, endpoints] of [
  ["horizontal", {0:3, 3:3}, [0,3]],
  ["vertical", {2:3, 9:1, 18:4, 29:3}, [2,29]],
  ["diagonal down-right", {0:3, 9:1, 18:4, 30:3}, [0,30]],
  ["diagonal down-left", {7:3, 9:1, 18:4, 31:3}, [7,31]],
  ["vertical wins despite digits outside the line", {0:3, 1:8, 10:1, 18:3}, [0,18]],
] as const) {
  for (const reverse of [false,true]) {
    test(`keeps the ${name} trail in old coordinates, reverse=${reverse}`, async ({page}) => {
      await page.emulateMedia({reducedMotion:"reduce"});
      await page.clock.install();
      const board = boardOf(entries);
      const [a,b] = reverse ? [...endpoints].reverse() : endpoints;
      await open(page, board);
      await digit(page,a).click();
      const centers = await Promise.all([a,b].map(i=>digit(page,i).evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return [rect.x+rect.width/2, rect.y+rect.height/2];
      })));
      await digit(page,b).click();
      const line = page.locator("#pair-trace .gap-trail");
      await expect(line).toHaveCount(1);
      const [start,end] = await line.evaluate(el=>{
        const path=el as SVGPathElement;
        const bounds=path.ownerSVGElement!.getBoundingClientRect();
        return [0,path.getTotalLength()].map(distance=>{
          const point=path.getPointAtLength(distance);
          return [bounds.x+point.x,bounds.y+point.y];
        });
      });
      expect(start[0]).toBeCloseTo(centers[0][0],1);
      expect(start[1]).toBeCloseTo(centers[0][1],1);
      expect(end[0]).toBeCloseTo(centers[1][0],1);
      expect(end[1]).toBeCloseTo(centers[1][1],1);
      const after = removePair(board,a,b);
      await page.clock.runFor(occupied(after) ? 115 : 250);
      await expect(page.locator("#remaining")).toHaveText(String(occupied(after)));
      if (occupied(after)) {
        await expect(line).toHaveCount(1);
        await expect(page.locator("#undo")).toBeEnabled();
        await page.locator("#undo").click();
        await expect(line).toHaveCount(0);
        await expect.poll(()=>savedBoard(page)).toEqual(board);
      } else {
        await expect(page.locator("#win")).toBeVisible();
        await expect(line).toHaveCount(0);
      }
    });
  }
}

for (const reverse of [false,true]) {
  test(`the wave follows tap order across the row edge, reverse=${reverse}`, async ({page})=>{
    await page.clock.install();
    const board = boardOf({7:6, 10:4});
    await open(page, board);
    await page.locator("#hint").click();
    await expect(page.locator("#status")).toHaveText("6 + 4 = 10 · через край строки");
    await expect(page.locator("#paths .edge-exit, #paths .edge-entry")).toHaveCount(2);
    const [a,b] = reverse ? [10,7] : [7,10];
    await digit(page,a).click();
    await digit(page,b).click();
    const wave = page.locator('.pair-wave[data-kind="match"]');
    const cells = await wave.locator(".pair-wave-cell").evaluateAll(nodes=>nodes.map(el=>({
      index: Number((el as HTMLElement).dataset.waveIndex),
      delay: parseFloat(getComputedStyle(el).animationDelay),
    })));
    expect(cells.map(c=>c.index)).toEqual(reverse ? [10,9,8,7] : [7,8,9,10]);
    expect(cells.map(c=>c.delay)).toEqual([0,.028,.056,.084]);
    await page.clock.runFor(270);
    await expect(page.locator("#win")).toBeVisible();
    await expect(wave).toHaveCount(0);
  });
}

test("a green diagonal runs from the first tap and releases the board before it fades", async ({page})=>{
  await page.clock.install();
  await open(page,boardOf({0:3,12:5,13:5,30:3}));
  await digit(page,30).click();
  await digit(page,0).click();
  const wave = page.locator('.pair-wave[data-kind="match"]');
  expect(await wave.locator(".pair-wave-cell").evaluateAll(nodes=>nodes.map(e=>Number((e as HTMLElement).dataset.waveIndex)))).toEqual([30,20,10,0]);
  await page.clock.runFor(115);
  await expect(page.locator("#remaining")).toHaveText("2");
  await expect(wave).toHaveCount(1);
  await expect(page.locator('[data-index="0"]')).toHaveCount(1);
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  await expect(wave).toHaveCount(0);
  await expect(page.locator("#remaining")).toHaveText("4");
});

test("wrong values preserve the new selection and adjacent removal has no trail",async({page})=>{
  await open(page,[2,3,7]);
  await digit(page,0).click();
  await digit(page,1).click();
  await expect(page.locator(".pair-blocker")).toHaveCount(0);
  await expect(digit(page,1)).toHaveClass(/selected/);
  await digit(page,2).click();
  await expect(page.locator("#remaining")).toHaveText("1");
  await expect(page.locator("#pair-trace")).toHaveCount(0);
  await expect(page.locator("#status")).toHaveText("В конец поля скопируется 1 цифра.");
});

test("dead end explains the copy after a successful gap pair",async({page})=>{
  await open(page,[3,0,3,8,5]);
  await digit(page,0).click();
  await digit(page,2).click();
  await expect(page.locator("#status")).toHaveText("В конец поля скопируются 2 цифры.");
  await page.locator("#add").click();
  await expect.poll(()=>savedBoard(page)).toEqual([0,0,0,8,5,8,5]);
  await expect(page.locator("#status")).toHaveText("Добавлено 2 цифры. Пар пока нет. Можно добавить ещё 4 цифры.");
  await page.locator("#undo").click();
  await expect.poll(()=>savedBoard(page)).toEqual([0,0,0,8,5]);
});

test("a collapse keeps the first surviving row in place on a scrolled board", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const board = Array.from({ length: 144 }, (_, i) => (i % 4) + 1);
  board.splice(36, 9, 5, 5, 0, 0, 0, 0, 0, 0, 0);
  await open(page, board);
  const viewport = page.locator("#viewport");
  const anchor = await digit(page, 45).elementHandle();
  const measure = (index: number) => digit(page, index).evaluate(el =>
    el.getBoundingClientRect().top - document.querySelector("#viewport")!.getBoundingClientRect().top);
  const previousScroll = await viewport.evaluate(el => {
    const height = el.querySelector(".cell")!.getBoundingClientRect().height;
    el.scrollTop = height * 4 + 5;
    return el.scrollTop;
  });
  const before = await measure(45);
  for (const index of [36, 37]) {
    const box = (await digit(page, index).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect.poll(() => savedBoard(page)).toEqual(removePair(board, 36, 37));
  await expect(page.locator("#remaining")).toHaveText(String(occupied(board) - 2));
  expect(await anchor.getAttribute("data-index")).toBe("36");
  await expect.poll(async () => Math.abs(await measure(36) - before)).toBeLessThan(1);
  expect(await viewport.evaluate(el => el.scrollTop)).toBeLessThan(previousScroll);
  await page.locator("#undo").click();
  await expect.poll(() => savedBoard(page)).toEqual(board);
  expect(await viewport.evaluate(el => el.scrollTop)).toBe(previousScroll);
});

test("collapse slides the surviving cells and accepts a new pair", async ({ page }) => {
  await page.clock.install();
  await open(page, boardOf({0:5, 1:5, 9:3, 10:3, 18:1}));
  await page.evaluate(() => {
    const board = document.getElementById("board")!;
    const originalPlay = Animation.prototype.play;
    Animation.prototype.play = function () {
      const effect = this.effect;
      if (effect instanceof KeyframeEffect && effect.target?.matches(".cell")
        && effect.getKeyframes()[0].translate) board.dataset.slid = "true";
      return originalPlay.call(this);
    };
  });
  await digit(page, 0).click();
  await digit(page, 1).click();
  await page.clock.runFor(110);
  await expect(page.locator("#board")).toHaveAttribute("data-slid", "true");
  await expect(page.locator("#remaining")).toHaveText("3");
  await digit(page, 0).dispatchEvent("click");
  await digit(page, 1).dispatchEvent("click");
  await page.clock.runFor(110);
  await expect(page.locator("#remaining")).toHaveText("1");
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Add only deals the appended digits, reduced motion=${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion });
    const board = [1, 2, 3, 4, 1, 2, 3, 4, 2, ...Array<number>(99).fill(0)];
    await open(page, board);
    await page.evaluate(() => {
      const board = document.getElementById("board")!;
      const originalPlay = Animation.prototype.play;
      const dealt: [number, number][] = [];
      Animation.prototype.play = function () {
        const effect = this.effect;
        if (effect instanceof KeyframeEffect && effect.target?.matches(".digit")
          && effect.getKeyframes()[0].translate === "0px -4px") {
          dealt.push([Number((effect.target.parentElement as HTMLElement).dataset.index), effect.getTiming().delay]);
          board.dataset.dealt = JSON.stringify(dealt);
        }
        return originalPlay.call(this);
      };
    });
    await page.locator("#add").click();
    await expect.poll(() => savedBoard(page)).toEqual([...board, ...board.slice(0, 9)]);
    await expect.poll(() => page.locator("#viewport").evaluate(el => el.scrollTop)).toBeGreaterThan(1);
    if (reducedMotion === "reduce") await expect(page.locator("#board")).not.toHaveAttribute("data-dealt");
    else await expect(page.locator("#board")).toHaveAttribute("data-dealt",
      JSON.stringify(Array.from({ length: 9 }, (_, i) => [108 + i, i * 23])));
    await page.locator("#undo").click();
    await expect.poll(() => savedBoard(page)).toEqual(board);
    await expect(page.locator(".add-pending")).toHaveCount(0);
    expect(await page.locator("#viewport").evaluate(el => el.scrollTop)).toBe(0);
  });
}

for (const count of [2,24,2400]) {
  test(`classic result opens first unsolved task with ${count} already solved`,async({page})=>{
    await open(page,[5,5],"classic",Array.from({length:count},(_,i)=>`book-v1-${i+1}`));
    await digit(page,0).click(); await digit(page,1).click();
    await expect(page.locator("#win")).toBeVisible();
    const button=page.locator("#try-notebook");
    if (count===2400) await expect(button).toBeHidden();
    else {
      await expect(button).toHaveText("Открыть тетрадь");
      await button.click();
      await expect(page.locator("#mode")).toHaveText(count===2 ? "Тетрадь 1 · задача 3" : "Тетрадь 2 · задача 1");
    }
  });
}
