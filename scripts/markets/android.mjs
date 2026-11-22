// Android-native font scaling and ADB touches against a debuggable build of the same web assets.
import {execFileSync, spawn} from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const app="com.seedsbits.game.preview", out="test-results/markets-android";
fs.mkdirSync(out,{recursive:true});
const [candidate,baseline,optimized]=process.argv.slice(2);
const prefs=`/data/user/0/${app}/shared_prefs/CapacitorStorage.xml`;
const progress="seeds-bits.progress.v2", settings="seeds-bits.settings.v1";
const adb=(...args)=>execFileSync("adb",args,{encoding:"utf8",timeout:26000,maxBuffer:8e6}).trim();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const launch=()=>adb("shell","am","start","-W","-n",app+"/.MainActivity");
const stop=()=>adb("shell","am","force-stop",app);
function lockDeviceRotation(rotation) {
  adb("shell","wm","user-rotation","lock",String(rotation));
  assert.equal(adb("shell","settings","get","system","user_rotation"),String(rotation));
}
const shot=name=>fs.writeFileSync(`${out}/${name}.png`,execFileSync("adb",["exec-out","screencap","-p"]));
const decode=s=>s.replaceAll("&quot;",'"').replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&");
const encode=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
function profiles() {
  const xml=adb("shell","cat",prefs);
  return {xml,values:Object.fromEntries([...xml.matchAll(/<string name="([^"]+)">([\s\S]*?)<\/string>/g)].map(m=>[m[1],JSON.parse(decode(m[2]))]))};
}
async function fixture(values) {
  stop();
  let xml=profiles().xml;
  for(const [key,data] of Object.entries(values)){
    const re=new RegExp(`<string name="${key.replaceAll(".","\\.")}">[\\s\\S]*?<\\/string>`);
    const el=`<string name="${key}">${encode(JSON.stringify(data))}</string>`;
    xml=re.test(xml)?xml.replace(re,()=>el):xml.replace("</map>",el+"\n</map>");
  }
  const file=`${out}/fixture.xml`;
  fs.writeFileSync(file,xml);
  adb("push",file,"/data/local/tmp/seeds-market.xml");
  adb("shell",`cat /data/local/tmp/seeds-market.xml > ${prefs}`);
  adb("shell","rm","-f",prefs+".bak");
  fs.unlinkSync(file);
}
async function connect() {
  let target;
  for(let i=0;i<70;i++){
    try{
      adb("forward","tcp:9223","localabstract:webview_devtools_remote_"+adb("shell","pidof",app));
      target=(await (await fetch("http://127.0.0.1:9223/json/list")).json()).find(t=>t.type==="page");
      if(target)break;
    }catch{}
    await wait(250);
  }
  assert(target,"No debug WebView");
  const ws=new WebSocket(target.webSocketDebuggerUrl), pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=({data})=>{const resp=JSON.parse(data);pending.get(resp.id)?.(resp);};
  const evaluate=async expression=>{
    const seq=++id;
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(seq);reject(Error("CDP timeout"));},12000);
      pending.set(seq,response=>{clearTimeout(timer);pending.delete(seq);resolve(response);});
    });
    ws.send(JSON.stringify({id:seq,method:"Runtime.evaluate",params:{expression,returnByValue:true,awaitPromise:true}}));
    const res=await promise;
    assert(!res.error&&!res.result.exceptionDetails,JSON.stringify(res));
    return res.result.result.value;
  };
  const until=async expression=>{
    for(let i=0;i<80;i++){if(await evaluate(expression))return;await wait(150);}
    throw Error(expression);
  };
  await until("document.querySelector('#dialog')&&!document.querySelector('#app').inert&&!document.querySelector('.locale-pending')");
  let bounds;
  for(let attempt=0;attempt<6;attempt++){
    try {
      adb("shell","uiautomator","dump","/sdcard/market.xml");
      bounds=/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(adb("shell","cat","/sdcard/market.xml"))?.slice(1).map(Number);
      if(bounds)break;
    }catch{}
    await wait(200);
  }
  assert(bounds,"No WebView bounds");
  async function tap(selector,scroll=true) {
    const p=await evaluate(`(()=>{
      const e=document.querySelector(${JSON.stringify(selector)});
      const point=()=>{const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
        return {x,y,w:innerWidth,h:innerHeight,ok:e.contains(document.elementFromPoint(x,y))};};
      if(${scroll}&&!point().ok)e.scrollIntoView({block:"center",behavior:"instant"});
      return point();
    })()`);
    assert(p.ok,selector+" "+JSON.stringify(p));
    adb("shell","input","tap",String(Math.round(bounds[0]+p.x*(bounds[2]-bounds[0])/p.w)),
      String(Math.round(bounds[1]+p.y*(bounds[3]-bounds[1])/p.h)));
    await wait(200);
  }
  return {evaluate,until,tap,close:()=>ws.close()};
}
const board=[0,0,0,0,0,0,0,0,6,4];
const digit=i=>`#board button[data-index="${i}"]`;
const saved={rules:1,current:{board,scroll:0,moves:1,additions:0},
  history:[{board:[5,5,0,0,0,0,0,0,6,4],scroll:0,moves:0,additions:0}]};
const sample={version:3,active:"book-v1-5",done:[],seen:[],hints:{},sessions:{"book-v1-5":saved}};
const edgeCaption="At the right edge, go to the next row’s left.";
function assertViewport(ui) {
  return ui.evaluate("[innerWidth,innerHeight]").then(size=>assert.deepEqual(size,[320,568]));
}
function textFits(text,boundary) {
  return `(()=>{
    const e=document.querySelector(${JSON.stringify(text)}),r=document.createRange();
    const box=document.querySelector(${JSON.stringify(boundary)}).getBoundingClientRect();
    r.selectNodeContents(e);
    const lines=Array.from(r.getClientRects());
    return lines.length>0&&lines.every(b=>b.top>=Math.max(0,box.top-1)&&
      b.bottom<=Math.min(innerHeight,box.bottom+1)&&b.left>=Math.max(0,box.left-1)&&
      b.right<=Math.min(innerWidth,box.right+1));
  })()`;
}
async function firstNotebookEdge(order) {
  const ui=await connect();
  try {
    await ui.until("document.querySelector('.opening-copy')?.textContent==='Tap any number.'");
    await assertViewport(ui);
    for(const [a,b,n] of [[8,17,6],[4,5,4],[9,11,2]]) {
      await ui.tap(digit(a),false);
      await ui.tap(digit(b),false);
      await ui.until(`document.querySelector('#remaining').textContent==='${n}'`);
    }
    const geometry=()=>ui.evaluate(`(()=>{
      const field=document.querySelector('#viewport');
      return {box:field.getBoundingClientRect().toJSON(),scroll:field.scrollTop};
    })()`);
    const before=await geometry();
    const copy="document.querySelector('.opening-copy').textContent";
    assert.equal(await ui.evaluate(copy),edgeCaption);
    assert(await ui.evaluate(textFits(".opening-copy","#page-progress")),"English opening cue clipped");
    if(order[0]===7)shot("acceptance-first-en-200");
    await ui.tap(digit(order[0]),false);
    assert(await ui.evaluate(`document.querySelector('${digit(order[0])}').classList.contains('selected')`));
    assert.equal(await ui.evaluate(copy),order[0]===7?"Find 9: 1 + 9 = 10.":"Find 1: 9 + 1 = 10.");
    assert(await ui.evaluate(textFits(".opening-copy","#page-progress")),"English selection cue clipped");
    assert.deepEqual(await geometry(),before);
    await ui.tap(digit(order[1]),false);
    await ui.until("!document.querySelector('#win').hidden");
    return {order,solved:true,fieldStayedPut:true,captionFits:true};
  } finally {
    ui.close();
    stop();
  }
}
async function archiveAtLargeFont(language,title,undo) {
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,languageChoice:language,sound:false,vibration:false}});
  launch();
  const ui=await connect();
  try {
    await ui.tap("#calendar-open");
    const day='[data-game="daily-v1-2026-11-13"]';
    const year=await ui.evaluate("document.querySelector('#calendar-year').value");
    const month=await ui.evaluate("document.querySelector('#calendar-month').value");
    if(year!=="2026"||month!=="11") {
      await ui.tap("#calendar-picker summary");
      for(const [id,value] of [["calendar-year","2026"],["calendar-month","11"]]) {
        await ui.evaluate(`(()=>{
          const select=document.querySelector('#${id}');
          if(select.value!==${JSON.stringify(value)}) {
            select.value=${JSON.stringify(value)};
            select.dispatchEvent(new Event('change',{bubbles:true}));
          }
        })()`);
      }
    }
    await ui.tap(day);
    await ui.until(`document.querySelector('#mode').textContent===${JSON.stringify(title)}`);
    await assertViewport(ui);
    assert.equal(await ui.evaluate("document.querySelector('#undo span').textContent"),undo);
    assert.equal(await ui.evaluate("document.documentElement.scrollWidth"),320);
    assert(await ui.evaluate(textFits("#mode",".game-meta")),"Archive title clipped");
    assert(await ui.evaluate(textFits("#undo span","#undo")),"Undo label clipped");
    assert(await ui.evaluate(textFits("#hint span","#hint")),"Hint label clipped");
    if(language==="pt-BR")shot("acceptance-archive-pt-br-200");
    return {language,title,undo,labelsFit:true};
  } finally {
    ui.close();
    stop();
  }
}
function installRecord(){return JSON.parse(adb("shell","cat",`/data/user/0/${app}/no_backup/seeds-first-install.json`));}
async function update() {
  adb("install",baseline);
  launch();
  for(let i=0;i<50;i++){try{if(profiles().values[progress]&&installRecord())break;}catch{}await wait(200);}
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,theme:"dark",sound:false,vibration:false}});
  const before=profiles().values;
  const source=installRecord();
  adb("install","-r",optimized);
  launch();
  assert.deepEqual(installRecord(),source);
  const after=profiles().values;
  const previousSession=before[progress].sessions["book-v1-5"];
  const restoredSession=after[progress].sessions["book-v1-5"];
  assert.deepEqual(restoredSession.current,previousSession.current);
  assert.equal((restoredSession.packedHistory??restoredSession.history).length,previousSession.history.length);
  assert.equal(after[settings].theme,"dark");
  shot("updated");
  stop();
}
async function showEdge(size,order,video) {
  stop();
  lockDeviceRotation(video?1:0);
  adb("shell","wm","size",size);
  adb("shell","settings","put","system","font_scale","2");
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,languageChoice:"en",sound:false,vibration:false}});
  launch();const ui=await connect();
  const recorder=video?spawn("adb",["shell","screenrecord","--bit-rate","1800000","--time-limit","40","/sdcard/market-language.mp4"],{stdio:"ignore"}):null;
  try {
    await ui.tap("#resume");
    const viewSize=()=>ui.evaluate("[innerWidth,innerHeight]");
    const dimensions=await viewSize();
    assert(dimensions[0]<dimensions[1],"The game must open in portrait");
    const geometry=()=>ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().toJSON()");
    const before=await geometry();
    assert.equal(await ui.evaluate("document.documentElement.lang"),"en");
    const status="document.querySelector('#status').textContent";
    assert.equal(await ui.evaluate(status),edgeCaption);
    const cueFits=`(()=>{
      const e=document.querySelector('#status'),r=document.createRange();
      const box=e.parentElement.getBoundingClientRect();r.selectNodeContents(e);
      return Array.from(r.getClientRects()).every(b=>b.top>=box.top-1&&b.bottom<=box.bottom+1&&b.left>=0&&b.right<=innerWidth);
    })()`;
    assert(await ui.evaluate(cueFits),"The English edge cue does not fit the status area");
    shot("edge-"+size+"-"+order[0]);
    await ui.tap(digit(order[0]),false);
    assert.equal(await ui.evaluate("document.querySelector('#viewport').scrollTop"),0);
    assert.deepEqual(await geometry(),before);
    if(video) {
      for (const rotation of [0,1,3]) {
        lockDeviceRotation(rotation);
        await wait(500);
        assert.deepEqual(await viewSize(),dimensions);
        assert.deepEqual(await geometry(),before);
        assert(await ui.evaluate(`document.querySelector('${digit(order[0])}').classList.contains('selected')`));
      }
    }
    await ui.tap("#menu");
    await ui.tap("#settings-open");
    await ui.tap("#language-open");
    await ui.tap('#language-options button[data-language="es"]');
    await ui.until("document.documentElement.lang==='es'");
    shot("language-"+size+"-"+order[0]);
    await ui.tap("#language-close");
    await ui.tap("#settings-back");
    await ui.tap("#resume");
    assert(await ui.evaluate(`document.querySelector('${digit(order[0])}').classList.contains('selected')`));
    assert((await ui.evaluate(`document.querySelector('${digit(order[0])}').getAttribute('aria-label')`)).includes("fila"));
    assert(await ui.evaluate(cueFits),"The Spanish edge cue does not fit the status area");
    assert.deepEqual(await geometry(),before);
    assert.equal(await ui.evaluate("document.querySelector('#viewport').scrollTop"),0);
    await ui.tap(digit(order[1]),false);
    await ui.until("!document.querySelector('#win').hidden");
    shot("solved-"+size+"-"+order[0]);
    if(video)await wait(1200);
    return {viewport:dimensions,order,languageSwitch:true,selectionPreserved:true,solved:true,
      requestedDeviceRotations:video?[1,0,1,3]:[0]};
  } finally {
    ui.close();
    if(recorder) {
      try{adb("shell","pkill","-2","screenrecord");}catch{}
      await new Promise(resolve=>recorder.exitCode===null?recorder.once("exit",resolve):resolve());
      adb("pull","/sdcard/market-language.mp4",out+"/market-language.mp4");
    }
    stop();
    lockDeviceRotation(0);
  }
}
try{
  adb("shell","wm","density","320");
  adb("shell","wm","size","780x1688");
  lockDeviceRotation(0);
  await update();
  adb("uninstall",app);
  adb("install",candidate);
  adb("shell","wm","size","640x1232");
  adb("shell","settings","put","system","font_scale","2");
  launch();
  const opening=[await firstNotebookEdge([7,14])];
  const file=installRecord();
  assert.equal(file.install_store,"unknown");
  assert.equal(file.artifact_channel,"rustore");
  assert.equal(file.acquisition_state,"fresh");
  assert.equal(adb("shell","pm","clear",app),"Success");
  launch();
  opening.push(await firstNotebookEdge([14,7]));
  const archives=[];
  archives.push(await archiveAtLargeFont("es","Reto del archivo · 13 de noviembre","Deshacer"));
  archives.push(await archiveAtLargeFont("pt-BR","Desafio do arquivo · 13 de novembro","Desfazer"));
  const controls=[];
  for(const order of [[8,9],[9,8]]) controls.push(await showEdge("640x1232",order,order[0]===8));
  fs.writeFileSync(out+"/result.json",JSON.stringify({source:process.env.GITHUB_SHA,package:app,versionCode:12071,
    physicalPhone:false,systemFont:2,forwardedFile:file,updatePreservedSave:true,opening,archives,controls,
    webview:adb("shell","dumpsys","webviewupdate").split("\n").find(x=>x.includes("Current WebView package"))},null,2));
}catch(error) {shot("failed");fs.writeFileSync(out+"/failure.txt",String(error)+"\n"+error.stack);throw error;}
