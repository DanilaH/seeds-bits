import { expect, test, type Page } from "@playwright/test";
import { classic, commit, removePair, type Session } from "../src/core";
import { packSession, unpackSession } from "../src/history-codec";
import { puzzleSession } from "../src/puzzles";
import { bookV5Fixture } from "./content-v5-fixture";

const key = "seeds-bits.progress.v2";
const prefs = "seeds-bits.settings.v1";
const retainedId = "book-v1-2180"; // Notebook 91, puzzle 20.
const parked = bookV5Fixture(retainedId);
const firstMove = parked.solution[0];
const original = puzzleSession(parked);
const started = commit(original, removePair(original.current.board,firstMove.a,firstMove.b),"pair",52);
const classicGame = (board = classic()): Session => ({
  rules:1,current:{board,scroll:0,moves:1,additions:0},history:[],
});
const read = (page:Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!),key);
const home = (page:Page) => page.locator('#dialog[data-screen="home"][open]');
async function install(page:Page, fields:Record<string,Session>={}, active="classic", done:string[]=[],
    ads=false, theme="light", lang="ru") {
  const bookRevisions = Object.fromEntries([...new Set([...Object.keys(fields),...done])]
    .filter(id=>id.startsWith("book-v1-")).map(id=>[id,id===retainedId?5:1]));
  const save = Object.keys(fields).length ? {
    version:9,active,done,seen:[],hints:{},bookRevisions,
    sessions:Object.fromEntries(Object.entries(fields).map(([id,s])=>[id,packSession(s)])),
    lastBookTask:fields[retainedId]?retainedId:undefined,
  } : null;
  await page.addInitScript(({save,prefs,key,ads,theme,lang})=>{
    if (!localStorage.getItem(prefs))
      localStorage.setItem(prefs,JSON.stringify({tutorialDone:true,languageChoice:lang,theme,sound:false,vibration:false}));
    if (save && !localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(save));
    if (!ads) return;
    const state={requests:[] as any[],banner:[] as any[],events:[] as any[],finish:undefined as undefined | ((r:any)=>void)};
    (window as any).menuQA=state;
    (window as any).__SEEDS_ADS_TEST__={
      initialize:async()=>({enabled:true,test:true}),addListener:async()=>({remove:async()=>{}}),
      banner:async(options:any)=>{state.banner.push(options);},preload:async()=>{},pending:async()=>({}),
      acknowledge:async()=>{},report:async(result:any)=>{state.events.push(result);},
      show:async(options:any)=>{state.requests.push(options);return new Promise(resolve=>{state.finish=resolve;});},
    };
  },{save,key,prefs,ads,theme,lang});
  await page.goto("/");
  await expect(home(page)).toBeVisible();
}
const route = (page:Page) => page.locator("#dialog").getAttribute("data-screen");
async function classicNew(page: Page, level=1) {
  await page.locator("#classic-mode").click();
  if(await page.locator("#next-classic").isVisible()) await page.locator("#next-classic").click();
  await page.locator(`[data-classic-level="${level}"]`).click();
}
test("fresh Home presents three modes with no fake resume; Escape cannot enter the game",async({page})=>{
  await install(page);
  await expect(page.locator("#resume")).toBeHidden();
  await expect(page.locator("#book-quick")).toHaveText("Начать");
  for(const id of ["classic-mode","book-mode","daily-mode"]) await expect(page.locator("#"+id)).toBeInViewport();
  await expect(page.locator("#dialog #close")).toHaveCount(0);
  await expect(page.locator(".home-links button")).toHaveCount(4);
  await expect(page.locator(".home-links").getByRole("button",{name:"Язык",exact:true})).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(home(page)).toBeVisible();
  await classicNew(page);
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#mode")).toHaveText("Классика");
});
test("parked Classic from another mode is replaced only after confirmation",async({page})=>{
  await install(page,{classic:classicGame(),[retainedId]:started},retainedId);
  await expect(page.locator("#book-quick")).toBeHidden();
  const before = await read(page);
  await classicNew(page,2);
  await expect(page.locator("#confirm-new")).toBeVisible();
  await page.locator("#cancel-new").click();
  expect((await read(page)).sessions).toEqual(before.sessions);
  await classicNew(page,2);
  await page.locator("#confirm-new").click();
  await expect(page.locator("#mode")).toHaveText("Классика");
  const after = await read(page);
  expect(after.meta.classicRun.difficulty).toBe(2);
  expect(after.sessions[retainedId]).toEqual(before.sessions[retainedId]);
});
test("last played Notebook 91/20 survives reload, browsing and a direct resume",async({page})=>{
  await install(page,{classic:classicGame(),[retainedId]:started});
  await expect(page.locator("#book-mode")).toHaveAccessibleName(/91.*20/);
  await expect(page.locator("#book-quick")).toHaveText("Продолжить");
  await page.locator("#book-mode").click();
  await expect(page.locator("#dialog .dialog-head .screen-heading")).toContainText("91");
  await expect(page.locator("#collection .task")).toHaveCount(24);
  await expect(page.locator("#collection .task.started")).toHaveAttribute("data-game",retainedId);
  await page.locator("#all-books").click();
  await page.locator("#toggle-book-filter").click();
  await page.locator("#book-filter").selectOption("active");
  await expect(page.locator('[data-book-range="4"]')).toHaveAttribute("aria-pressed","true");
  await page.locator('[data-volume="90"]').click();
  await page.locator("#collection-back").click();
  expect(await route(page)).toBe("book-picker");
  await expect(page.locator("#book-filter")).toHaveValue("active");
  await page.locator("#book-section-themes").click();
  await expect(page.locator("#book-filter-reset")).toBeVisible();
  await page.locator("#book-filter-reset").click();
  await expect(page.locator(".theme-shelf [data-volume]")).toHaveCount(4);
  await page.reload();
  await page.locator("#book-quick").click();
  await expect(page.locator("#mode")).toContainText("задача 20");
  expect(unpackSession((await read(page)).sessions[retainedId]).current.board).toEqual(started.current.board);
  expect(unpackSession((await read(page)).sessions[retainedId]).history).toEqual(started.history);
  await page.locator("#undo").click();
  await expect.poll(async()=>unpackSession((await read(page)).sessions[retainedId]).current.board).toEqual(original.current.board);
});
test("result to menu uses one fullscreen route, with stable banner and no immediate repeat",async({page})=>{
  await install(page,{classic:classicGame([5,5]),[retainedId]:started},"classic",[],true);
  const qa = () => page.evaluate(()=>(window as any).menuQA);
  await page.locator("#resume").click();
  await expect.poll(async()=>(await qa()).requests.length).toBe(1);
  await page.evaluate(()=>(window as any).menuQA.finish({shown:true,status:"closed"}));
  await expect(page.locator("#dialog")).toBeHidden();
  // Age the JS external suppression without changing a native policy.
  await page.clock.install();
  await page.clock.fastForward(31000);
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await expect(page.locator("#play-again")).toHaveText("В меню");
  await expect(page.locator("#result-actions button:visible")).toHaveCount(1);
  await page.locator("#play-again").click();
  await expect.poll(async()=>(await qa()).requests.length).toBe(2);
  expect((await qa()).requests.at(-1).route).toBe("classic-result-home");
  // Web reserves the slot while native decides whether a fullscreen will start.
  expect((await qa()).banner.at(-1).visible).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute("inert","");
  await page.evaluate(()=>(window as any).menuQA.finish({shown:true,status:"closed"}));
  await expect(home(page)).toBeVisible();
  await expect(page.locator("#resume")).toBeHidden();
  await expect.poll(async()=>(await qa()).banner.at(-1)?.visible).toBe(true);
  const before = (await qa()).banner.length;
  await page.locator("#book-mode").click();
  await page.locator("#all-books").click();
  await expect(page.locator('[data-volume="90"]')).toBeVisible();
  expect((await qa()).banner.length).toBe(before);
  await page.locator("#collection-back").click();
  await page.locator("#collection-back").click();
  await page.locator("#book-quick").click();
  await expect(page.locator("#dialog")).toBeHidden();
  expect((await qa()).requests).toHaveLength(2);
});
test("no-fill keeps the app banner and does not consume the external cooldown",async({page})=>{
  await install(page,{classic:classicGame([5,5])},"classic",[],true);
  const ads = () => page.evaluate(()=>(window as any).menuQA);
  await page.locator("#resume").click();
  await expect.poll(async()=>(await ads()).requests.length).toBe(1);
  await page.evaluate(()=>(window as any).menuQA.finish({status:"skipped",reason:"not_loaded"}));
  await expect(page.locator("#dialog")).toBeHidden();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await page.locator("#play-again").click();
  await expect.poll(async()=>(await ads()).requests.length).toBe(2);
  await page.evaluate(()=>(window as any).menuQA.finish({status:"skipped",reason:"cooldown"}));
  await expect(home(page)).toBeVisible();
  expect((await ads()).banner.every((call: {visible:boolean})=>call.visible)).toBe(true);
});
test("failed target write preserves previous session and sends no ad request",async({page})=>{
  await install(page,{classic:classicGame(),[retainedId]:started},"classic",[],true);
  const before = await read(page);
  await page.evaluate(key=>{
    const save=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw Error("quota");return save.call(this,k,v);};
  },key);
  await page.locator("#book-quick").click();
  await expect(page.locator("#save-notice")).toBeVisible();
  expect((await read(page)).sessions).toEqual(before.sessions);
  expect(await page.evaluate(()=>(window as any).menuQA.requests.length)).toBe(0);
});

for(const [width,height] of [[320,568],[360,640],[390,844],[820,600],[568,320]]) {
  for(const theme of ["light","dark"]) {
    test(`board CTA and Home modes avoid the app banner at ${width}×${height} ${theme}`,async({page})=>{
      await page.setViewportSize({width,height});
      await install(page,{classic:classicGame(),[retainedId]:started},"classic",[],true,theme,width===360?"pt-BR":"ru");
      const geometry = () => page.evaluate(()=>document.querySelector("#ad-space")!.getBoundingClientRect().toJSON());
      const slot = await geometry();
      expect(slot.height).toBeGreaterThan(0);
      for(const id of ["classic-mode","book-mode","daily-mode","book-quick"]) {
        const rect=await page.locator("#"+id).boundingBox();
        expect(rect!.height).toBeGreaterThanOrEqual(48);
        expect(rect!.y+rect!.height).toBeLessThanOrEqual(slot.y);
      }
      await page.locator("#book-mode").click();
      const cta = await page.locator("#continue-book").boundingBox();
      expect(cta!.height).toBeGreaterThanOrEqual(48);
      expect(cta!.y+cta!.height).toBeLessThanOrEqual(slot.y);
      const tiles = await page.locator(".compact-task-grid .task").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
      expect(Math.min(...tiles)).toBeGreaterThanOrEqual(48);
      expect(await geometry()).toEqual(slot);
      await page.locator("#all-books").click();
      expect(await geometry()).toEqual(slot);
    });
  }
}

test("theme selection, resume and Undo stay independent of the main notebook catalogue",async({page})=>{
  const id = "book-v3-links-1";
  await install(page,{classic:classicGame()});
  await page.locator("#book-mode").click();
  await page.locator("#all-books").click();
  await page.locator("#book-section-themes").click();
  await expect(page.locator(".theme-shelf [data-volume]")).toHaveCount(4);
  await page.locator('[data-volume="100"]').click();
  await expect(page.locator(".compact-task-grid button")).toHaveCount(24);
  await page.locator(`[data-game="${id}"]`).click();
  await expect(page.locator("#dialog")).toBeHidden();
  const initial = unpackSession((await read(page)).sessions[id]);
  await page.locator("#hint").click();
  await expect(page.locator("#board .hinted")).toHaveCount(2);
  await page.locator("#board .hinted").first().click();
  await page.locator("#board .hinted").last().click();
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  await page.locator("#classic-mode").click();
  await page.locator("#classic-resume").click();
  await expect(page.locator("#mode")).toHaveText("Классика");
  await page.reload();
  await expect(page.locator("#book-quick")).toHaveText("Продолжить");
  await page.locator("#book-quick").click();
  await expect(page.locator("#mode")).toContainText("Новые связи");
  await page.locator("#undo").click();
  await expect.poll(async()=>unpackSession((await read(page)).sessions[id]).current.board).toEqual(initial.current.board);
});

test("notebook completion markers and tap targets work from zero to all tasks solved",async({page})=>{
  const done = [[0,1],[9,12],[90,23],[99,24]].flatMap(([volume,count])=>
    Array.from({length:count},(_,i)=>`book-v1-${volume*24+i+1}`));
  await install(page,{classic:classicGame()},"classic",done);
  await page.locator("#book-mode").click();
  await page.locator("#all-books").click();
  for (const [volume,count] of [[0,1],[9,12],[90,23],[99,24],[1,0]]) {
    await page.locator(`[data-book-range="${Math.floor(volume/20)}"]`).click();
    await page.locator(`[data-volume="${volume}"]`).click();
    await expect(page.locator(".compact-task-grid button")).toHaveCount(24);
    await expect(page.locator(".compact-task-grid .task.done")).toHaveCount(count);
    await expect(page.locator(".notebook-toolbar")).toContainText(`${count} из 24`);
    if (count === 24) await expect(page.locator("#continue-book")).toHaveCount(0);
    else await expect(page.locator("#continue-book")).toHaveAttribute("data-continue",`book-v1-${volume*24+count+1}`);
    await page.locator("#collection-back").click();
  }
});
