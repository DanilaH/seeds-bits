// Actual browser frames at their original wall-clock intervals. No drawn mockups.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const side=process.argv[2];assert.ok(['before','after'].includes(side));
const out=path.resolve('test-results/final-ui49',side),temp=await fs.mkdtemp(path.join(os.tmpdir(),'seeds-uf49-'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...(process.env.SEEDS_CHROMIUM?{executablePath:process.env.SEEDS_CHROMIUM}:{}),args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
const encode=args=>{const r=spawnSync('ffmpeg',['-v','error','-y','-filter_threads','2','-filter_complex_threads','2',...args],{stdio:'inherit'});assert.equal(r.status,0);};
const source=process.env.SEEDS_UI49_SOURCE??process.env.GITHUB_SHA;
const report={source,side,physicalPhone:false,speed:1,audio:'UI status demonstration with sound switched off; original Core Feel audio comparison is a separate recording',clips:[],frames:[]};
try{
 for(const [name,kind,theme,width,height,seconds] of [
  ['unplayed-light','unplayed','light',390,844,12],['unplayed-dark','unplayed','dark',390,844,12],
  ['started-compact','started','light',320,520,4],['done-compact','done','dark',320,520,4],['navigation','unplayed','light',390,844,8],
 ]){
  const context=await browser.newContext({viewport:{width,height},locale:'ru-RU',hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
  await page.addInitScript(({kind,theme})=>{
   const day='daily-v1-2026-11-28',session={rules:1,current:{board:[5,5,2,8],moves:1,additions:0,scroll:0},history:[]},active=kind==='started'?day:'classic';
   const done=kind==='done'?[day]:[];
   localStorage.setItem('seeds-bits.progress.v2',JSON.stringify({version:3,active,sessions:{classic:session,'book-v1-9':session,...(kind==='started'?{[day]:session}:{})},done,seen:[],hints:{},meta:{version:2,since:'2026-11-01',wallet:1,completed:10,unassisted:10,attempts:{[active]:{id:'uf49-video',completed:false}},daily:{lastDay:kind==='done'?'2026-11-28':'2026-11-27',count:kind==='done'?3:2,best:3,reward:0}}}));
   localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',theme,sound:false,vibration:false}));
   window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),readiness:async()=>({state:'ready'}),preload:async()=>{},show:async()=>({status:'unavailable'})};
  },{kind,theme});
  await page.goto(process.env.SEEDS_UI49_URL??'http://127.0.0.1:5191');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>document.fonts.ready);await sleep(250);
  await page.screenshot({path:path.join(out,name+'.png')});
  const dir=path.join(temp,name);await fs.mkdir(dir);const cdp=await context.newCDPSession(page),frames=[];let ready;const first=new Promise(r=>ready=r);
  cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{const file=path.join(dir,`${frames.length}.jpg`);frames.push({file,time:metadata.timestamp,saved:fs.writeFile(file,Buffer.from(data,'base64'))});ready();void cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,everyNthFrame:1});await first;
  // Start one complete real CSS cycle. Ordinary render/save never does this.
  await page.locator('#home-today-art').evaluate(e=>{for(const a of e.getAnimations({subtree:true}))a.currentTime=0;});
  const start=performance.now(),actions=[];
  if(name==='navigation')for(const [i,selector] of ['#book-mode','#all-books','#collection-back','#collection-back','#calendar-open','#collection-back','#progress-open','#progress-jar','#collection-back','#collection-back','#settings-open','#settings-back','#pause-language','#language-close'].entries()){
   await sleep(350+i*500-(performance.now()-start));await page.locator(selector).click();actions.push({selector,atMs:performance.now()-start});
  }
  await sleep(seconds*1000-(performance.now()-start));const end=Date.now()/1000;
  await cdp.send('Page.stopScreencast');await Promise.all(frames.map(f=>f.saved));assert.ok(frames.length>15);assert.deepEqual(errors,[]);
  const list=path.join(dir,'frames.ffconcat');await fs.writeFile(list,'ffconcat version 1.0\n'+frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??end)-f.time).toFixed(6)}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`);
  encode(['-f','concat','-safe','0','-i',list,'-vf',`fps=30,scale=390:844:force_original_aspect_ratio=decrease,pad=390:844:(ow-iw)/2:(oh-ih)/2,drawtext=text='${side==='before'?'12111':'12112'} - ${name}':fontcolor=white:fontsize=18:box=1:boxcolor=black@0.65:x=8:y=h-30`,'-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-t',String(seconds),path.join(out,name+'.mp4')]);
  report.clips.push({name,kind,theme,width,height,seconds,actualFrames:frames.length,actions,pageErrors:errors});await context.close();
 }
 // Three literal status frames in each theme, identical fixtures on both sources.
 for(const theme of ['light','dark'])for(const status of ['unplayed','started','done']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
  await page.addInitScript(({status,theme})=>{const id='daily-v1-2026-11-28',session={rules:1,current:{board:[5,5],moves:1,additions:0,scroll:0},history:[]},active=status==='started'?id:'classic';localStorage.setItem('seeds-bits.progress.v2',JSON.stringify({version:3,active,sessions:{[active]:session},done:status==='done'?[id]:[],seen:[],hints:{},meta:{version:2,since:'2026-11-01',wallet:0,completed:0,unassisted:0,attempts:{[active]:{id:'state',completed:false}}}}));localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',theme,sound:false,vibration:false}));}, {status,theme});
  await page.goto(process.env.SEEDS_UI49_URL??'http://127.0.0.1:5191');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>document.fonts.ready);const file=`state-${theme}-${status}.png`;await page.screenshot({path:path.join(out,file)});report.frames.push({file,status,theme,width:390,height:844});await context.close();
 }
 // Matched Home composition matrix, including the correctly absent book quick.
 for(const theme of ['light','dark'])for(const language of ['ru','en','es','tr','pt-BR'])for(const [width,height] of [[320,520],[390,844],[768,1024],[568,320]])for(const kind of ['fresh','classic','book','started','done']){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
  await page.addInitScript(({kind,theme,language})=>{
   const id='daily-v1-2026-11-28',active=kind==='started'||kind==='done'?id:kind==='book'?'book-v1-9':'classic';
   const session={rules:1,current:{board:kind==='done'?[]:kind==='fresh'?Array.from({length:19},(_,i)=>String(i+1)).join('').replaceAll('0','').split('').map(Number):[4,0,6,7,0,3,0,0,1,5,5,8,0,2,9,0,2,0],moves:kind==='fresh'?0:1,additions:0,scroll:0},history:[]};
   localStorage.setItem('seeds-bits.progress.v2',JSON.stringify({version:3,active,sessions:{classic:session,[active]:session,...(kind==='classic'?{'book-v1-9':session}:{})},done:kind==='done'?[id]:[],seen:[],hints:{},meta:{version:2,since:'2026-11-01',wallet:0,completed:1,unassisted:1,attempts:{[active]:{id:'uf49-grid',completed:kind==='done'}}}}));
   localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
   window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),readiness:async()=>({state:'ready'}),preload:async()=>{},show:async()=>({status:'unavailable'})};
  },{kind,theme,language});
  await page.goto(process.env.SEEDS_UI49_URL??'http://127.0.0.1:5191');await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>document.fonts.ready);
  const file=`grid-${kind}-${theme}-${language}-${width}x${height}.png`;await page.screenshot({path:path.join(out,file)});report.frames.push({file,kind,theme,language,width,height});await context.close();
 }
 await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({side,source,clips:report.clips.map(x=>({name:x.name,frames:x.actualFrames})),states:report.frames.length}));
}finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
if(side==='after'){
 const before=JSON.parse(await fs.readFile('test-results/final-ui49/before/provenance.json','utf8'));assert.equal(before.source,'f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f');
 const parts=[];
 for(const {name} of report.clips){const target=path.resolve('test-results/final-ui49',name+'-comparison.mp4');encode(['-i',`test-results/final-ui49/before/${name}.mp4`,'-i',path.join(out,name+'.mp4'),'-filter_complex','[0:v][1:v]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-threads','2','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',target]);parts.push(target);}
 const list=path.join(temp+'-montage.txt');await fs.writeFile(list,'ffconcat version 1.0\n'+parts.map(f=>`file '${f}'`).join('\n')+'\n');encode(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart','test-results/final-ui49/seeds-12111-12112-ui-comparison.mp4']);await fs.rm(list);
 for(const {file} of report.frames)encode(['-i','test-results/final-ui49/before/'+file,'-i',path.join(out,file),'-filter_complex','[0:v][1:v]hstack=inputs=2[v]','-map','[v]','-frames:v','1','test-results/final-ui49/compare-'+file]);
}
