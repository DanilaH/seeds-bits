import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {notebookForTask,puzzleSession} from '../src/puzzles';
const dir='test-results/independent-12109',key='seeds-bits.progress.v2',settings='seeds-bits.settings.v1';fs.mkdirSync(dir,{recursive:true});
function out(n:string,x:unknown){fs.writeFileSync(dir+'/'+n+'.json',JSON.stringify(x,null,2));}
function fixture(active='classic',meter=22,board=[5,5,2,8],done:string[]=[]){return {version:3,active,done,seen:[],hints:{},sessions:{[active]:{rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]}},jars:{version:2,meter,seeds:meter,wins:3,attempt:'audit12109',highWater:1},meta:{version:2,since:'2026-11-01',completed:10,unassisted:10,wallet:9,rewardReceipts:['kept'],help:{version:1,install:'audit',inventory:{magnet:2,plan:3},demo:{magnet:true,plan:true},assignments:[]},attempts:{[active]:{id:'audit12109',completed:false}}}};}
async function seed(page:Page,p:any,{noLocks=false,backup=null as any,theme='light',reduced=true}={}){
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
 await page.addInitScript(({key,settings,p,noLocks,backup,theme})=>{
   if(!localStorage.getItem(key)){localStorage.setItem(key,JSON.stringify(p));if(backup)localStorage.setItem(key+'.recovery',JSON.stringify(backup));}
   if(!localStorage.getItem(settings))localStorage.setItem(settings,JSON.stringify({tutorialDone:true,languageChoice:'ru',theme,sound:true,vibration:true}));
   if(noLocks)Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
   (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),show:async()=>({status:'unavailable'})};
 },{key,settings,p,noLocks,backup,theme});
 await page.goto('/');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>document.fonts.ready);
}
test('actual preference UI with unsupported writer',async({page})=>{
 const p=fixture();await seed(page,p,{noLocks:true});await expect(page.locator('#save-notice')).toBeVisible();
 const read=()=>page.evaluate(({key,settings})=>({theme:document.documentElement.dataset.theme,sound:(document.querySelector('#sound') as HTMLInputElement).checked,vibration:(document.querySelector('#vibration') as HTMLInputElement).checked,progress:localStorage.getItem(key),prefs:localStorage.getItem(settings),fields:Object.fromEntries(['theme','sound','vibration'].map(f=>[f,localStorage.getItem(settings+'.'+f)]))}),{key,settings});
 const before=await read();await page.locator('#settings-open').click();
 for(const id of ['dark','sound','vibration'])await page.locator('#'+id).evaluate((e:HTMLInputElement)=>{e.checked=!e.checked;e.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.waitForTimeout(200);
 const changed=await read();await page.screenshot({path:dir+'/unsupported-settings.png'});
 await page.reload();await page.locator('#dialog[open]').waitFor();const reloaded=await read();
 const direct=await page.evaluate(async settings=>{const m=await import('/src/platform.ts');return await m.writeSettingsPatch(settings,'{}',{theme:'dark',sound:false,vibration:false});},settings);
 out('unsupported-settings',{before,changed,reloaded,direct,progressUnchanged:reloaded.progress===before.progress});
});
test('protected earned state with valid existing backup',async({page})=>{
 const backup=fixture(),damaged=structuredClone(backup) as any;damaged.meta.wallet='broken';await seed(page,damaged,{backup});await expect(page.locator('#read-notice')).toBeVisible();
 const x=await page.evaluate(async key=>{const p=await import('/src/progress.ts');const raw=localStorage.getItem(key+'.recovery')!;const valid=p.readProgress(raw);return {warning:document.querySelector('#read-notice')?.textContent,restoreVisible:(document.querySelector('#restore-backup') as HTMLElement).checkVisibility(),original:localStorage.getItem(key),backupWallet:valid.meta?.wallet,backupReceipts:valid.meta?.rewardReceipts,damaged:localStorage.getItem(key+'.damaged')};},key);out('protected-backup',{...x,originalUnchanged:x.original===JSON.stringify(damaged),rawDamagedCopy:x.damaged===JSON.stringify(damaged)});await page.screenshot({path:dir+'/protected-backup.png'});
});
for(const theme of ['light','dark'])for(const percent of [0,25,50,75,80,90,99])test('jar actual fill '+theme+' '+percent,async({page})=>{
 await seed(page,fixture('classic',84+percent),{theme});
 const geo=async(selector:string)=>page.locator(selector).evaluate(e=>{const f=e.querySelector('.jar-fill')!,g=e.querySelector('.jar-glass')!,r=g.getBoundingClientRect(),q=f.getBoundingClientRect(),s=getComputedStyle(f);return {glass:{x:r.x,y:r.y,w:r.width,h:r.height},fill:{x:q.x,y:q.y,w:q.width,h:q.height},height:s.height,max:s.maxHeight,ratio:q.height/r.height,declared:getComputedStyle(g).getPropertyValue('--fill').trim(),grains:f.querySelectorAll('i').length};});
 const home=await geo('#home-jar');await page.locator('#home-jar').click();await expect(page.locator('.jar-overview')).toBeVisible();const collection=await geo('.jar-overview .progress-hero');const full=await geo('.jar-keepsake:first-child');
 await page.screenshot({path:dir+'/jar-'+theme+'-'+percent+'.png'});out('jar-'+theme+'-'+percent,{percent,home,collection,full});
});
for(const kind of ['field','book','daily','daily-short'])test('real reward trace '+kind,async({page,context})=>{
 const field=kind==='field',daily=kind.startsWith('daily'),active=field?'classic':daily?'daily-v1-2026-11-13':'book-v1-24',done=field?[]:daily?Array.from({length:6},(_,i)=>'daily-v1-2026-11-0'+(i+1)):Array.from({length:23},(_,i)=>'book-v1-'+(i+1));
 if(kind==='daily-short')await page.setViewportSize({width:320,height:520});
 await seed(page,fixture(active,22,field?[5,5,2,8]:[5,5],done),{reduced:false});await page.locator('#resume').click();await expect(page.locator('#dialog')).toBeHidden();await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
 let blocker:Page|undefined;
 if(field){blocker=await context.newPage();await blocker.route('**/audit-lock',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await blocker.goto('/audit-lock');await blocker.evaluate(()=>{(window as any).held=new Promise<void>(ok=>{void navigator.locks.request('seeds-save',async()=>{ok();await new Promise<void>(done=>(window as any).release=done);});});});await blocker.evaluate(()=>(window as any).held);}
 try{
  await page.evaluate(()=>{const w=window as any;w.samples=[];const start=performance.now();w.stopTrace=false;function frame(){const win=document.querySelector<HTMLElement>('#win')!,glass=document.querySelector<HTMLElement>(win.hidden?'#jar-glass':'#result-jar-glass')!,holder=win.hidden?document.querySelector<HTMLElement>('#jar-meter')!:document.querySelector<HTMLElement>('#result-jar-card')!;const fill=glass.querySelector('.jar-fill')!,r=glass.getBoundingClientRect(),q=fill.getBoundingClientRect(),layer=document.querySelector<HTMLElement>('#jar-spill');const particles=[...document.querySelectorAll<HTMLElement>('#jar-spill i')].map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,opacity:Number(getComputedStyle(e).opacity)};});
    const wr=win.getBoundingClientRect();const title=document.querySelector<HTMLElement>('#win h1')?.getBoundingClientRect();w.samples.push({at:performance.now()-start,win:!win.hidden,kind:win.dataset.resultKind,persistence:document.querySelector('.game')?.getAttribute('data-persistence'),phase:glass.dataset.rewardPhase,fill:holder.dataset.filled,capacity:holder.dataset.capacity,name:document.querySelector('#jar-name')?.textContent,glass:{x:r.x,y:r.y,w:r.width,h:r.height},fillRatio:q.height/r.height,spill:layer?.dataset.target,particles,winBurst:document.querySelectorAll('.result-seed-burst i').length,medalBurst:document.querySelectorAll('.trophy-confetti i').length,flight:document.querySelectorAll('.flying-seed').length,winGeometry:{y:wr.y,h:wr.height,scroll:win.scrollHeight,client:win.clientHeight,titleY:title?.y,titleBottom:title?.bottom},disk:JSON.parse(localStorage.getItem('seeds-bits.progress.v2')!).jars?.meter});if(!w.stopTrace&&performance.now()-start<6500)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  await page.locator('#board [data-index="0"]').click();await page.locator('#board [data-index="1"]').click();
  if(field){await page.waitForTimeout(1100);await page.screenshot({path:dir+'/field-held.png'});await blocker!.evaluate(()=>(window as any).release());}
  await expect(page.locator('#jar-spill')).toBeAttached({timeout:6500});await page.waitForTimeout(190);await page.screenshot({path:dir+'/'+kind+'-spill.png'});
  await expect(page.locator('#jar-spill')).toHaveCount(0,{timeout:4000});await page.waitForTimeout(240);await page.screenshot({path:dir+'/'+kind+'-settled.png'});
  const trace=await page.evaluate(()=>{(window as any).stopTrace=true;return (window as any).samples;});out(kind+'-trace',trace);
 }finally{await blocker?.close();}
});
