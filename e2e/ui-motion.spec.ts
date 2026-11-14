import {test, expect, type Page} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {install, key} from './help-test-utils';

const phase = process.env.SEEDS_UI_PHASE || 'after';
const snapshot = phase === 'before';
const out = `test-results/ui-motion/${phase}`;
mkdirSync(out, {recursive:true});
test.use({video: process.env.SEEDS_RECORD_HELP === '1' ? 'on' : 'off'});

async function fixture(page:Page, o:{board?:number[],wallet?:number,dark?:boolean,meter?:number,large?:boolean}={}) {
  await page.addInitScript(o=>{
    localStorage.seededHelp='1';
    localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,theme:o.dark?'dark':'light',sound:false,vibration:false,reminders:false}));
    localStorage.setItem('seeds-bits.progress.v2',JSON.stringify({version:3,active:'classic',sessions:{classic:{rules:1,current:{board:o.board||[1,2,3,4,5,5,6,7,8,9,1,1],scroll:0,moves:0,additions:0},history:[]}},hints:{},done:[],seen:[],meta:{version:2,wallet:o.wallet??4,since:'2026-11-13',completed:0,unassisted:0,attempts:{classic:{id:'ui-motion',completed:false,hintKeys:['used1','used2','used3']}}},jars:{version:2,seeds:(o.meter??22)+20,meter:o.meter??22,wins:3,attempt:'ui-motion',highWater:0}}));
  },o);
  await install(page);
  if(o.large) await page.addStyleTag({content:'body {font-size:22px} .action-label {font-size:20px}'});
  await page.waitForTimeout(250);
}
const cell=(page:Page,i:number)=>page.locator(`#board [data-index="${i}"]`);
async function rawClick(page:Page, selector:string) {
  const r=await page.locator(selector).boundingBox();expect(r).toBeTruthy();
  await page.mouse.click(r!.x+r!.width/2,r!.y+r!.height/2);
}
async function evidence(page:Page,name:string,data:unknown) {
  writeFileSync(`${out}/${name}.json`,JSON.stringify(data,null,2));
  await page.screenshot({path:`${out}/${name}.png`});
}

test('selection replaces a previous rejection and effects end on navigation',async({page})=>{
  await fixture(page);
  const observations=await page.evaluate(async()=>{
    const c=(i:number)=>document.querySelector<HTMLButtonElement>(`#board [data-index="${i}"]`)!;
    c(0).click(); c(1).click();
    await new Promise(r=>setTimeout(r,25));
    c(0).click();
    const samples=[];
    for(let i=0;i<5;i++){
      await new Promise(r=>requestAnimationFrame(r));
      samples.push({color:getComputedStyle(c(0)).backgroundColor,selected:c(0).getAttribute('aria-pressed'),animations:c(0).getAnimations().map(a=>(a.effect as KeyframeEffect).getKeyframes())});
    }
    return samples;
  });
  await evidence(page,'rapid-selection',observations);
  await expect(cell(page,0)).toHaveAttribute('aria-pressed','true');
  if(!snapshot)expect(observations.every(s=>s.animations.every(frames=>frames.at(-1)?.background!=='transparent'))).toBe(true);
  // A fresh error followed immediately by navigation must relinquish its owner.
  const remaining=await page.evaluate(()=>{
    document.querySelector<HTMLButtonElement>('#board [data-index="2"]')!.click();
    document.querySelector<HTMLButtonElement>('#menu')!.click();
    return document.querySelector('#board')!.getAnimations({subtree:true}).filter(a=>a instanceof Animation && !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length;
  });
  writeFileSync(`${out}/navigation-ownership.json`,JSON.stringify({remaining}));
  if(!snapshot)expect(remaining).toBe(0);
  await page.locator('#resume').click();await page.waitForTimeout(220);
  await expect(cell(page,2)).toHaveAttribute('aria-pressed','true');
});

test('repeat rejection starts from the currently visible color',async({page})=>{
  await fixture(page);
  const samples=await page.evaluate(async()=>{
    const c=(i:number)=>document.querySelector<HTMLButtonElement>(`#board [data-index="${i}"]`)!;
    c(0).click();c(1).click();await new Promise(r=>setTimeout(r,35));c(0).click();
    await new Promise(r=>setTimeout(r,30));
    const before=getComputedStyle(c(0)).backgroundColor;c(1).click();
    return {before,after:getComputedStyle(c(0)).backgroundColor};
  });
  await evidence(page,'retarget-color',samples);
  if(!snapshot)expect(samples.after).toBe(samples.before);
});

test('rapid accepted pair keeps the removal/index-remapping gate and Undo',async({page})=>{
  await fixture(page,{board:[5,5,0,0,0,0,0,0,0,1,1,2]});
  await page.evaluate(()=>{
    const click=(i:number)=>document.querySelector<HTMLButtonElement>(`#board [data-index="${i}"]`)?.click();
    click(0);click(1);click(9);click(10);
  });
  await expect(page.locator('#remaining')).toHaveText('3');
  await expect(cell(page,0)).toHaveText('1');await expect(cell(page,1)).toHaveText('1');
  await rawClick(page,'#board [data-index="0"]');await rawClick(page,'#board [data-index="1"]');
  await expect(page.locator('#remaining')).toHaveText('1');
  await rawClick(page,'#undo');await expect(page.locator('#remaining')).toHaveText('3');
  await rawClick(page,'#undo');await expect(page.locator('#remaining')).toHaveText('5');
  await evidence(page,'remap-undo',await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sessions.classic,key));
});

test('press cancellation and edge release retain original hit geometry',async({page})=>{
  await fixture(page);
  const r=(await page.locator('#menu').boundingBox())!;
  await page.mouse.move(r.x+1,r.y+r.height/2);await page.mouse.down();
  await expect(page.locator('#menu')).toHaveClass(/is-pressed/);
  expect(await page.locator('#menu').boundingBox()).toEqual(r);
  await page.mouse.move(r.x+r.width+20,r.y);await page.mouse.up();
  await expect(page.locator('#menu')).not.toHaveClass(/is-pressed/);
  await expect(page.locator('#dialog')).not.toBeVisible();
  await page.mouse.click(r.x+1,r.y+r.height/2);await expect(page.locator('#dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#dialog')).not.toBeVisible();
  const c=await page.context().newCDPSession(page);
  const b=(await cell(page,0).boundingBox())!;
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('.is-pressed')).toHaveCount(0);
  await expect(cell(page,0)).toHaveAttribute('aria-pressed','false');
});

for(const dark of [false,true]) for(const viewport of [{width:320,height:568},{width:568,height:320},{width:390,height:844}]) {
  test(`stable counters and available controls ${dark?'dark':'light'} ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);
    const results=[];
    for(const wallet of [9,10,99,100,999]){
      await fixture(page,{wallet,dark,large:true});
      results.push(await page.evaluate(()=>{
        const ids=['undo','hint','add','menu','jar-name','jar-percent'];
        return ids.map(id=>{
          const e=document.getElementById(id)!;const b=e.getBoundingClientRect();
          const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
          return {id,text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height,hit:e===hit||e.contains(hit),visible:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1};
        });
      }));
      for(const b of results.at(-1)!.slice(0,4)){expect(b.visible).toBe(true);expect(b.hit).toBe(true);}
    }
    for(let j=1;j<results.length;j++) for(let k=0;k<results[0].length;k++){
      expect(results[j][k].x).toBeCloseTo(results[0][k].x,0);
      expect(results[j][k].y).toBeCloseTo(results[0][k].y,0);
      expect(results[j][k].w).toBeCloseTo(results[0][k].w,0);
    }
    await evidence(page,`counters-${viewport.width}-${dark?'dark':'light'}`,results);
    expect(await page.locator('#magnet').isVisible()).toBe(false);
    expect(await page.locator('#plan').isVisible()).toBe(false);
  });
}

test('rewarded states stay clear, cancellation does not show a late ad',async({page})=>{
  await install(page,'loading');await page.locator('#hint').click();
  await expect(page.locator('#watch-hints')).toBeDisabled();
  await evidence(page,'offer-loading',await page.locator('#hint-offer').innerText());
  await page.evaluate(()=>(window as any).setReady('ready'));
  await expect(page.locator('#watch-hints')).toBeEnabled();
  await evidence(page,'offer-ready',await page.locator('#hint-offer').innerText());
  await page.keyboard.press('Escape');await expect(page.locator('#hint-offer')).not.toBeVisible();
  expect(await page.evaluate(()=>(window as any).requests.length)).toBe(0);
  await page.evaluate(()=>(window as any).setReady('unavailable'));
  await page.locator('#hint').click();await expect(page.locator('#watch-hints')).toBeDisabled();
  await evidence(page,'offer-unavailable',await page.locator('#hint-offer').innerText());
});

for(const reduce of [false,true])test(`result/Continue and background cleanup ${reduce?'reduced':'normal'}`,async({page})=>{
  await page.emulateMedia({reducedMotion:reduce?'reduce':'no-preference'});
  await page.setViewportSize({width:568,height:320});
  await fixture(page,{board:[5,5],large:true});
  await rawClick(page,'#board [data-index="0"]');await rawClick(page,'#board [data-index="1"]');
  await expect(page.locator('#win')).toBeVisible();
  const r=(await page.locator('#play-again').boundingBox())!;
  expect(r.y+r.height).toBeLessThanOrEqual(320);expect(r.x).toBeGreaterThanOrEqual(0);
  await evidence(page,`result-${reduce?'reduced':'normal'}`,await page.locator('#win').innerText());
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  expect(await page.locator('#seed-flights i,.result-seed-burst').count()).toBe(0);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
  });
  await rawClick(page,'#play-again');await expect(page.locator('#win')).toBeHidden();
  await page.waitForTimeout(650);expect(await page.locator('.result-seed-burst').count()).toBe(0);
});
