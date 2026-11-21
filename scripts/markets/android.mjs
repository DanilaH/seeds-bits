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
function installRecord(){return JSON.parse(adb("shell","cat",`/data/user/0/${app}/no_backup/seeds-first-install.json`));}
async function update() {
  adb("install",baseline);
  launch();
  for(let i=0;i<50;i++){try{if(profiles().values[progress])break;}catch{}await wait(200);}
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,theme:"dark",sound:false,vibration:false}});
  const before=profiles().values[progress].sessions["book-v1-5"];
  adb("install","-r",optimized);
  launch();
  for(let i=0;i<50;i++){try{if(installRecord())break;}catch{}await wait(200);}
  assert.equal(installRecord().acquisition_state,"legacy");
  assert.equal(installRecord().install_store,"unknown");
  assert.deepEqual(profiles().values[progress].sessions["book-v1-5"].current.board,before.current.board);
  shot("updated");
  stop();
}
async function showEdge(size,order,video) {
  stop();
  adb("shell","wm","size",size);
  adb("shell","settings","put","system","font_scale","2");
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,languageChoice:"en",sound:false,vibration:false}});
  launch();const ui=await connect();
  const recorder=video?spawn("adb",["shell","screenrecord","--bit-rate","1800000","--time-limit","40","/sdcard/market-language.mp4"],{stdio:"ignore"}):null;
  try {
    await ui.tap("#resume");
    const geometry=()=>ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().toJSON()");
    const before=await geometry();
    assert.equal(await ui.evaluate("document.documentElement.lang"),"en");
    const caption="From the right edge, continue at the left of the next row.";
    const status="document.querySelector('#status').textContent";
    assert.equal(await ui.evaluate(status),caption);
    assert(await ui.evaluate(`(()=>{
      const e=document.querySelector('#status'),r=document.createRange();
      const box=e.parentElement.getBoundingClientRect();r.selectNodeContents(e);
      return Array.from(r.getClientRects()).every(b=>b.top>=box.top-1&&b.bottom<=box.bottom+1&&b.left>=0&&b.right<=innerWidth);
    })()`),"The edge cue does not fit the status area");
    shot("edge-"+size+"-"+order[0]);
    await ui.tap(digit(order[0]),false);
    assert.equal(await ui.evaluate("document.querySelector('#viewport').scrollTop"),0);
    assert.deepEqual(await geometry(),before);
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
    assert.equal(await ui.evaluate("document.querySelector('#viewport').scrollTop"),0);
    await ui.tap(digit(order[1]),false);
    await ui.until("!document.querySelector('#win').hidden");
    shot("solved-"+size+"-"+order[0]);
    if(video)await wait(1200);
    return {viewport:await ui.evaluate("[innerWidth,innerHeight]"),order,languageSwitch:true,selectionPreserved:true,solved:true};
  } finally {
    ui.close();
    if(recorder) {
      try{adb("shell","pkill","-2","screenrecord");}catch{}
      await new Promise(resolve=>recorder.exitCode===null?recorder.once("exit",resolve):resolve());
      adb("pull","/sdcard/market-language.mp4",out+"/market-language.mp4");
    }
    stop();
  }
}
try{
  adb("shell","wm","density","320");
  adb("shell","wm","size","780x1688");
  await update();
  adb("uninstall",app);
  adb("install",candidate);
  launch(); const first=await connect();
  await first.until("!!document.querySelector('.opening-copy')");
  first.close();await wait(400);stop();
  const file=installRecord();
  assert.equal(file.install_store,"unknown");
  assert.equal(file.artifact_channel,"rustore");
  assert.equal(file.acquisition_state,"fresh");
  const controls=[];
  for(const size of ["640x1232","1136x736"])
    for(const order of [[8,9],[9,8]])controls.push(await showEdge(size,order,size==="1136x736"&&order[0]===8));
  fs.writeFileSync(out+"/result.json",JSON.stringify({source:process.env.GITHUB_SHA,package:app,versionCode:12068,
    physicalPhone:false,systemFont:2,forwardedFile:file,legacyUpdate:true,controls,
    webview:adb("shell","dumpsys","webviewupdate").split("\n").find(x=>x.includes("Current WebView package"))},null,2));
}catch(error) {shot("failed");fs.writeFileSync(out+"/failure.txt",String(error)+"\n"+error.stack);throw error;}
