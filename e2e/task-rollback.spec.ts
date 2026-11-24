import {expect, test, type Page} from "@playwright/test";
import notebook from "../src/notebook.json" with {type:"json"};
import {unpackSession} from "../src/history-codec";
import {occupied, removePair} from "../src/core";
import {key} from "./help-test-utils";

async function start(page: Page, task: number, exhausted = false, archived = false) {
  const puzzle = notebook[task-1];
  const active = archived ? "daily-v1-2026-11-19" : puzzle.id;
  await page.addInitScript(({key, board, active, exhausted})=>{
    const w = window as any;
    w.__SEEDS_ADS_TEST__ = {
      initialize:async()=>({enabled:true,test:true,readiness:{state:"ready"}}),
      addListener:async()=>({remove:async()=>{}}),
      readiness:async()=>({state:"ready"}), preload:async()=>{}, banner:async()=>{},
      report:async()=>({accepted:true}), pending:async()=>({}), acknowledge:async()=>{},
    };
    if (localStorage.getItem(key)) return;
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true}));
    localStorage.setItem(key,JSON.stringify({
      version:3,active,done:[],seen:[],hints:{},
      sessions:{[active]:{rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}},
      meta:{version:2,wallet:0,since:"2026-11-10",completed:0,unassisted:0,attempts:{
        [active]:{id:"rollback-fixture",completed:false,hintKeys:exhausted?["used1","used2","used3"]:[]},
      }},
    }));
  },{key,board:puzzle.board,active,exhausted});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.locator("#resume").click();
  return puzzle.board;
}
async function remove(page:Page,a:number,b:number,remaining:number) {
  await page.locator(`#board button[data-index="${a}"]`).click();
  await page.locator(`#board button[data-index="${b}"]`).click();
  await expect(page.locator("#remaining")).toHaveText(String(remaining));
}
const state = (page:Page)=>page.evaluate(key=>{
  const {sessions,active,meta,hints} = JSON.parse(localStorage.getItem(key)!);
  return {game:sessions[active],wallet:meta.wallet,keys:meta.attempts[active].hintKeys,hints:hints[active]??0};
},key);

for (const exhausted of [false,true]) {
  test(`task 4 undoes one move without opening or spending a hint, exhausted=${exhausted}`, async({page})=>{
    let board = await start(page,4,exhausted);
    // Force a genuine scroll offset on this small two-row fixture.
    const shortField = () => page.addStyleTag({content:
      "#app .game #viewport {height:64px !important; max-height:64px !important; min-height:0 !important; flex:0 0 64px !important; overflow:auto !important}",
    });
    await shortField();
    for (const [a,b] of [[1,11],[7,16],[10,13]]) {
      board = removePair(board,a,b);
      await remove(page,a,b,occupied(board));
    }
    await expect.poll(async()=>unpackSession((await state(page)).game).current.moves).toBe(3);
    if (exhausted) {
      await page.reload();
      await shortField();
      await page.locator("#resume").click();
    }
    const before=await state(page), history=unpackSession(before.game).history;
    await page.locator("#hint").click();
    await expect(page.locator("#status")).toContainText("Из этой позиции решения нет");
    const rollback = page.locator("#recover-task");
    await expect(rollback).toHaveText("Отменить 1 ход");
    await rollback.click();
    await expect(page.locator("#status")).toContainText("Поле восстановлено.");
    await expect.poll(async()=>unpackSession((await state(page)).game)).toEqual({
      rules:1, current:history[2], history:history.slice(0,2),
    });
    expect(history[2].scroll).toBeGreaterThan(0);
    expect(await page.locator("#viewport").evaluate(el=>el.scrollTop)).toBe(history[2].scroll);
    await expect(page.locator("#board .hinted")).toHaveCount(0);
    await expect(page.locator("#hint-offer")).toBeHidden();
    const after=await state(page);
    expect([after.wallet,after.keys,after.hints]).toEqual([before.wallet,before.keys,before.hints]);
    await expect(page.locator("#hint")).toBeEnabled();
    await page.locator("#hint").click();
    if (exhausted) await expect(page.locator("#hint-offer")).toBeVisible();
    else await expect(page.locator("#board .hinted")).toHaveCount(2);
  });
}

test("real task 5 offers the exact two-move rollback depth",async({page})=>{
  let board=await start(page,5);
  for (const [a,b] of [[3,4],[5,13],[6,15],[2,11]]) {
    board=removePair(board,a,b);
    await remove(page,a,b,occupied(board));
  }
  await expect.poll(async()=>unpackSession((await state(page)).game).current.moves).toBe(4);
  const before=unpackSession((await state(page)).game);
  await page.locator("#hint").click();
  await expect(page.locator("#recover-task")).toHaveText("Отменить 2 хода");
  await page.locator("#recover-task").click();
  await expect.poll(async()=>unpackSession((await state(page)).game)).toEqual({
    rules:1,current:before.history[2],history:before.history.slice(0,2),
  });
  await expect(page.locator("#board .hinted")).toHaveCount(0);
});

test("archived daily reports an unknown solution without calling it impossible",async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage() {
        queueMicrotask(()=>this.onmessage?.call(this,new MessageEvent("message",{
          data:{advice:{kind:"unknown"},recovery:0},
        })));
      }
    };
  });
  let board=await start(page,4,false,true);
  board = removePair(board,1,11);
  await remove(page,1,11,occupied(board));
  await page.locator("#hint").click();
  await expect(page.locator("#status")).toContainText("Пока не удалось проверить, есть ли решение.");
  await expect(page.locator("#recover-task")).toHaveText("Отменить 1 ход");
  await expect(page.locator("#add")).toBeHidden();
  await page.locator("#recover-task").click();
  await expect(page.locator("#hint-offer")).toBeHidden();
  await expect(page.locator("#board .hinted")).toHaveCount(0);
});
