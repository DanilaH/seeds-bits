import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'docs/audit-2026-10-19';
mkdirSync(out, {recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5190'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))resolve()});server.on('exit',reject)});
const browser = await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM,args:['--no-sandbox']});
const results=[];
const snap = (board, moves=0) => ({board,scroll:0,moves,additions:0});
async function setup({board,progress,settings={tutorialDone:true},viewport={width:390,height:844},reducedMotion='no-preference'}={}) {
 const context=await browser.newContext({viewport,reducedMotion,timezoneId:'Asia/Yekaterinburg'});
 await context.addInitScript(({board,progress,settings})=>{
  if(sessionStorage.getItem('audit-init'))return;
  sessionStorage.setItem('audit-init','1');
  localStorage.setItem('seeds-bits.settings.v1',JSON.stringify(settings));
  if(board)localStorage.setItem('seeds-bits.session.v1',JSON.stringify({rules:1,current:{board,scroll:0,moves:0,additions:0},history:[]}));
  if(progress)localStorage.setItem('seeds-bits.progress.v2',JSON.stringify(progress));
 },{board,progress,settings});
 const page=await context.newPage(); page.setDefaultTimeout(4000);
 await page.goto('http://127.0.0.1:5190');
 await page.waitForFunction(()=>!document.querySelector('#app').inert);
 return {page,context};
}
async function run(name,fn){try{const data=await fn();results.push({name,data});console.log(name,JSON.stringify(data))}catch(e){results.push({name,error:String(e)});console.log(name,String(e))}}
const start=async page=>{if(await page.locator('#resume').isVisible())await page.locator('#resume').click()};
const pair=async(page,a,b)=>{await page.locator(`[data-index="${a}"]`).click();await page.locator(`[data-index="${b}"]`).click();await page.waitForTimeout(150)};
const metrics=page=>page.evaluate(()=>Object.fromEntries(['viewport','board','lesson','lesson-next','status','undo','hint','add'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,visible:!!e.checkVisibility()}]})));
await run('landscape-recheck-and-rotation',async()=>{const all=[];for(const [width,height] of [[844,390],[667,375],[740,360],[568,320],[390,844],[1366,768]]){const{page,context}=await setup({viewport:{width,height},settings:{tutorialDone:false}});const initial=await metrics(page);const hit=await page.locator('[data-index="0"]').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,160)});await page.screenshot({path:`${out}/recheck-tutorial-${width}x${height}.png`});await page.locator('#skip').click();const classic=await metrics(page);await page.locator('#book-top').click();await page.locator('[data-game="book-v1-24"]').click();const book=await metrics(page);await page.screenshot({path:`${out}/recheck-book-${width}x${height}.png`});all.push({width,height,initial,hit,classic,book});await context.close()}return all});
await run('storage-error-hidden-in-menu',async()=>{const{page,context}=await setup();await page.locator('#settings-open').click();await page.evaluate(()=>Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError')});await page.locator('#sound').check();await page.waitForTimeout(50);const data={status:await page.locator('#status').innerText(),statusVisible:await page.locator('#status').isVisible(),retryVisible:await page.locator('#retry-save').isVisible(),promise:await page.locator('#settings-panel .intro').innerText()};await page.screenshot({path:`${out}/hidden-save-error.png`});await context.close();return data});
await run('touch-targets-and-contrast',async()=>{const all=[];for(const width of [320,360,390,430]){const{page,context}=await setup({viewport:{width,height:844}});await page.locator('#daily-mode').click();const days=await page.locator('.calendar .task').first().boundingBox();await page.locator('#close').click();const cell=await page.locator('#board button').first().boundingBox();const colors=await page.locator('#status').evaluate(e=>({foreground:getComputedStyle(e).color,background:getComputedStyle(document.querySelector('.game')).backgroundColor}));all.push({width,days,cell,colors});await context.close()}return all});
await run('zoom-200-percent-proxy',async()=>{const{page,context}=await setup({viewport:{width:390,height:844},settings:{tutorialDone:false}});await page.evaluate(()=>document.body.style.zoom='2');await page.screenshot({path:`${out}/zoom-200-tutorial.png`});const data=await metrics(page);await context.close();return data});
await run('long-board-render-timing',async()=>{const data=[];for(const size of [28,1800]){const{page,context}=await setup({board:Array(size).fill(1)});await start(page);const samples=await page.evaluate(()=>{const ms=[];for(let i=0;i<40;i++){const t=performance.now();document.querySelector('[data-index="0"]').click();ms.push(performance.now()-t)}return ms});data.push({size,samples});await context.close()}return data});
await run('animation-probe-repeated',async()=>{const data=[];for(let run=0;run<3;run++){const{page,context}=await setup({board:[5,5,0,0,0,0,0,0,0,1,1,2,2,3,3,4,4,6]});await start(page);await page.evaluate(()=>{const original=Element.prototype.animate;window.auditAnimations=[];Element.prototype.animate=function(...args){const a=original.apply(this,args);window.auditAnimations.push(a);return a};document.querySelector('[data-index="0"]').click();document.querySelector('[data-index="1"]').click()});await page.waitForFunction(()=>document.querySelector('#remaining').textContent==='9',{},{polling:5});const before=await page.evaluate(()=>window.auditAnimations.filter(a=>a.effect.getTiming().duration===170).map(a=>({state:a.playState,connected:a.effect.target.isConnected,time:a.currentTime})));await page.evaluate(()=>document.querySelector('[data-index="0"]').click());const after=await page.evaluate(()=>window.auditAnimations.filter(a=>a.effect.getTiming().duration===170).map(a=>({state:a.playState,connected:a.effect.target.isConnected,time:a.currentTime})));data.push({before,after});await context.close()}return data});
await run('tutorial-resume-scroll-preserved',async()=>{const{page,context}=await setup({board:Array(180).fill(1)});await start(page);await page.locator('#viewport').evaluate(e=>e.scrollTop=400);await page.waitForTimeout(250);await page.locator('#menu').click();await page.locator('#learn').click();await page.locator('#skip').click();const scroll=await page.locator('#viewport').evaluate(e=>e.scrollTop);await context.close();return{scroll}});
writeFileSync(`${out}/followup-results.json`,JSON.stringify(results,null,2));await browser.close();server.kill();
