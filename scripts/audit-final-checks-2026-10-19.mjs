import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'docs/audit-2026-10-19';
mkdirSync(out, {recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5191'],{stdio:'pipe'});
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
 const page=await context.newPage(); page.setDefaultTimeout(15000);
 await page.goto('http://127.0.0.1:5191');
 await page.waitForFunction(()=>!document.querySelector('#app').inert);
 return {page,context};
}
async function run(name,fn){try{const data=await fn();results.push({name,data});console.log(name,JSON.stringify(data))}catch(e){results.push({name,error:String(e)});console.log(name,String(e))}}
const start=async page=>{if(await page.locator('#resume').isVisible())await page.locator('#resume').click()};
const pair=async(page,a,b)=>{await page.locator(`[data-index="${a}"]`).click();await page.locator(`[data-index="${b}"]`).click();await page.waitForTimeout(150)};
const metrics=page=>page.evaluate(()=>Object.fromEntries(['viewport','board','lesson','lesson-next','status','undo','hint','add'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,visible:!!e.checkVisibility()}]})));
await run('storage-error-verified',async()=>{const{page,context}=await setup();await page.locator('#settings-open').click();await page.evaluate(()=>Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError')});await page.locator('#sound').check();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Не удалось'));const data={message:await page.locator('#status').textContent(),statusVisible:await page.locator('#status').isVisible(),retryHiddenAttribute:await page.locator('#retry-save').getAttribute('hidden'),retryVisible:await page.locator('#retry-save').isVisible()};await page.screenshot({path:`${out}/hidden-save-error.png`});await page.locator('#close').click();data.afterClose=await page.locator('#retry-save').isVisible();await context.close();return data});
await run('touch-targets-verified',async()=>{const all=[];for(const width of [320,360,390,430]){const{page,context}=await setup({viewport:{width,height:844}});await page.locator('#daily-mode').click();const day=await page.locator('.calendar .task').first().boundingBox();await page.screenshot({path:`${out}/calendar-${width}.png`});await page.locator('#close').click();const cell=await page.locator('#board button').first().boundingBox();all.push({width,day,cell});await context.close()}return all});
await run('two-tabs-read-fresh',async()=>{const{page,context}=await setup();await start(page);const second=await context.newPage();await second.goto('http://127.0.0.1:5191');await start(second);await pair(page,0,9);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('seeds-bits.progress.v2')).sessions.classic.current.moves===1);await second.locator('#menu').click();await second.locator('#settings-open').click();await second.locator('#dark').check();await second.waitForFunction(()=>JSON.parse(localStorage.getItem('seeds-bits.progress.v2')).sessions.classic.current.moves===0);const third=await context.newPage();await third.goto('http://127.0.0.1:5191');await start(third);const data={firstTabDigits:await page.locator('#remaining').textContent(),freshTabDigits:await third.locator('#remaining').textContent()};await context.close();return data});
await run('hint-repeat-after-undo-task7',async()=>{const{page,context}=await setup();await page.locator('#book-mode').click();await page.locator('[data-game="book-v1-7"]').click();const steps=[];for(let j=0;j<3;j++){await page.locator('#hint').click();const ids=await page.locator('.hinted').evaluateAll(es=>es.map(e=>Number(e.dataset.index)));steps.push(ids);await pair(page,...ids);await page.waitForFunction(()=>!document.querySelector('#undo').disabled)}await page.locator('#undo').click();await page.locator('#hint').click();const again=await page.locator('.hinted').evaluateAll(es=>es.map(e=>Number(e.dataset.index)));await page.screenshot({path:`${out}/task7-hint-after-undo.png`});await context.close();return{steps,again}});
await run('hint-task20-recheck',async()=>{const{page,context}=await setup();await page.locator('#book-mode').click();await page.locator('[data-game="book-v1-20"]').click();let moves=0;while(moves<30){await page.waitForFunction(()=>!document.querySelector('#undo').disabled||document.querySelector('#remaining').textContent==='26');if(!await page.locator('#hint').isEnabled())break;await page.locator('#hint').click();const ids=await page.locator('.hinted').evaluateAll(es=>es.map(e=>Number(e.dataset.index)));await pair(page,...ids);moves++;await page.waitForFunction(()=>!document.querySelector('#undo').disabled)}const data={moves,remaining:await page.locator('#remaining').textContent()};await context.close();return data});
await run('animation-frames',async()=>{const{page,context}=await setup({board:[5,5,0,0,0,0,0,0,0,1,1,2,2,3,3,4,4,6]});await start(page);await page.evaluate(()=>{const original=Element.prototype.animate;Element.prototype.animate=function(...args){const a=original.apply(this,args);if(a.effect.getTiming().duration===170){a.pause();a.currentTime=60}return a}});await pair(page,0,1);await page.screenshot({path:`${out}/row-collapse-60ms.png`});await page.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect.getTiming().duration===170)a.currentTime=170}));await page.screenshot({path:`${out}/row-collapse-end.png`});await context.close();return{frameTime:60,duration:170}});
writeFileSync(`${out}/final-checks-results.json`,JSON.stringify(results,null,2));await browser.close();server.kill();
