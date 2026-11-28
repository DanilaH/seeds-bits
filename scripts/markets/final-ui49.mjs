import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';

/** Real WebView geometry, physical ADB taps, screencap and screenrecord. */
export async function verifyFinalUi49({adb,profiles,fixture,launch,stop,connect,progress,settings,out}) {
 const original=profiles().values,report={source:process.env.GITHUB_SHA,status:'RUNNING',physicalPhone:false,cases:[]};
 const checkpoint=()=>fs.writeFileSync(out+'/final-ui49.json',JSON.stringify(report,null,2));
 const inspect=`(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect().toJSON(),jar=r('#home-jar'),art=r('#home-jar .jar-glass'),cover=r('.home-current-copy');
  const controls=['#home-jar','#progress-open','#learn','#settings-open','#pause-language'].map(s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return {selector:s,rect:b.toJSON(),hits:[[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]].map(([x,y])=>e.contains(document.elementFromPoint(b.x+b.width*x,b.y+b.height*y)))};});
  return {width:innerWidth,height:innerHeight,jar,art,cover,overlap:cover.left<Math.max(jar.right,art.right)&&cover.right>Math.min(jar.left,art.left)&&cover.top<Math.max(jar.bottom,art.bottom)&&cover.bottom>Math.min(jar.top,art.top),status:document.querySelector('#daily-mode').dataset.dailyStatus,caption:document.querySelector('#daily-state').textContent,wholeCalendarAnimation:getComputedStyle(document.querySelector('#home-today-art')).animationName,controls};
 })()`;
 try{
  adb('shell','wm','size','640x1232');
  const day=adb('shell','date','+%Y-%m-%d'),id='daily-v1-'+day;
  for(const theme of ['light','dark'])for(const kind of ['unplayed','started','done','book']){
   const session={rules:1,current:{board:[5,5,2,8],moves:1,additions:0,scroll:0},history:[]};
   const active=kind==='started'?id:kind==='book'?'book-v1-9':'classic';
   await fixture({[settings]:{tutorialDone:true,languageChoice:'ru',theme,sound:false,vibration:false,reminders:false},[progress]:{version:3,active,done:kind==='done'?[id]:[],seen:[],hints:{},sessions:{classic:session,[active]:session},jars:{version:2,meter:12,seeds:12,wins:1,attempt:'uf49-native',highWater:1},meta:{version:2,since:day,wallet:0,completed:0,unassisted:0,attempts:{[active]:{id:'uf49-native',completed:false}}}}});
   launch();const ui=await connect();let recording,recorded;
   try{
    await ui.until("document.querySelector('#dialog').open && document.querySelector('#dialog').dataset.screen==='home'");
    if(kind==='unplayed'){
     const guest=`/sdcard/seeds-ui49-${theme}.mp4`,dest=out+`/ui49-dot-${theme}.mp4`;
     adb('shell','rm','-f',guest);
     recording=spawn('adb',['shell','screenrecord','--bit-rate','4000000','--time-limit','12',guest],{stdio:'ignore'});
     recorded=new Promise((resolve,reject)=>{recording.once('error',reject);recording.once('close',code=>code===0?resolve():reject(Error('Native UF49 recording exit '+code)));});
     // Observe the actual five-second animation, rather than only static endpoints.
     const samples=await ui.evaluate(`new Promise(resolve=>{const start=performance.now(),samples=[];function frame(){samples.push(${inspect});if(performance.now()-start>=5200)resolve(samples);else requestAnimationFrame(frame);}frame();})`);
     assert.ok(samples.length>15);assert.ok(samples.every(s=>!s.overlap),'Native swept jar art overlap');
     await recorded;recording=undefined;adb('pull',guest,dest);adb('shell','rm','-f',guest);
     const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',dest],{encoding:'utf8'}).trim());assert.ok(duration>=11,'Native recording must contain the full ten-second cycle');
     report.cases.push({theme,kind,video:`ui49-dot-${theme}.mp4`,seconds:duration,sweep:samples});
    }
    const state=await ui.evaluate(inspect);assert.equal(state.overlap,false);assert.equal(state.status,kind==='book'?'unplayed':kind);assert.equal(state.wholeCalendarAnimation,'none');
    for(const c of state.controls)assert.ok(c.hits.every(Boolean),`Native ${theme}/${kind}/${c.selector} raw hits`);
    fs.writeFileSync(out+`/ui49-${theme}-${kind}.png`,execFileSync('adb',['exec-out','screencap','-p'],{maxBuffer:20e6,timeout:12000}));
    await ui.tap('#home-jar',false);await ui.until("document.querySelector('#dialog').dataset.screen==='trophies'");await ui.tap('#collection-back',false);await ui.until("document.querySelector('#dialog').dataset.screen==='home'");
    report.cases.push({theme,kind,state,actualAdbJarOpen:true});checkpoint();
   }finally{if(recording){recording.kill('SIGINT');await recorded.catch(()=>{});}ui.close();stop();}
  }
  report.status='PASS';return report;
 }catch(error){report.status='ERROR';report.error=String(error);throw error;}
 finally{checkpoint();await fixture({[settings]:original[settings],[progress]:original[progress]});adb('shell','wm','size','780x1688');}
}
