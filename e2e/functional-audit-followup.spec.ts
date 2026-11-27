import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const dir='test-results/functional-followup',key='seeds-bits.progress.v2';
test('FA-04 corrupted statistics: actual boot and attempted recovery',async({page})=>{
 await page.addInitScript(({key})=>{if(localStorage.getItem(key))return;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru'}));localStorage.setItem(key,JSON.stringify({version:6,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[5,5],moves:0,scroll:0,additions:0},packedHistory:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:1,attempts:{classic:{id:'audit',completed:false}},rewardReceipts:['earned-before-corruption'],help:{version:1,install:'audit',inventory:{magnet:2,plan:3},demo:{magnet:true,plan:true},assignments:[]}}}));},{key});
 await page.goto('/');await page.locator('#dialog[open]').waitFor();await expect(page.locator('#restore-backup')).toBeVisible();await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
 const state=()=>page.evaluate(key=>{const m=JSON.parse(localStorage.getItem(key)!).meta,b=JSON.parse(localStorage.getItem(key+'.recovery')??'{}').meta;return {wallet:m.wallet,stock:m.help.inventory,receipts:m.rewardReceipts??[],backup:{wallet:b?.wallet,stock:b?.help?.inventory,receipts:b?.rewardReceipts}};},key);
 const first=await state();await page.screenshot({path:dir+'/corrupt-meta-boot.png'});
 await page.locator('#restore-backup').click();await page.waitForLoadState('domcontentloaded');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));const restored=await state();fs.writeFileSync(dir+'/corrupt-meta-recovery.json',JSON.stringify({first,restored},null,2));
});
test('full real-history catalogue save against Chromium localStorage quota',async({page})=>{
 await page.goto('/');await page.locator('#app').waitFor();const raw=fs.readFileSync(dir+'/catalogue-full-save.json','utf8');
 const result=await page.evaluate(async({raw,key})=>{
  const p=await import('/src/platform.ts');await navigator.locks.request('seeds-save',()=>{});
  const old=localStorage.getItem(key);let status='saved',error='';
  try{await p.saveState(key,raw,old,'seeds-bits.settings.v1','{}');}catch(e){status='failed';error=(e as Error).name;}
  const actual=localStorage.getItem(key);
  return {chars:raw.length,status,error,oldChars:old?.length,oldPreserved:old===actual,fullSaved:actual===raw};
 },{raw,key});fs.writeFileSync(dir+'/catalogue-browser-quota.json',JSON.stringify(result,null,2));
});
