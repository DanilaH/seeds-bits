// Evidence collection, not acceptance assertions that redefine a hidden button as OK.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-results/interface-followup';
await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM||undefined,args:['--no-sandbox']});
const report={source:process.env.GITHUB_SHA,method:'Current UI, native bridge double, explicit rendered-font scaling; no physical OS zoom claim',cases:[]};
const normal=Array.from({length:19},(_,i)=>String(i+1)).join('').replaceAll('0','').split('').map(Number);
function fixture(kind){
 const isResult=kind==='result'||kind==='book-result';
 const active=kind==='result'?'daily-v1-2026-11-30':kind==='book-result'?'book-v1-1':'classic';
 const snap=board=>({rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]});
 return {version:3,active,sessions:{classic:snap(kind==='no-moves'?[1,2]:normal),...(isResult?{[active]:snap([5,5])}:{})},hints:{},seen:[],done:kind==='result'?Array.from({length:29},(_,i)=>'daily-v1-2026-11-'+String(i+1).padStart(2,'0')):[],meta:{version:2,wallet:0,since:'2026-11-01',completed:0,unassisted:0,attempts:{classic:{id:'focus-classic',completed:false},...(isResult?{[active]:{id:'focus-task',completed:false}}:{})},...(kind==='result'?{daily:{lastDay:'2026-11-29',count:29,best:29,reward:0}}:{})}};
}
async function scale(page,zoom){
 await page.evaluate(zoom=>{
  const saved=window.auditBaseFonts??=new WeakMap();
  const nodes=[...document.querySelectorAll('body *')];
  for(const e of nodes)if(saved.has(e))e.style.fontSize=saved.get(e);
  const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));
  nodes.forEach((e,i)=>{if(!saved.has(e))saved.set(e,e.style.fontSize);e.style.fontSize=(sizes[i]*zoom)+'px';});
 },zoom);
 await page.waitForTimeout(220);
}
async function capture(page,name,label,selector){
 const geometry=await page.evaluate(selector=>{
  const rect=e=>e.getBoundingClientRect().toJSON();
  const items=[...document.querySelectorAll(selector)].filter(e=>e.getBoundingClientRect().width);
  return items.map(e=>{
   const r=e.getBoundingClientRect();
   const hit=(x,y)=>{const t=document.elementFromPoint(x,y);return t===e||e.contains(t)};
   return {id:e.id,text:e.innerText,rect:rect(e),centerHit:hit(r.x+r.width/2,r.y+r.height/2),hitSamples:[[r.x+r.width/2,r.top+Math.min(8,r.height/4)],[r.x+r.width/2,r.bottom-Math.min(8,r.height/4)]].every(([x,y])=>hit(x,y)),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',scrollers:[...function*(n){for(let a=n.parentElement;a;a=a.parentElement)if(['auto','scroll','hidden','clip'].includes(getComputedStyle(a).overflowY))yield a}(e)].map(a=>({id:a.id,class:a.className,rect:rect(a),scrollTop:a.scrollTop,clientHeight:a.clientHeight,scrollHeight:a.scrollHeight}))};
  });
 },selector);
 const file=name+'--'+label+'.png';
 await page.screenshot({path:out+'/'+file,animations:'disabled'});
 return {file,geometry};
}
try{
 for(const [profile,viewport,zoom,dark,safe] of [
  ['phone',{width:390,height:844},1,false,0],
  ['small-normal',{width:320,height:568},1,false,0],
  ['short-large',{width:568,height:320},1.5,false,0],
  ['short-large-dark-safe',{width:568,height:320},1.5,true,24],
  ['small-large',{width:320,height:568},1.5,false,0],
 ])for(const kind of ['no-moves','hint','result','book-result']){
  const context=await browser.newContext({viewport,locale:'ru-RU',timezoneId:'Asia/Yekaterinburg',reducedMotion:'reduce',isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const entry={name:profile+'-'+kind,viewport,zoom,dark,safe,errors:[],frames:[]};report.cases.push(entry);
  page.on('pageerror',e=>entry.errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-11-30T07:30:00Z'));
  await page.addInitScript(({p,dark})=>{
   localStorage.setItem('seeds-bits.progress.v2',JSON.stringify(p));
   localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,theme:dark?'dark':'light',sound:false,vibration:false,reminders:false}));
   window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true}),addListener:async()=>({remove:async()=>{}}),preload:async()=>{},banner:async()=>{},pending:async()=>({}),acknowledge:async()=>{},report:async()=>{},show:async()=>({status:'unavailable'})};
  },{p:fixture(kind),dark});
  try{
   await page.goto('http://127.0.0.1:5187');
   await page.locator('#resume').click();
   if(safe)await page.addStyleTag({content:':root{--safe-area-inset-top:24px;--safe-area-inset-bottom:24px;--safe-area-inset-left:24px;--safe-area-inset-right:24px}'});
   let selector;
   if(kind==='hint'){
    for(let i=0;i<3;i++){
     await page.locator('#hint').click();
     const cells=await page.locator('.hinted').evaluateAll(es=>es.map(e=>e.dataset.index));
     if(cells.length!==2)throw Error('Expected a legal hinted pair');
     for(const c of cells)await page.locator(`[data-index="${c}"]`).click();
    }
    await page.locator('#hint').click();
    await expect(page.locator('#hint-offer')).toBeVisible();
    selector='#hint-offer button';
   }else if(kind==='result'||kind==='book-result'){
    await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
    await expect(page.locator('#win')).toBeVisible();
    selector='#play-again';
   }else selector='#undo,#hint,#add';
   await scale(page,zoom);
   entry.frames.push(await capture(page,entry.name,'initial',selector));
   const target=kind==='no-moves'?page.locator('#add'):kind==='hint'?page.locator('#hint-offer button').filter({hasText:'Продолжить без подсказки'}):page.locator('#play-again');
   await target.scrollIntoViewIfNeeded();
   entry.frames.push(await capture(page,entry.name,'after-scroll',selector));
   if(kind==='no-moves'){
    await expect(target).toHaveAttribute('aria-disabled','false');await target.click();
    await expect(page.locator('#remaining')).toHaveText('4');
   }else if(kind==='hint'){
    await target.click();await expect(page.locator('#hint-offer')).not.toBeVisible();
   }else{
    await target.click();await expect(page.locator('#win')).toBeHidden();
   }
   entry.actionWorksAfterScroll=true;
  }catch(e){entry.failure=String(e);await page.screenshot({path:out+'/'+entry.name+'--failure.png'});}
  await context.close();
 }
}finally{
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 await browser.close();await server.close();
}
console.log(JSON.stringify(report.cases.map(c=>({name:c.name,failure:c.failure,actionWorksAfterScroll:c.actionWorksAfterScroll,initial:c.frames[0]?.geometry.map(g=>({id:g.id,text:g.text,centerHit:g.centerHit,hitSamples:g.hitSamples,disabled:g.disabled}))}))));
if(report.cases.some(c=>c.failure||c.errors.length))process.exitCode=1;
