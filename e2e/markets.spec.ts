import { openBookPicker } from "./book-controls";
import {expect,test,type BrowserContext,type Locator,type Page} from "@playwright/test";
import fs from "node:fs";

type QAEvent={name:string;data:Record<string,unknown>};
async function setup(context:BrowserContext, locale:string, events:QAEvent[], preset?:number[]) {
  await context.exposeBinding("recordMarketEvent", (_source,event)=>events.push(event as QAEvent));
  await context.addInitScript(({locale,preset})=>{
    window.YaGames={init:async()=>({
      environment:{app:{id:"control-1"},i18n:{lang:locale}},
      features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},
    })};
    window.addEventListener("seeds:market-qa",(event)=>{
      void (window as typeof window & {recordMarketEvent: (event:unknown)=>Promise<void>})
        .recordMarketEvent((event as CustomEvent).detail);
    });
    if(preset && !localStorage.getItem("seeds-bits.progress.v2")) {
      localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true}));
      localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({
        version:3,active:"book-v1-5",done:[],seen:[],hints:{},
        sessions:{"book-v1-5":{rules:1,current:{board:preset,moves:0,additions:0,scroll:0},history:[]}},
      }));
    }
  },{locale,preset});
}
const digit=(page:Page,i:number)=>page.locator(`#board button[data-index="${i}"]`);
async function choose(page:Page, code:string) {
  await page.locator(`#language-options button[data-language="${code}"]`).click();
  await expect(page.locator(`#language-options button[data-language="${code}"]`)).toHaveAttribute("aria-pressed","true");
}
async function openPicker(page:Page) {
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  await expect(page.locator("#settings-panel .language-row")).toBeVisible();
  await page.locator("#language-open").click();
}
async function doubleText(page:Page) {
  await page.evaluate(()=>{
    const elements=[...document.querySelectorAll<HTMLElement>("body *")];
    const sizes=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));
    elements.forEach((e,i)=>e.style.fontSize=sizes[i]*2+"px");
  });
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function expectTextInside(text:Locator, boundary:Locator) {
  const box=(await boundary.boundingBox())!;
  const lines=await text.evaluate(el=>{
    const range=document.createRange();
    range.selectNodeContents(el);
    return Array.from(range.getClientRects(),r=>r.toJSON());
  });
  expect(lines.length).toBeGreaterThan(0);
  for(const line of lines) {
    const details=JSON.stringify({text:await text.textContent(),line,box});
    expect(line.left,details).toBeGreaterThanOrEqual(box.x-1);
    expect(line.right,details).toBeLessThanOrEqual(box.x+box.width+1);
    expect(line.top,details).toBeGreaterThanOrEqual(box.y-1);
    expect(line.bottom,details).toBeLessThanOrEqual(box.y+box.height+1);
  }
}
async function touchDigit(page:Page,index:number) {
  const point=await digit(page,index).evaluate(el=>{
    const rect=el.getBoundingClientRect();
    const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
    return {x,y,visible:el.contains(document.elementFromPoint(x,y))};
  });
  expect(point.visible,JSON.stringify(point)).toBe(true);
  await page.mouse.click(point.x,point.y);
}
test("portal language before play, two tabs and switching with the same selection and Undo",async({page,context},testInfo)=>{
  const events:QAEvent[]=[];
  await setup(context,"en",events);
  await page.clock.setFixedTime(new Date("2026-11-19T04:00:00Z"));
  await page.goto("/");
  await expect(page.locator(".opening-copy")).toHaveText("Tap any number.");
  await expect.poll(()=>events.filter(e=>e.name==="web_first_play").length).toBe(1);
  await digit(page,8).click();
  const value=await digit(page,8).textContent();
  await expect(digit(page,8)).toHaveClass(/selected/);
  await openPicker(page);
  await page.locator("#language-close").click();
  await expect.poll(()=>events.filter(e=>e.name==="language_picker_open").length).toBe(1);
  expect(events.filter(e=>e.name==="language_changed")).toHaveLength(0);
  await page.locator("#language-open").click();
  await choose(page,"ru");
  await expect(page.locator("html")).toHaveAttribute("lang","ru");
  await page.locator("#language-close").click();
  await page.locator("#settings-back").click();
  await page.locator("#resume").click();
  await expect(digit(page,8)).toHaveText(value!);
  await expect(digit(page,8)).toHaveClass(/selected/);
  await digit(page,17).click();
  await expect(page.locator("#remaining")).toHaveText("6");
  const savedDigit=()=>page.evaluate(()=>{
    const progress=JSON.parse(localStorage.getItem("seeds-bits.progress.v2")??"{}");
    return progress.sessions?.["book-v1-1"]?.current?.board?.[8];
  });
  await expect.poll(savedDigit).toBe(0);
  await page.locator("#undo").click();
  await expect(page.locator("#remaining")).toHaveText("8");
  // The board updates immediately. Leave the page after its queued save has reached storage.
  await expect.poll(savedDigit).toBe(Number(value));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang","ru");
  await page.locator("#resume").click();
  await openPicker(page);
  await choose(page,"auto");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
  await page.locator("#language-close").click();
  await page.locator("#settings-back").click();
  await page.locator("#resume").click();
  for(const [a,b,n] of [[8,17,6],[4,5,4],[9,11,2],[7,14,0]]) {
    await digit(page,a).click();
    await digit(page,b).click();
    await expect(page.locator("#remaining")).toHaveText(String(n));
  }
  await page.locator("#play-again").click();
  await expect(page.locator("#mode")).toContainText("Puzzle 2");
  await digit(page,7).click();
  await digit(page,15).click();
  await expect.poll(()=>events.some(e=>e.name==="first_unassisted_pair")).toBe(true);
  await expect.poll(()=>events.some(e=>e.name==="game_complete")).toBe(true);
  const other=await context.newPage();
  await other.clock.setFixedTime(new Date("2026-11-20T04:00:00Z"));
  await other.goto("/");
  await other.locator("#resume").click();
  await expect(other.locator("html")).toHaveAttribute("lang","en");
  await expect.poll(()=>events.filter(e=>e.name==="language_changed").length).toBe(2);
  await expect.poll(()=>events.some(e=>e.name==="web_session_open"&&e.data.activity_day==="2026-11-20")).toBe(true);
  expect(events.filter(e=>e.name==="web_first_play")).toHaveLength(1);
  const event=events.find(e=>e.name==="web_first_play")!;
  expect(event.data).toMatchObject({surface:"web",portal_id:"yandex_games",portal_evidence:"sdk",requested_locale:"en",ui_language:"en",storage_scope:"persistent"});
  fs.writeFileSync(testInfo.outputPath("portal-control.json"),JSON.stringify({events,installations:[]},null,2));
});
for (const [signal,language,command] of [
  ["es-MX","es","Toca cualquier número."],["tr-TR","tr","Herhangi bir sayıya dokun."],
  ["pt-PT","pt-BR","Toque em qualquer número."],["kk","ru","Нажмите любую цифру."],
  ["nl-NL","en","Tap any number."],
])test(`automatic ${signal} shows ${language}`,async({page,context})=>{
  const events:QAEvent[]=[];
  await setup(context,signal,events);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang",language);
  await expect(page.locator(".opening-copy")).toHaveText(command);
  await expect.poll(()=>events.some(e=>e.name==="web_first_play")).toBe(true);
  expect(events.find(e=>e.name==="web_first_play")?.data.requested_locale).toBe(signal==="nl-NL"?"nl":signal);
});

for(const [width,height] of [[320,568],[568,320]])for(const reverse of [false,true]) {
  test(`200 percent edge and in-place language change ${width}x${height}, reverse=${reverse}`,async({page,context})=>{
    const board=[...Array(8).fill(0),6,4], log:QAEvent[]=[];
    await setup(context,"en",log,board);
    await page.setViewportSize({width,height});
    await page.goto("/");
    await page.locator("#resume").click();
    const status=page.locator("#status");
    await expect(status).toHaveText("At the right edge, go to the next row’s left.");
    await page.evaluate(()=>document.documentElement.classList.add("has-mobile-ads"));
    await doubleText(page);
    const statusMetrics=await status.evaluate(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      const box=el.parentElement!.getBoundingClientRect();
      const lines=Array.from(range.getClientRects(),rect=>rect.toJSON());
      return {ok:lines.every(rect=>rect.top>=box.top-1&&rect.bottom<=box.bottom+1),box:box.toJSON(),lines,
        style:getComputedStyle(el).font, layout:document.querySelector(".game")!.className, rail:el.parentElement!.parentElement!.id};
    });
    expect(statusMetrics.ok,JSON.stringify(statusMetrics)).toBe(true);
    const [first,second]=reverse?[9,8]:[8,9];
    const scroll=()=>page.locator("#viewport").evaluate(el=>el.scrollTop);
    const view=await page.locator("#viewport").boundingBox();
    await touchDigit(page,first);
    await expect(digit(page,first)).toHaveClass(/selected/);
    await expect(status).toHaveText("At the right edge, go to the next row’s left.");
    expect(await page.locator("#viewport").boundingBox()).toEqual(view);
    expect(await scroll()).toBe(0);
    await openPicker(page);
    await choose(page,"es");
    await page.locator("#language-close").click();
    await page.locator("#settings-back").click();
    await page.locator("#resume").click();
    await expect(digit(page,first)).toHaveClass(/selected/);
    await expect(digit(page,first)).toHaveAttribute("aria-label",/fila/);
    expect(await scroll()).toBe(0);
    await touchDigit(page,second);
    await expect(page.locator("#win")).toBeVisible();
  });
}

for(const [first,second] of [[7,14],[14,7]]) {
  test(`audit 12070: first notebook edge at 200 percent, ${first} → ${second}`,async({page,context})=>{
    await setup(context,"en",[]);
    await page.setViewportSize({width:320,height:568});
    await page.goto("/");
    const cue=page.locator(".opening-copy"), rail=page.locator("#page-progress");
    await expect(cue).toHaveText("Tap any number.");
    await page.evaluate(()=>document.documentElement.classList.add("has-mobile-ads"));
    await doubleText(page);
    for(const [a,b,n] of [[8,17,6],[4,5,4],[9,11,2]]) {
      await touchDigit(page,a);
      await touchDigit(page,b);
      await expect(page.locator("#remaining")).toHaveText(String(n));
    }
    const viewport=page.locator("#viewport"), before=await viewport.boundingBox();
    await expect(cue).toHaveText("At the right edge, go to the next row’s left.");
    await expectTextInside(cue,rail);
    await touchDigit(page,first);
    await expect(digit(page,first)).toHaveClass(/selected/);
    await expect(cue).toHaveText(first===7?"Find 9: 1 + 9 = 10.":"Find 1: 9 + 1 = 10.");
    await expectTextInside(cue,rail);
    expect(await viewport.boundingBox()).toEqual(before);
    expect(await viewport.evaluate(el=>el.scrollTop)).toBe(0);
    await touchDigit(page,second);
    await expect(page.locator("#win")).toBeVisible();
  });
}

for(const [language,otherDays,today,archive,undo] of [
  ["es","Otros días","Reto diario · 22 de noviembre","Reto del archivo · 13 de noviembre","Deshacer"],
  ["pt-BR","Outros dias","Desafio do dia · 22 de novembro","Desafio do arquivo · 13 de novembro","Desfazer"],
]) {
  test(`audit 12070: readable daily and archive on ${language}`,async({page,context})=>{
    await setup(context,language,[]);
    await page.setViewportSize({width:320,height:568});
    await page.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
    await page.goto("/");
    await page.locator("#menu").click();
    await expect(page.locator("#calendar-open")).toHaveAccessibleName(otherDays);
    await page.locator("#daily-mode").click();
    const mode=page.locator("#mode"), action=page.locator("#undo");
    for(const label of [today,archive]) {
      await expect(mode).toHaveText(label);
      await expect(action).toHaveAccessibleName(undo);
      await expect(action.locator("span")).toHaveText(undo);
      await expectTextInside(mode,page.locator(".game-meta"));
      await expectTextInside(action.locator("span"),action);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
      if(label===today) {
        await doubleText(page);
        await expectTextInside(mode,page.locator(".game-meta"));
        await expectTextInside(action.locator("span"),action);
        await page.locator("#menu").click();
        await page.locator("#calendar-open").click();
        await page.locator('[data-game="daily-v1-2026-11-13"]').click();
      }
    }
  });
}

for(const [language,otherDays] of [
  ["en","Other days"],["es","Otros días"],["tr","Diğer günler"],["pt-BR","Outros dias"],
]) {
  test(`audit 12070: Other days on a clean profile and during play on ${language}`,async({page,context})=>{
    await setup(context,language,[]);
    await page.goto("/");
    await touchDigit(page,8);
    await openPicker(page);
    const title=page.locator("#calendar-open");
    await expect(title).toHaveText(otherDays);
    await choose(page,"ru");
    await expect(title).toHaveText("Другие дни");
    await choose(page,language);
    await page.locator("#language-close").click();
    await page.locator("#settings-back").click();
    await expect(title).toHaveAccessibleName(otherDays);
    await page.locator("#resume").click();
    await expect(digit(page,8)).toHaveClass(/selected/);
  });
}

test("audit 12070: notebook numbers and completed streak accessible names",async({page,context})=>{
  await setup(context,"en",[]);
  await context.addInitScript(()=>{
    localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({
      version:3,active:"book-v1-1",done:["book-v1-25"],seen:[],sessions:{},hints:{},
      meta:{version:2,since:"2026-11-21T00:00:00Z",wallet:0,attempts:{},completed:1,unassisted:1,
        daily:{lastDay:"2026-11-21",count:1,best:1,reward:0}},
    }));
  });
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
  await page.goto("/");
  if(!await page.locator("#dialog").evaluate(el=>(el as HTMLDialogElement).open)) {
    await page.locator("#menu").click();
  }
  await page.locator("#book-mode").click();
  await openBookPicker(page);
  await page.locator('[data-volume="1"]').click();
  const first=page.locator('[data-game="book-v1-25"]');
  await expect(first).toHaveText("1✓");
  await expect(first).toHaveAccessibleName("Puzzle 1, solved");
  await page.locator("#book-later-pages > summary").click();
  await expect(page.locator('[data-game="book-v1-48"]')).toHaveAccessibleName("Puzzle 24");
  await first.click();
  await expect(page.locator("#mode")).toHaveText("Puzzle book 2 · Puzzle 1");
  await page.locator("#menu").click();
  await page.locator("#calendar-open").click();
  await page.locator("#calendar-extras > summary").click();
  await expect(page.locator(".run-days .done")).toHaveAttribute("aria-label","Day 1, counted");
});
