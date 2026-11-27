import {test,expect,type Page} from '@playwright/test';
import {resumeStoredGame} from './restore-game';
const key='seeds-bits.progress.v2';
const prefix=(index:number)=>Array.from({length:index},(_,i)=>i===0?24:i===1?60:Math.min(480,100+(i-2)*40)).reduce((a,b)=>a+b,0);
async function seed(page:Page,kind='task',language='ru',theme='light',meter=22){
  const daily=kind.startsWith('daily');
  const n=kind==='book'?23:kind==='page'?5:0;
  const active=daily?'daily-v1-2026-11-13':kind.startsWith('classic')||kind==='dead'?'classic':`book-v1-${kind==='book'?24:kind==='page'?6:9}`;
  const state={version:3,active,done:daily?Array.from({length:6},(_,i)=>`daily-v1-2026-11-0${i+1}`):Array.from({length:n},(_,i)=>`book-v1-${i+1}`),seen:[],hints:{},
    sessions:{[active]:{rules:1,current:{board:kind==='dead'?[1,2,3,4]:kind==='classic-six'?[5,5,2,8,3,7]:kind==='classic'?[5,5,2,8]:[5,5],moves:1,additions:0,scroll:0},history:[]}},
    jars:{version:2,meter,seeds:meter,wins:3,attempt:'va48',highWater:1},
    meta:{version:2,since:'2026-11-01',wallet:1,completed:10,unassisted:10,attempts:{[active]:{id:'va48',completed:false}}}};
  await page.addInitScript(({key,state,language,theme})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
    if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false,reminders:false}));
    (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),readiness:async()=>({state:'ready'}),preload:async()=>{},show:async()=>({status:'unavailable'})};
  },{key,state,language,theme});
  await page.goto('/');await expect(page.locator('#dialog[open]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
}
async function rawHit(page:Page,selector:string){
  const box=await page.locator(selector).boundingBox();expect(box).toBeTruthy();
  expect(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
}
/** Glyph rectangles must fit every actual clipping ancestor before autoscroll. */
async function glyphs(page:Page,selector:string){
  return page.locator(selector).evaluateAll(elements=>elements.flatMap(e=>{
    if(!e.checkVisibility()||!e.textContent?.trim())return [];
    let top=0,left=0,right=innerWidth,bottom=innerHeight;
    for(let a=e.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),r=a.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,r.top+a.clientTop);bottom=Math.min(bottom,r.top+a.clientTop+a.clientHeight);}
      if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,r.left+a.clientLeft);right=Math.min(right,r.left+a.clientLeft+a.clientWidth);}}
    const range=document.createRange();range.selectNodeContents(e);
    return [...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({text:e.textContent,ok:r.top>=top-1&&r.bottom<=bottom+1&&r.left>=left-1&&r.right<=right+1,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},clip:{top,bottom,left,right}}));
  }));
}
for(const [width,height] of [[320,520],[320,568],[360,640],[390,844],[568,320],[844,390],[800,1280]])
  for(const theme of ['light','dark'])for(const kind of ['task','page','book','daily','classic'])test(`VA01 ${kind} glyphs and raw actions ${width}x${height} ${theme}`,async({browser})=>{
    for(const language of ['ru','en','es','tr','pt-BR']){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();
      await seed(page,kind==='classic'?'task':kind,language,theme);
      if(kind==='classic'){
        await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key)!);p.sessions.classic=p.sessions[p.active];p.active='classic';p.meta.attempts.classic={id:'classic-va48',completed:false};localStorage.setItem(key,JSON.stringify(p));},key);
        await page.reload();await expect(page.locator('#dialog[open]')).toBeVisible();
      }
      await resumeStoredGame(page);await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
      await expect(page.locator('#win')).toBeVisible();await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
      const texts=await glyphs(page,'#win h1,#result-gains,#award .metal-name,#result-jar-amount');
      expect(texts.filter(t=>!t.ok),`${language}/${kind}`).toEqual([]);
      await rawHit(page,'#play-again');
      if(language==='ru'||language==='pt-BR')await page.screenshot({path:test.info().outputPath(`${language}-${kind}.png`)});
      await context.close();
    }
  });
for(const [width,height] of [[320,520],[568,320]])for(const theme of ['light','dark'])for(const kind of ['silver','gold','replay'])test(`VA01 rare daily ${kind} ${width} ${theme}`,async({browser})=>{
  for(const language of ['ru','pt-BR']){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();
    await page.clock.install({time:new Date('2026-11-26T12:00:00Z')});await seed(page,'daily',language,theme);
    await page.evaluate(({key,kind})=>{
      const p=JSON.parse(localStorage.getItem(key)!),active='daily-v1-2026-11-26',game=p.sessions[p.active];
      p.active=active;p.sessions={[active]:game};p.done=Array.from({length:kind==='silver'?13:kind==='gold'?29:30},(_,i)=>`daily-v1-2026-11-${String(i+1===26&&kind!=='replay'?30:i+1).padStart(2,'0')}`);
      p.meta.attempts={[active]:{id:'rare-va48',completed:kind==='replay'}};p.jars.attempt='rare-va48';localStorage.setItem(key,JSON.stringify(p));
    },{key,kind});await page.reload();await expect(page.locator('#dialog[open]')).toBeVisible();
    await resumeStoredGame(page);await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
    await expect(page.locator('#win')).toBeVisible();await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
    expect((await glyphs(page,'#win h1,#result-gains,#award .metal-name,#result-jar-amount')).filter(t=>!t.ok)).toEqual([]);
    await rawHit(page,'#result-home');await rawHit(page,'#play-again');
    await page.screenshot({path:test.info().outputPath(`${language}-${kind}.png`)});await context.close();
  }
});
for(const language of ['ru','en','es','tr','pt-BR'])test(`VA02/03/05/07 menus and enlarged language ${language}`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:520});await seed(page,'classic',language);
  expect((await glyphs(page,'.home-links button')).filter(t=>!t.ok)).toEqual([]);
  for(const selector of ['#progress-open','#learn','#settings-open','#pause-language'])await rawHit(page,selector);
  await page.locator('#pause-language').click();
  for(const size of [16,24,32]){
    await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',size);
    for(const option of await page.locator('#language-options button').all()){
      await option.scrollIntoViewIfNeeded();
      const bounds=await option.evaluate(e=>{const r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e.querySelector('.language-option-copy')!);return [...range.getClientRects()].filter(t=>t.left<r.left-1||t.right>r.right+1||t.top<r.top-1||t.bottom>r.bottom+1).map(t=>({text:e.textContent,button:r.toJSON(),glyph:t.toJSON()}));});
      if(bounds.length)await page.screenshot({path:test.info().outputPath(`language-${size}-overflow.png`)});
      expect(bounds,`${language}, root ${size}px`).toEqual([]);
    }
  }
  await page.keyboard.press('Escape');await page.locator('#book-mode').click();await page.locator('#all-books').click();
  expect((await glyphs(page,'.book-sections button')).filter(t=>!t.ok)).toEqual([]);
  await page.locator('#collection-back').click();await page.locator('#collection-back').click();
  await page.evaluate(()=>document.documentElement.style.fontSize='16px');await page.setViewportSize({width:800,height:1280});
  await page.locator('#progress-open').click();await expect(page.locator('#progress-jar .progress-jar-cue')).toBeVisible();
  const heights=await page.locator('#progress-jar,#progress-book,#progress-trophies').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThan(330);
  await page.screenshot({path:test.info().outputPath('tablet-progress.png')});
});
test('VA04 landscape dead field exposes primary/Undo actions before scrolling',async({page})=>{
  await page.setViewportSize({width:568,height:320});await page.emulateMedia({reducedMotion:'reduce'});await seed(page,'dead');await resumeStoredGame(page);
  await expect(page.locator('#no-moves-card')).toBeVisible();await rawHit(page,'#no-moves-primary');
  expect((await glyphs(page,'#no-moves-primary')).filter(t=>!t.ok)).toEqual([]);
  await page.screenshot({path:test.info().outputPath('landscape-dead.png')});
});
for(const theme of ['light','dark'])for(const index of [0,1,2,12])test(`VA09 linear glass volume jar ${index} ${theme}`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});const cap=index===0?24:index===1?60:index===2?100:480,base=prefix(index);
  await seed(page,'classic','ru',theme,base);let previous=-1;
  for(const percentage of [0,1,25,50,75,79,80,90,99]){
    const filled=Math.floor(cap*percentage/100);
    await page.evaluate(({key,value})=>{const p=JSON.parse(localStorage.getItem(key)!);p.jars.meter=p.jars.seeds=value;localStorage.setItem(key,JSON.stringify(p));},{key,value:base+filled});
    await page.reload();await expect(page.locator('#home-jar')).toBeVisible();
    const ratio=await page.locator('#home-jar .jar-interior').evaluate(e=>{const fill=e.querySelector('.jar-fill')!;return fill.getBoundingClientRect().height/e.getBoundingClientRect().height;});
    expect(Math.abs(ratio-filled/cap)).toBeLessThan(.006);
    expect(ratio).toBeGreaterThanOrEqual(previous);previous=ratio;
    if([0,50,80,99].includes(percentage))await page.screenshot({path:test.info().outputPath(`fill-${percentage}.png`)});
  }
});
for(const theme of ['light','dark'])for(const [width,height] of [[320,520],[390,844]])test(`VA09 every jar surface and collected 100% ${theme} ${width}`,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  await seed(page,'task','ru',theme,183);
  const ratio=async(selector:string)=>page.locator(selector).first().evaluate(e=>e.querySelector('.jar-fill')!.getBoundingClientRect().height/e.getBoundingClientRect().height);
  expect(await ratio('#home-jar .jar-interior')).toBeCloseTo(.99,2);
  await page.locator('#progress-open').click();expect(await ratio('#progress-jar .jar-interior')).toBeCloseTo(.99,2);
  await page.keyboard.press('Escape');await page.locator('#home-jar').click();
  expect(await ratio('.jar-collection .progress-hero .jar-interior')).toBeCloseTo(.99,2);
  for(const interior of await page.locator('.jar-keepsake .jar-interior').all())expect(await interior.evaluate(e=>e.querySelector('.jar-fill')!.getBoundingClientRect().height/e.getBoundingClientRect().height)).toBeCloseTo(1,2);
  await page.keyboard.press('Escape');await resumeStoredGame(page);
  expect(await ratio('#jar-glass .jar-interior')).toBeCloseTo(.99,2);
  await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');await expect(page.locator('#win')).toBeVisible();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(187);
  expect(await ratio('#result-jar-glass .jar-interior')).toBeCloseTo(3/140,2);
  await page.locator('#menu').click();await page.locator('#home-jar').click();
  expect(await ratio('.jar-collection .progress-hero .jar-interior')).toBeCloseTo(3/140,2);
  expect(await ratio('.jar-keepsake .jar-interior')).toBeCloseTo(1,2);
  await page.screenshot({path:test.info().outputPath('collected-full-and-next-remainder.png')});
});
for(const outcome of ['release','failure-retry','background','resize','reduced','resize-new-move'])test(`VA11 held save never paints new→old jar ${outcome}`,async({page,context})=>{
  if(outcome==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
  await seed(page,outcome==='resize-new-move'?'classic-six':'classic');await resumeStoredGame(page);await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
  const blocker=await context.newPage();await blocker.goto('/');
  await blocker.evaluate(()=>{(window as any).held=new Promise<void>(ready=>{void navigator.locks.request('seeds-save',async()=>{ready();await new Promise<void>(release=>(window as any).release=release);});});});
  await blocker.evaluate(()=>(window as any).held);await page.bringToFront();
  await page.evaluate(()=>{
    const samples:any[]=[];(window as any).va48Samples=samples;(window as any).va48Recording=true;
    function frame(){if(!(window as any).va48Recording)return;const e=document.querySelector<HTMLElement>('#jar-meter')!;
      samples.push({filled:e.dataset.filled,capacity:e.dataset.capacity,full:e.dataset.full,persistence:document.querySelector<HTMLElement>('.game')!.dataset.persistence,spill:!!document.querySelector('#jar-spill')});requestAnimationFrame(frame);}frame();
  });
  if(outcome==='failure-retry')await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='seeds-bits.progress.v2')throw new DOMException('test fault','QuotaExceededError');return set.call(this,k,v);};(window as any).va48Restore=()=>Storage.prototype.setItem=set;});
  await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
  await page.waitForTimeout(1000);await expect(page.locator('.game')).toHaveAttribute('data-persistence','pending');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(22);
  await expect(page.locator('#jar-meter')).toHaveAttribute('data-capacity','24');await expect(page.locator('#jar-spill')).toHaveCount(0);
  if(outcome==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  if(outcome.startsWith('resize'))await page.setViewportSize({width:400,height:800});
  if(outcome==='resize-new-move'){await page.locator('[data-index="2"]').click();await page.locator('[data-index="3"]').click();}
  await blocker.evaluate(()=>(window as any).release());
  if(outcome==='failure-retry'){
    await expect(page.locator('.game')).toHaveAttribute('data-persistence','failed');await expect(page.locator('#jar-meter')).toHaveAttribute('data-capacity','24');
    await page.evaluate(()=>(window as any).va48Restore());await page.locator('#retry-save').click();
  }
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(outcome==='resize-new-move'?26:24);
  if(outcome==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#jar-meter')).toHaveAttribute('data-capacity','60',{timeout:7000});
  if(outcome==='resize-new-move')await expect(page.locator('#jar-meter')).toHaveAttribute('data-filled','2');
  if(['background','resize','reduced'].includes(outcome)){
    await expect(page.locator('#jar-meter')).toHaveAttribute('data-filled','0');
    await expect(page.locator('#jar-spill,.flying-seed')).toHaveCount(0);
    await expect(page.locator('#jar-meter')).toHaveAttribute('data-full','false');
  }
  await page.evaluate(()=>(window as any).va48Recording=false);
  const samples=await page.evaluate(()=>(window as any).va48Samples);
  expect(samples.some((s:any)=>s.persistence==='pending'&&(s.capacity==='60'||s.full==='true'||s.spill))).toBe(false);
  const changes=samples.map((s:any)=>s.capacity).filter((x:string,i:number,all:string[])=>i===0||x!==all[i-1]);
  expect(changes.filter((x:string)=>x==='24')).toHaveLength(1);
  await test.info().attach('durable-jar-frames.json',{body:JSON.stringify(samples),contentType:'application/json'});await blocker.close();
});
