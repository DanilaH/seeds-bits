import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const dir='test-results/functional-followup',key='seeds-bits.progress.v2';
test('FA-04 corrupted statistics: actual boot and attempted recovery',async({page})=>{
 await page.addInitScript(({key})=>{if(localStorage.getItem(key))return;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru'}));localStorage.setItem(key,JSON.stringify({version:6,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[5,5],moves:0,scroll:0,additions:0},packedHistory:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:1,attempts:{classic:{id:'audit',completed:false}},rewardReceipts:['earned-before-corruption'],help:{version:1,install:'audit',inventory:{magnet:2,plan:3},demo:{magnet:true,plan:true},assignments:[]}}}));},{key});
 await page.goto('/');await page.locator('#dialog[open]').waitFor();await expect(page.locator('#restore-backup')).toBeVisible();await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
 const state=()=>page.evaluate(key=>{const m=JSON.parse(localStorage.getItem(key)!).meta,b=JSON.parse(localStorage.getItem(key+'.recovery')??'{}').meta;return {wallet:m.wallet,stock:m.help.inventory,receipts:m.rewardReceipts??[],backup:{wallet:b?.wallet,stock:b?.help?.inventory,receipts:b?.rewardReceipts}};},key);
 fs.mkdirSync(dir,{recursive:true});const first=await state();fs.writeFileSync(dir+'/corrupt-meta-first.json',JSON.stringify(first,null,2));await page.screenshot({path:dir+'/corrupt-meta-boot.png'});
 await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===page.mainFrame()}),page.locator('#restore-backup').click()]);await page.waitForLoadState('domcontentloaded');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));const restored=await state();fs.writeFileSync(dir+'/corrupt-meta-recovery.json',JSON.stringify({first,restored},null,2));
});

test('storage-denied fallback cannot imply durable persistence',async({page})=>{
 await page.addInitScript(()=>{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===localStorage)throw new DOMException('audit storage denied','SecurityError');return get.call(this,k);};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('audit storage denied','SecurityError');return set.call(this,k,v);};});
 await page.goto('/');await page.locator('#app').waitFor();await page.waitForTimeout(500);
 const before=await page.evaluate(async()=>{const p=await import('/src/platform.ts');await p.saveState('audit.temporary','sample',null,'audit.settings','{}');return {readBack:await p.read('audit.temporary'),noticeVisible:document.querySelector('#save-notice')?.getClientRects().length!==0,warningVisible:document.querySelector('#save-warning')?.getClientRects().length!==0,body:document.body.innerText.slice(0,2000)};});
 await page.reload();const after=await page.evaluate(async()=>{const p=await import('/src/platform.ts');return await p.read('audit.temporary');});
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/storage-denied-reload.json',JSON.stringify({before,after},null,2));
});