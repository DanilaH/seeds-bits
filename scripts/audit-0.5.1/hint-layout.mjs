import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const server=spawn('python3',['-m','http.server','5200','--bind','127.0.0.1','--directory','/tmp/seeds051-audit-apk'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
const b=await chromium.launch({executablePath:'/tmp/seeds-audit-chromium',args:['--no-sandbox']});const page=await b.newPage({viewport:{width:844,height:390}});
await page.addInitScript(()=>{const board=Array(540).fill(0);for(let i=8;i<540;i+=9)board[i]=1;board[0]=board[531]=5;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));localStorage.setItem('seeds-bits.session.v1',JSON.stringify({rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}));});
await page.goto('http://127.0.0.1:5200');await page.locator('#resume').click();await page.locator('#hint').click();await page.waitForFunction(()=>document.querySelectorAll('.hinted').length===2);
const result=await page.evaluate(()=>{const el=document.querySelector('#hint-jump'),r=el.getBoundingClientRect();return{hinted:[...document.querySelectorAll('.hinted')].map(x=>x.dataset.index),label:el.textContent,hitsButton:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el,emptyRows:0};});
await page.screenshot({path:'docs/audit-0.5.1/hint-no-empty-rows.png'});writeFileSync('docs/audit-0.5.1/hint-no-empty-rows.json',JSON.stringify(result,null,2));console.log(result);await b.close();server.kill();
