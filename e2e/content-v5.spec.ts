import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openBookPicker } from "./book-controls";
import { bookV5Fixture as bookV5 } from "./content-v5-fixture";
import { dailyForTask } from "../src/puzzles";
import { checkPair, occupied, removePair } from "../src/core";
import { unpackSession, packSession } from "../src/history-codec";

const key = "seeds-bits.progress.v2";
const prefs = "seeds-bits.settings.v1";
const classic = { rules: 1 as const, current: { board: [5,5,4,6], moves:0, scroll:0, additions:0 }, history:[] };
const legacy = { version: 6, active:"classic", sessions:{classic:packSession(classic)}, hints:{}, done:[], seen:[] };
const raw = (page:Page, suffix="") => page.evaluate(k=>localStorage.getItem(k),key+suffix);
const stored = async (page:Page) => JSON.parse((await raw(page))!);
const digit = (page:Page, i:number) => page.locator(`#board button[data-index="${i}"]`);
async function selectTask(page:Page,id:string) {
  const target=page.locator(`[data-game="${id}"]`);
  const later=page.locator("#book-later-pages");
  if (await later.count() && await target.count() && !await target.isVisible() &&
      await later.getAttribute("open")===null) await later.locator(":scope > summary").click();
  await target.click();
}
async function install(page:Page, fixture:object=legacy) {
  await page.addInitScript(({fixture,key,prefs})=>{
    if (!localStorage.getItem(prefs))
      localStorage.setItem(prefs,JSON.stringify({tutorialDone:true,languageChoice:"ru",vibration:false,sound:false}));
    if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));
  },{fixture,key,prefs});
}
async function chooseVolume(page:Page,volume:number) {
  await page.locator("#book-mode").click();
  await openBookPicker(page);
  await page.locator("#book-chapter").selectOption(String(Math.floor((volume-1)/10)));
  await openBookPicker(page);
  await page.locator(`[data-volume="${volume-1}"]`).click();
}

test("new v5 slot works with the legacy catalogue chunk blocked",async({page})=>{
  await install(page,{...legacy,hints:{"book-v1-25":0}});
  await page.route("**/*notebook-extra*",route=>route.abort());
  await page.goto("/");
  await chooseVolume(page,2);
  await selectTask(page,"book-v1-26");
  await expect(page.locator("#dialog")).toBeHidden();
  await expect.poll(async()=>{
    const p=await stored(page);
    return [p.version,p.bookRevisions,p.sessions["book-v1-26"]?.current.board];
  }).toEqual([9,{"book-v1-25":1,"book-v1-26":5},bookV5("book-v1-26")!.board]);
  expect((await raw(page,".pre-v5"))).toBeTruthy();
});

test("v5 chunk and save failures preserve the existing game and its raw bytes",async({page})=>{
  await install(page);
  let blocked=true;
  await page.route("**/*content-v5-books-1*",route=>blocked?route.abort():route.continue());
  await page.goto("/");
  const before=await raw(page);
  await chooseVolume(page,1);
  await selectTask(page,"book-v1-2");
  await expect(page.locator("#book-load-error")).toContainText("Не удалось");
  expect(await raw(page)).toBe(before);
  blocked=false;
  await page.getByRole("button",{name:"Сохранить и перезагрузить"}).click();
  await expect(page.locator("#book-mode")).toBeVisible();
  await page.evaluate(k=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) {
      if (key===k && JSON.parse(value).version===9) throw Error("quota");
      original.call(this,key,value);
    };
  },key);
  await chooseVolume(page,1);
  await selectTask(page,"book-v1-2");
  await expect(page.locator("#save-notice")).toBeVisible();
  await expect(page.locator("#dialog")).toBeVisible();
  expect((await stored(page)).active).toBe("classic");
  expect((await stored(page)).bookRevisions?.["book-v1-2"]).toBeUndefined();
  expect(JSON.parse((await raw(page,".pre-v5"))!).sessions.classic.current.board).toEqual(classic.current.board);
});

test("a malformed v5 assignment is visible and the save stays byte-for-byte unchanged", async({page})=>{
  const invalid={...legacy,version:9,bookRevisions:{"book-v1-2":7}};
  await install(page,invalid);
  await page.goto("/");
  await expect(page.locator("#read-notice")).toContainText("Не удалось определить сохранённое поле");
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeVisible();
  expect(await raw(page)).toBe(JSON.stringify(invalid));
  expect(await raw(page,".recovery")).toBe(JSON.stringify(invalid));
});

const root="docs/research/daily-notebook-design-2026-11-24/catalogue-v5";
const gate=JSON.parse(readFileSync(root+"/controls.json","utf8"));
for (const volume of [5,20,40,65,95]) {
  test(`control notebook ${volume} opens the authored field in the game`,async({page})=>{
    const id=gate.volumes.find((v:{volume:number})=>v.volume===volume).tasks.reduce(
      (a:any,b:any)=>a.geometry.n>=b.geometry.n?a:b).id;
    await install(page);
    await page.goto("/");
    await chooseVolume(page,volume);
    await selectTask(page,id);
    await expect(page.locator("#remaining")).toHaveText(String(occupied(bookV5(id)!.board)));
    expect((await stored(page)).sessions[id].current.board).toEqual(bookV5(id)!.board);
  });
}

for (const [width,height] of [[320,568],[390,844]]) {
  test(`108 digits at ${width}×${height}: scrolling, a hint, compression Undo and full win`, async({page})=>{
    test.setTimeout(100_000);
    await page.setViewportSize({width,height});
    const id="book-v1-2397";
    const task=bookV5(id)!;
    await install(page);
    await page.goto("/");
    await chooseVolume(page,100);
    await selectTask(page,id);
    await expect(page.locator("#remaining")).toHaveText("108");
    await expect(page.locator("#add")).toBeHidden();
    const viewport=page.locator("#viewport");
    await expect.poll(()=>viewport.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeGreaterThan(50);
    await viewport.evaluate(e=>e.scrollTop=e.scrollHeight);
    await expect(viewport).toHaveAttribute("data-scroll-above","");
    await page.locator("#hint").click();
    await expect(page.locator("#board .hinted")).toHaveCount(2);
    const pair=await page.locator("#board .hinted").evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.index)));
    expect(checkPair(task.board,pair[0],pair[1]).ok).toBe(true);
    await page.screenshot({path:`test-results/content-v5/108-${width}.png`});

    let board=task.board, undone=false, checkedReload=false;
    for(const [index, move] of task.solution.entries()) {
      const next=removePair(board,move.a,move.b), collapses=next.length<board.length && next.length>0;
      const play=async()=>{
        await digit(page,move.a).click();
        await digit(page,move.b).click();
        await expect(page.locator("#remaining")).toHaveText(String(occupied(next)));
      };
      await play();
      if(collapses && !undone) {
        await page.locator("#undo").click();
        await expect(page.locator("#remaining")).toHaveText(String(occupied(board)));
        expect(unpackSession((await stored(page)).sessions[id]).current.board).toEqual(board);
        await play();
        undone=true;
      }
      if(index>=5 && undone && !checkedReload) {
        const before=unpackSession((await stored(page)).sessions[id]);
        await page.reload();
        await page.locator("#resume").click();
        expect(unpackSession((await stored(page)).sessions[id])).toEqual(before);
        checkedReload=true;
      }
      board=next;
    }
    expect(undone&&checkedReload).toBe(true);
    await expect(page.locator("#win")).toBeVisible();
    const result=await stored(page);
    expect(result.done).toContain(id);
    expect(result.bookRevisions[id]).toBe(5);
    expect(unpackSession(result.sessions[id]).history).toHaveLength(54);
  });
}

test("assigned v4 is retained at the date boundary and two isolated profiles get the same v5 date",async({browser})=>{
  const old="daily-v4-2026-12-25",next="daily-v5-2026-12-26";
  const day=dailyForTask(old)!;
  const fixture={...legacy,version:8,sessions:{...legacy.sessions,[old]:packSession({rules:1,
    current:{board:day.board,moves:0,additions:0,scroll:0},history:[]})}};
  const contexts=await Promise.all([browser.newContext({locale:"ru-RU"}),browser.newContext({locale:"ru-RU"})]);
  try {
    const fields=await Promise.all(contexts.map(async(ctx,i)=>{
      const page=await ctx.newPage();
      await page.clock.setFixedTime(new Date("2026-12-26T12:00:00"));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,request=>request.abort());
      await install(page,i===0?fixture:legacy);
      await page.goto("/");
      await page.locator("#calendar-open").click();
      await expect(page.locator('[data-game="daily-v5-2026-12-27"]')).toBeDisabled();
      if(i===0) await expect(page.locator(`[data-game="${old}"]`)).toBeEnabled();
      await selectTask(page,next);
      await expect.poll(async()=> (await stored(page)).dailyAssignments?.["2026-12-26"]).toBe(next);
      const saved=await stored(page);
      if(i===0) {
        expect(saved.dailyAssignments["2026-12-25"]).toBe(old);
        expect(saved.sessions[old].current.board).toEqual(day.board);
      }
      await page.clock.setFixedTime(new Date("2026-12-27T12:00:00"));
      await page.reload();
      await page.locator("#resume").click();
      expect((await stored(page)).active).toBe(next);
      return saved.sessions[next].current.board;
    }));
    expect(fields[0]).toEqual(fields[1]);
    expect(fields[0]).toEqual(dailyForTask(next)!.board);
  } finally { await Promise.all(contexts.map(ctx=>ctx.close())); }
});
