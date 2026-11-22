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
      await expect(digit(page,b)).toHaveClass(/selected/);
      expect(await viewportTop(page)).toBeCloseTo(top, 0);
      expect(await savedBoard(page)).toEqual(board);
      if (reverse) await digit(page,b).click();
      else await page.clock.fastForward(900);
      await expect(outlined).toHaveCount(0);
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
  test(`exit right before entering left, reverse=${reverse}`, async ({page})=>{
    await page.clock.install();
    const board = boardOf({7:6, 10:4});
    await open(page, board);
    await page.locator("#hint").click();
    await expect(page.locator("#status")).toHaveText("6 + 4 = 10 · через край строки");
    await expect(page.locator("#paths .edge-exit, #paths .edge-entry")).toHaveCount(2);
    const [a,b] = reverse ? [10,7] : [7,10];
    await digit(page,a).click();
    await digit(page,b).click();
    const trace = page.locator("#pair-trace");
    const geometry = await trace.locator("path").evaluateAll(paths=>paths.map(el=>{
      const path=el as SVGPathElement;
      const [,x0,y0,x1]=path.getAttribute("d")!.match(/^M([^,]+),([^H]+)H([^m]+)/)!;
      return {x0:Number(x0),y:Number(y0),x1:Number(x1),delay:getComputedStyle(path).animationDelay};
    }));
    expect(geometry).toHaveLength(2);
    expect(geometry[0].y).toBeLessThan(geometry[1].y);
    expect(geometry[0].x0).toBeGreaterThan(geometry[1].x0);
    expect(geometry.every(g=>g.x1>g.x0)).toBe(true);
    expect(geometry.map(g=>g.delay)).toEqual(["0s","0.085s"]);
    await page.clock.runFor(270);
    await expect(page.locator("#win")).toBeVisible();
    await expect(trace).toHaveCount(0);
  });
}

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
