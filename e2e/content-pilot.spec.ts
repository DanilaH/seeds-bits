import {test,expect} from "@playwright/test";
import {pilotBooks} from "../src/content-pilot";
import {dailyForTask,daily,puzzleSession} from "../src/puzzles";
import {occupied,removePair} from "../src/core";

const key="seeds-bits.progress.v2";
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(()=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true}));
    if(!localStorage.getItem("seeds-bits.progress.v2"))localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({
      version:3,active:"classic",done:["book-v1-1"],hints:{},seen:[],
      sessions:{classic:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]}}
    }));
  });
});
test("themed books visible from normal menu, real move, reload, Undo, next task",async({page})=>{
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator("#pilot-books").click();
  await expect(page.locator(".volume-heading h3")).toContainText("Новые связи");
  const task=pilotBooks[0];
  await page.locator('[data-game="'+task.id+'"]').click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(task.board)));
  const {a,b}=task.solution[0];
  await page.locator('#board button[data-index="'+a+'"]').click();
  await page.locator('#board button[data-index="'+b+'"]').click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(task.board)-2));
  await expect.poll(()=>page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);return [p.version,p.sessions[p.active].current.moves]},key)).toEqual([7,1]);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(task.board)-2));
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(task.board)));
  let board=task.board;
  for(const move of task.solution){
    await page.locator('#board button[data-index="'+move.a+'"]').click();
    await page.locator('#board button[data-index="'+move.b+'"]').click();
    board=removePair(board,move.a,move.b);
    await expect(page.locator("#remaining")).toHaveText(String(occupied(board)));
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).done,key)).toContain(task.id);
  await page.locator("#play-again").click();
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).active,key)).toBe(pilotBooks[1].id);
});
test("calendar keeps legacy day, assigns next pilot day and blocks tomorrow",async({page})=>{
  await page.clock.install({time:new Date("2026-12-02T12:00:00")});
  const old=daily("2026-12-01");
  await page.addInitScript(({key,old,session})=>{
    // Seed a genuine legacy fixture before boot rather than racing the save queue.
    localStorage.setItem(key,JSON.stringify({
      version:3,active:"classic",done:["book-v1-1",old],hints:{},seen:[],
      sessions:{classic:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]},[old]:session}
    }));
  },{key,old:old.id,session:puzzleSession(old)});
  await page.goto("/");
  await page.locator("#calendar-open").click();
  await expect(page.locator('[data-game="daily-v1-2026-12-01"]')).toHaveClass(/done/);
  await expect(page.locator('[data-game="daily-v3-2026-12-03"]')).toBeDisabled();
  await page.locator('[data-game="daily-v3-2026-12-02"]').click();
  const task=dailyForTask("daily-v3-2026-12-02")!;
  await expect(page.locator("#remaining")).toHaveText(String(occupied(task.board)));
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).dailyAssignments,key)).toMatchObject({"2026-12-02":task.id});
});
