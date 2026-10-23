import { test, expect, type Page } from "@playwright/test";
import { notebook } from "../src/puzzles";
import { mkdirSync } from "node:fs";
test("capture every application screen", async ({ browser }) => {
  test.setTimeout(180000);
  const out="test-results/screen-gallery";
  mkdirSync(out,{recursive:true});
  const shot=async(page:Page,name:string)=>{
    await page.screenshot({path:out+"/"+name+".png",animations:"disabled"});
  };
  const cases: [string,string[]][]=[
    ["01-home",[]],
    ["02-classic",["#resume"]],
    ["03-notebooks",["#book-mode"]],
    ["04-notebook-game",["#book-mode","[data-game]"]],
    ["05-daily-game",["#daily-mode"]],
    ["06-calendar",["#calendar-open"]],
    ["07-progress",["#progress-open"]],
    ["08-jars",["#progress-open","#progress-trophies"]],
    ["09-month-trophies",["#progress-open","#progress-trophies","#trophies-mode"]],
    ["10-settings",["#settings-open"]],
    ["11-privacy",["#settings-open","#privacy-open"]],
    ["12-confirm-restart",["#settings-open","#new"]],
    ["13-tutorial",["#learn"]],
  ];
  for(const [name,actions] of cases){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
    const page=await context.newPage();
    await page.addInitScript(()=>localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true})));
    await page.goto("/");
    await expect(page.locator("#app")).not.toHaveAttribute("inert","");
    for(const action of actions) await page.locator(action).first().click();
    await shot(page,name);
    if(["03-notebooks","09-month-trophies","11-privacy"].includes(name)){
      await page.locator("#dialog").evaluate(e=>e.scrollTop=e.scrollHeight);
      await shot(page,name+"-bottom");
    }
    if(name==="13-tutorial"){
      let n=1;
      for(const [a,b] of [[0,1],[0,1],[0,3],[0,20],[8,9]]){
        await page.locator('[data-index="'+a+'"]').click();
        await page.locator('[data-index="'+b+'"]').click();
        await expect(page.locator("#lesson-next")).toBeEnabled();
        await page.locator("#lesson-next").click();
        await shot(page,"13-tutorial-step-"+(++n));
      }
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true})));
  await page.goto("/");
  await page.locator("#book-mode").click();
  await page.locator('[data-game="'+notebook[0].id+'"]').click();
  for(const p of notebook[0].solution){
    await page.locator('[data-index="'+p.a+'"]').click();
    await page.locator('[data-index="'+p.b+'"]').click();
    await expect(page.locator("#undo")).toBeEnabled();
  }
  await expect(page.locator("#win")).toBeVisible();
  await shot(page,"14-result");
  await context.close();
  for(const [label,viewport,dark] of [
    ["dark",{width:390,height:844},true],
    ["landscape",{width:844,height:390},false],
    ["tablet",{width:1280,height:800},false],
  ] as const){
    const c=await browser.newContext({viewport,reducedMotion:"reduce"});
    const p=await c.newPage();
    await p.addInitScript(dark=>localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,theme:dark?"dark":"light"})),dark);
    await p.goto("/");
    await shot(p,label+"-home");
    await p.locator("#book-mode").click();
    await shot(p,label+"-notebooks");
    await p.locator("[data-game]").first().click();
    await shot(p,label+"-game");
    await p.locator("#menu").click();
    await p.locator("#progress-open").click();
    await shot(p,label+"-progress");
    await c.close();
  }
});