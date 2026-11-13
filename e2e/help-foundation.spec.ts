import {test, expect, type Page} from "@playwright/test";
import {install, watch, wallet, key} from "./help-test-utils";
test.use({video:process.env.SEEDS_RECORD_HELP === "1" ? "on" : "off"});
test("A01–03: earned auto-opens the exact promised hint, debits once and reload repeats freely",async({page})=>{
  await install(page); await watch(page); await page.locator("#qa-ad").click();
  await expect.poll(()=>wallet(page)).toBe(2); await expect(page.locator("#board .hinted")).toHaveCount(2);
  if(process.env.SEEDS_RECORD_HELP){await page.screenshot({path:test.info().outputPath("hint-auto.png")});await page.waitForTimeout(900);}
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).meta,key);
  expect(before.rewardReceipts).toHaveLength(1);expect(before.attempts.classic.hintKeys).toHaveLength(4);
  await page.reload();await page.locator("#resume").click();await page.locator("#hint").click();
  await expect(page.locator("#board .hinted")).toHaveCount(2);expect(await wallet(page)).toBe(2);
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
});
test("A16: loading offers remain closable and late readiness never auto-shows",async({page})=>{
  await install(page,"loading");await page.locator("#hint").click();await expect(page.locator("#watch-hints")).toBeDisabled();
  await expect(page.locator("#rewarded-state")).toContainText("загружается");await page.locator("#cancel-hints").click();
  await page.evaluate(()=>(window as any).setReady("ready"));await expect(page.locator("#hint-offer")).not.toBeVisible();
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
});
test("A04/09: process recreation grants to inventory without touching a newer attempt",async({page})=>{
  await install(page);await watch(page);await page.evaluate(()=>{(window as any).earnNow();});
  await expect.poll(()=>wallet(page)).toBe(3);
  await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);p.meta.attempts.classic={id:"new-attempt",completed:false};p.sessions.classic.current.board=[1,1];localStorage.setItem(k,JSON.stringify(p));},key);
  await page.reload();await page.locator("#resume").click();expect(await wallet(page)).toBe(3);
  await expect(page.locator("#remaining")).toHaveText("2");await expect(page.locator("#board .hinted")).toHaveCount(0);
});
test("A10: closing without earned leaves the game usable and inventory unchanged",async({page})=>{
  await install(page);await page.evaluate(()=>(window as any).closeOnly=true);await watch(page);await page.locator("#qa-ad").click();
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");expect(await wallet(page)).toBe(0);
  await page.locator('#board [data-index="0"]').click();await page.locator('#board [data-index="1"]').click();await expect(page.locator("#remaining")).toHaveText("16");
});
test("A19: visibility is isolated and an already purchased pair remains ordinary",async({page})=>{
  await install(page,"ready","a3");await expect(page.locator("#hint")).toHaveAccessibleName(/3 подсказки за просмотр/);
  await watch(page);await page.locator("#qa-ad").click();await expect.poll(()=>wallet(page)).toBe(2);
  await expect(page.locator("#hint")).not.toHaveAccessibleName(/за просмотр/);
});
test("A07: a failed reveal write retains all three earned credits",async({page})=>{
  await install(page);await watch(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="seeds-bits.progress.v2"&&JSON.parse(v).meta.wallet===2)throw Error("reveal disk failure");return original.call(this,k,v);};});
  await page.locator("#qa-ad").click();await expect(page.locator("#save-notice")).toBeVisible();
  expect(await wallet(page)).toBe(3);await expect(page.locator("#board .hinted")).toHaveCount(0);
  await page.reload();await page.locator("#resume").click();expect(await wallet(page)).toBe(3);
});
test("A08: failed native acknowledgement cannot duplicate a durable grant on recreation",async({page})=>{
  await install(page);await watch(page);await page.evaluate(()=>(window as any).ackFail=true);await page.locator("#qa-ad").click();
  await expect.poll(()=>wallet(page)).toBe(2);await page.reload();await page.locator("#resume").click();
  expect(await wallet(page)).toBe(2);expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key)).meta.rewardReceipts).toHaveLength(1);
});
test("A11: an old pending reward during an unavailable request is stored without claiming the new offer",async({page})=>{
  await install(page);await page.locator("#hint").click();
  await page.evaluate(()=>{(window as any).unavailable=true;localStorage.nativeHelp=JSON.stringify({token:"old-pending",attempt:"old-attempt"});});
  await page.locator("#watch-hints").click();await expect.poll(()=>wallet(page)).toBe(3);
  await expect(page.locator("#board .hinted")).toHaveCount(0);await expect(page.locator("#status")).toContainText("недоступна");
});
test("A13: future receipt is retained with a visible recovery diagnosis",async({page})=>{
  await install(page);await page.evaluate(()=>localStorage.nativeHelp=JSON.stringify({version:9,product:"future_1",token:"future",attempt:"old"}));
  await page.reload();await expect(page.locator("body")).toContainText("формат пока не поддерживается");
  expect(await page.evaluate(()=>(window as any).acks.length)).toBe(0);expect(await wallet(page)).toBe(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.nativeHelp).version)).toBe(9);
});
