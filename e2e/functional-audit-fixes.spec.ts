import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import notebook from '../src/notebook.json' with {type:'json'};
import {occupied,removePair} from '../src/core';
import {unpackSession} from '../src/history-codec';
const key='seeds-bits.progress.v2',dir='test-results/functional-fixes';
fs.mkdirSync(dir,{recursive:true});
const evidence=(name:string,data:unknown)=>fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2));
async function empty(page:Page){await page.route('**/audit-writer',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('/audit-writer');}
// Exact independent b4376e9 scenario, now with assertions on the durable boundary.
test('FA01 actual legacy task5 recovery held, failed, retried and reloaded',async({page,context})=>{
 const puzzle=notebook[4],id=puzzle.id;
 await page.addInitScript(({key,id,board})=>{if(localStorage.getItem(key))return;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',sound:false,vibration:false}));localStorage.setItem(key,JSON.stringify({version:3,active:id,done:[],seen:[],hints:{},sessions:{[id]:{rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}},meta:{version:2,wallet:0,since:'2026-11-10',completed:0,unassisted:0,attempts:{[id]:{id:'functional-rollback',completed:false}}}}));},{key,id,board:puzzle.board});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('#resume').click();
 let b=puzzle.board;for(const [a,c] of [[3,4],[5,13],[6,15],[2,11]]){b=removePair(b,a,c);await page.locator(`#board button[data-index="${a}"]`).click();await page.locator(`#board button[data-index="${c}"]`).click();await expect(page.locator('#remaining')).toHaveText(String(occupied(b)));}
 const disk=()=>page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)!).sessions[id],{key,id});
 await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
 await page.locator('#hint').click();await expect(page.locator('#no-moves-primary')).toHaveText('Отменить 2 хода');
 const blocker=await context.newPage();await empty(blocker);
 await blocker.evaluate(()=>{(window as any).acquired=new Promise<void>(ok=>{void navigator.locks.request('seeds-save',async()=>{ok();await new Promise<void>(done=>(window as any).release=done);});});});await blocker.evaluate(()=>(window as any).acquired);
 try {
  await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if((window as any).failWrite&&k==='seeds-bits.progress.v2')throw new DOMException('fault','QuotaExceededError');return write.call(this,k,v);};(window as any).failWrite=true;});
  await page.locator('#no-moves-primary').click();await expect(page.locator('#remaining')).toHaveText('8');
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','pending');await expect(page.locator('#board')).toHaveAttribute('aria-busy','true');
  expect(unpackSession(await disk()).current.moves).toBe(4);await expect(page.locator('#status')).toHaveText('Сохраняем ход…');
  await page.screenshot({path:dir+'/recovery-pending.png'});
  await blocker.evaluate(()=>(window as any).release());await expect(page.locator('#save-notice')).toBeVisible();
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','failed');expect(unpackSession(await disk()).current.moves).toBe(4);
  await page.evaluate(()=>(window as any).failWrite=false);await page.locator('#retry-save').click();await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
  const saved=unpackSession(await disk());expect(saved.current.moves).toBe(2);expect(saved.history).toHaveLength(2);
  evidence('FA01',{saved,remaining:occupied(saved.current.board)});
  await page.reload();await page.locator('#resume').click();await expect(page.locator('#remaining')).toHaveText('8');
 } finally {await blocker.close();}
});
for(const wire of [6,9,10])test(`FA02 wire${wire} actual boot, backup restore, reload preserve wallet rights and receipt`,async({page})=>{
 await page.addInitScript(({key,wire})=>{if(localStorage.getItem(key))return;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru'}));localStorage.setItem(key,JSON.stringify({version:wire,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[5,5],moves:0,scroll:0,additions:0},packedHistory:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:1,attempts:{classic:{id:'audit',completed:false,hintKeys:['used']}},rewardReceipts:['earned-before-corruption'],help:{version:1,install:'audit',inventory:{magnet:2,plan:3},demo:{magnet:true,plan:true},assignments:[]}},jars:{version:2,seeds:16,meter:16,wins:0,highWater:8,attempt:'audit'}}));},{key,wire});
 const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
 await page.goto('/');await page.locator('#dialog[open]').waitFor();await expect(page.locator('#restore-backup')).toBeVisible();
 // Hints are compacted by the existing SHA256 codec; compare to the source key via its actual public contract.
 const expectedHint=await page.evaluate(async()=>{const h=await import('/src/hint-key.ts');return h.compactHintKey('used');});
 const assertEarned=async()=>{await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));const p=await state();expect(p.meta.wallet).toBe(9);expect(p.meta.rewardReceipts).toEqual(['earned-before-corruption']);expect(p.meta.help.inventory).toEqual({magnet:2,plan:3});expect(p.meta.attempts.classic).toMatchObject({id:'audit',completed:false,hintKeys:[expectedHint]});expect(p.jars.highWater).toBe(8);return p;};
 await assertEarned();const backup=await page.evaluate(key=>JSON.parse(localStorage.getItem(key+'.recovery')!),key);expect(backup.meta.unassisted).toBe(1);
 await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===page.mainFrame()}),page.locator('#restore-backup').click()]);await page.locator('#dialog[open]').waitFor();await assertEarned();
 await page.reload();await page.locator('#dialog[open]').waitFor();evidence(`FA02-wire${wire}`,await assertEarned());
});
for(const locks of [true,false,'mixed'] as const)test(`FA03 real two documents serialize CAS, locks=${locks}`,async({page,context})=>{
 const other=await context.newPage();await empty(page);await empty(other);
 for(const [i,p] of [page,other].entries())await p.evaluate(({disabled})=>{if(disabled)Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});}, {disabled:locks===false||(locks==='mixed'&&i===1)});
 const k='audit.concurrent',s='audit.settings';await page.evaluate(({k})=>localStorage.setItem(k,'base'),{k});
 const write=(p:Page,value:string,patch:Record<string,unknown>)=>p.evaluate(async({k,s,value,patch})=>{const p=await import('/src/platform.ts');try{await p.saveState(k,value,'base',s,'{"sound":true,"theme":"light"}',patch);return 'saved';}catch(e){return e instanceof p.SaveConflict?'conflict':String(e);}}, {k,s,value,patch});
 const results=await Promise.all([write(page,'A',{sound:false}),write(other,'B',{theme:'dark'})]);expect(results.sort()).toEqual(['conflict','saved']);
 const result=await page.evaluate(async({k,s})=>{const p=await import('/src/platform.ts');return {final:localStorage.getItem(k),settings:JSON.parse((await p.readSettings(s))!)};},{k,s});expect(['A','B']).toContain(result.final);expect(result.settings).toMatchObject({sound:false,theme:'dark'});
 await other.reload();const stale=await write(other,'stale',{});expect(stale).toBe('conflict');
 evidence(`FA03-locks-${locks}`,{results,...result,stale});await other.close();
});
test('FA04 denied at boot cannot acknowledge volatile storage; restore access and retry',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{(window as any).deny=true;for(const method of ['getItem','setItem'] as const){const original=Storage.prototype[method];(Storage.prototype as any)[method]=function(...args:any[]){if(this===localStorage&&(window as any).deny)throw new DOMException('denied','SecurityError');return (original as any).apply(this,args);};}});
 await page.goto('/');await expect(page.locator('#read-notice')).toBeVisible();await expect(page.locator('#read-notice')).toContainText('Постоянное хранилище недоступно');await expect(page.locator('#save-notice')).toBeVisible();
 const rejected=await page.evaluate(async()=>{const p=await import('/src/platform.ts');try{await p.saveState('audit.temporary','sample',null,'audit.settings','{}');return false;}catch{return true;}});expect(rejected).toBe(true);
 await page.evaluate(()=>(window as any).deny=false);await page.locator('#retry-save').click();await expect(page.locator('#save-notice')).toBeHidden();expect(await page.evaluate(key=>localStorage.getItem(key)!==null,key)).toBe(true);expect(errors).toEqual([]);
 evidence('FA04',{rejected,errors});
});
for(const field of ['wallet','help','rewardReceipts','attempts','hintKeys','jars'])test(`FA02 unreadable ${field}: actual boot protects exact original bytes`,async({page})=>{
 await page.addInitScript(({key,field})=>{
  const p:any={version:6,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[5,5],moves:0,scroll:0,additions:0},packedHistory:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:0,attempts:{classic:{id:'audit',completed:false}},rewardReceipts:['kept']},jars:{version:2,seeds:16,meter:16,wins:0,highWater:8,attempt:'audit'}};
  if(field==='jars')p.jars.highWater=-1;else if(field==='hintKeys')p.meta.attempts.classic.hintKeys='broken';else p.meta[field]='broken';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));
 },{key,field});
 await page.goto('/');await expect(page.locator('#read-notice')).toContainText('исходный прогресс защищён');
 const original=await page.evaluate(key=>localStorage.getItem(key),key);
 await page.reload();await expect(page.locator('#read-notice')).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(original);
 expect(await page.evaluate(key=>localStorage.getItem(key+'.recovery'),key)).toBe(original);
});
for(const service of ['listeners','initialize','configuration','ack'])test(`FA06 optional ${service} missing callback leaves usable core`,async({page})=>{
 await page.addInitScript(({key,service})=>{
  const w=window as any;w.ackCalls=0;const hang=()=>new Promise(()=>{});
  if(!localStorage.getItem(key)){localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));localStorage.setItem(key,JSON.stringify({version:3,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[1,1,2,8,3,7],moves:0,scroll:0,additions:0},history:[]}}}));}
  const listeners:any={};w.lateInitialize=undefined;
  w.__SEEDS_ADS_TEST__={addListener:async(n:string,f:any)=>{listeners[n]=f;if(service==='listeners')await hang();return {remove:async()=>{}};},initialize:async()=>{if(service==='initialize')return new Promise(ok=>w.lateInitialize=ok);return {enabled:false,test:true,...(service==='ack'?{reward:{token:'audit-earned',attempt:'legacy'}}:{})};},preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),pending:async()=>({}),acknowledge:async()=>{w.ackCalls++;if(service==='ack')await hang();},show:async()=>({status:'unavailable'})};
  w.__SEEDS_ENGAGEMENT_TEST__={addListener:async()=>({remove:async()=>{}}),configuration:service==='configuration'?hang:async()=>({available:true,granted:false}),requestNotifications:async()=>({available:true,granted:false})};
 },{key,service});
 await page.goto('/');await page.locator('#resume').click();await expect(page.locator('#dialog')).toBeHidden();await page.locator('#board [data-index="0"]').click();await page.locator('#board [data-index="1"]').click();await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');await expect(page.locator('#remaining')).toHaveText('4');
 if(service==='initialize'){
  await page.evaluate(()=>(window as any).lateInitialize({enabled:false,test:true,reward:{token:'late-earned',attempt:'legacy'}}));
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).meta.wallet,key)).toBe(3);
 }
 if(service==='ack'){
  expect(await page.evaluate(()=>(window as any).ackCalls)).toBe(1);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).meta.wallet,key)).toBe(3);
  await page.locator('#undo').click();await expect(page.locator('#remaining')).toHaveText('6');
 }
 evidence(`FA06-${service}`,{usable:true});
});
for(const years of [1,3,5])test(`FA05 ${years}-year real archive browser persistence and near-quota backup`,async({page})=>{
 test.skip(!fs.existsSync(`test-results/functional-profiles/archive-${years}.json`),'Profiles are generated by the full unit suite / functional CI before browser checks');
 const raw=fs.readFileSync(`test-results/functional-profiles/archive-${years}.json`,'utf8');await empty(page);
 const result=await page.evaluate(async({raw,key})=>{
  const platform=await import('/src/platform.ts'),times=[];
  for(let n=0;n<10;n++){const before=performance.now();await platform.saveState(key,raw,n===0?null:raw,'audit.settings','{}');times.push(performance.now()-before);}
  const accepted=localStorage.getItem(key)===raw;
  // Actual browser quota, with the authoritative profile already present.
  let quota=false;try{for(let n=0;n<20;n++)await platform.write(`${key}.backup-${n}`,raw);}catch(e){quota=(e as Error).name==='QuotaExceededError';}
  let rejected=false;try{await platform.saveState(key,raw+' '.repeat(6_000_000),raw,'audit.settings','{}');}catch(e){rejected=(e as Error).name==='QuotaExceededError';}
  return {times,accepted,quota,rejected,oldPreserved:localStorage.getItem(key)===raw,bytes:raw.length};
 },{raw,key});expect(result).toMatchObject({accepted:true,quota:true,rejected:true,oldPreserved:true});
 await page.reload();expect(await page.evaluate(key=>localStorage.getItem(key)?.length,key)).toBe(raw.length);evidence(`FA05-${years}`,result);
});
