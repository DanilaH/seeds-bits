import { chromium } from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='test-results/audit-2026-10-23';mkdirSync(out,{recursive:true});
const servers=[];
async function server(port,dir){
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--outDir',dir],{stdio:['ignore','pipe','pipe']});servers.push(s);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('preview startup')),15000);s.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});s.on('error',reject);});
}
let browser;
try{
 await server(5198,'dist');await server(5199,'dist-yandex');
 browser=await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const yandex=[];
 for(const kind of ['resolved','rejected','pending','script-unavailable','late','no-gameplay']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));window.sdkCalls=[];window.sdkEvents={};});
  const sdk=`({features:{LoadingAPI:{ready(){window.sdkCalls.push('ready')}},${kind==='no-gameplay'?'':'GameplayAPI:{start(){window.sdkCalls.push("start")},stop(){window.sdkCalls.push("stop")}}'}},on(n,f){window.sdkEvents[n]=f}})`;
  await p.route('**/sdk.js',r=>kind==='script-unavailable'?r.abort():r.fulfill({contentType:'application/javascript',body:`window.YaGames={init:()=>${kind==='rejected'?'Promise.reject(Error("outage"))':kind==='pending'?'new Promise(()=>{})':kind==='late'?`new Promise(r=>setTimeout(()=>r(${sdk}),4500))`:`Promise.resolve(${sdk})`}};`}));
  const start=Date.now();await p.goto('http://127.0.0.1:5199/');await p.locator('#resume').click({timeout:10000});await p.locator('[data-index="0"]').click();await p.locator('[data-index="9"]').click();await p.waitForFunction(()=>document.querySelector('#remaining').textContent==='26');
  if(['resolved','no-gameplay'].includes(kind)){
   await p.evaluate(()=>window.sdkEvents.game_api_pause?.());
   await p.locator('[data-index="1"]').dispatchEvent('click');await p.locator('[data-index="10"]').dispatchEvent('click');
   assert.equal(await p.locator('#remaining').textContent(),'26');await p.evaluate(()=>window.sdkEvents.game_api_resume?.());
  }
  await p.reload();await p.locator('#resume').click({timeout:10000});assert.equal(await p.locator('#remaining').textContent(),'26');
  const row={kind,elapsedMs:Date.now()-start,errors,calls:await p.evaluate(()=>window.sdkCalls),passed:true};assert.deepEqual(errors,[]);yandex.push(row);await c.close();
 }
 writeFileSync(out+'/C01-yandex-production.json',JSON.stringify(yandex,null,2));
 const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();
 await p.addInitScript(()=>{
  if(!sessionStorage.audioSeeded){sessionStorage.audioSeeded='1';localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,sound:true}));localStorage.setItem('seeds-bits.session.v1',JSON.stringify({rules:1,current:{board:Array(120).fill(5),moves:0,additions:0,scroll:0},history:[]}));}
  window.audioProbe={starts:0,active:0,maxActive:0,resumes:0,suspends:0,contexts:[]};const Base=window.AudioContext;
  window.AudioContext=class extends Base{
   constructor(...args){super(...args);window.audioProbe.contexts.push(this);}
   resume(){window.audioProbe.resumes++;return super.resume();}
   suspend(){window.audioProbe.suspends++;return super.suspend();}
   createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{const q=window.audioProbe;q.starts++;q.active++;q.maxActive=Math.max(q.maxActive,q.active);return start(...args);};node.addEventListener('ended',()=>window.audioProbe.active--);return node;}
  };
 });
 await p.goto('http://127.0.0.1:5198/');await p.locator('#resume').click();
 for(let i=0;i<50;i++){
  await p.locator('#board button').nth(0).click();await p.locator('#board button').nth(1).click();await p.waitForFunction(n=>document.querySelector('#remaining').textContent===String(n),120-2*(i+1));
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 }
 const audio=await p.evaluate(()=>({...window.audioProbe,contexts:window.audioProbe.contexts.map(c=>({state:c.state,currentTime:c.currentTime}))}));
 writeFileSync(out+'/C02-audio-real-ui.json',JSON.stringify({pairs:50,backgroundResumeCycles:50,...audio,scope:'real Chromium AudioContext; actual UI moves, simulated document visibility'},null,2));
 assert.ok(audio.starts>50);assert.ok(audio.resumes>50);await c.close();
 console.log(JSON.stringify({yandex:yandex.length,audio},null,2));
}finally{await browser?.close();for(const s of servers)s.kill();}
