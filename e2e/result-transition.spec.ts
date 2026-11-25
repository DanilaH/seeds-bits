import { test, expect, type Page } from "@playwright/test";
import { install, key } from "./help-test-utils";

test.use({ video:process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off" });

async function result(page: Page, profile: string, reason: string) {
  await page.emulateMedia({ reducedMotion:"reduce" });
  await install(page,"ready",profile);
  await page.evaluate(key => {
    const save = JSON.parse(localStorage.getItem(key)!);
    save.sessions.classic.current.board = [5,5];
    localStorage.setItem(key,JSON.stringify(save));
  },key);
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator("#dialog")).toBeHidden();
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.evaluate(({reason,key}) => {
    const qa = window as any;
    qa.__SEEDS_ADS_TEST__.show = async (options: any) => {
      const profile = JSON.parse(localStorage.getItem(key)!);
      qa.requests.push({...options,saved:profile.sessions.classic.current.board.filter(Boolean).length === 0});
      return {status:"skipped",reason};
    };
  },{reason,key});
  await page.locator('#board [data-index="0"]').click();
  await page.locator('#board [data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
}

test("QA short route preserves the result when an ad is unavailable and never shows it late",async({page})=>{
  await result(page,"result","not_loaded");
  await page.locator("#try-notebook").click();
  await expect(page.locator("#mode")).toContainText("Тетрадь");
  const calls=await page.evaluate(()=>(window as any).requests);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({kind:"interstitial",saved:true,route:"short"});
  await page.evaluate(()=>(window as any).setReady("ready"));
  await expect(page.locator("#qa-ad")).not.toBeVisible();
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(1);
});

test("baseline Classic only offers Home and retains the native cooldown reason",async({page})=>{
  await result(page,"baseline","cooldown");
  await expect(page.locator("#result-actions button:visible")).toHaveCount(1);
  await expect(page.locator("#try-notebook")).toBeHidden();
  await expect(page.locator("#play-again")).toHaveText("В меню");
  await page.locator("#play-again").click();
  await expect(page.locator("#menu-content")).toBeVisible();
  expect(await page.evaluate(()=>(window as any).requests)).toMatchObject([{route:"classic-result-home",saved:true}]);
  expect(await page.evaluate(()=>(window as any).events.some((e:any)=>e.name==="result_transition"&&e.data.reason==="cooldown"))).toBe(true);
});

test("failed result navigation cannot request an ad or start the destination",async({page})=>{
  await result(page,"result","not_loaded");
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="seeds-bits.progress.v2") throw Error("disk");
      return original.call(this,key,value);
    };
  });
  await page.locator("#try-notebook").click();
  await expect(page.locator("#save-notice")).toBeVisible();
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
  await expect(page.locator("#win")).toBeVisible();
});
