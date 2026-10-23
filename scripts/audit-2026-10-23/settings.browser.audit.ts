import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='test-results/audit-2026-10-23';mkdirSync(out,{recursive:true});
for(const front of [false,true])for(let n=0;n<6;n++)test(`settings merge ${front?'foreground':'original background'} ${n}`,async({page,context})=>{
 const trace:any[]=[];
 const capture=(p:any)=>p.on('console',(m:any)=>{if(m.text().startsWith('AUDIT_SETTINGS '))trace.push(JSON.parse(m.text().slice(15)));});capture(page);context.on('page',capture);
 await context.addInitScript(()=>{
  const id=crypto.randomUUID(),set=Storage.prototype.setItem;
  const get=Storage.prototype.getItem;console.log('AUDIT_SETTINGS '+JSON.stringify({id,kind:'environment',locks:typeof navigator.locks?.request}));
  Storage.prototype.getItem=function(k){const v=get.call(this,k);if(k==='seeds-bits.settings.v1')console.log('AUDIT_SETTINGS '+JSON.stringify({id,kind:'read',at:Date.now(),value:v}));return v;};
  Storage.prototype.setItem=function(k,v){if(k==='seeds-bits.settings.v1')console.log('AUDIT_SETTINGS '+JSON.stringify({id,kind:'write',at:Date.now(),value:v}));return set.call(this,k,v);};
  document.addEventListener('change',e=>console.log('AUDIT_SETTINGS '+JSON.stringify({id,kind:'change',at:Date.now(),target:(e.target as HTMLElement).id})),true);
  window.addEventListener('storage',e=>{if(e.key==='seeds-bits.settings.v1')console.log('AUDIT_SETTINGS '+JSON.stringify({id,kind:'storage',at:Date.now(),value:e.newValue}));});
 });
 await page.addInitScript(()=>{if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));});
 try{
  await page.goto('/');await page.locator('#resume').click();await page.locator('#hint').click();await page.waitForTimeout(250);
  const other=await context.newPage();await other.goto('/');await other.locator('#settings-open').click();
  if(front)await page.bringToFront();await page.locator('#menu').click();await page.locator('#settings-open').click();await page.locator('#dark').check();
  if(front)await other.bringToFront();await other.locator('#sound').check();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.settings.v1')!))).toMatchObject({theme:'dark',sound:true});
  await other.reload();await other.locator('#settings-open').click();await expect(other.locator('#dark')).toBeChecked();await expect(other.locator('#sound')).toBeChecked();
 }finally{writeFileSync(`${out}/D-settings-${front}-${n}.json`,JSON.stringify(trace,null,2));}
});
