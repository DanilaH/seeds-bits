import {test,expect,type Page} from "@playwright/test";
import {pairs,removePair} from "../src/core";
import notebook from "../src/notebook.json" with {type:"json"};
import {daily} from "../src/puzzles";
import {bookV4} from "../src/content-v4";
const key="seeds-bits.progress.v2", settings="seeds-bits.settings.v1";
const cue=(p:Page)=>p.locator(".opening-copy");
async function stable(p:Page){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function click(p:Page,selector:string,region?:string){
  if(region)await p.locator(selector).evaluate((el,region)=>{
    const v=document.querySelector(region)!,r=el.getBoundingClientRect(),b=v.getBoundingClientRect();
    if(r.top<b.top)v.scrollBy({top:r.top-b.top,behavior:"instant"});
    else if(r.bottom>b.bottom)v.scrollBy({top:r.bottom-b.bottom,behavior:"instant"});
  },region);
  await stable(p);
  const xy=await p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,ok:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&el.contains(document.elementFromPoint(x,y))};});
  expect(xy.ok,selector+JSON.stringify(xy)).toBe(true);await p.mouse.click(xy.x,xy.y);
}
async function digit(p:Page,i:number){await click(p,`#board [data-index="${i}"]`,"#viewport");}
async function move(p:Page,a:number,b:number){const before=+(await p.locator("#remaining").innerText());await digit(p,a);await digit(p,b);await expect(p.locator("#remaining")).toHaveText(String(before-2));await stable(p);}
async function start(p:Page){await p.emulateMedia({reducedMotion:"reduce"});await p.goto("/");await expect(cue(p)).toHaveText("Нажмите любую цифру.");}
async function scale(p:Page,z:number){await p.evaluate(z=>{
  const es=[...document.querySelectorAll<HTMLElement>("body *")],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=`${sizes[i]*z}px`);
},z);await stable(p);}
async function fullyVisible(p:Page,selector:string,region:string){
  const result = await p.locator(selector).evaluate((e,region)=>{
    const r=e.getBoundingClientRect(),v=document.querySelector(region)!.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(e);
    const lines = [...range.getClientRects()];
    const visible = lines.length > 0 && lines.every(b=>b.top>=v.top-1&&b.bottom<=v.bottom+1&&b.left>=-1&&b.right<=innerWidth+1)&&r.height>0;
    return {visible, region:v.toJSON(), lines:lines.map(line=>line.toJSON())};
  },region);
  expect(result.visible, JSON.stringify(result)).toBe(true);
}
test("clean first run is a real saved task, voluntary task 2 and no duplicate reward",async({page})=>{
  await start(page);await expect(page.locator("#dialog")).not.toHaveAttribute("open");await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 1");
  for(const [a,b] of [[8,17],[4,5],[9,11],[7,14]])await move(page,a,b);
  await expect(page.locator("#win")).toBeVisible();await expect(page.locator("#win")).toContainText("1 из 24");await expect(page.locator("#play-again")).toHaveText("К задаче 2");
  await expect(page.locator("#result-jar-amount")).toContainText("4 из 24");
  await expect(page.locator("#result-gains")).toContainText("+4");
  await page.waitForTimeout(1700);expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).active,key)).toBe("book-v1-1");
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).meta.completed,key);
  await page.reload();await page.locator("#resume").click();await expect(page.locator("#win")).toBeVisible();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).meta.completed,key)).toBe(before);
  await page.locator("#play-again").click();await expect(page.locator("#mode")).toContainText("задача 2");
  const pair=pairs(bookV4("book-v1-2")!.board)[0];await move(page,pair.a,pair.b);
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions["book-v1-2"],key);
  await page.locator("#menu").click();
  await expect(page.locator("#home-goal")).toContainText("1 из 24");
  await expect(page.locator("#resume")).toHaveText("Продолжить задачу 2");
  await page.keyboard.press("Escape");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.reload();await page.locator("#resume").click();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions["book-v1-2"],key)).toEqual(saved);
});
for(const i of notebook[0].board.flatMap((v,i)=>v?[i]:[]))test(`first selection ${i} offers only legal partners`,async({page})=>{
  await start(page);await digit(page,i);const values=notebook[0].board;
  const partners=pairs(values).filter(p=>p.a===i||p.b===i).map(p=>values[p.a===i?p.b:p.a]);
  const text=await cue(page).innerText();const v=values[i];
  if(partners.includes(v)&&!partners.includes(10-v))await expect(cue(page)).toHaveText(`Найдите ещё одну ${v}.`);
  if(!partners.includes(v))expect(text).not.toContain(`ещё одну ${v}`);
  if(!partners.includes(10-v))expect(text).not.toContain(`или ${10-v}`);
  expect(partners.length).toBeGreaterThan(0);
});
test("first explicit hint replaces the opening command",async({page})=>{
  await start(page);await page.locator("#hint").click();await expect(cue(page)).not.toContainText("Нажмите любую");await expect(cue(page)).toContainText("6 + 4 = 10");await expect(page.locator("#status")).toHaveText("");
});
for(const reverse of [false,true])test(`gap cue before the move, explicit hint, edge order ${reverse}`,async({page})=>{
  await start(page);const top=await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top);
  await move(page,8,17);await page.locator("#undo").click();await expect(cue(page)).toHaveText("Нажмите любую цифру.");
  await move(page,8,17);await move(page,4,5);await expect(cue(page)).toHaveText("Пустые клетки можно пропускать.");
  await expect(page.locator("#board .hinted")).toHaveCount(0);await page.locator("#hint").click();
  await expect(cue(page)).toContainText("3 и 3");await expect(cue(page)).toContainText("по горизонтали");await expect(page.locator("#status")).toHaveText("");
  await move(page,9,11);await expect(cue(page)).toHaveText("От правого края — в начало строки ниже.");
  const a=reverse?14:7,b=reverse?7:14;await digit(page,a);
  await expect(page.locator("#board .hinted")).toHaveCount(0);
  expect(await page.locator("#paths").innerHTML()).toBe("");
  await page.locator("#hint").click();
  await expect(page.locator("#board .hinted")).toHaveCount(2);
  const svg=await page.locator("#paths").innerHTML();expect(svg).toContain("path");
  expect(await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top)).toBe(top);
  await move(page,a,b);
  await expect(page.locator("#win")).toBeVisible();
});
for(const height of [520,568])test(`first commands fully visible at 320x${height} and 200%`,async({page})=>{
  await page.setViewportSize({width:320,height});await start(page);await scale(page,2);await fullyVisible(page,".opening-copy","#page-progress");
  await page.screenshot({path:`test-results/first-session/first-${height}-200.png`});await digit(page,9);await expect(cue(page)).toHaveText("Найдите ещё одну 3.");await fullyVisible(page,".opening-copy","#page-progress");
  await page.locator("#menu").click();await page.locator("#learn").click();await stable(page);
  await expect(page.locator("#lesson-text")).toHaveText("Нажмите на две четвёрки.");await fullyVisible(page,"#lesson-text","#lesson");
  const before=await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top);await digit(page,0);await digit(page,1);await expect(page.locator("#lesson-next")).toBeVisible();await click(page,"#lesson-next","#lesson-actions");
  await expect(page.locator("#lesson-text")).toHaveText("Соедините 3 и 7.");await fullyVisible(page,"#lesson-text","#lesson");expect(Math.abs(await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top)-before)).toBeLessThanOrEqual(1);
});
for(const profile of ["classic","book-v1-2","daily-v1-2026-11-19","settings-only","backup-only","empty-settings","broken-settings","legacy"])test(`existing ${profile} keeps its route and stored position`,async({page})=>{
  await page.addInitScript(({key,settings,profile})=>{
    if(profile==="empty-settings"||profile==="broken-settings"){localStorage.setItem(settings,profile==="empty-settings"?"":"{");return;}
    if(profile==="backup-only"){localStorage.setItem(key+".recovery","{}");return;}
    localStorage.setItem(settings,JSON.stringify({tutorialDone:true,theme:"dark",sound:false,vibration:false}));
    if(profile==="settings-only")return;
    if(profile==="legacy"){localStorage.setItem("seeds-bits.session.v1",JSON.stringify({rules:1,current:{board:[0,0,1,1,2,2],scroll:0,moves:1,additions:0},history:[{board:[5,5,1,1,2,2],scroll:0,moves:0,additions:0}]}));return;}
    localStorage.setItem(key,JSON.stringify({version:3,active:profile,sessions:{[profile]:{rules:1,current:{board:[0,0,1,1,2,2],moves:1,scroll:0,additions:0},history:[{board:[5,5,1,1,2,2],moves:0,scroll:0,additions:0}]}},hints:{[profile]:1},done:[],seen:[]}));
  },{key,settings,profile});
  await page.goto("/");await expect(cue(page)).toHaveCount(0);await expect(page.locator("#dialog[open],#lesson:not([hidden])").first()).toBeVisible();
  if(["classic","book-v1-2","daily-v1-2026-11-19","legacy"].includes(profile)){
    await page.locator("#resume").click();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions[JSON.parse(localStorage.getItem(k)!).active].current.board,key)).toEqual([0,0,1,1,2,2]);await page.locator("#undo").click();await expect(page.locator("#remaining")).toHaveText("6");
  }
});
test("archive date is retained across menu, victory, replay and restart",async({page})=>{
  await page.clock.install({time:new Date("2026-11-20T10:00:00+05:00")});await start(page);
  await page.locator("#menu").click();await page.locator("#calendar-open").click();await page.locator('[data-game="daily-v1-2026-11-19"]').click();await expect(page.locator("#mode")).toContainText("19 ноября");await expect(page.locator("#remaining")).toHaveText(String(daily("2026-11-19").board.filter(Boolean).length));
  await page.locator("#menu").click();await expect(page.locator("#resume")).toHaveText("Продолжить задачу за 19 ноября");await page.locator("#resume").click();
  // Solve the real generated daily board using the existing verified solver.
  for(const step of daily("2026-11-19").solution)await move(page,step.a,step.b);
  await expect(page.locator("#win h1")).toHaveText("Задача за 19 ноября решена");
  const done=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).done,key);expect(done).toContain("daily-v1-2026-11-19");expect(done).not.toContain("daily-v1-2026-11-20");
  await page.reload();await page.locator("#resume").click();await expect(page.locator("#win h1")).toHaveText("Задача за 19 ноября решена");
  await page.locator("#menu").click();await page.locator("#calendar-open").click();
  await expect(page.locator('[data-game="daily-v1-2026-11-19"]')).toHaveClass(/done/);
  await expect(page.locator('[data-game="daily-v1-2026-11-20"]')).not.toHaveClass(/done/);
  await page.locator('[data-game="daily-v1-2026-11-19"]').click();await expect(page.locator("#mode")).toContainText("19 ноября");await expect(page.locator("#remaining")).toHaveText(String(daily("2026-11-19").board.filter(Boolean).length));
  for(const step of daily("2026-11-19").solution)await move(page,step.a,step.b);
  await expect(page.locator("#win h1")).toHaveText("Задача за 19 ноября решена");
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).done.filter((x:string)=>x==="daily-v1-2026-11-19").length,key)).toBe(1);
  await page.locator("#menu").click();await page.locator("#calendar-open").click();await page.locator("#today-task").click();
  await expect(page.locator("#mode")).toHaveText("Задача дня · 20 ноября");
  const first=daily("2026-11-20").solution[0];await move(page,first.a,first.b);
  await page.locator("#menu").click();await expect(page.locator("#resume")).toHaveText("Продолжить задачу дня");await page.locator("#resume").click();
  for(const step of daily("2026-11-20").solution.slice(1))await move(page,step.a,step.b);
  await expect(page.locator("#win h1")).toHaveText("Задача дня решена");
});

test("today's completed field names the archived task that the next action opens", async ({page}) => {
  const todayId = "daily-v1-2026-11-22", target = "daily-v1-2026-11-21";
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
  await page.addInitScript(({key,settings,todayId})=>{
    localStorage.setItem(settings,JSON.stringify({tutorialDone:true}));
    localStorage.setItem(key,JSON.stringify({
      version:3,active:todayId,done:[],seen:[],hints:{},
      sessions:{[todayId]:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]}},
    }));
  },{key,settings,todayId});
  await page.goto("/");
  await page.locator("#resume").click();
  await move(page,0,1);
  await expect(page.locator("#win h1")).toHaveText("Задача дня решена");
  await expect(page.locator("#award .trophy-heading")).toContainText("1 из 30");
  const next = page.locator("#play-again");
  await expect(next).toHaveText("Задача из архива · 21 ноября");
  await next.click();
  await expect(page.locator("#mode")).toHaveText("Задача из архива · 21 ноября");
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).active,key)).toBe(target);
});

for(const height of [520,568])test(`returning short course command fully visible at 320x${height} and 200%`,async({page})=>{
  await page.setViewportSize({width:320,height});await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({tutorialDone:false})),settings);
  await page.goto("/");await expect(page.locator("#lesson-text")).toHaveText("Нажмите на две четвёрки.");await scale(page,2);
  await fullyVisible(page,"#lesson-text","#lesson");const top=await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top);
  await digit(page,0);await digit(page,1);await click(page,"#lesson-next","#lesson-actions");
  await expect(page.locator("#lesson-text")).toHaveText("Соедините 3 и 7.");await fullyVisible(page,"#lesson-text","#lesson");
  expect(Math.abs(await page.locator("#viewport").evaluate(e=>e.getBoundingClientRect().top)-top)).toBeLessThanOrEqual(1);
});

const edgeRoute = [
  [[4,14],[5,7],[8,17],[0,2]],
  [[7,15],[2,8],[3,4],[7,8]],
  [[2,3],[4,14],[5,15],[6,16],[0,2]],
  [[1,11],[6,7],[4,8],[1,4],[7,8]],
  [[2,11],[3,4],[5,13],[15,16],[12,17]],
];

for (const [first, second] of [[6, 10], [10, 6]]) {
  test(`first required reading-order pair in task 5, starting at ${first}`, async ({page}) => {
    await start(page);
    for (const [index, route] of edgeRoute.entries()) {
      let board = notebook[index].board;
      for (const [a, b] of route) {
        expect(pairs(board)).toContainEqual({a, b, kind: "straight"});
        await move(page, a, b);
        board = removePair(board, a, b);
      }
      if (index === 4) {
        expect(pairs(board)).toEqual([{a:6, b:10, kind:"reading"}]);
      } else {
        await page.locator("#play-again").click();
        await expect(page.locator("#mode")).toContainText(`задача ${index + 2}`);
        await expect(page.locator("#remaining")).toHaveText(String(notebook[index + 1].board.filter(Boolean).length));
      }
    }

    const status = page.locator("#status");
    const seen = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).seen, key);
    await expect(status).toHaveText("От правого края — в начало строки ниже.");
    expect(await seen()).not.toContain("reading");
    await page.reload();
    await page.locator("#resume").click();
    await expect(status).toHaveText("От правого края — в начало строки ниже.");
    await digit(page, first);
    await expect(status).toHaveText("От правого края — в начало строки ниже.");
    await expect(page.locator("#paths path, #board .hinted")).toHaveCount(0);
    if (first === 10) {
      await page.locator("#hint").click();
      await expect(status).toContainText("2 и 2");
      await expect(page.locator("#paths path")).toHaveCount(2);
      await digit(page, first);
    }
    await digit(page, second);
    await expect(page.locator("#win")).toBeVisible();
    await expect.poll(seen).toContain("reading");

    await page.locator("#book-top").click();
    await page.locator('[data-game="book-v1-5"]').click();
    await expect(page.locator("#remaining")).toHaveText("12");
    for (const [a, b] of edgeRoute[4]) await move(page, a, b);
    expect(await status.textContent()).not.toContain("От правого края");
    await expect(page.locator("#remaining")).toHaveText("2");
  });
}

test("landscape 568×320 at 200% fits the first command and required pair explanations", async ({page}) => {
  await page.setViewportSize({width:568, height:320});
  await start(page);
  // The native ad slot applies its layout even when the device is offline.
  await page.evaluate(() => document.documentElement.classList.add("has-mobile-ads"));
  await scale(page, 2);
  const geometry = () => page.locator("#viewport").boundingBox();
  const before = await geometry();
  await fullyVisible(page, ".opening-copy", "#page-progress");
  await fullyVisible(page, ".opening-copy", ".game-top");
  await page.screenshot({path:"test-results/first-session/landscape-opening-200.png"});
  // Without scrolling, tap a digit on each row and check the menu at the end.
  await click(page, '#board [data-index="4"]');
  await expect(cue(page)).toContainText("9 + 1 = 10");
  await fullyVisible(page, ".opening-copy", "#page-progress");
  await fullyVisible(page, ".opening-copy", ".game-top");
  await page.screenshot({path:"test-results/first-session/landscape-nine-200.png"});
  expect(await geometry()).toEqual(before);
  await click(page, '#board [data-index="4"]');
  await move(page, 8, 17);
  await move(page, 4, 5);
  await expect(cue(page)).toHaveText("Пустые клетки можно пропускать.");
  await fullyVisible(page, ".opening-copy", "#page-progress");
  await fullyVisible(page, ".opening-copy", ".game-top");
  await move(page, 9, 11);
  await expect(cue(page)).toHaveText("От правого края — в начало строки ниже.");
  await fullyVisible(page, ".opening-copy", "#page-progress");
  await fullyVisible(page, ".opening-copy", ".game-top");
  expect(await geometry()).toEqual(before);
  await click(page, "#menu");
  await expect(page.locator("#dialog")).toBeVisible();
});

test("the first required edge in task 5 explains the route at 568×320 and 200%", async ({page}) => {
  const active = notebook[4].id;
  let board = notebook[4].board;
  for (const [a,b] of edgeRoute[4]) board = removePair(board,a,b);
  await page.addInitScript(({key,settings,active,board}) => {
    localStorage.setItem(settings,JSON.stringify({tutorialDone:true}));
    localStorage.setItem(key,JSON.stringify({version:3,active,done:[],seen:[],hints:{},sessions:{
      [active]:{rules:1,current:{board,scroll:0,moves:5,additions:0},history:[]},
    }}));
  },{key,settings,active,board});
  await page.setViewportSize({width:568,height:320});
  await page.goto("/");
  await page.locator("#resume").click();
  await page.evaluate(() => document.documentElement.classList.add("has-mobile-ads"));
  await scale(page,2);
  await expect(page.locator(".game")).toHaveClass(/docked-actions/);
  const field = await page.locator("#viewport").boundingBox();
  await expect(page.locator("#status")).toHaveText("От правого края — в начало строки ниже.");
  await fullyVisible(page,"#status",".status-wrap");
  await fullyVisible(page,"#status",".game-actions");
  await digit(page,10);
  await expect(page.locator("#paths path")).toHaveCount(0);
  expect(await page.locator("#viewport").boundingBox()).toEqual(field);
  await digit(page,6);
  await expect(page.locator("#win")).toBeVisible();
});

for (const trigger of ["timer", "focus"]) {
  test(`midnight relabels the open daily board on ${trigger} without changing play`, async ({page}) => {
    const beforeMidnight = new Date("2026-11-20T23:59:45+05:00");
    const afterMidnight = new Date("2026-11-21T00:00:05+05:00");
    await page.clock.install({time:beforeMidnight});
    await start(page);
    await page.locator("#menu").click();
    await page.locator("#daily-mode").click();
    const mode = page.locator("#mode");
    await expect(mode).toHaveText("Задача дня · 20 ноября");
    const {solution} = daily("2026-11-20");
    await move(page, solution[0].a, solution[0].b);
    const next = solution[1];
    // Make this five-row board scroll so the rollover exercises a nonzero offset.
    await page.locator("#viewport").evaluate(el => {el.style.maxHeight = "95px";});
    await digit(page, next.a);
    const selected = page.locator(`#board [data-index="${next.a}"]`);
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await page.locator("#viewport").evaluate(el => {el.scrollTop = el.scrollHeight;});
    await stable(page);

    const read = () => page.evaluate(k => {
      const saved = JSON.parse(localStorage.getItem(k)!);
      return {active:saved.active, game:saved.sessions[saved.active], scroll:document.querySelector("#viewport")!.scrollTop};
    }, key);
    const before = await read();
    expect(before.scroll).toBeGreaterThan(0);
    if (trigger === "timer") {
      await page.clock.fastForward(afterMidnight.getTime() - beforeMidnight.getTime());
    } else {
      await page.clock.setSystemTime(afterMidnight);
      await expect(mode).toHaveText("Задача дня · 20 ноября");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }
    await expect(mode).toHaveText("Задача из архива · 20 ноября");
    const after = await read();
    expect(after.active).toBe("daily-v1-2026-11-20");
    expect(after.game.current.board).toEqual(before.game.current.board);
    expect(after.game.packedHistory).toEqual(before.game.packedHistory);
    expect(after.scroll).toBe(before.scroll);
    await expect(selected).toHaveAttribute("aria-pressed", "true");

    await page.locator("#viewport").evaluate(el => {el.style.maxHeight = "";});
    await digit(page, next.b);
    await expect(page.locator("#remaining")).toHaveText(String(before.game.current.board.filter(Boolean).length - 2));
    for (const pair of solution.slice(2)) await move(page, pair.a, pair.b);
    await expect(page.locator("#win h1")).toHaveText("Задача за 20 ноября решена");
    const done = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).done, key);
    expect(done).toContain("daily-v1-2026-11-20");
    expect(done).not.toContain("daily-v1-2026-11-21");
  });
}
