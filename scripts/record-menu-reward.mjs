// Real application frames + the live WebAudio mix, using the existing Core Feel recorder recipe.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '@playwright/test';
const side=process.argv[2];if(!['before','baseline','after'].includes(side))throw Error('before, baseline or after required');
const baseline='125606e4a90e06b844fe6eb8f83249032cb7057f';
const out=path.resolve('test-results/menu-reward-audio',side),temp=await fs.mkdtemp(path.join(os.tmpdir(),'seeds-menu-audio-'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
const ffmpeg=(...a)=>{const p=spawnSync('ffmpeg',['-v','error','-y','-filter_threads','2','-filter_complex_threads','2',...a],{stdio:'inherit'});if(p.status)throw Error('ffmpeg failed');};
const key='seeds-bits.progress.v2';const report={side,source:process.env.SEEDS_FEEL_SOURCE||(side==='before'?baseline:process.env.GITHUB_SHA),physicalPhone:false,audio:'actual application WebAudio mix; no replacement track',clips:[]};
try {
 for(const [name,kind,width,height,theme] of [['jar','task',390,844,'light'],['field','field',390,844,'light'],['book','book',390,844,'light'],['medal','daily',390,844,'light'],['menus','nav',390,844,'light'],['compact-field','field',320,520,'dark'],['compact-medal','daily',320,520,'dark'],['compact-book','book',320,520,'dark']]){
  const dir=path.join(temp,name);await fs.mkdir(dir);
  const context=await browser.newContext({viewport:{width,height},locale:'ru-RU',hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>{throw e;});
  const active=['nav','field'].includes(kind)?'classic':kind==='daily'?'daily-v1-2026-11-26':`book-v1-${kind==='book'?24:9}`;
  const done=kind==='book'?Array.from({length:23},(_,i)=>'book-v1-'+(i+1)):kind==='daily'?Array.from({length:6},(_,i)=>'daily-v1-2026-11-0'+(i+1)):[];
  await page.addInitScript(({key,active,done,theme,kind})=>{
   localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',theme,sound:true,vibration:false}));
   localStorage.setItem(key,JSON.stringify({version:3,active,done,seen:[],hints:{},sessions:{[active]:{rules:1,current:{board:kind==='field'?[5,5,2,8]:[5,5],moves:1,additions:0,scroll:0},history:[]}},jars:{version:2,meter:22,seeds:22,wins:3,attempt:'menu-audio',highWater:1},meta:{version:2,since:'2026-11-01',completed:10,unassisted:10,wallet:1,attempts:{[active]:{id:'menu-audio',completed:false}}}}));
   window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},pending:async()=>({}),report:async()=>({accepted:true}),show:async()=>({status:'unavailable'})};
   const streams=new Map(),connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(destination,...args){
    if(this.context instanceof AudioContext&&destination===this.context.destination){let stream=streams.get(this.context);if(!stream){stream=this.context.createMediaStreamDestination();streams.set(this.context,stream);}connect.call(this,stream);}
    return connect.call(this,destination,...args);
   };
   let recorder,chunks;
   window.recordFeelSound=()=>{const stream=[...streams.values()].at(-1);if(!stream)throw Error('No application audio stream');chunks=[];recorder=new MediaRecorder(stream.stream,{mimeType:'audio/webm;codecs=opus'});recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();return Date.now();};
   window.finishFeelSound=()=>new Promise(resolve=>{recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'audio/webm'}));};recorder.stop();});
  },{key,active,done,theme,kind});
  await page.goto(process.env.SEEDS_FEEL_URL??'http://127.0.0.1:5191');
  await page.locator('#dialog[open]').waitFor();await page.evaluate(()=>document.fonts.ready);
  if(kind==='nav'){
   await page.locator('#home-jar').click();await page.locator('#collection-back').click();
  }else {
   await page.locator('#resume').click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.locator('[data-index="0"]').click();await sleep(100);await page.locator('[data-index="0"]').click();
  }
  await sleep(350);
  const cdp=await context.newCDPSession(page),frames=[];let ready;
  const first=new Promise(r=>ready=r);
  cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{
   const file=path.join(dir,`${frames.length}.jpg`);frames.push({file,time:metadata.timestamp,saved:fs.writeFile(file,Buffer.from(data,'base64'))});ready();void cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});await first;
  const start=await page.evaluate(()=>window.recordFeelSound());
  const actions=[];
  const click=async(selector,at)=>{await sleep(start+at-Date.now());await page.locator(selector).click();actions.push({selector,ms:Date.now()-start});};
  if(kind==='nav'){
   for(const [i,selector] of ['#book-mode','#all-books','#book-range-4','#book-section-themes','#collection-back','#collection-back','#pause-language','#language-close','#home-jar','#trophies-mode','#jars-tab'].entries())await click(selector,350+i*400);
  }else {await click('[data-index="0"]',350);await click('[data-index="1"]',550);}
  const length=6;await sleep(start+length*1000-Date.now());
  const end=Date.now()/1000,audio=path.join(dir,'mix.webm');await fs.writeFile(audio,Buffer.from(await page.evaluate(()=>window.finishFeelSound()),'base64'));
  await cdp.send('Page.stopScreencast');await Promise.all(frames.map(f=>f.saved));if(frames.length<15)throw Error('too few real frames');
  const list=path.join(dir,'sequence.ffconcat');await fs.writeFile(list,'ffconcat version 1.0\n'+frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??end)-f.time).toFixed(6)}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`);
  const target=path.join(out,`${name}.mp4`),offset=(start/1000-frames[0].time).toFixed(5);
  ffmpeg('-f','concat','-safe','0','-i',list,'-itsoffset',offset,'-i',audio,'-map','0:v','-map','1:a','-vf',`fps=60,scale=390:844:force_original_aspect_ratio=decrease,pad=390:844:(ow-iw)/2:(oh-ih)/2,drawtext=text='${process.env.SEEDS_FEEL_LABEL||(side==='before'?'12106':side==='baseline'?'12109':'12110')} - ${name} ${width}x${height}':fontcolor=white:fontsize=18:box=1:boxcolor=black@0.65:x=8:y=h-30`,'-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-af','aresample=async=1:first_pts=0,apad','-c:a','aac','-b:a','128k','-movflags','+faststart','-t',String(length),target);
  report.clips.push({name,width,height,theme,frames:frames.length,audioOffsetSeconds:Number(offset),actions,seconds:length});
  await context.close();
 }
 const concat=path.join(temp,'montage.ffconcat');await fs.writeFile(concat,'ffconcat version 1.0\n'+report.clips.map(c=>`file '${path.join(out,c.name+'.mp4')}'`).join('\n')+'\n');
 ffmpeg('-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',path.join(out,`menu-reward-${side}-sound.mp4`));
 await fs.writeFile(path.join(out,'recording.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
