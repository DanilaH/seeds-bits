import {test,expect,type Page} from "@playwright/test";
import {install,key} from "./help-test-utils";
test.use({video:process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off"});
async function result(page:Page,profile="result",reason="not_loaded"){
 await install(page,"ready",profile);
 await page.evaluate(({key})=>{const p=JSON.parse(localStorage.getItem(key)!);p.sessions.classic.current.board=[];p.meta.attempts.classic.completed=true;localStorage.setItem(key,JSON.stringify(p));},{key});
 await page.reload();await page.locator("#resume").click();
 await page.evaluate(({reason,key})=>{const w=window as any;w.__SEEDS_ADS_TEST__.show=async(o:any)=>{w.requests.push({...o,saved:JSON.parse(localStorage.getItem(key)!).sessions.classic.current.board.length===0});return {status:"skipped",reason};};},{reason,key});
 await expect(page.locator("#win")).toBeVisible();
}
test("A4: unavailable result route starts task immediately; late loaded does not show; first entry recorded",async({page})=>{
 await result(page);await page.locator("#try-notebook").click();await expect(page.locator("#mode")).toContainText("Тетрадь");
 const calls=await page.evaluate(()=>(window as any).requests);expect(calls).toHaveLength(1);expect(calls[0].kind).toBe("interstitial");expect(calls[0].saved).toBe(true);
 await page.evaluate(()=>(window as any).setReady("ready"));await expect(page.locator("#qa-ad")).not.toBeVisible();expect(await page.evaluate(()=>(window as any).requests.length)).toBe(1);
 const events=await page.evaluate(()=>(window as any).events.filter((e:any)=>e.name==="result_transition"));expect(events.some((e:any)=>e.data.phase==="choice"&&e.data.first_short_task)).toBe(true);expect(events.some((e:any)=>e.data.phase==="result"&&e.data.reason==="not_loaded"&&!e.data.shown)).toBe(true);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).meta.flags.includes("result_short_task_seen"),key)).toBe(true);
});
test("A4 control: the new short-task route is off by default",async({page})=>{await result(page,"");await page.locator("#try-notebook").click();await expect(page.locator("#mode")).toContainText("Тетрадь");expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);});
for(const button of ["play-again","classic-easier","classic-harder"])test(`A4 shared policy: ${button} retains native cooldown reason`,async({page})=>{
 await result(page,"result","cooldown");await page.locator('#'+button).click();await expect(page.locator("#remaining")).not.toHaveText("0");expect(await page.evaluate(()=>(window as any).requests.length)).toBe(1);expect(await page.evaluate(()=>(window as any).events.some((e:any)=>e.name==="result_transition"&&e.data.reason==="cooldown"))).toBe(true);
});
test("A4: failed result save cannot request an ad or start the destination",async({page})=>{
 await result(page);await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="seeds-bits.progress.v2")throw Error("disk");return original.call(this,k,v);};});await page.locator("#try-notebook").click();await expect(page.locator("#save-notice")).toBeVisible();expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);await expect(page.locator("#win")).toBeVisible();
});
