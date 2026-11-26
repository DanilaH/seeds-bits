import {expect,test,type Page} from "@playwright/test";

const board=Array(45).fill(0);for(const [i,v] of [[0,4],[2,1],[4,6],[8,6],[9,2],[10,3],[20,8],[44,4]])board[i]=v;
async function boot(page:Page,lang="ru",dark=false) {
  await page.addInitScript(({board,lang,dark})=>{
    (window as any).__SEEDS_ADS_TEST__={
      initialize:async()=>({enabled:true,test:true,readiness:{state:"ready"}}),
      addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:"ready"}),
      preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),
      pending:async()=>({}),show:async()=>({status:"unavailable"}),
    };
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:lang,theme:dark?"dark":"light",sound:false,vibration:false}));
    localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({version:3,active:"classic",sessions:{classic:{rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]}},done:[],seen:[],hints:{},meta:{version:2,since:"2026-11-26",wallet:0,completed:0,unassisted:0,attempts:{classic:{id:"audit-reach",completed:false,hintKeys:["one","two","three"]}}}}));
  },{board,lang,dark});
  await page.goto("/");await page.evaluate(()=>document.documentElement.classList.add("has-mobile-ads"));
  await page.evaluate(()=>document.fonts.ready);
}
async function textFits(page:Page,selector:string) {
  const failures=await page.locator(selector).evaluateAll(elements=>elements.flatMap(el=>{
    if(!el.checkVisibility())return[];
    const box=el.getBoundingClientRect();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const failed:string[]=[];
    for(let node=walker.nextNode();node;node=walker.nextNode()) {
      if(!node.textContent?.trim() || !(node.parentElement?.checkVisibility()))continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const r of range.getClientRects())if(r.left<box.left-1 || r.right>box.right+1 || r.top<box.top-1 || r.bottom>box.bottom+1)failed.push(`${el.id||el.className}: ${node.textContent}`);
    }return failed;
  }));expect(failures).toEqual([]);
}
for(const [width,height] of [[320,568],[360,712],[390,844]])for(const lang of ["ru","en","es","tr","pt-BR"]) {
  test(`controls and paper contain text ${width} ${lang}`,async({page})=>{
    await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:"reduce"});await boot(page,lang);
    await textFits(page,"#home-notebook, #resume, .mode-nav button, .home-links button");
    await page.locator("#book-mode").click();await page.locator("#all-books").click();
    await expect(page.locator("#book-filter,#toggle-book-filter")).toHaveCount(0);
    await textFits(page,".volume-cover,.book-ranges button,.book-sections button");
    await page.locator('[data-book-range="4"]').click();await textFits(page,".volume-illustration");
    const ink=await page.locator('[data-volume="99"] .volume-illustration').evaluate(el=>{
      const box=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el.querySelector("strong")!);const r=range.getBoundingClientRect();
      return {left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top,width:box.width,height:box.height};
    });
    expect(ink.left).toBeGreaterThanOrEqual(ink.width*12/67);expect(ink.right).toBeLessThanOrEqual(ink.width*50/67);
    expect(ink.top).toBeGreaterThanOrEqual(ink.height*10/62);expect(ink.bottom).toBeLessThanOrEqual(ink.height*45/62);
    await page.locator("#book-section-themes").click();await textFits(page,".volume-cover,.volume-title");
    for(const title of await page.locator(".volume-title").all()) {
      const a=(await title.boundingBox())!,b=(await title.locator("..").locator(".volume-illustration").boundingBox())!;
      expect(a.y).toBeGreaterThanOrEqual(b.y+b.height);
    }
    await page.screenshot({path:`test-results/ui-audit12103/themes-${width}-${lang}.png`,animations:"disabled"});
    await page.locator("#collection-back").click();await page.locator("#collection-back").click();
    await page.locator("#resume").click();await page.locator("#hint").click();
    await expect(page.locator("#hint-offer")).toBeVisible();
    await textFits(page,"#hint-offer,.hint-copy,#hint-offer button");
    const inset=await page.locator(".hint-copy").evaluate(el=>{const s=getComputedStyle(el);return [s.paddingLeft,s.paddingRight,s.borderRadius];});
    expect(inset).toEqual(["12px","12px","10px"]);
    await expect(page.locator("#cancel-hints")).toBeInViewport();
    await page.screenshot({path:`test-results/ui-audit12103/hint-${width}-${lang}.png`,animations:"disabled"});
    await page.locator("#cancel-hints").click();await page.locator("#menu").click();
    await page.locator("#settings-open").click();await textFits(page,".settings-basics,.settings-rows button,#new");
    await page.locator("#settings-back").click();await page.locator("#pause-language").click();
    await textFits(page,"#language-sheet,.language-option");await page.keyboard.press("Escape");
    await page.locator("#classic-mode").click();await page.locator("#next-classic").click();
    await textFits(page,"#classic-new-sheet,.classic-difficulty-option");await page.keyboard.press("Escape");
    await page.locator("#calendar-open").click();
    await page.locator("#calendar-picker summary").click();await textFits(page,".calendar-layout,.calendar-nav button,#calendar-picker summary");
  });
}
for(const dark of [false,true])test(`reachability respects blockers, hints and selection dark=${dark}`,async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await boot(page,"ru",dark);await page.locator("#resume").click();
  const state=()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem("seeds-bits.progress.v2")!);return {sessions:p.sessions,hints:p.hints,wallet:p.meta.wallet,attempts:p.meta.attempts,inventory:p.meta.help.inventory,done:p.done};});
  const before=await state();
  await page.locator('[data-index="0"]').click();
  await expect(page.locator(".cell.reachable")).toHaveCount(3);
  expect(await page.locator(".cell.reachable").evaluateAll(es=>es.map(e=>Number((e as HTMLElement).dataset.index)))).toEqual([2,9,10]);
  await expect(page.locator('[data-index="20"]')).not.toHaveClass(/reachable/);
  expect(await state()).toEqual(before);
  await page.screenshot({path:`test-results/ui-audit12103/reach-${dark?"dark":"light"}.png`,animations:"disabled"});
  await page.locator('[data-index="0"]').click();await expect(page.locator(".cell.reachable")).toHaveCount(0);
  await page.locator('[data-index="8"]').click();await page.locator('[data-index="44"]').click();
  await expect(page.locator(".cell.reachable")).toHaveCount(0);
  await page.locator("#undo").click();await page.locator('[data-index="0"]').click();await expect(page.locator(".cell.reachable")).toHaveCount(3);
});
test("home ground shadow remains visible and follows the float, with stable target",async({page})=>{
  await boot(page);const target=page.locator("#home-notebook"),before=await target.boundingBox();
  const a=await target.evaluate(el=>{const s=getComputedStyle(el,"::before");return {height:parseFloat(s.height),background:s.backgroundImage,opacity:parseFloat(s.opacity),transform:s.transform};});
  expect(a.height).toBeGreaterThanOrEqual(20);expect(a.background).toContain("radial-gradient");expect(a.opacity).toBeGreaterThanOrEqual(.3);
  await target.evaluate(el=>{for(const a of el.getAnimations({subtree:true})){a.pause();a.currentTime=2500;}});
  const b=await target.evaluate(el=>getComputedStyle(el,"::before").transform);expect(b).not.toBe(a.transform);expect(await target.boundingBox()).toEqual(before);
  await page.screenshot({path:"test-results/ui-audit12103/home-shadow.png",animations:"allow"});
});

for(const lang of ["ru","en","es","tr","pt-BR"])test(`fresh menu text fits empty notebook ${lang}`,async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(lang=>localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:lang})),lang);
  await page.goto("/");await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator(".home-current")).toHaveAttribute("data-new-game","");
  await textFits(page,"#home-notebook,#resume,.mode-nav button,.home-links button");
});

test.describe("visual acceptance recording",()=>{
  test("records the home shadow, catalogue, reach and rewarded panel",async({browser})=>{
    const context=await browser.newContext({baseURL:"http://127.0.0.1:5173",viewport:{width:390,height:844},recordVideo:{dir:"test-results/ui-audit12103/recording",size:{width:390,height:844}}});
    const page=await context.newPage();
    await boot(page);await page.waitForTimeout(2600);
    await page.locator("#book-mode").click();await page.locator("#all-books").click();
    await page.waitForTimeout(1000);await page.locator("#book-section-themes").click();await page.waitForTimeout(1600);
    await expect(page.locator(".volume-title")).toHaveCount(4);
    await page.locator("#collection-back").click();await page.locator("#collection-back").click();await page.locator("#resume").click();
    await page.locator('[data-index="0"]').click();await expect(page.locator(".cell.reachable")).toHaveCount(3);await page.waitForTimeout(2000);
    await page.locator('[data-index="0"]').click();await page.locator('[data-index="10"]').click();await page.waitForTimeout(1700);
    await page.locator('[data-index="10"]').click();await page.locator("#hint").click();await expect(page.locator("#hint-offer")).toBeVisible();await page.waitForTimeout(1800);
    await page.locator("#cancel-hints").click();await page.locator("#menu").click();await page.waitForTimeout(600);
    const video=page.video()!;await page.close();await context.close();await video.saveAs("test-results/ui-audit12103/ui-and-reach.webm");
  });
});
