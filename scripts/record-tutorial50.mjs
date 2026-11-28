// Real CDP frames, actual inputs, wall-clock durations; UI recording is silent.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out=path.resolve('test-results/tutorial50-recordings');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...(process.env.SEEDS_CHROMIUM?{executablePath:process.env.SEEDS_CHROMIUM}:{}),args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ffmpeg=args=>assert.equal(spawnSync('ffmpeg',['-v','error','-y','-filter_threads','2','-filter_complex_threads','2',...args],{stdio:'inherit'}).status,0);
const report={source:process.env.GITHUB_SHA,before:'4ce4cd4bf56a6b9723af1f9f0bfcf76371aeb77e',speed:1,physicalPhone:false,audio:'Silent UI comparison; original Core Feel audio is preserved in the separate reward comparison',clips:[]};
try{
 for(const theme of ['light','dark'])for(const side of ['before','after']){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ru-RU',colorScheme:theme,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env[side==='before'?'SEEDS_TUTORIAL50_BEFORE_URL':'SEEDS_TUTORIAL50_AFTER_URL']??`http://127.0.0.1:${side==='before'?5196:5191}`);
  await page.locator('.opening-copy').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.locator('#menu').click();await page.locator('#settings-open').click();if(await page.locator('#dark').isChecked()!==(theme==='dark'))await page.locator('#dark').click();await page.locator('#settings-back').click();await page.locator('#resume').click();assert.equal(await page.locator('#dark').isChecked(),theme==='dark');
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'seeds-ft50-')),frames=[],actions=[];
  const cdp=await context.newCDPSession(page);let first;const started=new Promise(r=>first=r);
  cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{
   const file=path.join(temporary,`${frames.length}.jpg`);frames.push({file,time:metadata.timestamp,saved:fs.writeFile(file,Buffer.from(data,'base64'))});first();void cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,everyNthFrame:1});await started;
  const start=performance.now();
  const shot=async name=>{await page.screenshot({path:path.join(out,`${side}-${theme}-${name}.png`)});};
  const tap=async selector=>{
   const point=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,hit:e.contains(document.elementFromPoint(x,y))};});assert(point.hit,selector);
   actions.push({selector,atMs:performance.now()-start});await page.mouse.click(point.x,point.y);await sleep(480);
  };
  await shot('fresh-first-task');await sleep(700);
  await tap('#board [data-index="4"]');await tap('#board [data-index="8"]');await shot('error');
  await tap('#board [data-index="8"]');
  for(const [a,b] of [[8,17],[4,5],[9,11],[7,14]]){await tap(`#board [data-index="${a}"]`);await tap(`#board [data-index="${b}"]`);}
  await page.locator('#win:not([hidden])').waitFor();await sleep(6000);await shot('win');await tap('#play-again');await shot('task2');await sleep(1000);
  await tap('#menu');await tap('#learn');
  for(let step=0;step<6;step++){
   await shot('lesson-'+(step+1));await sleep(350);
   if(step===5){await tap('#add');await tap('#undo');}
   else{const [a,b]=[[0,1],[0,1],[0,3],[0,20],[8,9]][step];await tap(`#board [data-index="${a}"]`);await tap(`#board [data-index="${b}"]`);}
   await page.locator('#lesson-next:not([hidden])').waitFor();await tap('#lesson-next');
  }
  if(!await page.locator('#dialog').evaluate(e=>e.open))await tap('#menu');
  await tap('#learn');await sleep(500);await tap('#skip');await sleep(700);
  if(!await page.locator('#dialog').evaluate(e=>e.open))await tap('#menu');
  await tap('#classic-mode');await tap('[data-classic-level="1"]');await shot('classic');await sleep(1500);
  await cdp.send('Page.stopScreencast');await Promise.all(frames.map(f=>f.saved));
  const length=(performance.now()-start)/1000;assert(frames.length>150);assert.deepEqual(errors,[]);
  const list=path.join(temporary,'frames.txt');await fs.writeFile(list,frames.map((frame,i)=>`file '${frame.file}'\nduration ${Math.max(.001,frames[i+1]?frames[i+1].time-frame.time:.05)}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`);
  const target=path.join(out,`${side}-${theme}.mp4`);
  ffmpeg(['-f','concat','-safe','0','-i',list,'-vf',`fps=60,drawtext=text='${side==='before'?'12112':'12113'} - ${theme}':fontcolor=white:fontsize=17:box=1:boxcolor=black@0.65:x=8:y=h-26`,'-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  report.clips.push({side,theme,seconds:length,frames:frames.length,actions,pageErrors:errors});await context.close();await fs.rm(temporary,{recursive:true,force:true});
 }
 for(const theme of ['light','dark'])ffmpeg(['-i',path.join(out,`before-${theme}.mp4`),'-i',path.join(out,`after-${theme}.mp4`),'-filter_complex','[0:v][1:v]hstack=inputs=2:shortest=1[v]','-map','[v]','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`seeds-12112-12113-tutorial-${theme}.mp4`)]);
 const clips=path.join(out,'comparison-list.txt');await fs.writeFile(clips,['light','dark'].map(theme=>`file '${path.join(out,`seeds-12112-12113-tutorial-${theme}.mp4`)}'`).join('\n'));
 ffmpeg(['-f','concat','-safe','0','-i',clips,'-c','copy','-movflags','+faststart',path.join(out,'seeds-12112-12113-tutorial-comparison.mp4')]);
 await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify(report,null,2));
}finally{await browser.close();}
