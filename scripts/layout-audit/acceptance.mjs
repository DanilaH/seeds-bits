// Android system font scaling, ordinary ADB touches, no DOM click fallback.
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const app = "com.seedsbits.game.preview";
const out = "test-results/layout-android/acceptance";
fs.mkdirSync(out,{recursive:true});
const adb = (...args) => execFileSync("adb",args,{encoding:"utf8"}).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const rows = [], failures = [];
const apk = process.argv[2];
if (apk) fs.writeFileSync(out+"/build.json",JSON.stringify({
  commit:process.env.GITHUB_SHA,package:app,
  sha256:createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),
  version:adb('shell','dumpsys','package',app).split('\n').filter(x=>/versionName=|versionCode=/.test(x)).map(x=>x.trim()),
  webview:adb('shell','dumpsys','webviewupdate').split('\n').find(x=>x.includes('Current WebView package')),
},null,2));
// Install only synthetic state while the debug application is fully stopped.
// An active document can persist its old board on pause, overwriting Preferences.set.
function installFixture(board) {
  adb('shell','am','force-stop',app);
  let xml=adb('shell','run-as',app,'cat','shared_prefs/CapacitorStorage.xml');
  const values={
    'seeds-bits.settings.v1':{tutorialDone:true},
    'seeds-bits.progress.v2':{version:3,active:'classic',sessions:{classic:{rules:1,current:{board,moves:0,scroll:0,additions:0},history:[]}},hints:{},done:[],seen:[]},
  };
  for(const [key,value] of Object.entries(values)) {
    const text=JSON.stringify(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const node=`<string name="${key}">${text}</string>`;let replaced=false;
    xml=xml.replace(/<string name="([^"]+)">[\s\S]*?<\/string>/g,(entry,name)=>name===key?(replaced=true,node):entry);
    if(!replaced)xml=xml.replace('</map>',node+'\n</map>');
  }
  const file='/tmp/seeds-layout-fixture.xml';fs.writeFileSync(file,xml);
  adb('push',file,'/data/local/tmp/seeds-layout-fixture.xml');
  adb('shell','run-as',app,'cp','/data/local/tmp/seeds-layout-fixture.xml','shared_prefs/CapacitorStorage.xml');
  adb('shell','monkey','-p',app,'1');
}
async function attach() {
  let target;
  for (let i=0;i<60;i++) {
    try {
      adb("forward","tcp:9223","localabstract:webview_devtools_remote_"+adb("shell","pidof",app));
      target = (await (await fetch("http://127.0.0.1:9223/json/list")).json()).find(t=>t.type==="page");
      if(target)break;
    }catch{}
    await wait(500);
  }
  assert(target,"WebView not found");
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let seq=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const evaluate=async expression=>{
    const id=++seq,promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP evaluation timed out'));},15000);
      pending.set(id,m=>{clearTimeout(timer);resolve(m);});
    });
    ws.send(JSON.stringify({id,method:"Runtime.evaluate",params:{expression,returnByValue:true,awaitPromise:true}}));
    const m=await promise;assert(!m.error&&!m.result.exceptionDetails,JSON.stringify(m));return m.result.result.value;
  };
  return {evaluate,close:()=>ws.close()};
}
const matrix = [
  ["780x1688",1],["780x1688",1.5],["780x1688",2],
  ["640x1136",1],["640x1136",1.5],["640x1136",2],
  ["1136x640",1],["1136x640",1.5],["1136x640",2],
  ["1688x780",1],["1688x780",1.5],["1688x780",2],
] ;
const selected=matrix.filter(([size,font])=>!process.env.LAYOUT_CASE||process.env.LAYOUT_CASE===`${size}:${font}`);
assert(selected.length,'Unknown LAYOUT_CASE');
for (const [size,font] of selected) {
  let evaluate,close;
  try {
  adb("shell","am","force-stop",app);adb("shell","pm","clear",app);
  adb("shell","wm","size",size);adb("shell","settings","put","system","font_scale",String(font));
  adb("shell","monkey","-p",app,"1");
  ({evaluate,close}=await attach());
  const until=async expression=>{
    for(let i=0;i<60;i++){if(await evaluate(expression))return;await wait(200);}
    throw Error("Timed out: "+expression);
  };
  await until("document.querySelector('#lesson-feedback')&&!document.querySelector('#app').inert&&!document.querySelector('#lesson').hidden");
  await wait(300);
  let bounds;
  const measureBounds=async()=>{
    let xml='';
    for(let attempt=0;attempt<5;attempt++) {
      try {
      adb("shell","uiautomator","dump","/sdcard/layout-window.xml");
      xml=adb("shell","cat","/sdcard/layout-window.xml");
      const m=xml.match(/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if(m){bounds=m.slice(1).map(Number);return;}
      } catch(error) {console.log("UIA_RETRY",size,font,attempt,String(error));}
      await wait(300);
    }
    fs.writeFileSync(`${out}/failed-bounds-${size}-${font}.xml`,xml);
    throw Error('WebView bounds missing after five UIA snapshots');
  };
  await measureBounds();
  async function tap(selector,scrollRegion) {
    if(scrollRegion)await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),v=${scrollRegion === "dialog" ? "(document.querySelector('.dialog-scroll:not([hidden])')??document.querySelector('#dialog'))" : `document.querySelector(${JSON.stringify(scrollRegion)})`},r=e.getBoundingClientRect(),b=v.getBoundingClientRect();const top=Math.max(0,b.top),bottom=Math.min(innerHeight,b.bottom);if(r.top<top)v.scrollBy({top:r.top-top,behavior:'instant'});else if(r.bottom>bottom)v.scrollBy({top:r.bottom-bottom,behavior:'instant'});})()`);
    const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return{x,y,w:innerWidth,h:innerHeight,ok:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))}})()`);
    if(!p?.ok)fs.writeFileSync(`${out}/failed-tap.png`,execFileSync("adb",["exec-out","screencap","-p"]));
    assert(p?.ok,selector+" "+JSON.stringify(p));
    adb("shell","input","tap",String(Math.round(bounds[0]+p.x*(bounds[2]-bounds[0])/p.w)),String(Math.round(bounds[1]+p.y*(bounds[3]-bounds[1])/p.h)));
    await wait(250);
  }
  const digit=i=>tap(`#board [data-index="${i}"]`,"#viewport");
  async function record(state,picture=false) {
    const row=await evaluate(`(()=>{const v=document.getElementById('viewport'),r=v.getBoundingClientRect();const covered=[...document.querySelectorAll('#board button')].filter(e=>{const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return y>=r.top&&y<r.bottom&&!e.contains(document.elementFromPoint(x,y))}).map(e=>+e.dataset.index);return {screen:[innerWidth,innerHeight],top:r.top,height:r.height,covered,step:document.querySelector('#lesson-step').textContent,jumpHidden:document.querySelector('#hint-jump').hidden,firstVisible:document.querySelector('[data-index="0"]')?.getBoundingClientRect().top>=r.top-1}})()`);
    rows.push({size,font,state,...row});
    fs.writeFileSync(out+"/measurements.json",JSON.stringify(rows,null,2));
    console.log("LAYOUT_ACCEPTED",JSON.stringify(rows.at(-1)));
    if(picture)fs.writeFileSync(`${out}/${size}-${font}-${state}.png`,execFileSync("adb",["exec-out","screencap","-p"]));
    return row;
  }
  for(let step=0;step<2;step++) {
    const before=await record("short-"+step+"-before",step===0);
    assert(before.height>=44,"Field collapsed");
    await digit(0);
    if(size==="780x1688"&&font===1&&step===0) {
      adb("shell","wm","size","1688x780");await wait(600);
      assert(await evaluate("document.querySelector('[data-index=\"0\"]').classList.contains('selected')"));
      adb("shell","wm","size",size);await wait(600);await measureBounds();
    }
    await digit(1);
    await until("!document.querySelector('#lesson-next').hidden");
    const after=await record("short-"+step+"-after",step===0);
    assert(Math.abs(after.top-before.top)<=1,"Field moved after the pair");
    await tap("#lesson-next","#lesson-actions");
    if(step===0)assert(Math.abs((await record("short-next",true)).top-before.top)<=1,"Field moved at the next lesson");
  }
  await tap("#menu");await tap("#learn","dialog");
  for(const [step,a,b] of [[1,0,1],[2,0,1],[3,0,3],[4,0,20],[5,8,9]]) {
    const before=await record("full-"+step+"-before");
    await digit(a);await digit(b);await until("!document.querySelector('#lesson-next').hidden");
    assert(Math.abs((await record("full-"+step+"-after")).top-before.top)<=1);
    await tap("#lesson-next","#lesson-actions");
    assert(Math.abs((await record("full-"+step+"-next")).top-before.top)<=1);
  }
  await tap("#add",".game-actions");await tap("#undo",".game-actions");
  await tap("#lesson-next","#lesson-actions");
  assert(await evaluate("document.querySelector('#lesson').hidden"));
  const hintBoard=Array.from({length:180},(_,i)=>i%9===0?0:1);hintBoard[0]=hintBoard[171]=5;
  close();installFixture(hintBoard);
  ({evaluate,close}=await attach());
  await until("document.querySelector('#dialog')?.open&&!document.querySelector('#app').inert");
  await measureBounds();
  await tap("#resume","dialog");
  assert.equal(await evaluate("document.querySelector('#remaining').textContent"),"162","Hint fixture was not restored");
  const before=await record("hint-before",true);
  await tap("#hint");await until("!document.querySelector('#hint-jump').hidden");
  const shown=await record("hint-shown",true);
  assert.equal(shown.covered.length,0,"Hint intercepts a cell");
  assert(Math.abs(shown.height-before.height)<=1&&Math.abs(shown.top-before.top)<=1,"Hint moved the playing field");
  if(font===1.5){await wait(8000);assert.equal((await record("hint-idle-8s",true)).covered.length,0);}
  await tap("#hint-jump");await until("document.querySelector('#hint-jump').hidden");
  assert.equal((await record("hint-arrived",true)).covered.length,0);
  await digit(171);await until("!document.querySelector('#hint-jump').hidden");
  assert((await evaluate("document.querySelector('#hint-jump').textContent")).includes("выше"));
  await tap("#hint-jump");await until("document.querySelector('#hint-jump').hidden");
  await tap("#menu");await tap("#book-mode","dialog");
  assert(await evaluate("document.querySelector('#hint-jump').hidden"));
  if(size==="640x1136"&&font===2) {
    const saveBoard=Array(90).fill(1);saveBoard[0]=saveBoard[1]=5;
    close();installFixture(saveBoard);
    ({evaluate,close}=await attach());
    await until("document.querySelector('#dialog')?.open&&!document.querySelector('#app').inert");await measureBounds();
    await tap("#resume","dialog");
    assert.equal(await evaluate("document.querySelector('#remaining').textContent"),"90","Save fixture was not restored");
    await evaluate(`(()=>{const native=window.Capacitor.nativePromise;window.failLayoutSave=true;window.Capacitor.nativePromise=(plugin,method,options)=>plugin==='SeedsMonetization'&&method==='persistState'&&window.failLayoutSave?Promise.reject(new Error('layout acceptance: storage full')):native(plugin,method,options);})()`);
    await digit(0);await digit(1);await until("!document.querySelector('#save-notice').hidden");
    assert(await evaluate("document.querySelector('#status').hidden"));
    assert(await evaluate("document.querySelector('#viewport').clientHeight>=document.querySelector('#board .cell').getBoundingClientRect().height"));
    assert(await evaluate("(()=>{const v=document.querySelector('#viewport').getBoundingClientRect(),r=document.querySelector('#board .cell').getBoundingClientRect();return r.top>=v.top-1&&r.bottom<=v.bottom+1})()"));
    await record("save-error",true);
    await evaluate("document.querySelector('#retry-save').addEventListener('click',()=>window.failLayoutSave=false,{once:true,capture:true})");await tap("#retry-save",".status-wrap");
    await until("document.querySelector('#save-notice').hidden");
    assert.equal(await evaluate("document.querySelector('#remaining').textContent"),"88");
    await tap("#menu");await tap("#settings-open","dialog");await tap("#privacy-open","dialog");
    assert(await evaluate("[...document.querySelectorAll('#collection a')].every(a=>a.scrollWidth<=a.clientWidth+1)"));
    await evaluate("document.querySelector('#collection a').scrollIntoView({block:'center',behavior:'instant'})");
    await record("privacy",true);
    await tap("#privacy-back");await tap("#settings-back");await tap("#progress-open","dialog");
    assert(await evaluate("[...document.querySelectorAll('.progress-hero .hero-kicker,.progress-hero .hero-count,.progress-hero .fine')].every(e=>e.scrollWidth<=e.clientWidth+1)"));
    await record("progress",true);
  }
  } catch(error) {
    failures.push({size,font,error:String(error),stack:error.stack});
    fs.writeFileSync(out+'/failures.json',JSON.stringify(failures,null,2));
    try{fs.writeFileSync(`${out}/failed-${size}-${font}.png`,execFileSync('adb',['exec-out','screencap','-p']));}catch{}
    console.error('LAYOUT_CASE_FAILED',JSON.stringify(failures.at(-1)));
  } finally {close?.();}
}
assert.equal(failures.length,0,'Android layout cases failed; see failures.json');
fs.writeFileSync(out+"/passed.json",JSON.stringify({cases:selected.length,shortAndFullLessons:true,adbTouches:true,domClickFallback:false,systemFonts:[...new Set(selected.map(([,font])=>font))],rotationPreservesSelection:selected.some(([size,font])=>size==="780x1688"&&font===1),hintDirections:["below","above"],hintCoveredCellCentres:0},null,2));
