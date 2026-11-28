import {expect,test,type Page} from '@playwright/test';
import {resumeStoredGame} from './restore-game';

const key='seeds-bits.progress.v2';
async function seed(page:Page,language:string,theme:string,kind:'new'|'task'|'page'|'book') {
  const id=kind==='new'?'classic':`book-v1-${kind==='task'?9:kind==='page'?6:24}`;
  const done=Array.from({length:kind==='task'?8:kind==='page'?5:kind==='book'?23:0},(_,i)=>`book-v1-${i+1}`);
  await page.addInitScript(({key,id,done,language,theme,kind})=>{
    localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
    localStorage.setItem(key,JSON.stringify({version:3,active:id,done,seen:[],hints:{},
      sessions:{[id]:{rules:1,current:{board:kind==='new'?[]:[5,5],moves:1,additions:0,scroll:0},history:[]}},
      meta:{version:2,since:'2026-11-01',wallet:0,completed:done.length+1,unassisted:0,attempts:{[id]:{id:'bookmark-followup',completed:kind==='new'}}}}));
    (window as any).__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),
      addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},
      report:async()=>({accepted:true}),pending:async()=>({}),show:async()=>({status:'unavailable'})};
  },{key,id,done,language,theme,kind});
  await page.goto('/');await expect(page.locator('#dialog')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
}

for(const [width,height,language,theme] of [[320,568,'ru','light'],[320,568,'en','dark'],[390,844,'en','light'],[390,844,'ru','dark']] as const) {
  test(`new-game note clears the cover bookmark ${width} ${language}`,async({page})=>{
    await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
    await seed(page,language,theme,'new');await expect(page.locator('.home-current')).toHaveAttribute('data-new-game','');
    for(const size of [16,24]) {
      await page.evaluate(size=>{document.documentElement.style.fontSize=size+'px';},size);
      const geometry=await page.locator('.home-current-copy').evaluate(cover=>{
        const note=document.querySelector('#resume-context')!,style=getComputedStyle(cover),box=cover.getBoundingClientRect();
        const matrix=new DOMMatrix(style.transform),[ox,oy]=style.transformOrigin.split(' ').map(parseFloat);
        const w=(cover as HTMLElement).offsetWidth,h=(cover as HTMLElement).offsetHeight;
        const point=(x:number,y:number)=>{const p=matrix.transformPoint({x:x-ox,y:y-oy});return {x:p.x+ox,y:p.y+oy};};
        const corners=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>point(x,y));
        const dx=box.left-Math.min(...corners.map(p=>p.x)),dy=box.top-Math.min(...corners.map(p=>p.y));
        // Actual cover.svg ribbon: x222..254/y-6..60 in viewBox -5 -7 307 244.
        const ribbon=[[227/307*w,1/244*h],[259/307*w,1/244*h],[259/307*w,67/244*h],[227/307*w,67/244*h]].map(([x,y])=>point(x,y));
        const r={left:Math.min(...ribbon.map(p=>p.x))+dx,right:Math.max(...ribbon.map(p=>p.x))+dx,
          top:Math.min(...ribbon.map(p=>p.y))+dy,bottom:Math.max(...ribbon.map(p=>p.y))+dy};
        const range=document.createRange();range.selectNodeContents(note);
        const lines=[...range.getClientRects()].map(t=>({left:t.left,right:t.right,top:t.top,bottom:t.bottom}));
        return {ribbon:r,lines,overlap:lines.some(t=>t.right>r.left&&t.left<r.right&&t.bottom>r.top&&t.top<r.bottom)};
      });
      await page.screenshot({path:test.info().outputPath(`new-game-${size}.png`),animations:'disabled'});
      expect(geometry.overlap,JSON.stringify(geometry)).toBe(false);
      const resume=(await page.locator('#resume').boundingBox())!;
      expect(resume.y+resume.height).toBeLessThanOrEqual(height);
    }
    const button=(await page.locator('#resume').boundingBox())!;
    await page.mouse.click(button.x+button.width/2,button.y+button.height/2);
    await expect(page.locator('#classic-new-sheet')).toBeVisible();
  });

  test(`notebook task, page and book keep the ribbon on the paper ${width} ${language}`,async({browser})=>{
    for(const kind of ['task','page','book'] as const) {
      const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width,height},reducedMotion:'reduce'});
      try {
        const page=await context.newPage();await seed(page,language,theme,kind);await resumeStoredGame(page);
        await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
        await expect(page.locator('#win')).toHaveAttribute('data-result-kind',kind);
        await expect(page.locator('#win')).toBeVisible();
        await page.screenshot({path:test.info().outputPath(`${kind}-result.png`),animations:'disabled'});
        const paper=(await page.locator('.quiet-result-page').boundingBox())!,ribbon=(await page.locator('.result-ribbon').boundingBox())!;
        expect(ribbon.y).toBeGreaterThanOrEqual(paper.y-1);expect(ribbon.y).toBeLessThan(paper.y+2);
        expect(ribbon.x+ribbon.width).toBeLessThan(paper.x+paper.width*.94);
        expect(ribbon.x).toBeGreaterThan(paper.x+paper.width*.7);
        const title=(await page.locator('#win h1').boundingBox())!;
        expect(title.y).toBeGreaterThan(ribbon.y+ribbon.height);
        const next=page.locator('#play-again'),destination=await next.getAttribute('data-destination'),b=(await next.boundingBox())!;
        expect(b.y+b.height).toBeLessThanOrEqual(height);
        await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
        await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,key)).toBe(destination);
      }finally{await context.close();}
    }
  });
}
