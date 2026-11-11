import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const output=path.resolve('test-results/ux-20261111');
await fs.mkdir(output,{recursive:true});
const dev='http://127.0.0.1:5173', production='http://127.0.0.1:5174';
const servers=[
 spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'}),
 spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5174'],{stdio:'ignore'}),
];
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Server unavailable: '+url);}
await Promise.all([ready(dev),ready(production)]);
const browser=await chromium.launch({...(process.env.SEEDS_CHROMIUM?{executablePath:process.env.SEEDS_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const classic=Array.from({length:19},(_,i)=>String(i+1)).join('').replaceAll('0','').split('').map(Number);
const report={source:(process.env.GITHUB_SHA || 'working-tree'),date:'2026-11-11',scope:'Real browser UI; native ad/engagement replies are controlled test doubles, not live SDK/device evidence',scenarios:[],frames:[],observations:[]};
const snap=board=>({rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]});
const isoDay=n=>'2026-11-'+String(n).padStart(2,'0');
function fixture(o={}){
 const today=o.today??'2026-11-11';
 const active=o.active??'classic';
 const done=o.done??['book-v1-1','book-v1-2','book-v1-3',...Array.from({length:6},(_,i)=>isoDay(Number(today.slice(-2))-6+i)).map(d=>'daily-v1-'+d)];
 const sessions={classic:snap(o.board??classic)};
 if(active!=='classic')sessions[active]=snap(o.board??[5,5]);
 return {version:3,active,sessions,hints:{},done,seen:[],jars:{version:2,seeds:o.meter??340,meter:o.meter??340,wins:3,attempt:'ux-classic',highWater:0},meta:{version:2,wallet:o.wallet??4,since:'2026-11-01',completed:18,unassisted:8,attempts:{classic:{id:'ux-classic',completed:false},...(active!=='classic'?{[active]:{id:'ux-task',completed:false}}:{})},...(o.streak?{daily:{lastDay:o.lastDay??isoDay(Number(today.slice(-2))-1),count:o.streak,best:o.streak,reward:0}}:{}),...(o.flags?{flags:o.flags}:{})}};
}
async function open(o={}){
 const context=await browser.newContext({viewport:o.viewport??{width:390,height:844},isMobile:o.mobile!==false,hasTouch:true,locale:'ru-RU',timezoneId:'Asia/Yekaterinburg',reducedMotion:o.motion?'no-preference':'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.clock.setFixedTime(new Date((o.today??'2026-11-11')+'T07:30:00Z'));
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({o,p})=>{
  if(!sessionStorage.uxSeeded){
   sessionStorage.uxSeeded='1';
   if(!o.fresh)localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,theme:o.dark?'dark':'light',reminders:o.reminders!==false,vibration:true,sound:false,...o.settings}));
   if(p)localStorage.setItem('seeds-bits.progress.v2',JSON.stringify(p));
   if(o.corrupt)localStorage.setItem('seeds-bits.progress.v2','{"version":3,broken');
   if(o.future)localStorage.setItem('seeds-bits.progress.v2','{"version":99}');
  }
  window.auditCalls=[];window.auditListeners={};window.auditPermission=Boolean(o.granted);
  if(o.native!==false){
   window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true}),addListener:async(n,fn)=>{window.auditListeners[n]=fn;return{remove:async()=>{}}},preload:async()=>{},banner:async b=>{window.auditBanner=b},pending:async()=>({}),acknowledge:async x=>window.auditCalls.push({ack:x}),report:async x=>window.auditCalls.push(x),show:async x=>{window.auditCalls.push({show:x});return{status:'unavailable'}}};
   window.__SEEDS_ENGAGEMENT_TEST__={configuration:async()=>({available:true,granted:window.auditPermission}),requestNotifications:async()=>{window.auditCalls.push({permission:true});window.auditPermission=!o.denied;return{available:true,granted:window.auditPermission}},openNotificationSettings:async()=>window.auditCalls.push({systemSettings:true}),prepareReview:async()=>({status:'unavailable'}),review:async()=>({status:'finished'}),addListener:async(n,fn)=>{window.auditListeners[n]=fn;return{remove:async()=>{}}}};
  }
 },{o,p:o.fixture===false?null:!o.fresh&&o.seed!==false?fixture(o):null});
 await page.goto(o.production?production:dev);
 await page.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').inert&&document.querySelector('#board button'));
 if(o.font)await page.addStyleTag({content:`html{font-size:${o.font} !important}`});
 return {page,context,errors};
}
async function capture(page,scenario,label){
 await page.waitForTimeout(180); // Let saved-state and transient board feedback settle before visual inspection.
 const file=scenario+'--'+label+'.png';
 await page.screenshot({path:path.join(output,file),animations:'disabled'});
 const state=await page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const modal=[...document.querySelectorAll('dialog[open]')].at(-1);
  const nodes=[...document.querySelectorAll('button,input,select,summary,a[href]')].filter(visible).filter(e=>!modal||modal.contains(e));
  const controls=nodes.map(e=>{const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=x>=0&&x<innerWidth&&y>=0&&y<innerHeight?document.elementFromPoint(x,y):null;return{id:e.id,tag:e.tagName,label:e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||e.closest('label')?.innerText||'',disabled:Boolean(e.disabled),rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?e===hit||e.contains(hit):false,inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};});
  const overflow=[...document.querySelectorAll('h1,h2,h3,p,label,.fine,.action-label,.action-count,.hero-kicker,.hero-count,.metal-name,.metal-count,.next-count')].filter(visible).filter(e=>!modal||modal.contains(e)).filter(e=>e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='auto').map(e=>({tag:e.tagName,id:e.id,class:e.className,text:e.innerText,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  const containers=['#dialog','#viewport','#hint-offer'].map(s=>{const e=document.querySelector(s);return e&&visible(e)?{selector:s,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop}:null}).filter(Boolean);
  return{viewport:{width:innerWidth,height:innerHeight},screen:document.querySelector('#dialog')?.open?document.querySelector('#dialog').dataset.screen:'game',text:(modal??document.body).innerText,activeElement:{id:document.activeElement?.id,text:document.activeElement?.innerText?.slice(0,80)},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,controls,overflow,containers,banner:window.auditBanner??null,calls:window.auditCalls??[]};
 });
 report.frames.push({scenario,label,file,...state});
 return state;
}
async function click(page,selector){await page.locator(selector).click();}
async function board(page){if(await page.locator('#dialog').evaluate(e=>e.open))await click(page,'#resume');}
async function run(name,o,fn){
 let env;
 const entry={name,options:o,status:'completed'};report.scenarios.push(entry);
 try{env=await open(o);await fn(env.page,name);entry.errors=env.errors;}
 catch(e){entry.status='blocked';entry.error=String(e).slice(0,1800);if(env)try{await capture(env.page,name,'failure');}catch{}}
 finally{if(env)await env.context.close();await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({name,status:entry.status,error:entry.error,frames:report.frames.filter(f=>f.scenario===name).length}));}
}

try{
 await run('fresh-native',{fresh:true},async(p,n)=>{
  await capture(p,n,'first-launch');
  for(let step=0;step<2;step++){
   await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');
   await capture(p,n,'solved-step-'+(step+1));await click(p,'#lesson-next');
  }
  await capture(p,n,'first-classic');await click(p,'#menu');await capture(p,n,'first-home');
 });
 await run('fresh-production',{fresh:true,native:false,production:true},async(p,n)=>{await capture(p,n,'first-launch');await click(p,'#skip');await capture(p,n,'classic');await click(p,'#menu');await capture(p,n,'home');});
 await run('classic-actions',{seed:false},async(p,n)=>{
  await board(p);await capture(p,n,'initial');
  await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await capture(p,n,'invalid-pair');
  await click(p,'#hint');await capture(p,n,'hint');
  const hints=await p.locator('.hinted').evaluateAll(es=>es.map(e=>e.dataset.index));
  if(hints.length!==2)throw Error('Expected two hinted cells');
  for(const i of hints)await click(p,`[data-index="${i}"]`);
  await capture(p,n,'pair-removed');await click(p,'#undo');await capture(p,n,'undo');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#dialog')?.open);await board(p);await capture(p,n,'restored');
 });
 await run('full-help',{seed:false},async(p,n)=>{
  await click(p,'#learn');await capture(p,n,'step1');
  const pairs=[[0,1],[0,1],[0,3],[0,20],[8,9]];
  for(let i=0;i<pairs.length;i++){for(const c of pairs[i])await click(p,`[data-index="${c}"]`);await click(p,'#lesson-next');await capture(p,n,'step'+(i+2));}
  await click(p,'#add');await click(p,'#undo');await click(p,'#lesson-next');await capture(p,n,'finished');
 });
 const profiles=[
  ['phone390',{width:390,height:844},null],['phone360',{width:360,height:640},null],['phone320',{width:320,height:568},null],
  ['landscape844',{width:844,height:390},null],['landscape568',{width:568,height:320},null],
  ['tabletPortrait',{width:800,height:1280},null],['tabletLandscape',{width:1280,height:800},null],
  ['largeTextPortrait',{width:360,height:640},'150%'],['largeTextLandscape',{width:844,height:390},'150%'],
  ['darkPhone',{width:390,height:844},null],
 ];
 for(const [name,viewport,font] of profiles)await run(name,{viewport,font,dark:name.startsWith('dark'),streak:6},async(p,n)=>{
  await capture(p,n,'home');
  await board(p);await capture(p,n,'classic');await click(p,'#menu');
  await click(p,'#book-mode');await capture(p,n,'books');await p.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);await capture(p,n,'books-bottom');await click(p,'#collection-back');
  await click(p,'#calendar-open');await capture(p,n,'calendar');await p.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);await capture(p,n,'calendar-bottom');await click(p,'#collection-back');
  await click(p,'#progress-open');await capture(p,n,'progress');await click(p,'#progress-trophies');await capture(p,n,'jars');
  await click(p,'#trophies-mode');await capture(p,n,'medals');await click(p,'#collection-back');await click(p,'#collection-back');
  await click(p,'#settings-open');await capture(p,n,'settings');await p.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);await capture(p,n,'settings-bottom');
  await click(p,'#privacy-open');await capture(p,n,'privacy');await p.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);await capture(p,n,'privacy-bottom');await click(p,'#privacy-back');
 });
 await run('book-filters-and-large-field',{},async(p,n)=>{
  await click(p,'#book-mode');await p.locator('#book-filter').selectOption('done');await capture(p,n,'empty-filter');await click(p,'#book-filter-reset');
  await p.locator('#book-chapter').selectOption('9');await click(p,'[data-volume="99"]');await capture(p,n,'last-notebook');
  const task=p.locator('[data-game="book-v1-2400"]');await task.click();await p.waitForFunction(()=>!document.querySelector('#dialog').open&&document.querySelector('#mode').innerText.includes('Тетрадь'));
  await capture(p,n,'large-top');await p.locator('#viewport').evaluate(e=>e.scrollTop=e.scrollHeight);await capture(p,n,'large-bottom');
  await click(p,'#hint');await p.waitForTimeout(300);await capture(p,n,'large-hint');
  if(await p.locator('#hint-jump').isVisible()){await click(p,'#hint-jump');await capture(p,n,'hint-jump');}
  await click(p,'#book-top');await capture(p,n,'returned-to-book');
 });
 await run('calendar-navigation',{streak:6},async(p,n)=>{
  await click(p,'#calendar-open');await click(p,'#calendar-picker summary');await capture(p,n,'month-picker');
  await p.locator('#calendar-year').selectOption('2025');await p.locator('#calendar-month').selectOption('01');await capture(p,n,'archive-start');
  await click(p,'[data-game="daily-v1-2025-01-01"]');await capture(p,n,'archive-game');
  await click(p,'#menu');await capture(p,n,'home-archive');await click(p,'#daily-mode');await capture(p,n,'today-game');
 });
 await run('collection-return-route',{},async(p,n)=>{
  await click(p,'#progress-open');await click(p,'#progress-trophies');await click(p,'#trophies-mode');
  await click(p,'[data-month="2026-11"]');await capture(p,n,'month-from-medals');
  for(let i=0;i<3;i++){await click(p,'#collection-back');await capture(p,n,'back-'+(i+1));}
 });
 await run('hint-video-unavailable',{seed:false},async(p,n)=>{
  await board(p);
  for(let i=0;i<3;i++){
   await click(p,'#hint');const cells=await p.locator('.hinted').evaluateAll(es=>es.map(e=>e.dataset.index));
   if(cells.length!==2)throw Error('No usable hint at free reveal '+i);
   for(const c of cells)await click(p,`[data-index="${c}"]`);
  }
  await click(p,'#hint');await capture(p,n,'offer');
  const action=p.locator('#hint-offer button').filter({hasText:/видео|реклам|смотр/i}).first();
  if(await action.count())await action.click();else await p.locator('#hint-offer button').first().click();
  await capture(p,n,'unavailable');
 });
 for(const [name,count,today] of [['bronze',7,'2026-11-11'],['silver',14,'2026-11-14'],['gold',30,'2026-11-30']]){
  const prior=Array.from({length:count-1},(_,i)=>'daily-v1-'+isoDay(Number(today.slice(-2))-(count-1)+i));
  await run('daily-result-'+name,{active:'daily-v1-'+today,today,board:[5,5],done:prior,streak:count-1,lastDay:isoDay(Number(today.slice(-2))-1),granted:true},async(p,n)=>{
   await board(p);await capture(p,n,'before');await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await p.waitForFunction(()=>!document.querySelector('#win').hidden);await capture(p,n,'result');
   await click(p,'#menu');await capture(p,n,'home-complete');await click(p,'#calendar-open');await capture(p,n,'calendar-complete');
  });
 }
 await run('classic-result-and-next',{board:[5,5],meter:23,wallet:0,done:[]},async(p,n)=>{await board(p);await capture(p,n,'before');await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await capture(p,n,'result');await click(p,'#play-again');await capture(p,n,'next-game');});
 await run('fresh-leave-tutorial-via-notebook',{fresh:true},async(p,n)=>{await click(p,'#book-top');await capture(p,n,'book-during-tutorial');await click(p,'#continue-book');await capture(p,n,'book-game');await p.reload();await p.waitForFunction(()=>document.querySelector('#board button'));await capture(p,n,'after-reload');});
 await run('book-resume-two-unfinished',{},async(p,n)=>{
  await click(p,'#book-mode');
  for(const task of ['book-v1-4','book-v1-5']){
   await click(p,`[data-game="${task}"]`);await click(p,'#hint');await p.waitForFunction(()=>document.querySelectorAll('.hinted').length===2);
   const cells=await p.locator('.hinted').evaluateAll(es=>es.map(e=>e.dataset.index));for(const c of cells)await click(p,`[data-index="${c}"]`);
   await click(p,'#book-top');
  }
  report.observations.push({id:'book-resume-two-unfinished',active:await p.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.progress.v2')).active),button:await p.locator('#continue-book').innerText(),destination:await p.locator('#continue-book').getAttribute('data-continue')});
  await capture(p,n,'resume-priority');await click(p,'#continue-book');await capture(p,n,'actual-resumed-game');
 });
 await run('daily-next-destination',{active:'daily-v1-2026-11-11',board:[5,5],granted:true,done:Array.from({length:6},(_,i)=>'daily-v1-'+isoDay(i+5)),streak:6},async(p,n)=>{
  await board(p);await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await capture(p,n,'result');await click(p,'#play-again');await capture(p,n,'destination');
  report.observations.push({id:'daily-next-destination',mode:await p.locator('#mode').innerText(),active:await p.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.progress.v2')).active)});
 });
 await run('invalid-backup-action',{corrupt:true},async(p,n)=>{
  await capture(p,n,'unusable-copy-preserved');if(await p.locator('#restore-backup').isVisible())throw Error('Unusable recovery offered as a restore action');
  report.observations.push({id:'invalid-backup-action',warning:await p.locator('#read-notice').innerText(),buttonVisible:await p.locator('#restore-backup').isVisible()});
 });
 await run('deep-screen-header-reachability',{},async(p,n)=>{
  await click(p,'#book-mode');await p.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);const state=await capture(p,n,'book-bottom');
  report.observations.push({id:'deep-screen-header-reachability',controls:state.controls.filter(c=>['close','collection-back','continue-book','book-chapter'].includes(c.id))});
  await p.keyboard.press('Escape');await capture(p,n,'back-by-keyboard');
 });
 await run('legal-dead-end-recovery',{},async(p,n)=>{
  await click(p,'#book-mode');await click(p,'[data-game="book-v1-7"]');
  for(const [a,b] of [[2,22],[7,25],[9,10]]){await click(p,`[data-index="${a}"]`);await click(p,`[data-index="${b}"]`);}
  await click(p,'#hint');await p.waitForFunction(()=>!document.querySelector('#recover-task').hidden);await capture(p,n,'recovery-offer');
  await click(p,'#recover-task');await p.waitForFunction(()=>document.querySelectorAll('.hinted').length===2);await capture(p,n,'recovered');
 });
 await run('true-text-enlargement-experiment',{viewport:{width:360,height:640}},async(p,n)=>{
  await board(p);await p.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')];const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=(sizes[i]*1.5)+'px');});await capture(p,n,'classic-fonts-150');
  await click(p,'#menu');await click(p,'#settings-open');await p.evaluate(()=>{const nodes=[...document.querySelectorAll('#settings-panel *')];const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=(sizes[i]*1.5)+'px');});await capture(p,n,'settings-fonts-150');
 });
 await run('restart-confirmation',{seed:false},async(p,n)=>{await board(p);await click(p,'[data-index="0"]');await click(p,'[data-index="9"]');await click(p,'#menu');await click(p,'#new');await capture(p,n,'confirm');await click(p,'#cancel-new');await capture(p,n,'cancel-return');});
 await run('notification-denied',{denied:true},async(p,n)=>{await click(p,'#settings-open');await capture(p,n,'pending');await click(p,'#notification-permission-request');await capture(p,n,'denied');await p.locator('#reminder-time').fill('13:45');await capture(p,n,'time-edit');});
 await run('notification-granted',{granted:true},async(p,n)=>{await click(p,'#settings-open');await p.locator('#reminders').uncheck();await capture(p,n,'disabled');await p.locator('#reminders').check();await capture(p,n,'enabled');});
 await run('no-moves',{board:[1,2],wallet:0,done:[]},async(p,n)=>{await board(p);await capture(p,n,'before-add');await click(p,'#add');await capture(p,n,'added');await click(p,'#undo');await capture(p,n,'undo-add');});
 await run('save-error',{seed:false},async(p,n)=>{
  await board(p);await p.evaluate(()=>{window.auditSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('seeds-bits'))throw new DOMException('full','QuotaExceededError');return window.auditSetItem.call(this,k,v)}});
  await click(p,'[data-index="0"]');await click(p,'[data-index="9"]');await capture(p,n,'error-game');await click(p,'#menu');await capture(p,n,'error-menu');
  await p.evaluate(()=>Storage.prototype.setItem=window.auditSetItem);await click(p,'#retry-save');await capture(p,n,'retried');
 });
 await run('corrupt-save',{corrupt:true},async(p,n)=>{await capture(p,n,'home-warning');await board(p);await capture(p,n,'game-warning');});
 await run('future-save',{future:true},async(p,n)=>{await capture(p,n,'home-protected');await board(p);await capture(p,n,'game-protected');});
 await run('rotation-and-banner',{viewport:{width:390,height:844}},async(p,n)=>{
  await board(p);await capture(p,n,'portrait');
  for(const [label,size] of [['landscape',{width:844,height:390}],['short',{width:568,height:320}],['back',{width:390,height:844}]]){
   await p.setViewportSize(size);await p.evaluate(()=>window.auditListeners.bannerSize?.({height:90}));await p.waitForTimeout(200);await capture(p,n,label);
  }
 });
 await run('motion-and-keyboard',{motion:true},async(p,n)=>{
  await board(p);await p.locator('[data-index="0"]').focus();await p.keyboard.press('ArrowDown');await capture(p,n,'keyboard-focus');
  await click(p,'#menu');await click(p,'#settings-open');await p.keyboard.press('Escape');await capture(p,n,'escape-settings');await p.keyboard.press('Escape');await capture(p,n,'escape-home');
 });
}finally{
 await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(output,'summary.json'),JSON.stringify({source:report.source,scenarios:report.scenarios.length,completed:report.scenarios.filter(s=>s.status==='completed').length,blocked:report.scenarios.filter(s=>s.status!=='completed'),frames:report.frames.length,horizontalOverflow:report.frames.filter(f=>f.horizontalOverflow).map(f=>f.file),pageErrors:report.scenarios.filter(s=>s.errors?.length)},null,2));
 await browser.close();servers.forEach(p=>p.kill('SIGTERM'));
 console.log(JSON.stringify({scenarios:report.scenarios.length,frames:report.frames.length,blocked:report.scenarios.filter(s=>s.status!=='completed').map(s=>({name:s.name,error:s.error}))}));
}
