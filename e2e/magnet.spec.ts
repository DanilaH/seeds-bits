import {test,expect,type Page} from "@playwright/test";
import fixture from "../fixtures/assistance/magnet-example.json" with {type:"json"};
import {install,key} from "./help-test-utils";
test.use({video:process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off"});
async function position(page:Page,charges=0,demo=false,state="ready") {
  await install(page,state,"magnet");
  await page.evaluate(({key,board,charges,demo})=>{
    const p=JSON.parse(localStorage.getItem(key)!);
    p.sessions.classic.current={board,scroll:0,moves:6,additions:0};p.sessions.classic.packedHistory=[];
    p.meta.attempts.classic.help={version:1,assisted:false};
    p.meta.help.inventory.magnet=charges;p.meta.help.demo.magnet=demo;
    localStorage.setItem(key,JSON.stringify(p));
  },{key,board:fixture.before,charges,demo});
  await page.reload();await page.locator("#resume").click();
}
async function data(page:Page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);}
async function preview(page:Page){await page.locator("#magnet").click();await expect(page.locator("#hint-offer")).toBeVisible();await expect(page.locator("#help-offer-copy")).toContainText("2 хода");}
test("M01/07/08/12/13: preview is reversible; demo, Undo, replay and ordinary completion",async({page})=>{
  await position(page);const before=await data(page);await preview(page);
  await expect(page.locator("#help-preview .magnet-mark")).toHaveCount(2);
  if(process.env.SEEDS_RECORD_HELP){await page.waitForTimeout(250);await page.screenshot({path:test.info().outputPath("magnet-preview.png")});await page.waitForTimeout(800);}
  await page.locator("#cancel-hints").click();expect(await data(page)).toEqual(before);
  await preview(page);await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");let p=await data(page);
  if(process.env.SEEDS_RECORD_HELP){await page.screenshot({path:test.info().outputPath("magnet-after.png")});await page.waitForTimeout(700);}
  expect(p.meta.help.demo.magnet).toBe(true);expect(p.sessions.classic.current.moves).toBe(6);expect(p.sessions.classic.current.assists).toBe(1);
  await page.locator("#undo").click();await expect(page.locator("#remaining")).toHaveText("6");
  await preview(page);await expect(page.locator("#watch-hints")).toHaveText("Повторить бесплатно");await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");
  for(const step of fixture.normal_continuation){await page.locator(`#board [data-index="${step.pair[0]}"]`).click();await page.locator(`#board [data-index="${step.pair[1]}"]`).click();await expect(page.locator("#remaining")).toHaveText(String(step.after.filter(Boolean).length));}
  await expect(page.locator("#win")).toBeVisible();p=await data(page);expect(p.meta.unassisted).toBe(0);expect(p.meta.attempts.classic.help.assisted).toBe(true);
});
test("M10: product-specific earned applies once and survives reload; next Magnet is limited",async({page})=>{
  await position(page,0,true);await preview(page);await page.locator("#watch-hints").click();await expect(page.locator("#qa-ad")).toBeVisible();await page.locator("#qa-ad").click();
  await expect(page.locator("#remaining")).toHaveText("4");let p=await data(page);
  expect(p.meta.wallet).toBe(0);expect(p.meta.help.inventory.magnet).toBe(0);expect(p.meta.rewardReceipts).toHaveLength(1);
  expect(p.meta.attempts.classic.help.magnet.applications).toHaveLength(1);
  await expect(page.locator("#magnet")).toBeDisabled();await page.reload();await page.locator("#resume").click();await page.locator("#undo").click();
  await preview(page);await page.locator("#watch-hints").click();await expect(page.locator("#remaining")).toHaveText("4");
  p=await data(page);expect(p.meta.attempts.classic.help.magnet.applications).toHaveLength(2);expect(p.meta.help.inventory.magnet).toBe(0);
});
test("M09/19: saved charge works with unavailable ads and does not request video",async({page})=>{
  await position(page,2,true,"unavailable");await preview(page);await expect(page.locator("#watch-hints")).toBeEnabled();await page.locator("#watch-hints").click();
  await expect(page.locator("#remaining")).toHaveText("4");expect((await data(page)).meta.help.inventory.magnet).toBe(1);
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
});
test("M18: old unfinished attempt waits for a new game",async({page})=>{
  await install(page,"ready","magnet");await expect(page.locator("#magnet")).not.toBeVisible();
});
test("M11: recovered Magnet from an old intent remains a charge in the new position",async({page})=>{
  await position(page,0,true);await preview(page);await page.locator("#watch-hints").click();
  await expect(page.locator("#qa-ad")).toBeVisible();
  await page.evaluate(()=>(window as any).earnNow());
  await expect.poll(async()=>(await data(page)).meta.help.inventory.magnet).toBe(1);
  await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);p.meta.attempts.classic={id:"replacement",completed:false,help:{version:1,assisted:false}};p.sessions.classic.current.board=[5,5];localStorage.setItem(k,JSON.stringify(p));},key);
  await page.reload();await page.locator("#resume").click();await expect(page.locator("#remaining")).toHaveText("2");
  expect((await data(page)).meta.help.inventory.magnet).toBe(1);expect((await data(page)).meta.wallet).toBe(0);
});
test("M09: failed application write does not consume demo, charge, limit or board",async({page})=>{
  await position(page,1,true);await preview(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="seeds-bits.progress.v2"&&JSON.parse(v).sessions.classic.current.assists)throw Error("assist disk failure");return original.call(this,k,v);};});
  await page.locator("#watch-hints").click();await expect(page.locator("#save-notice")).toBeVisible();
  const p=await data(page);expect(p.meta.help.inventory.magnet).toBe(1);expect(p.meta.attempts.classic.help.magnet).toBeUndefined();expect(p.sessions.classic.current.board).toEqual(fixture.before);
});
for(const [width,height] of [[320,568],[568,320]])test(`M/A20: preview actions and enlarged toolbar fit ${width}×${height}`,async({page})=>{
  await page.setViewportSize({width,height});await position(page);await preview(page);
  await page.addStyleTag({content:'#hint-offer p,#hint-offer button{font-size:22px!important}'});
  for(const id of ["watch-hints","cancel-hints"]){const action=page.locator('#'+id);await action.scrollIntoViewIfNeeded();const r=(await action.boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width+1);expect(r.y).toBeGreaterThanOrEqual(-1);expect(r.y+r.height).toBeLessThanOrEqual(height+1);}
  if(process.env.SEEDS_RECORD_HELP)await page.screenshot({path:test.info().outputPath("layout.png")});
});
