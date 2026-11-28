import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const progress='seeds-bits.progress.v2', settings='seeds-bits.settings.v1';
const opening=[0,0,0,0,9,1,0,1,6,3,0,3,0,0,9,0,0,4];
const pause=async(p:Page)=>{await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
async function tap(p:Page,sel:string){
 const point=await p.locator(sel).evaluate(e=>{
  const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  return {x,y,hit:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))};
 });
 expect(point.hit,sel+JSON.stringify(point)).toBe(true);await p.mouse.click(point.x,point.y);await pause(p);
}
const digit=(p:Page,n:number)=>tap(p,`#board [data-index="${n}"]`);
async function geometry(p:Page){return p.evaluate(()=>{
 const rect=(sel:string)=>{const e=document.querySelector<HTMLElement>(sel)!;return e.getBoundingClientRect().toJSON();};
 const first=document.querySelector<HTMLElement>('#board button.cell')!;
 const cell=first?.getBoundingClientRect(),index=Number(first?.dataset.index??0);
 return {classes:document.querySelector('.game')!.className,top:rect('.game-top'),viewportStyle:{display:getComputedStyle(document.querySelector('#viewport')!).display,alignItems:getComputedStyle(document.querySelector('#viewport')!).alignItems,gridRow:getComputedStyle(document.querySelector('#viewport')!).gridRow},viewport:rect('#viewport'),footer:rect('footer'),status:rect('.status-wrap'),
  grid:getComputedStyle(document.querySelector('#board')!).gridTemplateColumns.split(' ').length,
  cell:cell?{pitch:cell.width,height:cell.height,x:cell.x-index%9*cell.width,y:cell.y-Math.floor(index/9)*cell.height,font:getComputedStyle(first.querySelector('.digit')!).fontSize}:null,
  tools:['#undo','#add'].map(rect)};
});}
function sameRect(a:any,b:any){for(const key of ['x','y','width','height'])expect(Math.abs(a[key]-b[key]),key).toBeLessThanOrEqual(1);}
function sameCell(a:any,b:any){expect(a.grid).toBe(9);expect(b.grid).toBe(9);expect(a.cell.font).toBe(b.cell.font);for(const k of ['pitch','height','x','y'])expect(Math.abs(a.cell[k]-b.cell[k]),k).toBeLessThanOrEqual(1);}
function saveEvidence(info:any,name:string,value:any){mkdirSync(info.outputDir,{recursive:true});writeFileSync(path.join(info.outputDir,name),JSON.stringify(value,null,2));}
for(const language of ['ru-RU','en-US','tr-TR','es-ES','pt-BR'])for(const theme of ['light','dark'] as const)for(const [width,height] of [[320,520],[320,568],[360,640],[390,844],[768,1024],[568,320],[844,390]]){
 test.describe(`${language} ${theme} ${width}x${height}`,()=>{
  test.use({locale:language,viewport:{width,height},colorScheme:theme});
  test('FT01–03 product entry, shared field, six optional lessons without layout jumps',async({page,browser},info)=>{
   const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));await page.emulateMedia({reducedMotion:'reduce'});
   await page.goto('/');await expect(page.locator('.opening-copy')).toBeVisible();await pause(page);
   await tap(page,'#menu');await tap(page,'#settings-open');if(await page.locator('#dark').isChecked()!==(theme==='dark'))await tap(page,'#dark');await tap(page,'#settings-back');await tap(page,'#resume');expect(await page.locator('#dark').isChecked()).toBe(theme==='dark');
   expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions['book-v1-1'].current.board,progress)).toEqual(opening);
   await expect(page.locator('#lesson')).toBeHidden();await expect(page.locator('#add')).toBeHidden();
   const guided=await geometry(page);await page.screenshot({path:info.outputPath('first-guided.png')});
   await digit(page,4);sameRect((await geometry(page)).viewport,guided.viewport);
   await digit(page,8);sameRect((await geometry(page)).viewport,guided.viewport);await page.screenshot({path:info.outputPath('first-error.png')});
   // Remove only the teaching marker in the fixture. The same saved task/board
   // then provides the ordinary renderer comparison, with no changed content.
   await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k)!);d.seen=d.seen.filter((s:string)=>s!=='first-notebook-guide-v1');localStorage.setItem(k,JSON.stringify(d));},progress);
   await page.reload();await expect(page.locator('#dialog')).toBeVisible();await tap(page,'#resume');
   await expect(page.locator('.opening-copy')).toHaveCount(0);const ordinary=await geometry(page);sameCell(guided,ordinary);sameRect(guided.viewport,ordinary.viewport);sameRect(guided.footer,ordinary.footer);
   await page.screenshot({path:info.outputPath('first-ordinary.png')});
   const before=await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k)!);return{active:d.active,sessions:d.sessions,done:d.done,jars:d.jars,wallet:d.meta?.wallet??0,hints:d.hints};},progress);
   await tap(page,'#menu');await tap(page,'#learn');await expect(page.locator('#lesson-step')).toHaveText('1 / 6');
   const records:any[]=[];let previous:any;
   for(let step=0;step<6;step++){
    await expect(page.locator('#lesson-step')).toHaveText(`${step+1} / 6`);const initial=await geometry(page);
    // Compare with the same actual board, not another lesson's row count.
    const values=await page.locator('#board .cell').evaluateAll(es=>es.map(e=>Number(e.textContent?.trim())||0));
    const peer=await browser.newContext({locale:language,viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});const peerPage=await peer.newPage();
    await peerPage.addInitScript(({progress,settings,values,theme})=>{
     localStorage.setItem(settings,JSON.stringify({tutorialDone:true,sound:false,theme}));
     localStorage.setItem(progress,JSON.stringify({version:3,active:'book-v1-1',sessions:{'book-v1-1':{rules:1,current:{board:values,moves:1,scroll:0,additions:0},history:[]}},done:[],seen:[],hints:{}}));
    },{progress,settings,values,theme});
    await peerPage.goto('/');await peerPage.locator('#resume').click();await pause(peerPage);const matched=await geometry(peerPage);saveEvidence(info,`lesson-${step+1}-comparison.json`,{initial,matched});sameCell(matched,initial);await peer.close();
    if(previous){sameRect(initial.viewport,previous.viewport);sameRect(initial.footer,previous.footer);}
    await page.screenshot({path:info.outputPath(`lesson-${step+1}.png`)});
    if(step===5){await tap(page,'#add');await expect(page.locator('#remaining')).toHaveText('4');await tap(page,'#undo');await expect(page.locator('#remaining')).toHaveText('2');}
    else{const pair=[[0,1],[0,1],[0,3],[0,20],[8,9]][step];await digit(page,pair[0]);await digit(page,pair[1]);}
    await expect(page.locator('#lesson-next')).toBeVisible();const answered=await geometry(page);sameRect(initial.viewport,answered.viewport);sameRect(initial.footer,answered.footer);
    records.push({step:step+1,initial,matched,answered});previous=initial;await tap(page,'#lesson-next');
   }
   await expect(page.locator('#dialog')).toBeHidden();await expect(page.locator('#lesson')).toBeHidden();
   const after=await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k)!);return{active:d.active,sessions:d.sessions,done:d.done,jars:d.jars,wallet:d.meta?.wallet??0,hints:d.hints};},progress);
   // Only the scroll anchor may be captured on entering a voluntary course.
   for(const data of [before,after])for(const session of Object.values(data.sessions) as any[])session.current.scroll=0;
   expect(after).toEqual(before);expect(errors).toEqual([]);
   saveEvidence(info,'shared-geometry.json',{source:process.env.GITHUB_SHA,productionBundle:true,language,theme,width,height,guided,ordinary,lessons:records,progressPreserved:true,pageErrors:errors});
  });
 });
}
test('FT01 production preserves settings-only, legacy progress and explicit skip / Back',async({browser},info)=>{
 const records=[];
 for(const kind of ['settings-only','legacy','future','read-error','first-write-error'] as const){
  const context=await browser.newContext({locale:'ru-RU',viewport:{width:320,height:568},reducedMotion:'reduce'});const page=await context.newPage();
  await page.addInitScript(({kind,progress,settings})=>{
   if(kind==='read-error'){
    const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===progress)throw Error('read fault');return get.call(this,k);};return;
   }
   if(kind==='first-write-error'){
    const set=Storage.prototype.setItem;(window as any).restoreTutorialStorage=()=>Storage.prototype.setItem=set;
    Storage.prototype.setItem=function(k,v){if(k===progress&&JSON.parse(v).active==='book-v1-1')throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};return;
   }
   localStorage.setItem(settings,JSON.stringify({tutorialDone:false,sound:false}));
   if(kind!=='settings-only')localStorage.setItem(progress,JSON.stringify({version:kind==='future'?999:3,active:'classic',sessions:{classic:{rules:1,current:{board:[5,5,2,8],moves:1,additions:0,scroll:0},history:[]}},done:[],seen:[],hints:{}}));
  },{kind,progress,settings});
  await page.goto('/');await expect(page.locator('#dialog')).toBeVisible();await expect(page.locator('#lesson')).toBeHidden();await expect(page.locator('.opening-copy')).toHaveCount(0);
  if(kind==='first-write-error'){await page.evaluate(()=>(window as any).restoreTutorialStorage());if(await page.locator('#retry-save').isVisible()){await tap(page,'#retry-save');await expect(page.locator('#save-notice')).toBeHidden();}}
  if(kind==='settings-only'||kind==='legacy'){await tap(page,'#learn');await expect(page.locator('#lesson-step')).toHaveText('1 / 6');await tap(page,'#skip');await expect(page.locator('#dialog')).toBeVisible();await tap(page,'#learn');await page.keyboard.press('Escape');await expect(page.locator('#dialog')).toBeVisible();}
  records.push({kind,automaticCourse:false,firstTaskReplay:false});await context.close();
 }
 saveEvidence(info,'production-profiles.json',{source:process.env.GITHUB_SHA,productionBundle:true,records});
});
