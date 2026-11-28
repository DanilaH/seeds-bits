import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
async function evidence(label:string,value:unknown){const path=test.info().outputPath(label+'.json');writeFileSync(path,JSON.stringify(value,null,2));await test.info().attach(label,{path,contentType:'application/json'});}

const languages=['ru','en','es','tr','pt-BR'];
const progress='seeds-bits.progress.v2';
// Exact "large" Home fixture from the independent 12110 acceptance probe:
// parked notebook/resume, long statistics, all five translations and banner space.
async function start(page:Page,language:string,theme:string,kind='large'){
  const session=(board:number[])=>({rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]});
  const board=kind==='hint'?Array.from({length:180},(_,i)=>i===0||i===171?5:i%9===0?0:1):kind==='dead'?[1,2,3,4]:kind==='classic'?[5,5]:[4,0,6,7,0,3,0,0,1,5,5,8,0,2,9,0,2,0];
  const active=kind==='dead'?'book-v1-25':'classic',large=kind==='large',meter=large?250000:3004;
  const state={version:3,active,sessions:{[active]:session(board),...(active==='classic'?{'book-v1-9':session([4,0,0,6])}:{})},seen:[],hints:{},
    done:[...Array.from({length:8},(_,i)=>`book-v1-${i+1}`),...Array.from({length:6},(_,i)=>`daily-v1-2026-11-0${i+1}`)],
    jars:{version:2,seeds:meter,meter,wins:7,attempt:'audit',highWater:1},
    meta:{version:2,since:'2026-11-01',wallet:large?12345:0,completed:large?123456:21,unassisted:large?98765:17,attempts:{[active]:{id:'audit',completed:false}}}};
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
  await page.addInitScript(({progress,state,language,theme})=>{
    localStorage.setItem(progress,JSON.stringify(state));
    localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
    (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),pending:async()=>({}),show:async()=>({status:'unavailable'})};
  },{progress,state,language,theme});
  await page.goto('/');await expect(page.locator('#dialog[data-screen="home"][open]')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}

// No locator click/scroll before measuring. Check own text bounds, every clipping
// ancestor and five raw hit points; a successful scroll into view is not a pass.
async function geometry(page:Page,selector:string){
  return page.locator(selector).evaluate(e=>{
    const r=e.getBoundingClientRect(),rect=r.toJSON();
    let left=0,top=0,right=innerWidth,bottom=innerHeight;
    const scrolls=[];
    for(let a=e.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,b.left+a.clientLeft);right=Math.min(right,b.left+a.clientLeft+a.clientWidth);}
      if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,b.top+a.clientTop);bottom=Math.min(bottom,b.top+a.clientTop+a.clientHeight);}
      if(/auto|scroll/.test(s.overflowY))scrolls.push({id:a.id,top:a.scrollTop,max:a.scrollHeight-a.clientHeight});
    }
    const glyphs:ReturnType<DOMRect["toJSON"]>[]=[],walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
    for(let n=walker.nextNode();n;n=walker.nextNode())if(n.textContent?.trim()&&!n.parentElement?.closest('svg,[aria-hidden="true"]')){
      const range=document.createRange();range.selectNodeContents(n);
      glyphs.push(...[...range.getClientRects()].filter(b=>b.width>0&&b.height>0).map(b=>b.toJSON()));
    }
    const hits=[[.5,.5],[.18,.18],[.82,.18],[.18,.82],[.82,.82]].map(([x,y])=>e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)));
    const whole=r.left>=left-1&&r.right<=right+1&&r.top>=top-1&&r.bottom<=bottom+1;
    const overflow=glyphs.filter(b=>b.left<Math.max(left,r.left)-1||b.right>Math.min(right,r.right)+1||b.top<Math.max(top,r.top)-1||b.bottom>Math.min(bottom,r.bottom)+1);
    return {selector:'#'+e.id,text:e.textContent,disabled:e.matches(':disabled,[aria-disabled=true]'),rect,clip:{left,top,right,bottom},whole,hits,glyphs,overflow,scrolls};
  });
}
async function check(page:Page,selector:string,label:string){
  const m=await geometry(page,selector);
  await evidence(label,m);
  expect(m.whole,label+' whole control').toBe(true);expect(m.overflow,label+' own/clipped glyphs').toEqual([]);if(!m.disabled)expect(m.hits,label+' raw hits').toEqual([true,true,true,true,true]);
  return m;
}
async function tap(page:Page,selector:string){const m=await check(page,selector,selector.slice(1)+'-tap');expect(m.disabled,selector+' enabled for actual tap').toBe(false);await page.mouse.click(m.rect.x+m.rect.width/2,m.rect.y+m.rect.height/2);}
async function contrast(page:Page){
  return page.locator('#hint-jump').evaluate(e=>{
    const s=getComputedStyle(e),rgb=(v:string)=>v.match(/[\d.]+/g)!.map(Number);
    const luminance=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
    const fg=rgb(s.color),bg=rgb(s.backgroundColor),a=luminance(fg),b=luminance(bg);
    return {fg:s.color,bg:s.backgroundColor,opaque:bg.length===3||bg[3]===1,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),outline:s.outlineStyle,outlineWidth:s.outlineWidth,active:e.matches(':active')};
  });
}

for(const language of languages)for(const theme of ['light','dark'])test(`VA02R exact independent Home 320x520 ${language} ${theme}`,async({page})=>{
  await page.setViewportSize({width:320,height:520});await start(page,language,theme);
  for(const selector of ['#progress-open','#learn','#settings-open','#pause-language'])await check(page,selector,selector.slice(1));
  expect(await page.locator('#dialog').evaluate(e=>e.scrollTop)).toBe(0);
  await page.screenshot({path:test.info().outputPath('home-initial.png')});
  await tap(page,'#settings-open');await expect(page.locator('#settings-panel')).toBeVisible();
  await page.keyboard.press('Escape');await tap(page,'#pause-language');await expect(page.locator('#language-sheet')).toBeVisible();
});

for(const [width,height,language] of [[390,844,'ru'],[390,844,'pt-BR'],[568,320,'ru'],[844,390,'pt-BR']] as const)for(const theme of ['light','dark'])test(`VA06R far hint contrast and actual jump ${width}x${height} ${language} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height});await start(page,language,theme,'hint');await tap(page,'#resume');await expect(page.locator('#dialog')).not.toBeVisible();
  await tap(page,'#hint');await expect(page.locator('#hint-jump')).toBeVisible();
  await check(page,'#hint-jump','hint-jump-normal');
  const normal=await contrast(page);expect(normal.opaque).toBe(true);expect(normal.ratio).toBeGreaterThanOrEqual(4.5);
  // Keyboard modality must retain a visible focus indicator.
  await page.keyboard.press('Tab');await page.locator('#hint-jump').focus();
  const focus=await contrast(page);expect(focus.outline).not.toBe('none');expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);expect(focus.ratio).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:test.info().outputPath('hint-focus.png')});
  const m=await geometry(page,'#hint-jump');await page.mouse.move(m.rect.x+m.rect.width/2,m.rect.y+m.rect.height/2);await page.mouse.down();
  const pressed=await contrast(page);expect(pressed.active).toBe(true);expect(pressed.ratio).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:test.info().outputPath('hint-pressed.png')});await page.mouse.up();
  await expect(page.locator('#hint-jump')).toBeHidden();
  await check(page,'[data-index="171"]','destination-digit');
  expect(await page.locator('#viewport').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await evidence('contrast-states',{normal,focus,pressed});
});

for(const [width,height,language,theme] of [[568,320,'ru','light'],[844,390,'pt-BR','dark']] as const)test(`VA04R own button glyphs and raw actions ${width}x${height} ${language}`,async({page})=>{
  await page.setViewportSize({width,height});await start(page,language,theme);
  await check(page,'#book-quick','book-quick-initial');await page.screenshot({path:test.info().outputPath('home-landscape.png')});
  await tap(page,'#book-quick');await expect(page.locator('#dialog')).not.toBeVisible();await expect(page.locator('#mode')).not.toHaveText('');
});
for(const [width,height,language,theme] of [[568,320,'ru','light'],[844,390,'pt-BR','dark']] as const)test(`VA04R classic footer glyphs and pair/Undo ${width}x${height} ${language}`,async({page})=>{
  await page.setViewportSize({width,height});await start(page,language,theme,'normal');await tap(page,'#resume');
  for(const selector of ['#undo','#hint','#add'])await check(page,selector,selector.slice(1)+'-initial');
  const before=await page.locator('#remaining').textContent();await tap(page,'[data-index="9"]');await tap(page,'[data-index="10"]');await expect(page.locator('#undo')).toBeEnabled();
  await tap(page,'#undo');await expect(page.locator('#remaining')).toHaveText(before!);
  await page.screenshot({path:test.info().outputPath('field-landscape.png')});
});
for(const language of languages)test(`VA04R preserve dead-field primary 568x320 ${language}`,async({page})=>{
  await page.setViewportSize({width:568,height:320});await start(page,language,'light','dead');await tap(page,'#resume');
  await expect(page.locator('#no-moves-card')).toBeVisible();await check(page,'#no-moves-primary','dead-field-primary');
  await tap(page,'#no-moves-primary');await expect(page.locator('#no-moves-card')).toBeHidden();
});
