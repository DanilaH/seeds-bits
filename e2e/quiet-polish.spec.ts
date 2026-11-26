import {expect,test,type Page} from '@playwright/test';
import {checkPair} from '../src/core';
const key='seeds-bits.progress.v2';
const mixed=Array(45).fill(0);for(const [i,v] of [[0,4],[2,4],[4,6],[8,6],[9,2],[10,6],[20,8],[44,4]])mixed[i]=v;
async function seed(page:Page,{board=mixed,language='ru',theme='light',meter=3004,id='classic',done=[] as string[],wallet=1}={}) {
 await page.addInitScript(({board,language,theme,meter,id,done,wallet,key})=>{
  localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
  localStorage.setItem(key,JSON.stringify({version:3,active:id,sessions:{[id]:{rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]}},done,seen:[],hints:{},jars:{version:2,meter,seeds:meter,wins:7,attempt:'polish',highWater:1},meta:{version:2,since:'2026-11-01',wallet,completed:1,unassisted:0,attempts:{[id]:{id:'polish',completed:false,hintKeys:['old1','old2','old3']}}}}));
  (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),pending:async()=>({}),show:async()=>({status:'unavailable'})};
 },{board,language,theme,meter,id,done,wallet,key});
 await page.goto('/');await expect(page.locator('#dialog')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
}
async function durable(page:Page){return page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key)!);return {board:p.sessions[p.active],wallet:p.meta.wallet,attempts:p.meta.attempts,done:p.done,hints:p.hints};},key);}
for(const theme of ['light','dark']) for(const motion of ['reduce','no-preference'] as const)test(`reach values, reset and hint priority ${theme} ${motion}`,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});await seed(page,{theme});await page.locator('#resume').click();
 const before=await durable(page);await page.locator('[data-index="0"]').click();
 await expect(page.locator('.reachable-valid')).toHaveCount(2);await expect(page.locator('.reachable-invalid')).toHaveCount(1);
 expect(await page.locator('.reachable-valid').evaluateAll(es=>es.map(e=>+(e as HTMLElement).dataset.index!))).toEqual([2,10]);
 await expect(page.locator('[data-index="9"]')).toHaveClass(/reachable-invalid/);await expect(page.locator('[data-index="9"]')).toHaveCSS('outline-style','dashed');
 await expect(page.locator('[data-index="4"]')).not.toHaveClass(/reachable/);await expect(page.locator('[data-index="20"]')).not.toHaveClass(/reachable/);
 await expect(page.locator('[data-index="2"]')).toHaveAttribute('aria-description','Достижима: допустимая пара');
 await expect(page.locator('[data-index="9"]')).toHaveAttribute('aria-description','Достижима: числа не образуют пару');
 expect(await durable(page)).toEqual(before);
 await page.locator('[data-index="0"]').click();await expect(page.locator('.reachable')).toHaveCount(0);
 await page.locator('[data-index="0"]').click();await page.locator('[data-index="2"]').click();await expect(page.locator('.reachable')).toHaveCount(0);
 await page.locator('#undo').click();await page.locator('[data-index="0"]').click();await expect(page.locator('.reachable-valid')).toHaveCount(2);
 await page.locator('#hint').click();await expect(page.locator('.hinted')).toHaveCount(2);
 for(const hint of await page.locator('.hinted').all()) {
   const bg=await hint.evaluate(el=>getComputedStyle(el).backgroundColor);const token=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--highlight').trim());
   expect(bg).not.toBe('rgba(0, 0, 0, 0)');expect(token).toBeTruthy();
 }
});
test('all values use the existing pair rule for the same geometric candidates',async({page})=>{
 await seed(page);await page.locator('#resume').click();
 const cases=[];for(let a=1;a<=9;a++)for(let b=1;b<=9;b++)cases.push({board:[a,b],valid:checkPair([a,b],0,1).ok});
 const outcomes=await page.evaluate(async cases=>{
   const {BoardView}=await import(/* @vite-ignore */ '/src/board-view.ts');const root=document.createElement('div');document.body.append(root);const view=new BoardView(root);
   const result=cases.map(({board,valid})=>{view.render(board,0,null);const cell=view.cell(1)!;return {valid,green:cell.classList.contains('reachable-valid'),red:cell.classList.contains('reachable-invalid')};});
   view.render([4,6],0,null,false);const suppressed=!root.querySelector('.reachable');root.remove();return {result,suppressed};
 },cases);
 expect(outcomes.suppressed).toBe(true);for(const r of outcomes.result){expect(r.green).toBe(r.valid);expect(r.red).toBe(!r.valid);}
});
test('Add, Undo, menu and theme cannot retain an obsolete candidate',async({page})=>{
 await seed(page,{board:[1,2]});await page.locator('#resume').click();await page.locator('[data-index="0"]').click();await expect(page.locator('.reachable-invalid')).toHaveCount(1);
 await page.locator('#add').click();await expect(page.locator('.reachable')).toHaveCount(0);await page.locator('#undo').click();await expect(page.locator('.reachable')).toHaveCount(0);
 await page.locator('[data-index="0"]').click();await page.locator('#menu').click();await page.locator('#settings-open').click();await page.locator('#dark').check();await page.locator('#settings-back').click();await page.locator('#resume').click();
 const selection=await page.locator('.cell.selected').getAttribute('data-index').catch(()=>null);
 if(selection===null)await expect(page.locator('.reachable')).toHaveCount(0);else await expect(page.locator('.reachable-invalid')).toHaveCount(1);
});
for(const [width,height] of [[320,568],[390,844]])for(const language of ['ru','en','es','tr','pt-BR'])test(`jar and confirmation density ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await seed(page,{language,theme:width===320?'dark':'light'});
 await page.locator('#progress-open').click();await page.locator('#progress-trophies').click();
 const hero=(await page.locator('.jar-overview .progress-hero').boundingBox())!;expect(hero.height).toBeLessThan(210);
 await expect(page.locator('.jar-overview .hero-value')).toHaveCount(0);await expect(page.locator('#jar-play')).toBeInViewport();
 const shelf=page.locator('.jar-shelf');const first=(await shelf.locator('.jar-keepsake').first().boundingBox())!;expect(first.y).toBeLessThan(height-62);
 await expect(page.locator('#dialog .dialog-head')).toHaveCSS('box-shadow','none');
 await page.locator('#collection-back').click();await page.locator('#collection-back').click();await page.locator('#classic-mode').click();await page.locator('#next-classic').click();await page.locator('[data-classic-level="2"]').click();
 const confirm=(await page.locator('#confirm-content').boundingBox())!;expect(confirm.height).toBeLessThan(330);const padding=await page.locator('#confirm-content').evaluate(el=>getComputedStyle(el).paddingLeft);expect(padding).toBe('16px');
 await page.locator('#cancel-new').click();
});
for(const meter of [0,24,3004,5000])test(`all earned jars remain addressable: ${meter}`,async({page})=>{
 await page.setViewportSize({width:320,height:568});await seed(page,{meter});await page.locator('#progress-open').click();await page.locator('#progress-trophies').click();
 await expect(page.locator('#jar-play')).toBeInViewport();
 if(!meter){await expect(page.locator('.jar-shelf')).toHaveCount(0);await expect(page.locator('.jar-empty')).toBeVisible();}
 else {const seen=new Set<string>();while(true){for(const text of await page.locator('.jar-keepsake small').allTextContents())seen.add(text);if(await page.locator('#older-jars').isDisabled())break;await page.locator('#older-jars').click();}expect(seen.size).toBeGreaterThan(0);}
});
for(const [width,height] of [[320,568],[390,844]])for(const language of ['ru','en','es','tr','pt-BR'])test(`daily ribbon safe area and colored archive ${width} ${language}`,async({browser})=>{
 for(const count of [0,6,13,29]){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();
  const done=Array.from({length:30},(_,i)=>i+1).filter(n=>n!==13).slice(0,count).map(n=>'daily-v1-2026-11-'+String(n).padStart(2,'0'));
  await seed(page,{language,theme:width===320?'dark':'light',id:'daily-v1-2026-11-13',board:[5,5],done});
  await page.locator('#resume').click();await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();await expect(page.locator('#win')).toBeVisible();
  const title=(await page.locator('#win h1').boundingBox())!,ribbon=(await page.locator('.result-ribbon').boundingBox())!;
  expect(title.x+title.width).toBeLessThanOrEqual(ribbon.x+1);
  await expect(page.locator('#play-again')).toHaveClass(/archive-next/);await expect(page.locator('#play-again')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('#play-again')).toBeInViewport();await expect(page.locator('#result-home')).toBeInViewport();
  const overflow=await page.locator('#viewport').evaluate(e=>e.scrollHeight-e.clientHeight);expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
 }
});
