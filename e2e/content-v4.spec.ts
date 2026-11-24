import {test,expect,type Page} from "@playwright/test";
import {notebook,daily,dailyForTask,puzzleSession} from "../src/puzzles";
import {bookV4} from "../src/content-v4";
import {commit,occupied,removePair} from "../src/core";
import {packSession} from "../src/history-codec";
const key="seeds-bits.progress.v2";
const stored=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
test("v8 partial old book and previously assigned v4 slot keep independent fields across reload and Undo",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  const old=notebook[1],next=bookV4("book-v1-3")!,step=old.solution[0];
  const partial=commit(puzzleSession(old),removePair(old.board,step.a,step.b),"pair",0);
  const raw={version:8,active:old.id,done:["book-v1-1"],hints:{[old.id]:1},seen:[],
    bookRevisions:{"book-v1-1":1,[old.id]:1,[next.id]:4},
    sessions:{classic:packSession({rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]}),[old.id]:packSession(partial)}};
  await page.addInitScript(({key,raw})=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true}));
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(raw));
  },{key,raw});
  await page.goto("/");
  if(await page.locator("#resume").isVisible())await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(partial.current.board)));
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(old.board)));
  await expect.poll(async()=> (await stored(page)).sessions[old.id].current.board).toEqual(old.board);
  await page.locator("#book-top").click();
  await page.locator('[data-game="'+next.id+'"]').click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(next.board)));
  await expect.poll(async()=> (await stored(page)).bookRevisions).toMatchObject({[old.id]:1,[next.id]:4});
  await expect.poll(async()=> (await stored(page)).sessions[next.id].current.board).toEqual(next.board);
  const m=next.solution[0],after=removePair(next.board,m.a,m.b);
  await page.locator('#board button[data-index="'+m.a+'"]').click();
  await page.locator('#board button[data-index="'+m.b+'"]').click();
  await expect.poll(async()=> (await stored(page)).sessions[next.id].current.board).toEqual(after);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(after)));
  await page.locator("#undo").click();
  await expect.poll(async()=> (await stored(page)).sessions[next.id].current.board).toEqual(next.board);
  await page.locator("#book-top").click();
  await page.locator('[data-game="'+old.id+'"]').click();
  await expect.poll(async()=> (await stored(page)).sessions[old.id].current.board).toEqual(old.board);
  const saved=await stored(page);
  expect(saved.version).toBe(8);expect(saved.done).toContain("book-v1-1");
  expect(saved.bookRevisions).toMatchObject({[old.id]:1,[next.id]:4});
});
test("calendar migration keeps an already completed legacy date while next date opens v5",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.clock.setFixedTime(new Date("2026-12-26T12:00:00"));
  const old=daily("2026-12-25"),next=dailyForTask("daily-v5-2026-12-26")!;
  await page.addInitScript(({key,old,session})=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true}));
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
      version:3,active:"classic",done:[old],hints:{},seen:[],
      sessions:{classic:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]},[old]:session}
    }));
  },{key,old:old.id,session:puzzleSession(old)});
  await page.goto("/");
  await page.locator("#calendar-open").click();
  await expect(page.locator('[data-game="'+old.id+'"]')).toHaveClass(/done/);
  await expect(page.locator('[data-game="daily-v5-2026-12-27"]')).toBeDisabled();
  await page.locator('[data-game="'+next.id+'"]').click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(next.board)));
  await expect.poll(async()=> (await stored(page)).dailyAssignments).toMatchObject({"2026-12-25":old.id,"2026-12-26":next.id});
  await expect.poll(async()=> (await stored(page)).sessions[next.id].current.board).toEqual(next.board);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#remaining")).toHaveText(String(occupied(next.board)));
  expect((await stored(page)).done).toContain(old.id);
});
