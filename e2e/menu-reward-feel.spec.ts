import {test,expect,type Page} from '@playwright/test';
import {resumeStoredGame} from './restore-game';
const key='seeds-bits.progress.v2';
const ids=(n:number)=>Array.from({length:n},(_,i)=>`book-v1-${i+1}`);
async function seed(page:Page,kind='task',meter=22,language='ru',theme='light') {
  const daily=kind.startsWith('daily'),classic=kind==='classic'||kind==='menu';
  const n=kind==='page'?5:kind==='book'?23:kind==='page-replay'?6:kind==='book-replay'?24:0;
  const active=classic?'classic':daily?'daily-v1-2026-11-26':`book-v1-${kind.startsWith('page')?6:kind.startsWith('book')?24:9}`;
  const dayCount=kind==='daily-gold'?29:kind==='daily-silver'?13:kind==='daily-bronze'?6:3;
  const done=daily?Array.from({length:dayCount},(_,i)=>`daily-v1-2026-11-${String(i+1===26?30:i+1).padStart(2,'0')}`):ids(n);
  const state:any={version:3,active,done,seen:[],hints:{},sessions:{[active]:{rules:1,current:{board:[5,5],moves:1,additions:0,scroll:0},history:[]}},
    jars:{version:2,meter,seeds:meter,wins:3,attempt:'feel46',highWater:1},meta:{version:2,since:'2026-11-01',completed:10,unassisted:10,wallet:1,attempts:{[active]:{id:'feel46',completed:false}}}};
  if(kind==='menu'){state.sessions['book-v1-1']=structuredClone(state.sessions.classic);state.meta.attempts['book-v1-1']={id:'menu-notebook',completed:false};}
  await page.addInitScript(({key,state,language,theme})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
    if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
    (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),show:async()=>({status:'unavailable'})};
  },{key,state,language,theme});
  await page.goto('/');await expect(page.locator('#dialog')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
}
async function raw(page:Page,selector:string,initial=true){
  const b=(await page.locator(selector).boundingBox())!;expect(b).toBeTruthy();
  if(initial){expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}
  expect(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
}
async function win(page:Page){await resumeStoredGame(page);await raw(page,'[data-index="0"]');await raw(page,'[data-index="1"]');await expect(page.locator('#win')).toBeVisible();}
async function trace(page:Page){
  return page.evaluate(async()=>{
    const start=performance.now(),samples:any[]=[];
    await new Promise<void>(resolve=>{const frame=()=>{
      const paper=document.querySelector('.quiet-result-page')!,card=document.querySelector<HTMLElement>('#result-jar-card')!,glass=document.querySelector<HTMLElement>('#result-jar-glass')!;
      const r=glass.getBoundingClientRect(), anchor=glass.parentElement!.getBoundingClientRect();
      samples.push({at:performance.now()-start,kind:document.querySelector('#win')?.getAttribute('data-result-kind'),fill:card.dataset.filled,capacity:card.dataset.capacity,index:card.dataset.jarIndex,
        phase:glass.dataset.rewardPhase,spillTarget:document.querySelector<HTMLElement>('#jar-spill')?.dataset.target,
        particles:document.querySelectorAll('.result-seed-burst i,#jar-spill i,.trophy-confetti i,.flying-seed').length,
        angle:Math.atan2(new DOMMatrix(getComputedStyle(paper).transform).b,new DOMMatrix(getComputedStyle(paper).transform).a)*180/Math.PI,
        opacity:Number(getComputedStyle(document.querySelector('#win')!).opacity),box:{x:r.x,y:r.y,width:r.width,height:r.height},anchor:{x:anchor.x,y:anchor.y,width:anchor.width,height:anchor.height}});
      if(performance.now()-start>4300)resolve();else requestAnimationFrame(frame);
    };frame();});return samples;
  });
}
for(const kind of ['task','page','book','classic','daily','daily-bronze','daily-silver','daily-gold'])test(`MF earned ${kind}: one scene, true final total, no pose jump`,async({page})=>{
  await page.setViewportSize({width:320,height:568});await seed(page,kind);await win(page);
  const samples=await trace(page);await test.info().attach('frames.json',{body:JSON.stringify(samples),contentType:'application/json'});
  expect(Math.max(...samples.map(x=>x.particles))).toBeLessThanOrEqual(26);
  expect(samples.every(x=>x.opacity===1)).toBe(true);
  if(['task','page','book'].includes(kind))expect(Math.max(...samples.map(x=>Math.abs(x.angle)))).toBeLessThan(.1);
  for(const axis of ['x','y'])expect(Math.max(...samples.map(x=>x.anchor[axis]))-Math.min(...samples.map(x=>x.anchor[axis]))).toBeLessThanOrEqual(1);
  expect(samples.some(x=>x.fill==='24'&&x.capacity==='24')).toBe(true);
  expect(samples.some(x=>x.phase==='closing'&&x.spillTarget==='result-jar-glass')).toBe(true);
  const total=kind==='classic'?24:26;
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(total);
  await expect(page.locator('#result-jar-card')).toHaveAttribute('data-filled',String(total-24));
  await raw(page,'#play-again');
  await expect(page.locator('#jar-spill,.trophy-confetti,.result-seed-burst i,.flying-seed')).toHaveCount(0);
});
for(const kind of ['page-replay','book-replay'])test(`MF replay exact final member ${kind}`,async({page})=>{
  await seed(page,kind,20);await win(page);await expect(page.locator('#win')).toHaveAttribute('data-result-kind','task');
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).meta.attempts[JSON.parse(localStorage.getItem(key)!).active].completed,key)).toBe(true);
  await expect(page.locator('.result-seed-burst i,.trophy-confetti i,#jar-spill')).toHaveCount(0);
  const before=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await resumeStoredGame(page);
  await expect(page.locator('#win')).toHaveAttribute('data-result-kind','task');
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(after.jars.meter).toBe(20);expect(after.done.length).toBe(kind==='page-replay'?6:24);
  expect(after.meta.completed).toBe(JSON.parse(before!).meta.completed);
});
for(const mode of ['reduced','next','background','resize'])test(`MF interruption ${mode} settles to durable outcome`,async({page})=>{
  if(mode==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
  await seed(page,'daily-bronze');await win(page);
  if(mode==='next')await raw(page,'#play-again');
  if(mode==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  if(mode==='resize')await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.result-seed-burst i,.trophy-confetti i,#jar-spill,.flying-seed')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(26);
  await page.waitForTimeout(1600); // exceed the cancelled visual sequence, not a save barrier
  await expect(page.locator('.result-seed-burst i,.trophy-confetti i,#jar-spill,.flying-seed')).toHaveCount(0);
});
for(const language of ['ru','en','es','tr','pt-BR'])for(const theme of ['light','dark'])test(`MF menu layout ${language} ${theme}`,async({page})=>{
  await seed(page,'menu',5600,language,theme);
  for(const [width,height] of [[320,568],[390,844],[844,390]])for(const font of [16,24,32]){
    await page.setViewportSize({width,height});await page.evaluate(font=>document.documentElement.style.fontSize=font+'px',font);
    const words=await page.locator('#book-quick').evaluate(e=>{
      const node=e.firstChild!,text=e.textContent??"",box=e.getBoundingClientRect();
      return [...text.matchAll(/\S+/g)].map(word=>{
        const range=document.createRange();range.setStart(node,word.index!);range.setEnd(node,word.index!+word[0].length);
        return {word:word[0],box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},rects:[...range.getClientRects()].filter(r=>r.width>0).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}))};
      });
    });
    await page.screenshot({path:test.info().outputPath(`home-${width}-${font}.png`),animations:"disabled"});
    expect(words.length).toBeGreaterThan(0);
    for(const word of words) {
      expect(new Set(word.rects.map(r=>Math.round(r.top))).size,word.word).toBe(1);
      for(const r of word.rects) {
        expect(r.left).toBeGreaterThanOrEqual(Math.max(0,word.box.left)-1);
        expect(r.right).toBeLessThanOrEqual(Math.min(width,word.box.right)+1);
      }
    }
  }
  await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.documentElement.style.fontSize='16px');
  await raw(page,'#book-quick');await expect(page.locator('#dialog')).toBeHidden();await raw(page,'#menu');
  await raw(page,'#progress-open');await raw(page,'#progress-jar');await expect(page.locator('#dialog')).toHaveAttribute('data-screen','trophies');
  await raw(page,'#trophies-mode');await raw(page,'#jars-tab');await raw(page,'#collection-back');await raw(page,'#collection-back');
  await raw(page,'#pause-language');
  const languageBox=(await page.locator('#language-sheet').boundingBox())!;expect(languageBox.height).toBeLessThan(568-24);
  // A fixed dialog with top/bottom:0 and height:auto fills the viewport even
  // though its options need much less space. Check the real content boundary.
  const languageContent=await page.locator('#language-sheet').evaluate(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect(),options=el.querySelector('#language-options')!.getBoundingClientRect();
    return {blank:r.bottom-options.bottom,expected:parseFloat(s.paddingBottom)+parseFloat(s.borderBottomWidth)};
  });
  expect(languageContent.blank).toBeLessThanOrEqual(languageContent.expected+2);
  await raw(page,'#language-close');
});
for(const mode of ['held','failed'])test(`MF ${mode} commit cannot celebrate; successful retry earns once`,async({page})=>{
  await seed(page,'book',22);await resumeStoredGame(page);
  await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
  if(mode==='held'){
    await page.evaluate(()=>{const w=window as any;w.acquired46=new Promise<void>(done=>{void navigator.locks.request('seeds-save',async()=>{done();await new Promise<void>(r=>w.release46=r);});});});
    await page.evaluate(()=>(window as any).acquired46);
  }else await page.evaluate(key=>{
    const set=Storage.prototype.setItem;(window as any).fail46=true;
    Storage.prototype.setItem=function(k,v){if(k===key&&(window as any).fail46&&JSON.parse(v).sessions?.['book-v1-24']?.current?.board.length===0)throw new DOMException('test write fault','QuotaExceededError');return set.call(this,k,v);};
  },key);
  await raw(page,'[data-index="0"]');await raw(page,'[data-index="1"]');await expect(page.locator('#win')).toBeVisible();
  await page.waitForTimeout(1800); // cross the former visual timeout while the real write is blocked
  await expect(page.locator('#jar-spill,.trophy-confetti i,.result-seed-burst i,.flying-seed')).toHaveCount(0);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(22);
  if(mode==='held')await page.evaluate(()=>(window as any).release46());
  else {await page.evaluate(()=>(window as any).fail46=false);await raw(page,'#retry-save');}
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(26);
  await expect(page.locator('#jar-spill')).toHaveAttribute('data-target','result-jar-glass');
  await expect(page.locator('#result-jar-card')).toHaveAttribute('data-filled','2');
  await page.reload();await resumeStoredGame(page);await expect(page.locator('#jar-spill,.result-seed-burst i')).toHaveCount(0);
});
for(const meter of [0,24,2884,3364])test(`MF collection ${meter}: earned state only, no replayed celebration`,async({page})=>{
  await seed(page,'task',meter);await raw(page,'#home-jar');
  await expect(page.locator('#jar-spill,.trophy-confetti i,.result-seed-burst i')).toHaveCount(0);
  await expect(page.locator('.jar-collection')).toBeVisible();
  const count=await page.locator('.jar-keepsake').count();expect(count).toBeLessThanOrEqual(12);
  await raw(page,'#trophies-mode');await raw(page,'#jars-tab');
  expect(await page.locator('.jar-keepsake').count()).toBe(count);
});
test('MF fast local navigation and cancellation retain current selection and input',async({page})=>{
  await seed(page);await raw(page,'#book-mode');await raw(page,'#all-books');
  await page.locator('#book-range-4').click();await page.locator('#book-range-0').click();
  await expect(page.locator('#book-range-0')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.volume-shelf [data-volume="0"]')).toBeVisible();
  await raw(page,'#collection-back');await raw(page,'#collection-back');
  const b=(await page.locator('#book-mode').boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await expect(page.locator('#book-mode')).toHaveClass(/is-pressed/);
  await page.dispatchEvent('#book-mode','pointercancel');await page.mouse.move(0,0);await page.mouse.up();
  await expect(page.locator('#dialog')).toHaveAttribute('data-screen','home');await expect(page.locator('button.is-pressed')).toHaveCount(0);
  await page.setViewportSize({width:320,height:568});await page.locator('#calendar-open').click();
  const targets=await page.evaluate(async()=>{
    document.querySelector<HTMLButtonElement>('#prev-month')!.click();
    const start=performance.now(),samples:{w:number,h:number}[]=[];
    await new Promise<void>(resolve=>{const frame=()=>{
      for(const day of document.querySelectorAll('.calendar .task')){const r=day.getBoundingClientRect();samples.push({w:r.width,h:r.height});}
      if(performance.now()-start>=180)resolve();else requestAnimationFrame(frame);
    };frame();});return samples;
  });
  expect(targets.length).toBeGreaterThan(28);
  expect(targets.every(r=>r.w>=44&&r.h>=44)).toBe(true);
});
test('MF multiple jar thresholds coalesce while every accepted move remains durable',async({page})=>{
  await seed(page,'classic',22);
  await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key)!);p.sessions.classic.current={board:Array(84).fill(5),moves:0,additions:0,scroll:0};p.jars.highWater=0;localStorage.setItem(key,JSON.stringify(p));},key);
  await page.reload();await resumeStoredGame(page);
  await page.evaluate(()=>{
    (window as any).closings46=0;
    new MutationObserver(records=>{for(const r of records)if((r.target as HTMLElement).dataset.rewardPhase==='closing')(window as any).closings46++;}).observe(document.querySelector('#jar-glass')!,{attributes:true,attributeFilter:['data-reward-phase']});
    for(let i=0;i<40;i++){const digits=[...document.querySelectorAll<HTMLButtonElement>('#board button')].filter(b=>b.textContent?.trim()==='5'&&!b.disabled);digits[0].click();digits[1].click();}
  });
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).jars.meter,key)).toBe(102);
  await expect(page.locator('#jar-name')).toContainText('1–2');
  await expect(page.locator('#jar-name')).toHaveText('Баночка 3');
  await expect(page.locator('#jar-meter')).toHaveAttribute('data-filled','18');
  expect(await page.evaluate(()=>(window as any).closings46)).toBe(1);
  const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(p.sessions.classic.current.moves).toBe(40);expect(p.sessions.classic.current.board.filter(Boolean)).toHaveLength(4);
});
