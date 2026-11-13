import {test,expect,type Page} from "@playwright/test";
import {install,key} from "./help-test-utils";
test.use({video:process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off"});
const board=[5,5,0,0,0,0,0,0,0,7,3,2,8];
async function data(page:Page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);}
async function position(page:Page,charges=0,demo=false,state="ready"){
  await install(page,state,"plan");
  await page.evaluate(({key,board,charges,demo})=>{const p=JSON.parse(localStorage.getItem(key)!);p.sessions.classic.current={board,scroll:0,moves:0,additions:0};p.sessions.classic.packedHistory=[];p.meta.attempts.classic.help={version:1,assisted:false};p.meta.help.inventory.plan=charges;p.meta.help.demo.plan=demo;localStorage.setItem(key,JSON.stringify(p));},{key,board,charges,demo});
  await page.reload();await page.locator("#resume").click();
}
async function preview(page:Page){await page.locator("#plan").click();await expect(page.locator("#hint-offer-title")).toHaveText("План на 3 хода");await expect(page.locator("#help-offer-copy")).toContainText("Очистить поле");}
async function pair(page:Page,a:number,b:number,remaining:number){await page.locator(`#board [data-index="${a}"]`).click();await page.locator(`#board [data-index="${b}"]`).click();await expect(page.locator("#remaining")).toHaveText(String(remaining));}
test("P01/05/06/09/10: preview, demo, complete player-driven plan with compaction, Undo and reload",async({page})=>{
  await position(page);const before=await data(page);await preview(page);await expect(page.locator("#board .hinted")).toHaveCount(0);await page.locator("#cancel-hints").click();expect(await data(page)).toEqual(before);
  await preview(page);if(process.env.SEEDS_RECORD_HELP)await page.waitForTimeout(800);await page.locator("#watch-hints").click();await expect(page.locator("#board .hinted")).toHaveCount(2);
  await expect(page.locator("#remaining")).toHaveText("6");const p=await data(page),path=p.meta.attempts.classic.help.plan.intent.proof;expect(p.meta.help.demo.plan).toBe(true);
  await pair(page,...path[0] as [number,number],4);await expect(page.locator("#plan-count")).toHaveText("2/3");
  await page.locator("#undo").click();await expect(page.locator("#plan-count")).toHaveText("1/3");
  await page.reload();await page.locator("#resume").click();await expect(page.locator("#board .hinted")).toHaveCount(2);
  for(let i=0;i<path.length;i++){if(process.env.SEEDS_RECORD_HELP)await page.waitForTimeout(650);await pair(page,...path[i] as [number,number],4-i*2);}
  await expect(page.locator("#win")).toBeVisible();const q=await data(page);expect(q.meta.unassisted).toBe(0);expect(q.meta.help.inventory.plan).toBe(0);expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
});
test("P07: deviation hides path; exact Undo resumes freely and hint never charges for plan step",async({page})=>{
  await position(page,2,true);await preview(page);await page.locator("#watch-hints").click();await pair(page,11,12,4);await expect(page.locator("#board .hinted")).toHaveCount(0);await expect(page.locator("#status")).toContainText("возврата");await expect(page.locator("#plan")).toBeDisabled();
  await page.reload();await page.locator("#resume").click();await page.locator("#undo").click();await expect(page.locator("#board .hinted")).toHaveCount(2);await page.locator("#hint").click();expect((await data(page)).meta.wallet).toBe(0);expect((await data(page)).meta.help.inventory.plan).toBe(1);
});
test("P05: one earned pays the whole plan, duplicate listeners and reload do not debit twice",async({page})=>{
  await position(page,0,true);await preview(page);await page.locator("#watch-hints").click();await page.locator("#qa-ad").click();await expect(page.locator("#board .hinted")).toHaveCount(2);let p=await data(page);expect(p.meta.rewardReceipts).toHaveLength(1);expect(p.meta.help.inventory.plan).toBe(0);expect(p.meta.wallet).toBe(0);
  await page.reload();await page.locator("#resume").click();await expect(page.locator("#board .hinted")).toHaveCount(2);p=await data(page);expect(p.meta.help.inventory.plan).toBe(0);expect(p.meta.attempts.classic.help.plan.applications).toHaveLength(1);
});
test("P08: earned on a replaced attempt remains a stored plan charge",async({page})=>{
  await position(page,0,true);await preview(page);await page.locator("#watch-hints").click();await expect(page.locator("#qa-ad")).toBeVisible();await page.evaluate(()=>(window as any).earnNow());await expect.poll(async()=>(await data(page)).meta.help.inventory.plan).toBe(1);
  await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);p.meta.attempts.classic={id:"new-plan-attempt",completed:false,help:{version:1,assisted:false}};p.sessions.classic.current.board=[5,5];localStorage.setItem(k,JSON.stringify(p));},key);await page.reload();await page.locator("#resume").click();await expect(page.locator("#board .hinted")).toHaveCount(0);expect((await data(page)).meta.help.inventory.plan).toBe(1);
});
test("P04/10: failed durable disclosure retains the charge and leaves preview unassisted",async({page})=>{
  await position(page,1,true,"unavailable");await preview(page);await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="seeds-bits.progress.v2"&&JSON.parse(v).meta.attempts.classic.help.plan)throw Error("plan disk failure");return original.call(this,k,v);};});await page.locator("#watch-hints").click();await expect(page.locator("#save-notice")).toBeVisible();const p=await data(page);expect(p.meta.help.inventory.plan).toBe(1);expect(p.meta.attempts.classic.help.assisted).toBe(false);await expect(page.locator("#board .hinted")).toHaveCount(0);
});
