// Actual UI recording with known puzzle solutions. This is an automated inspection,
// never a human playtest or a measurement of human solving speed.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const out = path.resolve('test-results/product-journey');
await fs.mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5180'], { stdio: 'ignore' });
const url = 'http://127.0.0.1:5180';
let browser;
const report = { source: process.env.GITHUB_SHA, method: 'Scripted real UI; known solutions; mock native ads, analytics and permissions; no human playtest', scenarios: [] };
try {
  for (let i=0; i<100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({ executablePath: process.env.SEEDS_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const puzzles = JSON.parse(await fs.readFile('src/notebook.json','utf8'));
  for (const [name, viewport, large, reduced] of [
    ['portrait',{width:390,height:844},false,false],
    ['quick-start',{width:390,height:844},false,false],
    ['small',{width:320,height:568},false,false],
    ['landscape-large-reduced',{width:844,height:390},true,true],
  ]) {
    const context = await browser.newContext({ viewport, isMobile:true, hasTouch:true, locale:'ru-RU', timezoneId:'Asia/Yekaterinburg', reducedMotion:reduced?'reduce':'no-preference', recordVideo:{ dir:out, size:viewport } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const entry = { name, viewport, large, reduced, errors:[], frames:[], events:[] };
    report.scenarios.push(entry);
    page.on('pageerror', e=>entry.errors.push(String(e)));
    await page.addInitScript(()=>{
      window.productCalls=[];
      window.__SEEDS_ADS_TEST__={ initialize:async()=>({enabled:true,test:true}), addListener:async()=>({remove:async()=>{}}), preload:async()=>{}, banner:async()=>{}, pending:async()=>({}), acknowledge:async()=>{}, report:async x=>{window.productCalls.push(x)}, show:async()=>({status:'unavailable'}) };
      window.__SEEDS_ENGAGEMENT_TEST__={ configuration:async()=>({available:true,granted:false}), requestNotifications:async()=>({available:true,granted:false}), addListener:async()=>({remove:async()=>{}}), prepareReview:async()=>({status:'unavailable'}) };
    });
    const shot = async label => {
      await page.waitForTimeout(450);
      const file=name+'--'+label+'.png';
      await page.screenshot({path:path.join(out,file)});
      entry.frames.push({file, text:await page.locator('body').innerText(), horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
    };
    const click = async selector => { await page.locator(selector).click(); await page.waitForTimeout(250); };
    const pair = async indices => { for (const i of indices) await click(`[data-index="${i}"]`); };
    try {
      await page.goto(url);
      await page.waitForSelector('#board button');
      if (large) await page.addStyleTag({content:'html{font-size:150% !important}'});
      await shot('first-launch');
      for(let i=0;i<2;i++){
        await pair([0,1]); await shot('lesson-'+(i+1));
        await click(i===1 && name==='quick-start' ? '#lesson-quick' : '#lesson-next');
      }
      if(name==='quick-start') {
        await shot('quick-entry');await click('#hint');await shot('hint-explanation');
      } else {
        await shot('first-classic');
        await pair([9,10]); await shot('first-independent-pair');
        await click('#hint'); await shot('hint');
        const hinted=await page.locator('.hinted').evaluateAll(es=>es.map(e=>e.dataset.index));
        if(hinted.length!==2) throw Error('Expected two hinted cells');
        await pair(hinted); await shot('hint-result');
        await click('#menu'); await shot('home');
        await click('#book-mode'); await shot('notebooks');
        await click('#continue-book');
      }
      for(let task=0;task<6;task++){
        if(task===0) await shot('first-notebook');
        for(const solution of puzzles[task].solution) await pair([solution.a, solution.b]);
        await page.waitForSelector('#win:not([hidden])');
        await page.waitForTimeout(1800); // Record the entire value transfer and jar milestone before leaving.
        await shot('complete-'+(task+1));
        if(task<5) await click('#play-again');
      }
      await click('#menu'); await click('#calendar-open'); await shot('calendar');
      await click('#today-task'); await shot('daily');
      await click('#menu'); await click('#resume');
      const before=await page.locator('#mode').innerText();
      await page.reload(); await page.waitForSelector('#board button', {state:'attached'});
      await page.waitForFunction(()=>!document.querySelector('#app').inert);
      if(await page.locator('#dialog').evaluate(e=>e.open)) await click('#resume');
      if(await page.locator('#mode').innerText()!==before) throw Error('Mode not restored');
      await shot('restored-daily');
      entry.events=await page.evaluate(()=>window.productCalls);
      entry.progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.progress.v2')));
      entry.status='passed';
    } catch(error) { entry.status='failed'; entry.failure=String(error); await shot('failure'); }
    const video=page.video(); await context.close();
    await video.saveAs(path.join(out,name+'.webm'));
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,status:entry.status,failure:entry.failure,frames:entry.frames.length}));
  }
  if(report.scenarios.some(s=>s.status!=='passed')) process.exitCode=1;
} finally { await browser?.close(); server.kill(); }
