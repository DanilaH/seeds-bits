import {test, expect, type Page} from '@playwright/test';
import {classic} from '../src/core';
import {writeFileSync} from 'node:fs';
async function evidence(label:string,value:unknown){const path=test.info().outputPath(label+'.json');writeFileSync(path,JSON.stringify(value,null,2));await test.info().attach(label,{path,contentType:'application/json'});}
const key='seeds-bits.progress.v2';
const day='2026-11-28',daily='daily-v1-'+day;
async function seed(page:Page,kind='classic',language='ru',theme='light',motion:'reduce'|'no-preference'='reduce') {
  const session=(moves=1)=>({rules:1,current:{board:[5,5],moves,additions:0,scroll:0},history:[]});
  const active=kind==='book100'?'book-v1-2399':kind==='book'?'book-v1-9':kind==='daily'||kind==='done'?daily:kind==='archive-year'?'daily-v1-2025-11-27':kind==='archive'?'daily-v1-2026-11-27':'classic';
  const state:any={version:3,active,sessions:{classic:session(),'book-v1-9':session(),[active]:session()},seen:[],hints:{},done:kind==='done'?[daily]:[],
    meta:{version:2,since:'2026-11-01',wallet:0,completed:1,unassisted:1,attempts:{[active]:{id:'uf49',completed:kind==='done'}}}};
  if(kind==='preloaded')state.sessions[daily]=session(0);
  if(kind==='fresh'){state.sessions.classic=session(0);state.sessions.classic.current.board=classic();state.meta.completed=0;state.meta.unassisted=0;}
  if(kind==='done')state.sessions[daily].current.board=[];
  await page.emulateMedia({reducedMotion:motion});await page.clock.setFixedTime(new Date(day+'T12:00:00Z'));
  await page.addInitScript(({key,state,language,theme})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
    if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
    (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),readiness:async()=>({state:'ready'}),preload:async()=>{},show:async()=>({status:'unavailable'})};
  },{key,state,language,theme});
  await page.goto('/');await expect(page.locator('#dialog[data-screen="home"][open]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
}
async function raw(page:Page,selector:string,click=false){
  const m=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();const points=[[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]];
    let top=0,left=0,right=innerWidth,bottom=innerHeight;
    for(let a=e.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,b.top+a.clientTop);bottom=Math.min(bottom,b.top+a.clientTop+a.clientHeight);}
      if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,b.left+a.clientLeft);right=Math.min(right,b.left+a.clientLeft+a.clientWidth);}}
    return {rect:r.toJSON(),clip:{top,left,right,bottom},visible:r.top>=top-1&&r.bottom<=bottom+1&&r.left>=left-1&&r.right<=right+1,hits:points.map(([x,y])=>e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y))),targets:points.map(([x,y])=>document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)?.outerHTML.slice(0,160))};});
  expect(m.visible,selector+' visible before scrolling '+JSON.stringify(m)).toBe(true);expect(m.hits,selector+' five raw points '+JSON.stringify(m)).toEqual([true,true,true,true,true]);
  if(click)await page.mouse.click(m.rect.x+m.rect.width/2,m.rect.y+m.rect.height/2);return m;
}
async function geometry(page:Page){return page.evaluate(()=>{
  const r=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();
  const jar=r('#home-jar'),jarArt=r('#home-jar .jar-glass'),cover=r('.home-current-copy'),controls=['#classic-mode','#book-mode','#daily-mode'].map(r);
  const titleY=['#classic-mode','#book-mode','#daily-mode'].map(s=>{const e=document.querySelector(s+' > span:last-child')!,node=e.firstChild!,range=document.createRange();range.selectNodeContents(node);return range.getClientRects()[0]?.top;});
  return {jar,jarArt,cover,controls,titleY,overlap:cover.left<Math.max(jar.right,jarArt.right)&&cover.right>Math.min(jar.left,jarArt.left)&&cover.top<Math.max(jar.bottom,jarArt.bottom)&&cover.bottom>Math.min(jar.top,jarArt.top),
    secondary:['#book-quick','#calendar-open'].map(s=>({r:r(s),hidden:(document.querySelector(s) as HTMLElement).hidden})),
    nav:r('.home-links'),modes:r('.mode-nav')};
});}
for(const language of ['ru','en','es','tr','pt-BR'])for(const theme of ['light','dark'])test(`UF01–03 geometry and routes ${language} ${theme}`,async({page})=>{
  await seed(page,'classic',language,theme,'no-preference');
  const records=[];
  for(const [width,height] of [[320,520],[320,568],[390,844],[768,1024],[568,320],[844,390]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(240); // existing route transition, not a durability barrier
    for(const fraction of [0,.125,.25,.375,.5,.625,.75,.875,1]){
      await page.locator('.home-current-copy').evaluate((e,t)=>{for(const a of e.getAnimations())a.currentTime=t;},fraction*5000);
      const m=await geometry(page);records.push({width,height,fraction,...m});expect(m.overlap,JSON.stringify({width,height,fraction,jar:m.jar,jarArt:m.jarArt,cover:m.cover})).toBe(false);
      for(const s of ['#home-jar','#progress-open','#learn','#settings-open','#pause-language'])await raw(page,s);
    }
    const m=await geometry(page);expect(Math.max(...m.titleY)-Math.min(...m.titleY)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.secondary[0].r.top-m.secondary[1].r.top)).toBeLessThanOrEqual(1);
    expect(m.controls[0].right).toBeLessThanOrEqual(m.controls[1].left+1);expect(m.controls[1].right).toBeLessThanOrEqual(m.controls[2].left+1);
    expect(m.nav.top-m.modes.bottom).toBeLessThanOrEqual(35);
    await page.screenshot({path:test.info().outputPath(`home-${width}x${height}.png`)});
    await raw(page,'#home-jar',true);await expect(page.locator('#dialog')).toHaveAttribute('data-screen','trophies');
    await page.keyboard.press('Escape');await expect(page.locator('#dialog')).toHaveAttribute('data-screen','home');
  }
  await evidence('swept-geometry',records);
  await raw(page,'#home-notebook',true);await expect(page.locator('#dialog')).toBeHidden();
});
for(const kind of ['book','book100','daily','archive','archive-year','fresh','preloaded','done'])for(const theme of ['light','dark'])for(const language of ['ru','en','es','tr','pt-BR'])test(`UF01/06 Home ${kind} ${theme} ${language}`,async({page})=>{
  await page.setViewportSize({width:320,height:520});await seed(page,kind,language,theme);
  const status=kind==='done'?'done':kind==='daily'?'started':'unplayed';
  await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status',status);
  expect((await geometry(page)).overlap).toBe(false);
  await raw(page,'#home-jar');for(const s of ['#progress-open','#learn','#settings-open','#pause-language'])await raw(page,s);
  const dot=await page.locator('#home-today-art').evaluate(e=>{const s=getComputedStyle(e,'::after');return {content:s.content,animation:s.animationName,pointer:s.pointerEvents};});
  expect(dot.animation).toBe('none');expect(dot.pointer).toBe('none');expect(dot.content).toBe(kind==='done'?'"✓"':'""');
  if(kind==='fresh')await expect(page.locator('.home-current')).toHaveAttribute('data-new-game','');
  if(kind==='daily')await expect(page.locator('#daily-state')).toHaveText(({ru:'Продолжить',en:'Continue',es:'Continuar',tr:'Devam et','pt-BR':'Continuar'} as Record<string,string>)[language]);
  await page.screenshot({path:test.info().outputPath('state.png')});
});
test('UF06 two soft cycles, stable phase, modal/background/reduced motion and midnight',async({page})=>{
  await seed(page,'classic','ru','light','no-preference');
  await expect(page.locator('#home-today-art')).toHaveCSS('animation-name','none');
  await expect(page.locator('#home-today-art')).toHaveCSS('transform','none');
  const result=await page.evaluate(()=>{
    const e=document.querySelector('#home-today-art')!,a=e.getAnimations({subtree:true}).find(a=>a instanceof CSSAnimation&&a.animationName==='home-daily-dot')!;
    const frames=[];a.pause();
    for(const at of [0,1000,2000,3000,4000,5000,7000,9999]){a.currentTime=at;const s=getComputedStyle(e,'::after');frames.push({at,opacity:Number(s.opacity),transform:s.transform});}
    return {frames,timing:a.effect!.getTiming()};
  });
  expect(result.timing.duration).toBe(10000);expect(result.frames[1].opacity).toBeGreaterThan(result.frames[0].opacity);expect(result.frames[3].opacity).toBeGreaterThan(result.frames[2].opacity);
  expect(result.frames.slice(4).every(x=>Math.abs(x.opacity-.65)<.01)).toBe(true);
  await page.evaluate(()=>{const e=document.querySelector('#home-today-art')!;(window as any).uf49Dot=e.getAnimations({subtree:true})[0];});
  await raw(page,'#pause-language',true);
  expect(await page.locator('#home-today-art').evaluate(e=>getComputedStyle(e,'::after').animationPlayState)).toBe('paused');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.querySelector('#home-today-art')!.getAnimations({subtree:true})[0]===(window as any).uf49Dot)).toBe(true);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.locator('#home-today-art').evaluate(e=>getComputedStyle(e,'::after').animationPlayState)).toBe('paused');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('#home-today-art').evaluate(e=>getComputedStyle(e,'::after').animationName)).toBe('none');
  await page.clock.setFixedTime(new Date('2026-11-29T12:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#home-today-art')).toHaveAttribute('data-date','2026-11-29:ru');await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','unplayed');
  await evidence('dot-cycle',result);
});
test('UF06 pending/failure result cannot show a done check; retry and replay retain durable completion',async({page})=>{
  await seed(page,'daily');await raw(page,'#resume',true);await expect(page.locator('#dialog')).toBeHidden();
  await page.evaluate(()=>new Promise<void>(ready=>{void navigator.locks.request('seeds-save',async()=>{ready();await new Promise<void>(release=>(window as any).release=release);});}));
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='seeds-bits.progress.v2')throw new DOMException('UF06 fault','QuotaExceededError');return set.call(this,k,v);};(window as any).restore=()=>Storage.prototype.setItem=set;});
  await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','pending');await page.locator('#menu').click();await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','started');
  await page.evaluate(()=>(window as any).release());await expect(page.locator('.game')).toHaveAttribute('data-persistence','failed');await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','started');
  await page.evaluate(()=>(window as any).restore());await page.locator('#retry-save').click();await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
  await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','done');
  await page.reload();await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','done');await page.locator('#daily-mode').click();await expect(page.locator('#dialog')).toBeHidden();await page.locator('#menu').click();await expect(page.locator('#daily-mode')).toHaveAttribute('data-daily-status','done');
});
