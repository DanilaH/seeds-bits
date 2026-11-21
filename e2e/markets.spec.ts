import {expect,test,type BrowserContext,type Page} from "@playwright/test";
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
    await expect(status).toHaveText("From the right edge, continue at the left of the next row.");
    await page.evaluate(()=>{
      document.documentElement.classList.add("has-mobile-ads");
      const elements=[...document.querySelectorAll<HTMLElement>("body *")];
      const heights=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));
      elements.forEach((e,i)=>e.style.fontSize=heights[i]*2+"px");
    });
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const statusMetrics=await status.evaluate(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      const box=el.parentElement!.getBoundingClientRect();
      const lines=Array.from(range.getClientRects(),rect=>rect.toJSON());
      return {ok:lines.every(rect=>rect.top>=box.top-1&&rect.bottom<=box.bottom+1),box:box.toJSON(),lines,
        style:getComputedStyle(el).font, layout:document.querySelector(".game")!.className, rail:el.parentElement!.parentElement!.id};
    });
    expect(statusMetrics.ok,JSON.stringify(statusMetrics)).toBe(true);
    const [first,second]=reverse?[9,8]:[8,9];
    const box=await digit(page,first).evaluate(el=>{
      const viewport=document.querySelector("#viewport")!;
      const rect=el.getBoundingClientRect(), bounds=viewport.getBoundingClientRect();
      const delta=rect.top<bounds.top?rect.top-bounds.top:Math.max(0,rect.bottom-bounds.bottom);
      viewport.scrollBy({top:delta,behavior:"instant"});
      const within=el.getBoundingClientRect();
      return {x:within.x+within.width/2,y:within.y+within.height/2};
    });
    const view=await page.locator("#viewport").boundingBox();
    await page.mouse.click(box.x,box.y);
    await expect(digit(page,first)).toHaveClass(/selected/);
    await expect(status).toHaveText("From the right edge, continue at the left of the next row.");
    expect(await page.locator("#viewport").boundingBox()).toEqual(view);
    await openPicker(page);
    await choose(page,"es");
    await page.locator("#language-close").click();
    await page.locator("#settings-back").click();
    await page.locator("#resume").click();
    await expect(digit(page,first)).toHaveClass(/selected/);
    await expect(digit(page,first)).toHaveAttribute("aria-label",/fila/);
    await digit(page,second).click();
    await expect(page.locator("#win")).toBeVisible();
  });
}
