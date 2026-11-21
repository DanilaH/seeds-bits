// Actual ADB touches in the new APK; old optimized payload is re-signed only for CI upgrade.
import {execFileSync,spawn} from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const app="com.seedsbits.game.preview",out="test-results/first-session-android";
fs.mkdirSync(out,{recursive:true});
const [candidate,baseline,releaseCandidate]=process.argv.slice(2);
const adb=(...a)=>execFileSync("adb",a,{encoding:"utf8",maxBuffer:8e6}).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const launch=()=>adb("shell","am","start","-W","-n",app+"/.MainActivity");
const stop=()=>adb("shell","am","force-stop",app);
const shot=name=>fs.writeFileSync(`${out}/${name}.png`,execFileSync("adb",["exec-out","screencap","-p"]));
const notes=[];let videoStart=0;
const note=(action,details={})=>{const row={action,timeMs:Date.now()-videoStart,...details};notes.push(row);console.log("FIRST_SESSION",JSON.stringify(row));fs.writeFileSync(out+"/actions.json",JSON.stringify(notes,null,2));};
async function xml(){
  let last;
  for(let i=0;i<6;i++){try{adb("shell","uiautomator","dump","/sdcard/first-session.xml");last=adb("shell","cat","/sdcard/first-session.xml");if(last.includes('class="android.webkit.WebView"'))return last;}catch{}await wait(250);}
  fs.writeFileSync(out+"/failed-window.xml",last??"");throw Error("UIA WebView not available");
}
const decode=s=>s.replaceAll("&quot;",'"').replaceAll("&apos;","'").replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&");
const encode=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const prefsFile=`/data/user/0/${app}/shared_prefs/CapacitorStorage.xml`;
function readPrefs(){
  const source=adb("shell","cat",prefsFile),values={};
  for(const m of source.matchAll(/<string name="([^"]+)">([\s\S]*?)<\/string>/g))values[m[1]]=decode(m[2]);
  return{source,values};
}
function installPrefs(values){
  stop();let {source}=readPrefs();
  for(const [key,value] of Object.entries(values)){
    const node=`<string name="${key}">${encode(value)}</string>`;let found=false;
    source=source.replace(/<string name="([^"]+)">[\s\S]*?<\/string>/g,(entry,name)=>name===key?(found=true,node):entry);
    if(!found)source=source.replace("</map>",node+"\n</map>");
  }
  fs.writeFileSync("/tmp/first-session-prefs.xml",source);adb("push","/tmp/first-session-prefs.xml","/data/local/tmp/first-session-prefs.xml");
  // Write the existing inode as emulator root, retaining the application's owner and context.
  adb("shell",`cat /data/local/tmp/first-session-prefs.xml > ${prefsFile}`);
}
async function tapText(text){
  let node,tree;
  const normalize=s=>decode(s).replace(/\s+/g," ").trim();
  for(let attempt=0;attempt<10;attempt++){
    tree=await xml();const nodes=[...tree.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]);
    node=nodes.find(n=>{const s=/text="([^"]*)"/.exec(n)?.[1],d=/content-desc="([^"]*)"/.exec(n)?.[1];return normalize(s??"")===text||normalize(d??"")===text;});
    if(node)break;await wait(250);
  }
  if(!node)fs.writeFileSync(out+"/missing-label.xml",tree??"");
  assert(node,"Native label missing: "+text);const b=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node).slice(1).map(Number);
  adb("shell","input","tap",String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));await wait(300);
}

async function attach(){
  let target;
  for(let i=0;i<70;i++){try{adb("forward","tcp:9223","localabstract:webview_devtools_remote_"+adb("shell","pidof",app));target=(await(await fetch("http://127.0.0.1:9223/json/list")).json()).find(t=>t.type==="page");if(target)break;}catch{}await wait(300);}
  assert(target,"WebView debugging not found");const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let seq=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const evaluate=async expression=>{const id=++seq,promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP timeout"));},15000);pending.set(id,m=>{clearTimeout(timer);resolve(m);});});ws.send(JSON.stringify({id,method:"Runtime.evaluate",params:{expression,returnByValue:true,awaitPromise:true}}));const m=await promise;assert(!m.error&&!m.result.exceptionDetails,JSON.stringify(m));return m.result.result.value;};
  const until=async expression=>{for(let i=0;i<90;i++){if(await evaluate(expression))return;await wait(150);}shot("timeout");throw Error(expression);};
  await until("document.querySelector('#dialog')&&!document.querySelector('#app').inert");
  const tree=await xml(),b=/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tree).slice(1).map(Number);
  async function tap(selector,region){
    if(region)await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),v=document.querySelector(${JSON.stringify(region)}),r=e.getBoundingClientRect(),b=v.getBoundingClientRect();if(r.top<b.top)v.scrollBy({top:r.top-b.top,behavior:'instant'});else if(r.bottom>Math.min(innerHeight,b.bottom))v.scrollBy({top:r.bottom-Math.min(innerHeight,b.bottom),behavior:'instant'});})()`);
    await wait(80);const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,w:innerWidth,h:innerHeight,ok:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))}})()`);assert(p.ok,selector+JSON.stringify(p));adb("shell","input","tap",String(Math.round(b[0]+p.x*(b[2]-b[0])/p.w)),String(Math.round(b[1]+p.y*(b[3]-b[1])/p.h)));await wait(250);
  }
  const digit=i=>tap(`#board [data-index="${i}"]`,"#viewport");
  const move=async(a,b)=>{const n=await evaluate("+document.querySelector('#remaining').textContent");await digit(a);await digit(b);await until(`+document.querySelector('#remaining').textContent===${n-2}`);};
  const fullText=async(selector,region)=>assert(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),v=document.querySelector(${JSON.stringify(region)}).getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);const lines=[...r.getClientRects()];return lines.length>0&&getComputedStyle(e).visibility==='visible'&&lines.every(b=>b.top>=v.top-1&&b.bottom<=v.bottom+1&&b.left>=0&&b.right<=innerWidth)})()`),selector+" not fully visible");
  return{evaluate,until,tap,digit,move,fullText,close:()=>ws.close()};
}
const progress="seeds-bits.progress.v2",settings="seeds-bits.settings.v1";
async function upgrade(){
  adb("install",baseline);launch();
  for(let i=0;i<45;i++){try{const x=readPrefs();if(x.values[progress]&&x.values[settings])break;}catch{}await wait(250);}
  stop();
  const original=readPrefs(),p=JSON.parse(original.values[progress]),s=JSON.parse(original.values[settings]);
  p.active="classic";p.sessions.classic={rules:1,current:{board:[5,5,1,1,2,2,9,1],scroll:0,moves:0,additions:0},packedHistory:[]};p.hints.classic=1;p.meta.wallet=17;p.meta.help.inventory={magnet:2,plan:3};p.seen.push("old-profile-upgrade-check");s.tutorialDone=true;s.theme="dark";s.sound=false;s.vibration=false;
  installPrefs({[progress]:JSON.stringify(p),[settings]:JSON.stringify(s)});launch();await wait(1800);await tapText("Начать классику");await tapText("5, строка 1, столбец 1");await tapText("5, строка 1, столбец 2");await wait(500);stop();
  const before=readPrefs(),old=JSON.parse(before.values[progress]);assert.equal(old.sessions.classic.current.moves,1);assert.equal(old.sessions.classic.packedHistory.length,1);
  // First upgrade to the exact optimized release payload; inspect durable state before debug instrumentation.
  adb("install","-r",releaseCandidate);launch();await wait(1800);await tapText("Продолжить классику");shot("upgrade-release-resumed");stop();
  const optimized=JSON.parse(readPrefs().values[progress]);assert.deepEqual(optimized.sessions.classic,old.sessions.classic);assert.equal(optimized.active,"classic");assert.equal(optimized.hints.classic,old.hints.classic);assert.equal(optimized.meta.wallet,old.meta.wallet);assert.deepEqual(optimized.meta.help.inventory,old.meta.help.inventory);assert.equal(optimized.meta.help.install,old.meta.help.install);assert(optimized.seen.includes("old-profile-upgrade-check"));
  const optimizedSettings=JSON.parse(readPrefs().values[settings]);for(const k of ["theme","sound","vibration"])assert.equal(optimizedSettings[k],s[k]);
  adb("install","-r",candidate);launch();const ui=await attach();
  assert(await ui.evaluate("document.querySelector('#dialog').open&&!document.querySelector('.opening-copy')"));await ui.tap("#resume","#dialog");
  assert.equal(await ui.evaluate("document.querySelector('#mode').textContent"),"Классика");assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),"6");shot("upgrade-resumed");
  const now=JSON.parse(readPrefs().values[progress]);assert.deepEqual(now.sessions.classic,old.sessions.classic);assert.equal(now.hints.classic,old.hints.classic);assert.equal(now.meta.wallet,old.meta.wallet);assert.deepEqual(now.meta.help.inventory,old.meta.help.inventory);assert.equal(now.meta.help.install,old.meta.help.install);assert(await ui.evaluate("document.querySelector('#magnet').hidden&&document.querySelector('#plan').hidden"));assert(now.seen.includes("old-profile-upgrade-check"));
  const currentSettings=JSON.parse(readPrefs().values[settings]);for(const k of ["theme","sound","vibration"])assert.equal(currentSettings[k],s[k]);await ui.tap("#undo");await ui.until("document.querySelector('#remaining').textContent==='8'");ui.close();stop();
  fs.writeFileSync(out+"/upgrade.json",JSON.stringify({baselineVersion:12065,candidateVersion:12066,package:app,baselineSha256:createHash("sha256").update(fs.readFileSync(baseline)).digest("hex"),candidateReleaseSha256:createHash("sha256").update(fs.readFileSync(releaseCandidate)).digest("hex"),candidateDebugSha256:createHash("sha256").update(fs.readFileSync(candidate)).digest("hex"),method:"Exact old optimized payload upgraded to exact current optimized release payload, then current debug payload for CDP/Undo; all signed with one ephemeral CI certificate; no app-data deletion between installs",boardHistorySettingsHintsWalletRetained:true,undoRestoresEight:true,oldBoard:old.sessions.classic},null,2));
}
async function fresh(){
  adb("shell","pm","clear",app);adb("shell","settings","put","system","font_scale","1");adb("shell","wm","size","780x1688");
  videoStart=Date.now();const recorder=spawn("adb",["shell","screenrecord","--bit-rate","1400000","--time-limit","45","/sdcard/first-run.mp4"],{stdio:"ignore"});
  let ui;
  try{await wait(250);launch();ui=await attach();await ui.until("!!document.querySelector('.opening-copy')");assert(!await ui.evaluate("document.querySelector('#dialog').open"));note("First real notebook task");shot("first-launch");await wait(1300);
    for(const [a,b] of [[8,17],[4,5],[9,11],[7,14]]){await ui.move(a,b);note("Pair removed",{a,b,cue:await ui.evaluate("document.querySelector('.opening-copy')?.textContent")});await wait(650);}
    await ui.until("!document.querySelector('#win').hidden");assert((await ui.evaluate("document.querySelector('#win').textContent")).includes("1 из 24"));assert.equal(await ui.evaluate("document.querySelector('#play-again').textContent"),"К задаче 2");note("Victory 1 of 24");shot("first-victory");await wait(2200);assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),"0");await ui.tap("#play-again");await ui.until("document.querySelector('#mode').textContent.includes('задача 2')");note("Voluntary task 2");shot("task-2");await wait(1500);
  }finally{ui?.close();try{adb("shell","pkill","-2","screenrecord");}catch{}await new Promise(r=>recorder.exitCode!==null?r():recorder.once("exit",r));adb("pull","/sdcard/first-run.mp4",out+"/first-run.mp4");stop();}
}
async function font200(){
  adb("shell","pm","clear",app);adb("shell","wm","size","640x1136");adb("shell","settings","put","system","font_scale","2");launch();const ui=await attach();
  try{await ui.until("!!document.querySelector('.opening-copy')");await ui.fullText(".opening-copy","#page-progress");shot("first-launch-200");const top=await ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().top");await ui.move(8,17);await ui.move(4,5);assert.equal(await ui.evaluate("document.querySelector('.opening-copy').textContent"),"Пустые клетки можно пропускать.");await ui.tap("#hint");assert((await ui.evaluate("document.querySelector('.opening-copy').textContent")).includes("3 и 3"));assert.equal(await ui.evaluate("document.querySelector('#status').textContent"),"");shot("gap-hint-200");
    await ui.tap("#menu");await ui.tap("#learn","#dialog");await ui.fullText("#lesson-text","#lesson");assert.equal(await ui.evaluate("document.querySelector('#lesson-text').textContent"),"Нажмите на две четвёрки.");shot("lesson-command-200");const lessonTop=await ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().top");await ui.digit(0);await ui.digit(1);await ui.until("!document.querySelector('#lesson-next').hidden");await ui.tap("#lesson-next","#lesson-actions");await ui.fullText("#lesson-text","#lesson");assert(Math.abs((await ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().top"))-lessonTop)<=1);
    fs.writeFileSync(out+"/font-200.json",JSON.stringify({cssViewport:await ui.evaluate("[innerWidth,innerHeight]"),systemFont:adb("shell","settings","get","system","font_scale"),openingInstructionFullyVisible:true,lessonInstructionFullyVisible:true,lessonFieldTopStable:true,openingFieldTop:top,explicitHintReplacesOldInstruction:true},null,2));
  }finally{ui.close();stop();}
}
async function landscapeFont200() {
  adb("shell", "pm", "clear", app);
  adb("shell", "wm", "size", "1136x736");
  adb("shell", "settings", "put", "system", "font_scale", "2");
  launch();
  const ui = await attach();
  try {
    await ui.until("!!document.querySelector('.opening-copy') && innerWidth > innerHeight");
    const mode = await ui.evaluate("[innerWidth, innerHeight]");
    assert.equal(mode[0], 568);
    const text = "document.querySelector('.opening-copy').textContent";
    const viewport = "JSON.stringify(document.querySelector('#viewport').getBoundingClientRect())";
    const before = await ui.evaluate(viewport);
    const measure = async () => {
      await ui.fullText(".opening-copy", "#page-progress");
      await ui.fullText(".opening-copy", ".game-top");
    };
    assert.equal(await ui.evaluate(text), "Нажмите любую цифру.");
    await measure();
    shot("landscape-first-launch-200");
    await ui.tap('#board [data-index="4"]');
    assert((await ui.evaluate(text)).includes("9 + 1 = 10"));
    await measure();
    assert.equal(await ui.evaluate(viewport), before);
    shot("landscape-nine-200");
    await ui.tap('#board [data-index="14"]');
    await ui.until("document.querySelector('#remaining').textContent === '6'");
    await ui.tap("#menu");
    await ui.until("document.querySelector('#dialog').open");
    await ui.fullText(".home-title h1", "#dialog");
    assert(await ui.evaluate(`(() => {
      const title = document.querySelector(".home-title h1").getBoundingClientRect();
      const close = document.querySelector("#close").getBoundingClientRect();
      return title.right <= close.left && close.width >= 44 && close.height >= 44 &&
        Math.abs(title.y + title.height / 2 - close.y - close.height / 2) <= 4;
    })()`));
    shot("pause-menu-landscape-200");
    await ui.tap("#close");
    await ui.until("!document.querySelector('#dialog').open");
    fs.writeFileSync(out + "/font-200-landscape.json", JSON.stringify({
      cssViewport: mode,
      systemFont: adb("shell", "settings", "get", "system", "font_scale"),
      openingAndTwoOptionAnswerFullyVisible: true,
      fieldUnmoved: true,
      bothRowsAndMenuReachable: true,
      pauseTitleAndCloseShareRow: true,
    }, null, 2));
  } finally {
    ui.close();
    stop();
  }
}
async function recordTaskFiveEdges() {
  const task = JSON.parse(fs.readFileSync("src/notebook.json", "utf8"))[4];
  const records = [];
  for (const [a,b] of [[6,10],[10,6]]) {
    const label = a === 6 ? "upper-first" : "lower-first";
    installPrefs({
      [settings]:JSON.stringify({tutorialDone:true,sound:false,vibration:false}),
      [progress]:JSON.stringify({version:3,active:task.id,done:[],seen:[],hints:{},sessions:{
        [task.id]:{rules:1,current:{board:task.board,moves:0,additions:0,scroll:0},history:[]},
      }}),
    });
    launch();
    const ui = await attach();
    const movie = `/sdcard/edge-${label}.mp4`;
    let recorder;
    try {
      await ui.tap("#resume","#dialog");
      for (const [i,j] of [[4,5],[3,13],[2,11],[15,16],[12,17]]) await ui.move(i,j);
      assert.equal(await ui.evaluate("document.querySelector('#status').textContent"),"От правого края — в начало строки ниже.");
      recorder = spawn("adb",["shell","screenrecord","--bit-rate","1700000","--time-limit","25",movie],{stdio:"ignore"});
      await wait(1000);
      await ui.digit(a);
      assert.equal(await ui.evaluate("document.querySelectorAll('#paths path').length"),0);
      await wait(500);
      await ui.evaluate(`new MutationObserver((_,observer)=>{
        const trace=document.querySelector('#pair-trace');
        if(trace){window.qaEdge=[...trace.querySelectorAll('path')].map(p=>({d:p.getAttribute('d'),delay:getComputedStyle(p).animationDelay}));observer.disconnect();}
      }).observe(document.querySelector('#app'),{childList:true})`);
      await ui.digit(b);
      await ui.until("!document.querySelector('#win').hidden");
      const segments = await ui.evaluate("window.qaEdge");
      assert.deepEqual(segments.map(segment=>segment.delay),["0s","0.085s"]);
      records.push({order:[a,b],segments});
      await wait(2100);
    } finally {
      ui.close();
      if (recorder) {
        try { adb("shell","pkill","-2","screenrecord"); } catch {}
        await new Promise(resolve=>recorder.exitCode!==null?resolve():recorder.once("exit",resolve));
        adb("pull",movie,`${out}/edge-${label}.mp4`);
      }
      stop();
    }
  }
  assert.deepEqual(records[0].segments,records[1].segments);
  fs.writeFileSync(`${out}/task-five-edges.json`,JSON.stringify({task:task.id,systemFont:2,orders:records},null,2));
}
try{adb("shell","wm","density","320");adb("shell","wm","size","780x1688");await upgrade();await fresh();await font200();await landscapeFont200();await recordTaskFiveEdges();fs.writeFileSync(out+"/passed.json",JSON.stringify({source:process.env.GITHUB_SHA,package:app,version:12066,upgrade:true,freshRealTask:true,voluntaryTask2:true,firstInstructionFont200:true,physicalPhone:false,webview:adb("shell","dumpsys","webviewupdate").split("\n").find(x=>x.includes("Current WebView package"))},null,2));}
catch(error){shot("failed");fs.writeFileSync(out+"/failure.txt",String(error)+"\n"+error.stack);throw error;}
