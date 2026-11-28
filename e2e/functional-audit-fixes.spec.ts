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
for(const locks of [true,false,'mixed'] as const)test(`FA03 two documents: atomic writer or explicit unsupported mode, locks=${locks}`,async({page,context})=>{
 const other=await context.newPage();await empty(page);await empty(other);
 const disable=async(p:Page)=>p.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
 if(locks===false)await disable(page);if(locks!==true)await disable(other);
 const k='audit.concurrent',s='audit.settings';await page.evaluate(({k,s})=>{localStorage.setItem(k,'base');localStorage.setItem(s,'{"sound":true,"theme":"light"}');},{k,s});
 const write=(p:Page,value:string,patch:Record<string,unknown>)=>p.evaluate(async({k,s,value,patch})=>{const p=await import('/src/platform.ts');try{await p.saveState(k,value,'base',s,'{"sound":true,"theme":"light"}',patch);return 'saved';}catch(e){return e instanceof p.SaveConflict?'conflict':e instanceof p.AtomicStorageUnavailable?'unsupported':String(e);}}, {k,s,value,patch});
 const results=await Promise.all([write(page,'A',{sound:false}),write(other,'B',{theme:'dark'})]);
 expect(results.sort()).toEqual(locks===true?['conflict','saved']:locks===false?['unsupported','unsupported']:['saved','unsupported']);
 const final=await page.evaluate(k=>localStorage.getItem(k),k);if(locks===false)expect(final).toBe('base');else expect(['A','B']).toContain(final);
 // Independent settings patches remain canonical even when game writing is unsupported.
 await Promise.all([page.evaluate(async s=>(await import('/src/platform.ts')).writeSettingsPatch(s,'{}',{sound:false}),s),other.evaluate(async s=>(await import('/src/platform.ts')).writeSettingsPatch(s,'{}',{theme:'dark'}),s)]);
 await expect.poll(()=>page.evaluate(async s=>JSON.parse((await (await import('/src/platform.ts')).readSettings(s))!),s)).toMatchObject({sound:false,theme:'dark'});
 await other.reload();if(locks===false)await disable(other);const stale=await write(other,'stale',{});expect(stale).toBe(locks===false?'unsupported':'conflict');
 evidence(`FA03-locks-${locks}`,{results,final,stale});await other.close();
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
test('FA06 notification during held/failed move waits for durable retry and preserves the old game',async({page,context})=>{
 await page.clock.setFixedTime(new Date('2026-11-27T12:00:00'));
 await page.addInitScript(({key})=>{
  const w=window as any;w.__SEEDS_ENGAGEMENT_TEST__={addListener:async(_:string,callback:any)=>{w.dailyOpen=callback;return {remove:async()=>{}};},configuration:async()=>({available:true,granted:false})};
  localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));localStorage.setItem(key,JSON.stringify({version:3,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[1,1,2,8],moves:0,scroll:0,additions:0},history:[]}}}));
 },{key});await page.goto('/');await page.locator('#resume').click();
 const blocker=await context.newPage();await empty(blocker);await blocker.evaluate(()=>{(window as any).held=new Promise<void>(ready=>{void navigator.locks.request('seeds-save',async()=>{ready();await new Promise<void>(release=>(window as any).release=release);});});});await blocker.evaluate(()=>(window as any).held);
 try {
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if((window as any).fail&&k==='seeds-bits.progress.v2')throw new DOMException('fault','QuotaExceededError');return original.call(this,k,v);};(window as any).fail=true;});
  await page.locator('#board [data-index="0"]').click();await page.locator('#board [data-index="1"]').click();await expect(page.locator('.game')).toHaveAttribute('data-persistence','pending');
  await page.evaluate(()=>(window as any).dailyOpen());expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,key)).toBe('classic');await expect(page.locator('#mode')).toContainText('Классика');
  await blocker.evaluate(()=>(window as any).release());await expect(page.locator('#save-notice')).toBeVisible();await expect(page.locator('#mode')).toContainText('Классика');
  await page.evaluate(()=>(window as any).fail=false);await page.locator('#retry-save').click();await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,key)).toMatch(/^daily-v[135]-2026-11-27$/);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);expect(saved.sessions.classic.current.moves).toBe(1);expect(saved.sessions.classic.packedHistory).toHaveLength(1);evidence('FA06-notification-during-save',{active:saved.active,old:saved.sessions.classic});
 }finally{await blocker.close();}
});
test('FA08 keyboard-only play, named controls, modal focus and independent opt-outs',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(({key})=>{localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,sound:true,vibration:true}));localStorage.setItem(key,JSON.stringify({version:3,active:'classic',done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:{board:[1,1,2,8],moves:0,scroll:0,additions:0},history:[]}}}));},{key});
 await page.goto('/');await page.locator('#resume').focus();await page.keyboard.press('Enter');await expect(page.locator('#dialog')).toBeHidden();
 for(const index of [0,1]){const button=page.locator(`#board [data-index="${index}"]`);await expect(button).toHaveAccessibleName(/1/);await button.focus();await page.keyboard.press('Enter');}
 await expect(page.locator('#remaining')).toHaveText('2');await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');await expect(page.locator('#status')).toHaveAttribute('role','status');
 await page.locator('#undo').focus();await page.keyboard.press('Space');await expect(page.locator('#remaining')).toHaveText('4');
 await page.locator('#menu').focus();await page.keyboard.press('Enter');await page.locator('#settings-open').focus();await page.keyboard.press('Enter');
 await page.locator('#sound').focus();await page.keyboard.press('Space');await page.locator('#vibration').focus();await page.keyboard.press('Space');
 await page.locator('#language-open').focus();await page.keyboard.press('Enter');await expect(page.locator('#language-sheet')).toBeVisible();
 // Native dialog may send focus to browser chrome (activeElement=BODY), never a background app control.
 for(let n=0;n<12;n++){await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({inside:!!document.activeElement?.closest('#language-sheet'),tag:document.activeElement?.tagName}));expect(focus.inside||focus.tag==='BODY').toBe(true);}
 await page.keyboard.press('Escape');await expect(page.locator('#language-sheet')).toBeHidden();await expect(page.locator('#language-open')).toBeFocused();
 await page.keyboard.press('Escape');await page.locator('#resume').focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.settings.v1')!))).toMatchObject({sound:false,vibration:false});
 evidence('FA08',{keyboard:true,accessibleNames:true,noBackgroundControlFocus:true,focusReturn:true,sound:false,vibration:false,reducedMotion:true,physicalTalkBack:'UNKNOWN'});
});
test('FA03 unsupported writer is explicit, preserves original bytes and recovers capability',async({page})=>{
 await empty(page);const result=await page.evaluate(async()=>{
  const original=navigator.locks;Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
  const p=await import('/src/platform.ts'),key='audit.writer-recovery';localStorage.setItem(key,'base');let rejected=false;
  try{await p.saveState(key,'lost','base','audit.settings','{}');}catch(e){rejected=e instanceof p.AtomicStorageUnavailable;}
  const protectedBase=localStorage.getItem(key)==='base';Object.defineProperty(navigator,'locks',{value:original,configurable:true});await p.saveState(key,'saved','base','audit.settings','{}');
  return {rejected,protectedBase,actual:localStorage.getItem(key)};
 });expect(result).toEqual({rejected:true,protectedBase:true,actual:'saved'});evidence('FA03-capability',result);
});
