import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'docs/audit-2026-10-19';
mkdirSync(out, {recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5192'],{stdio:'pipe'});
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
 await page.goto('http://127.0.0.1:5192');
 await page.waitForFunction(()=>!document.querySelector('#app').inert);
 return {page,context};
}
async function run(name,fn){try{const data=await fn();results.push({name,data});console.log(name,JSON.stringify(data))}catch(e){results.push({name,error:String(e)});console.log(name,String(e))}}
const start=async page=>{if(await page.locator('#resume').isVisible())await page.locator('#resume').click()};
const pair=async(page,a,b)=>{await page.locator(`[data-index="${a}"]`).click();await page.locator(`[data-index="${b}"]`).click();await page.waitForTimeout(150)};
const metrics=page=>page.evaluate(()=>Object.fromEntries(['viewport','board','lesson','lesson-next','status','undo','hint','add'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,visible:!!e.checkVisibility()}]})));
await run('isolated-long-board',async()=>{const{page,context}=await setup({board:Array(1800).fill(1)});await start(page);const times=[];for(let n=0;n<30;n++){const begin=Date.now();await page.evaluate(()=>{const buttons=document.querySelectorAll('#board button');buttons[0].click();document.querySelectorAll('#board button')[1].click()});await page.waitForFunction(expected=>document.querySelector('#remaining').textContent===String(expected),1800-(n+1)*2);times.push(Date.now()-begin)}await page.locator('#viewport').evaluate(e=>e.scrollTop=1200);await page.locator('#book-top').click();await page.locator('[data-game="book-v1-1"]').click();await page.locator('#menu').click();await page.locator('#classic-mode').click();const restored=await page.locator('#viewport').evaluate(e=>e.scrollTop);await page.reload();await start(page);const afterReload=await page.locator('#remaining').textContent();await page.locator('#undo').click();const afterUndo=await page.locator('#remaining').textContent();await context.close();return{times,restored,afterReload,afterUndo}});
writeFileSync(`${out}/stress-results.json`,JSON.stringify(results,null,2));await browser.close();server.kill();
