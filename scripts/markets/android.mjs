// Android-native font scaling and ADB touches against a debuggable build of the same web assets.
import {execFileSync, spawn} from "node:child_process";
import fs from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";
import {findSdkCloseCross,findSdkStoryNext} from "./sdk-controls.mjs";

const app="com.seedsbits.game.preview", out="test-results/markets-android";
fs.mkdirSync(out,{recursive:true});
const [candidate,baseline,optimized,classicBundle]=process.argv.slice(2);
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
async function expectSavedBoard(id, board) {
  // Undo renders before its Preferences write finishes. Check the disk state itself.
  let saved;
  for (let attempt=0;attempt<20;attempt++) {
    saved=profiles().values[progress].sessions[id]?.current.board;
    if (saved?.join("")===board.join("")) return;
    await wait(125);
  }
  assert.deepEqual(saved,board);
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
      const targets=await (await fetch("http://127.0.0.1:9223/json/list")).json();
      // The ads SDK also creates debuggable WebViews in this process.
      target=targets.find(t=>t.type==="page" && /^https?:\/\/localhost(?:[/:?#]|$)/.test(t.url));
      if(target)break;
    }catch{}
    await wait(250);
  }
  assert(target,"No game debug WebView at the configured localhost origin");
  const ws=new WebSocket(target.webSocketDebuggerUrl), pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=({data})=>{const resp=JSON.parse(data);pending.get(resp.id)?.(resp);
    if(resp.method==="Runtime.exceptionThrown" || resp.method==="Runtime.consoleAPICalled" && ["error","warning"].includes(resp.params?.type))
      fs.appendFileSync(out+"/webview-errors.jsonl",JSON.stringify(resp)+"\n");
  };
  ws.send(JSON.stringify({id:++id,method:"Runtime.enable"}));
  const evaluate=async expression=>{
    const seq=++id;
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(seq);reject(Error("CDP timeout: "+expression.slice(0,150)));},12000);
      pending.set(seq,response=>{clearTimeout(timer);pending.delete(seq);resolve(response);});
    });
    ws.send(JSON.stringify({id:seq,method:"Runtime.evaluate",params:{expression,returnByValue:true,awaitPromise:true}}));
    const res=await promise;
    assert(!res.error&&!res.result.exceptionDetails,JSON.stringify(res));
    return res.result.result.value;
  };
  const until=async expression=>{
    for(let i=0;i<80;i++){if(await evaluate(expression))return;await wait(150);}
    try {
      const state=await evaluate(`({url:location.href,ready:document.readyState,hidden:document.hidden,focus:document.hasFocus(),
        root:document.documentElement.className,body:document.body?.outerHTML.slice(0,18000),
        resources:performance.getEntriesByType('resource').map(e=>({name:e.name,duration:e.duration,bytes:e.transferSize}))})`);
      fs.writeFileSync(out+"/webview-wait-failure.json",JSON.stringify({expression,state},null,2));
      fs.writeFileSync(out+"/webview-logcat.txt",adb("logcat","-d","-t","500"));
    } catch(diagnosticError) {console.warn("WebView failure details:",String(diagnosticError));}
    throw Error(expression);
  };
  await until("document.querySelector('#dialog')&&!document.querySelector('#app').inert&&!document.querySelector('.locale-pending')");
  // Demo builds expose the native WebView rectangle. Accessibility dumps can
  // stay busy while a creative is animated and return no hierarchy.
  let bounds;
  try {
    const frame = await evaluate("window.Capacitor.Plugins.SeedsMonetization.bannerDiagnostics()");
    if (frame?.webWidth > 0 && frame?.webHeight > 0)
      bounds = [frame.webX,frame.webY,frame.webX+frame.webWidth,frame.webY+frame.webHeight];
  } catch { /* Non-demo builds use Android's accessible hierarchy. */ }
  for(let attempt=0;!bounds && attempt<6;attempt++){
    try {
      // uiautomator can exit successfully without writing a new dump.
      adb("shell","rm","-f","/sdcard/market.xml");
      adb("shell","uiautomator","dump","/sdcard/market.xml");
      bounds=/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(adb("shell","cat","/sdcard/market.xml"))?.slice(1).map(Number);
      if(bounds)break;
    }catch{}
    await wait(200);
  }
  assert(bounds,"No WebView bounds");
  // Insets and the banner may settle after connect(). Project each gesture
  // through the current native WebView, not a cached startup rectangle.
  async function refreshBounds() {
    try {
      const f=await evaluate("window.Capacitor.Plugins.SeedsMonetization.bannerDiagnostics()");
      if(f?.webWidth>0 && f?.webHeight>0) bounds=[f.webX,f.webY,f.webX+f.webWidth,f.webY+f.webHeight];
    } catch { /* Existing accessibility bounds remain a fallback. */ }
  }
  await evaluate(`(()=>{
    if(window.__seedsNativeInputTrace)return;
    window.__seedsNativeInputTrace=[];
    for(const type of ['pointerdown','pointerup','click']) document.addEventListener(type,event=>{
      const selector=window.__seedsNativeInputSelector;
      window.__seedsNativeInputTrace.push({type,x:event.clientX,y:event.clientY,time:performance.now(),target:event.target.id||event.target.tagName,
        hit:!!selector&&event.composedPath().some(node=>node instanceof Element&&node.matches(selector))});
      if(window.__seedsNativeInputTrace.length>200)window.__seedsNativeInputTrace.shift();
    },true);
  })()`);
  async function tap(selector,scroll=true) {
    await refreshBounds();
    await evaluate(`window.__seedsNativeInputSelector=${JSON.stringify(selector)};window.__seedsNativeInputTrace=[]`);
    const hitTest=`(()=>{
      const e=document.querySelector(${JSON.stringify(selector)});
      if(!e || e.matches(':disabled') || e.closest('[inert]')) return {ok:false};
      const point=()=>{const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
        return {x,y,w:innerWidth,h:innerHeight,ok:e.contains(document.elementFromPoint(x,y))};};
      if(${scroll}&&!point().ok)e.scrollIntoView({block:"center",behavior:"instant"});
      return point();
    })()`;
    let p;
    for(let attempt=0;attempt<50;attempt++){
      p=await evaluate(hitTest);
      if(p.ok)break;
      await wait(100);
    }
    assert(p.ok,selector+" "+JSON.stringify(p));
    await refreshBounds();
    adb("shell","input","tap",String(Math.round(bounds[0]+p.x*(bounds[2]-bounds[0])/p.w)),
      String(Math.round(bounds[1]+p.y*(bounds[3]-bounds[1])/p.h)));
    await wait(200);
    const trace=await evaluate("window.__seedsNativeInputTrace");
    fs.appendFileSync(out+"/native-input.jsonl",JSON.stringify({selector,bounds,point:p,events:trace})+"\n");
  }
  async function swipeBoardUp() {
    await refreshBounds();
    const p=await evaluate(`(()=>{
      const r=document.querySelector("#viewport").getBoundingClientRect();
      return {x:r.x+r.width*.5,from:r.y+r.height*.8,to:r.y+r.height*.25,w:innerWidth,h:innerHeight};
    })()`);
    const x=String(Math.round(bounds[0]+p.x*(bounds[2]-bounds[0])/p.w));
    const y=point=>String(Math.round(bounds[1]+point*(bounds[3]-bounds[1])/p.h));
    adb("shell","input","swipe",x,y(p.from),x,y(p.to),"330");
    await wait(350);
  }
  return {evaluate,until,tap,swipeBoardUp,bounds,close:()=>ws.close()};

}
const board=[0,0,0,0,0,0,0,0,6,4];
const digit=i=>`#board button[data-index="${i}"]`;
function bookV5(slot) {
  const index=slot-1;
  const book=JSON.parse(fs.readFileSync(`src/content-v5-books-${Math.floor(index/600)+1}.json`,"utf8"));
  const [cells,flat]=book[index%600];
  const proof=[];
  for(let i=0;i<flat.length;i+=2)proof.push([flat[i],flat[i+1]]);
  return {board:Array.from(cells,Number),proof};
}
const v5Preview=fs.existsSync("src/content-v5-books-1.json");
const openingFile="src/notebook-opening-v6.json";
const openingPreview=fs.existsSync(openingFile);
function moved(board,[a,b]) {
  const blank=board.map((value,i)=>i===a||i===b?0:value);
  return blank.flatMap((_,i)=>i%9===0&&blank.slice(i,i+9).some(Boolean)?blank.slice(i,i+9):[]);
}
function packed(session) {
  return {rules:1,current:session.current,packedHistory:[...session.history].reverse().map(state=>[
    state.scroll,state.moves,state.additions,[state.board.join("")],
  ])};
}
function unpacked(session) {
  let board=session.current.board;
  const history=session.packedHistory.map(([scroll,moves,additions,segments])=>{
    board=segments.flatMap(part=>typeof part==="string"?Array.from(part,Number):board.slice(part[0],part[0]+part[1]));
    return {board,scroll,moves,additions};
  }).reverse();
  return {current:session.current,history};
}
function v5Session(slot,first) {
  const {board,proof}=bookV5(slot);
  const start={board,scroll:0,moves:0,additions:0};
  return {rules:1,current:{...start,board:moved(board,first??proof[0]),moves:1},history:[start]};
}
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
async function measureGameText(systemScale) {
  adb("shell","settings","put","system","font_scale",String(systemScale));
  assert.equal(Number(adb("shell","settings","get","system","font_scale")),systemScale);
  assert.equal(adb("shell","pm","clear",app),"Success");
  launch();
  const ui=await connect();
  try {
    await ui.until("document.querySelector('.opening-copy')?.textContent==='Tap any number.'");
    await assertViewport(ui);
    const measure=async selector=>ui.evaluate(`(async()=>{
      await document.fonts.ready;
      const element=document.querySelector(${JSON.stringify(selector)});
      const range=document.createRange();
      range.selectNodeContents(element);
      const {width,height}=range.getBoundingClientRect();
      return {text:element.textContent,width,height};
    })()`);
    const instruction=await measure(".opening-copy");
    const number=await measure(digit(8)+" .digit");
    await ui.tap("#menu");
    await ui.until("document.querySelector('#dialog').open");
    const menu=await measure("#resume");
    for (const item of [instruction,number,menu]) {
      assert(item.text.trim() && item.width>0 && item.height>0,"Expected visible game text");
    }
    return {instruction,number,menu};
  } finally {
    ui.close();
    stop();
  }
}
async function firstNotebookEdge(order, {recordVideo=false}={}) {
  const ui=await connect();
  let recorder=null;
  const recording="/sdcard/calm-first-win-to-task-2.mp4";
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
    if(order[0]===7) shot("acceptance-first-en-200");
    if(recordVideo) {
      // Keep optional video evidence isolated from the core Android acceptance route.
      recorder=spawn("adb",["shell","screenrecord","--size","320x616","--bit-rate","800000","--time-limit","30",recording],{stdio:"ignore"});
      await wait(750);
      assert.equal(recorder.exitCode,null,"Android screen recorder exited before the final pair");
    }
    await ui.tap(digit(order[0]),false);
    assert(await ui.evaluate(`document.querySelector('${digit(order[0])}').classList.contains('selected')`));
    assert.equal(await ui.evaluate(copy),order[0]===7?"Find 9: 1 + 9 = 10.":"Find 1: 9 + 1 = 10.");
    assert(await ui.evaluate(textFits(".opening-copy","#page-progress")),"English selection cue clipped");
    assert.deepEqual(await geometry(),before);
    await ui.tap(digit(order[1]),false);
    await ui.until("!document.querySelector('#win').hidden");
    await ui.until("!document.querySelector('#play-again').disabled&&document.querySelector('#result-jar-amount').textContent.includes('4 of 24')");
    assert.match(await ui.evaluate("document.querySelector('#result-subtitle').textContent"),/1 of 24/);
    assert.match(await ui.evaluate("document.querySelector('#result-gains').textContent"),/\+4/);
    assert.match(await ui.evaluate("document.querySelector('#play-again').textContent"),/2/);
    if(order[0]===7)shot("calm-first-result");
    await ui.tap("#play-again");
    await ui.until("document.querySelector('#mode').textContent.includes('Puzzle 2')");
    if(recorder) {
      // The emulator encoder can lag behind WebView; hold on puzzle 2 while
      // capturing fewer pixels to avoid destabilizing the Android emulator.
      await wait(4500);
      adb("shell","pkill","-2","screenrecord");
      await new Promise(resolve=>recorder.exitCode===null?recorder.once("exit",resolve):resolve());
      adb("pull",recording,out+"/calm-first-win-to-task-2.mp4");
      assert(fs.statSync(out+"/calm-first-win-to-task-2.mp4").size>15000,"First-win recording is empty");
      recorder=null;
    }
    const second=v5Preview?bookV5(2):{board:Array(8).fill(1),proof:[[7,15]]};
    await ui.tap(digit(second.proof[0][0]));
    await ui.tap(digit(second.proof[0][1]));
    await ui.until(`document.querySelector('#remaining').textContent==='${second.board.filter(Boolean).length-2}'`);
    await ui.tap("#menu");
    await ui.until("document.querySelector('#dialog').open");
    assert.match(await ui.evaluate("document.querySelector('#resume').textContent"),/2/);
    assert.match(await ui.evaluate("document.querySelector('#home-goal').textContent"),/1 of 24/);
    if(order[0]===7)shot("calm-menu-task-2");
    assert(await ui.evaluate("!document.querySelector('#dialog #close')"));
    await ui.tap("#resume");
    await ui.until("!document.querySelector('#dialog').open");
    assert.equal(await ui.evaluate("document.querySelector('#undo').disabled"),false);
    return {order,solved:true,fieldStayedPut:true,captionFits:true,jarFilled:4,bookSolved:1,continuedTo:2,explicitContinue:true};
  } finally {
    if(recorder) {
      try{adb("shell","pkill","-2","screenrecord");}catch{}
      await new Promise(resolve=>recorder.exitCode===null?recorder.once("exit",resolve):resolve());
      try{adb("pull",recording,out+"/calm-first-win-to-task-2-incomplete.mp4");}catch{}
    }
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
    await ui.tap("#menu");
    assert.match(await ui.evaluate("document.querySelector('#resume').textContent"),/13 de novembro|13 de noviembre/);
    await ui.tap("#resume");
    assert.equal(await ui.evaluate("document.querySelector('#mode').textContent"),title);
    return {language,title,undo,labelsFit:true};
  } finally {
    ui.close();
    stop();
  }
}
function installRecord(){return JSON.parse(adb("shell","cat",`/data/user/0/${app}/no_backup/seeds-first-install.json`));}
function installedVersionCode() {
  const match=adb("shell","dumpsys","package",app).match(/^\s*versionCode=(\d+)\b/m);
  assert(match,"Installed Android package has no versionCode");
  return Number(match[1]);
}
async function update() {
  adb("install",baseline);
  const from=installedVersionCode();
  launch();
  for(let i=0;i<50;i++){try{if(profiles().values[progress]&&installRecord())break;}catch{}await wait(200);}
  let upgradeFixture=classicBundle ? {...sample, sessions:{...sample.sessions, classic:oldHighSession},
    meta:oldHighMeta, jars:oldHighJars} : sample;
  if(openingPreview) {
    const sessions={...upgradeFixture.sessions,"book-v1-3":v5Session(3),"book-v1-9":v5Session(9)};
    upgradeFixture={...upgradeFixture,version:9,
      sessions:Object.fromEntries(Object.entries(sessions).map(([id,game])=>[id,packed(game)])),
      bookRevisions:{"book-v1-5":1,"book-v1-3":5,"book-v1-9":5}};
  }
  await fixture({[progress]:upgradeFixture,[settings]:{tutorialDone:true,theme:"dark",sound:false,vibration:false}});
  const before=profiles().values;
  const source=installRecord();
  adb("install","-r",optimized);
  const to=installedVersionCode();
  assert(to>from,"The preview must have a newer versionCode than the installed baseline");
  launch();
  assert.deepEqual(installRecord(),source);
  const after=profiles().values;
  const previousSession=before[progress].sessions["book-v1-5"];
  const restoredSession=after[progress].sessions["book-v1-5"];
  assert.deepEqual(restoredSession.current,previousSession.current);
  assert.equal((restoredSession.packedHistory??restoredSession.history).length,(previousSession.packedHistory??previousSession.history).length);
  assert.equal(after[settings].theme,"dark");
  if (classicBundle) {
    assert.deepEqual(after[progress].sessions.classic.current,oldHighSession.current);
    assert.equal((after[progress].sessions.classic.packedHistory??after[progress].sessions.classic.history).length,1);
    assert.deepEqual(after[progress].meta.classicRun,oldHighMeta.classicRun);
    assert.equal(after[progress].meta.wallet,oldHighMeta.wallet);
    assert.equal(after[progress].jars.seeds,oldHighJars.seeds);
  }
  shot("updated");
  stop();
  let overlay;
  if(openingPreview) {
    for(const id of ["book-v1-3","book-v1-9"]){
      assert.equal(after[progress].bookRevisions[id],5);
      assert.deepEqual(unpacked(after[progress].sessions[id]),unpacked(before[progress].sessions[id]));
    }
    adb("install","-r",candidate);
    launch();
    const ui=await connect();
    try {
      await ui.tap("#book-mode");
      await ui.tap('[data-game="book-v1-3"]');
      await ui.until("!document.querySelector('#dialog').open");
      await ui.tap("#undo");
      await ui.until(`document.querySelector('#remaining').textContent==='${bookV5(3).board.filter(Boolean).length}'`);
      await expectSavedBoard("book-v1-3",bookV5(3).board);
      await ui.tap("#menu");
      await ui.tap("#book-mode");
      await ui.tap('[data-game="book-v1-4"]');
      await ui.until("!document.querySelector('#dialog').open");
      const latest=profiles().values[progress];
      const opening=JSON.parse(fs.readFileSync(openingFile,"utf8"));
      assert.equal(latest.version,10);
      assert.equal(latest.bookRevisions["book-v1-4"],6);
      assert.deepEqual(latest.sessions["book-v1-4"].current.board,Array.from(opening[4][0],Number));
      assert.deepEqual(unpacked(latest.sessions["book-v1-9"]),unpacked(before[progress].sessions["book-v1-9"]));
      overlay={previous:[3,9],undo:3,newAssignment:4,wire:10};
    } finally {ui.close();stop();}
  }
  return {from,to,overlay,...(classicBundle?{legacyHigh27:true}:{})};
}
async function showEdge(size,order,rotate,recordVideo=rotate) {
  stop();
  lockDeviceRotation(rotate?1:0);
  adb("shell","wm","size",size);
  adb("shell","settings","put","system","font_scale","2");
  await fixture({[progress]:sample,[settings]:{tutorialDone:true,languageChoice:"en",sound:false,vibration:false}});
  launch();const ui=await connect();
  const recorder=recordVideo?spawn("adb",["shell","screenrecord","--bit-rate","1800000","--time-limit","40","/sdcard/market-language.mp4"],{stdio:"ignore"}):null;
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
    if(rotate) {
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
    if(recorder)await wait(1200);
    return {viewport:dimensions,order,languageSwitch:true,selectionPreserved:true,solved:true,
      requestedDeviceRotations:rotate?[1,0,1,3]:[0]};
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
// Reproduce the exact 23-Nov phone screenshot through physical ADB taps,
// not DOM dispatch. The starting board is the shipped book-v1-78.
const report78Board=[..."000200060600070060006000000085700500064000000"].map(Number);
const report78Witness=[[16,20],[13,21],[3,19],[28,29],[20,24],[7,9]];
async function verifyReport78Taps() {
  stop();
  adb("shell","wm","size","640x1136");
  adb("shell","settings","put","system","font_scale","1");
  const snapshot={rules:1,current:{board:report78Board,scroll:0,moves:0,additions:0},history:[]};
  const savedGame={version:3,active:"book-v1-78",done:Array.from({length:5},(_,i)=>`book-v1-${73+i}`),
    seen:[],hints:{},sessions:{"book-v1-78":snapshot}};
  await fixture({[progress]:savedGame,[settings]:{tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}});
  launch();
  let ui=await connect();
  const left=n=>`document.querySelector('#remaining').textContent==='${n}'`;
  const press=async(a,b,remaining)=>{
    await ui.tap(digit(a));
    assert(await ui.evaluate(`document.querySelector('${digit(a)}').getAttribute('aria-pressed')==='true'`),
      "Tap must select a real board button "+a);
    await ui.tap(digit(b));
    await ui.until(left(remaining));
  };
  try {
    await ui.tap("#resume");
    await ui.until("!document.querySelector('#dialog').open && !document.querySelector('#app').inert && "+left(12));
    assert.match(await ui.evaluate("document.querySelector('#mode').textContent"),/Тетрадь 4.*задача 6/);
    const values=await ui.evaluate("Array.from(document.querySelectorAll('#board button')).map(b=>[Number(b.dataset.index),Number(b.textContent)])");
    assert.deepEqual(values,report78Board.flatMap((v,i)=>v?[[i,v]]:[]),"Exact screenshot board");
    assert.equal(await ui.evaluate("document.querySelector('#app').inert"),false);
    assert.equal(await ui.evaluate("document.querySelector('#undo').disabled"),true);
    shot("book78-report-before-taps");
    // Upper highlighted 6+6 is legal, though it is a losing branch.
    await press(7,16,10);
    assert.equal(await ui.evaluate("document.querySelector('#undo').disabled"),false);
    await ui.tap("#undo");
    await ui.until(left(12));
    // Lower highlighted 6+4 also must click.
    await press(37,38,10);
    await ui.tap("#undo");
    await ui.until(left(12));
    // Simulate going to another Android app and returning to this exact board.
    ui.close();
    adb("shell","input","keyevent","3");
    await wait(650);
    launch();
    ui=await connect();
    if(await ui.evaluate("document.querySelector('#dialog').open"))await ui.tap("#resume");
    await ui.until("!document.querySelector('#app').inert && !document.hidden && "+left(12));
    // The shipped witness is a complete six-move winning sequence.
    for(let i=0;i<report78Witness.length;i++) {
      const [a,b]=report78Witness[i];
      await press(a,b,12-2*(i+1));
    }
    await ui.until("!document.querySelector('#win').hidden");
    shot("book78-report-solved-after-resume");
    return {package:app,task:"book-v1-78",source:"shipped notebook-extra.json",
      board:report78Board.join(""),testedSize:"640x1136 at density 320",
      nativeInput:"ADB shell input tap",verticalSixesAccepted:true,bottomSixAndFourAccepted:true,
      undoRestoredBoard:true,homeAndResume:true,solvedWithShippedSixMoveWitness:true,physicalPhone:false};
  } finally {
    ui.close();
    stop();
    adb("shell","wm","size","640x1232");
  }
}
async function verifyPairWaves() {
  const board=[6,0,8,0,4,2,0,0,8];
  const game={...sample,active:"classic",sessions:{classic:{rules:1,
    current:{board,scroll:0,moves:0,additions:0},history:[]}}};
  await fixture({[progress]:game,[settings]:{tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}});
  launch();
  const ui=await connect();
  try {
    await ui.tap("#resume");
    await ui.until("!document.querySelector('#dialog').open");
    await ui.evaluate(`(() => {
      window.seedsWaveCheck=[];
      new MutationObserver(records=>{
        for(const record of records)for(const node of record.addedNodes){
          if(!(node instanceof HTMLElement) || !node.matches(".pair-wave")) continue;
          window.seedsWaveCheck.push({kind:node.dataset.kind,
            cells:[...node.children].map(cell=>Number(cell.dataset.waveIndex)),
            impact:node.querySelector(".pair-wave-impact")?.dataset.waveIndex ?? null});
        }
      }).observe(document.getElementById("app"),{childList:true});
    })()`);
    await ui.tap(digit(0));
    await ui.tap(digit(4));
    assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),"5");
    await ui.tap(digit(4));
    await ui.tap(digit(8));
    await ui.tap(digit(5));
    await ui.until("document.querySelector('#remaining').textContent==='3'");
    const waves=await ui.evaluate("window.seedsWaveCheck");
    assert.deepEqual(waves,[
      {kind:"blocked",cells:[0,1,2],impact:"2"},
      {kind:"match",cells:[8,7,6,5],impact:null},
    ]);
    await ui.tap("#undo");
    await ui.until("document.querySelector('#remaining').textContent==='5'");
    return waves;
  } finally {ui.close(); stop();}
}
async function verifyBoardMotion() {
  const remaining=[1,2,3,4,1,2,3,4,2];
  const board=[5,5,0,0,0,0,0,0,0,...remaining];
  const game={...sample,active:"classic",sessions:{classic:{rules:1,
    current:{board,scroll:0,moves:0,additions:0},history:[]}}};
  await fixture({[progress]:game,[settings]:{tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}});
  launch();
  const ui=await connect();
  try {
    await ui.tap("#resume");
    await ui.evaluate(`(() => {
      window.boardMotion={collapsed:0,added:[]};
      new MutationObserver(records=>{
        for(const record of records)for(const node of record.addedNodes)
          if(node instanceof HTMLElement && node.matches(".collapsed-row")) window.boardMotion.collapsed++;
      }).observe(document.getElementById("app"),{childList:true});
      const play=Animation.prototype.play;
      Animation.prototype.play=function(){
        const effect=this.effect;
        if(effect instanceof KeyframeEffect && effect.target?.matches(".digit")) {
          const index=Number(effect.target.parentElement.dataset.index), delay=effect.getTiming().delay;
          queueMicrotask(()=>{
            if(this.id==="board-add") window.boardMotion.added.push([index,delay]);
          });
        }
        return play.call(this);
      };
    })()`);
    await ui.tap(digit(0));
    await ui.tap(digit(1));
    await ui.until("document.querySelector('#remaining').textContent==='9'");
    await ui.tap("#add");
    await ui.until("window.boardMotion.added.length===9");
    assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),"18");
    const result=await ui.evaluate("window.boardMotion");
    assert.deepEqual(result,{collapsed:1,added:remaining.map((_,i)=>[i+9,i*9])});
    await ui.tap("#undo");
    await ui.until("document.querySelector('#remaining').textContent==='9' && !document.querySelector('.add-pending')");
    return result;
  } finally {ui.close(); stop();}
}
async function verifyContentV5() {
  const slot=2397,id="book-v1-"+slot,{board,proof}=bookV5(slot);
  assert.equal(board.filter(Boolean).length,108);
  const game={...sample,active:"classic",sessions:{classic:oldHighSession},
    meta:oldHighMeta,jars:oldHighJars};
  const settingsFixture={tutorialDone:true,languageChoice:"ru",sound:false,vibration:false};
  await fixture({[progress]:game,[settings]:settingsFixture});
  adb("shell","wm","size","640x1232");
  launch();
  let ui=await connect();
  const elapsed={};
  const remaining=n=>`document.querySelector('#remaining').textContent==='${n}'`;
  try {
    await ui.tap("#book-mode");
    await ui.tap("#all-books");
    await ui.tap('[data-book-range="4"]');
    await ui.tap('[data-volume="99"]');
    let at=performance.now();
    await ui.tap(`[data-game="${id}"]`);
    await ui.until(remaining(108)+" && !document.querySelector('#dialog').open");
    elapsed.open=Math.round(performance.now()-at);
    const top=()=>ui.evaluate("document.querySelector('#viewport').scrollTop");
    await ui.swipeBoardUp();
    assert(await top()>0,"108 digits should scroll");
    at=performance.now();
    await ui.tap("#hint");
    await ui.until("document.querySelectorAll('#board .hinted').length===2");
    elapsed.hint=Math.round(performance.now()-at);
    shot("v5-108-320x568");
    const grid=()=>ui.evaluate("document.querySelector('#board').childElementCount");
    const settled="!document.querySelector('#board').getAnimations({subtree:true}).some(a=>"+
      "(a.pending || a.playState==='running') && a.effect?.getKeyframes().some(f=>f.translate))";
    async function pressPair(a,b,count){
      await ui.until(settled);
      try {
        await ui.tap(digit(a));
        assert.equal(await ui.evaluate(`document.querySelector('${digit(a)}').getAttribute('aria-pressed')`),"true");
        await ui.tap(digit(b));
        await ui.until(remaining(count));
      } catch(error) {
        const detail=await ui.evaluate(`({
          remaining:document.querySelector('#remaining').textContent,
          status:document.querySelector('#status').textContent,
          selected:document.querySelector('#board .selected')?.dataset.index,
          board:[...document.querySelectorAll('#board .cell')].map(el=>Number(el.textContent)||0),
          scroll:document.querySelector('#viewport').scrollTop
        })`);
        fs.writeFileSync(out+"/v5-failed-move.json",JSON.stringify({id,a,b,count,detail},null,2));
        shot("v5-failed-move");
        throw error;
      }
    }
    let collapsed=false;
    for(const [index,[a,b]] of proof.entries()){
      const before=await grid(), count=108-2*(index+1);
      at=performance.now();
      await pressPair(a,b,count);
      if(index===0) {
        assert.equal(profiles().values[progress].bookRevisions[id],5);
        assert.equal(profiles().values[progress].version,9);
        elapsed.firstPairAndSave=Math.round(performance.now()-at);
      }
      if(!collapsed&&count>0&&(await grid())<before){
        await ui.tap("#undo");
        await ui.until(remaining(count+2));
        assert.equal(await grid(),before);
        await pressPair(a,b,count);
        collapsed=true;
        const snapshot=profiles().values[progress].sessions[id];
        ui.close();stop();
        adb("shell","wm","size","780x1784");
        launch();ui=await connect();
        await ui.tap("#resume");
        await ui.until(remaining(count));
        assert.deepEqual(profiles().values[progress].sessions[id].current.board,snapshot.current.board);
        shot("v5-108-resumed-390");
      }
    }
    await ui.until("!document.querySelector('#win').hidden");
    const p=profiles().values[progress];
    assert(collapsed);
    assert(p.done.includes(id));
    assert.equal(p.jars.seeds>oldHighJars.seeds,true);
    assert.deepEqual(p.sessions.classic.current,oldHighSession.current);
    assert.equal(p.sessions[id].packedHistory?.length??p.sessions[id].history?.length,54);
    return {id, digits:108, moves:proof.length, collapsedUndo:true, rebootRetained:true, offline:true,
      checkedUsing:"Android shell taps, CDP observations and journal in Preferences", elapsed};
  } finally {
    ui.close();stop();adb("shell","wm","size","640x1232");
  }
}
// Exact old generator seed 73, with its legal first pair [0,9] removed.
const oldHighBoard=[1,6,1,5,1,5,6,1,4,1,8,1,9,8,7,1,7,1,2,1,4,3,1,3,1,9,2];
const oldHighCurrent=oldHighBoard.map((digit,i)=>i===0||i===9?0:digit);
const oldHighSession={rules:1,current:{board:oldHighCurrent,scroll:0,moves:1,additions:0},
  history:[{board:oldHighBoard,scroll:0,moves:0,additions:0}]};
const oldHighMeta={version:2,wallet:7,since:"2026-11-23T00:00:00.000Z",completed:0,unassisted:0,
  attempts:{classic:{id:"legacy27",completed:false},"book-v1-5":{id:"old-book",completed:false}},
  classicRun:{version:1,difficulty:2,seed:3384638011,recent:[oldHighBoard.join("")],current:{attempt:"legacy27",board:oldHighBoard}}};
const oldHighJars={version:2,seeds:74,meter:74,wins:0,highWater:1,attempt:"legacy27"};
async function classicPilot() {
  await fixture({[progress]:{...sample,active:"classic",sessions:{classic:oldHighSession},meta:oldHighMeta,jars:oldHighJars},
    [settings]:{tutorialDone:true,theme:"dark",languageChoice:"ru",sound:false,vibration:false}});
  adb("shell","wm","size","640x1232");
  adb("shell","settings","put","system","font_scale","1");
  launch();
  const ui=await connect();
  const source=fs.readFileSync(classicBundle,"utf8");
  const withGenerator=code=>`(()=>{${source}
return (${code})(SeedsClassicQA);})()`;
  const left=n=>`document.querySelector("#remaining").textContent==="${n}"`;
  const depth=()=>ui.evaluate(`(()=>{const v=document.querySelector("#viewport");
    return {w:innerWidth,h:innerHeight,clientHeight:v.clientHeight,scrollHeight:v.scrollHeight,scroll:v.scrollTop};})()`);
  const edgeState=(above,below)=>`(()=>{const v=document.querySelector("#viewport");
    return v.hasAttribute("data-scroll-above")===${above} && v.hasAttribute("data-scroll-below")===${below}
      && (getComputedStyle(v).maskImage!=="none")===${above||below};})()`;
  const timing=[];
  let geometry, savedScroll, expertCount;
  const generated = [];
  try {
    assertViewportResult(await depth());
    await ui.tap("#resume");
    await ui.until("!document.querySelector('#dialog').open");
    await ui.until(left(25));
    await ui.tap("#undo");
    await ui.until(left(27));
    await expectSavedBoard("classic",oldHighBoard);
    await ui.tap("#menu");
    const { counts, holes } = await ui.evaluate(withGenerator(
      "({CLASSIC_START_COUNTS, CLASSIC_START_HOLES}) => ({counts:CLASSIC_START_COUNTS, holes:CLASSIC_START_HOLES})",
    ));
    for (const level of [2,0,1,3]) {
      const seen = new Set();
      let count;
      for (let n=0; n<3 || (level===3 && count<81); n++) {
        await ui.tap("#classic-mode");
        if(await ui.evaluate("!document.querySelector('#classic-entry').hidden"))await ui.tap("#next-classic");
        if (level===2 && n===0) shot("classic-four-difficulties-320-dark");
        await ui.tap(`[data-classic-level="${level}"]`);
        if (await ui.evaluate("!document.querySelector('#confirm-content').hidden"))
          await ui.tap("#confirm-new");
        await ui.until("!document.querySelector('#classic-new-sheet').open && !document.querySelector('#dialog').open");
        const board=profiles().values[progress].sessions.classic.current.board;
        count=board.filter(Boolean).length;
        assert(counts[level].includes(count));
        assert([0,holes[level]].includes(board.length-count));
        await ui.until(left(count));
        if(level===0) await ui.until(edgeState(false,false));
        if (!seen.has(count)) {
          await ui.until("!document.getAnimations().some(a=>a.id==='board-entrance'&&a.playState==='running')");
          shot(`classic-${count}-320-dark`);
          generated.push({ level, count, holes: board.length-count });
        }
        seen.add(count);
        if (level!==3 || n<2 || count<81) await ui.tap("#menu");
        assert(n<4,"Could not select a full Expert test");
      }
      assert.deepEqual([...seen].sort((a,b)=>a-b), counts[level]);
      if (level===3) expertCount=count;
    }
    const natural=await depth();
    const savedExpert=profiles().values[progress].sessions.classic.current.board;
    assert.equal(savedExpert.filter(Boolean).length,expertCount);
    const reservesBanner=await ui.evaluate("document.documentElement.classList.contains('has-mobile-ads')");
    if (!reservesBanner) {
      await ui.evaluate("document.documentElement.classList.add('has-mobile-ads')");
    }
    const reserved=await depth();
    geometry={natural,reserved,realBannerReserve:reservesBanner};
    assert(reserved.scrollHeight>reserved.clientHeight,`Expert is not scrollable with the short reserved viewport: ${JSON.stringify(reserved)}`);
    await ui.until(edgeState(false,true));
    const statusMetrics=await ui.evaluate(`(() => {
      const copy=document.querySelector("#status");
      return {height:copy.closest(".status-wrap").getBoundingClientRect().height,font:getComputedStyle(copy).fontSize};
    })()`);
    assert.deepEqual(statusMetrics,{height:48,font:"14px"});
    shot("classic-scroll-top");
    await ui.evaluate(`(() => { const v=document.querySelector("#viewport"); v.scrollTop=(v.scrollHeight-v.clientHeight)/2; })()`);
    await ui.until(edgeState(true,true));
    shot("classic-scroll-middle");
    await ui.swipeBoardUp();
    await ui.until(edgeState(true,false));
    shot("classic-scroll-bottom");
    const bottomPair=await ui.evaluate(withGenerator(`({pairs}) => pairs(${JSON.stringify(savedExpert)})
      .reverse().find(({a,b})=> a>=54 && [a,b].every(i=>{
        const r=document.querySelector('#board button[data-index="'+i+'"]').getBoundingClientRect();
        const v=document.querySelector('#viewport').getBoundingClientRect();
        return r.top>=v.top-1&&r.bottom<=v.bottom+1;
      }))`));
    assert(bottomPair,"No bottom pair in visible Expert rows");
    await ui.tap(digit(bottomPair.a),false);
    await ui.tap(digit(bottomPair.b),false);
    await ui.until(left(expertCount-2));
    await ui.tap("#undo");
    await ui.until(left(expertCount));
    assert.deepEqual(profiles().values[progress].sessions.classic.current.board,savedExpert);
    shot("classic-expert-bottom-320-dark");
    await ui.tap(digit(bottomPair.a));
    await ui.tap(digit(bottomPair.b));
    await ui.until(left(expertCount-2));
    savedScroll=(await depth()).scroll;
    for(const level of [0,1,2,3]){
      timing.push(await ui.evaluate(withGenerator(`({generateClassic,newClassicRun})=>{
        for(let seed=9996;seed<10000;seed++)generateClassic(newClassicRun(seed),${level});
        const data=[];
        for(let seed=10000;seed<10032;seed++){
          const start=performance.now();
          const game=generateClassic(newClassicRun(seed),${level});
          const size=game.board.filter(Boolean).length;
          data.push({seed,ms:performance.now()-start,size,holes:game.board.length-size,...game.diagnostics,fallback:game.fallback});
        }
        const start=performance.now();
        const forced=generateClassic(newClassicRun(12081),${level},{attempts:0});
        const forcedFallback={ms:performance.now()-start,fallback:forced.fallback,size:forced.board.filter(Boolean).length,
          proofActions:forced.proof.length,...forced.diagnostics};
        const times=data.map(d=>d.ms).sort((a,b)=>a-b);
        return {level:${level},data,forcedFallback,p50:times[15],p95:times[30],max:times.at(-1)};
      }`)));
    }
    assert(timing.every((result,i)=>result.forcedFallback.fallback&&counts[i].includes(result.forcedFallback.size)));
    await ui.tap("#menu");
    assert.equal(profiles().values[progress].meta.wallet,7);
  } finally { ui.close(); stop(); }
  launch();
  const resumed=await connect();
  try{
    await resumed.tap("#resume");
    await resumed.until(left(expertCount-2));
    const restoredScroll=await resumed.evaluate("document.querySelector('#viewport').scrollTop");
    if(geometry.realBannerReserve)assert(Math.abs(restoredScroll-savedScroll)<=1,"Lost Expert scroll after restart");
    await resumed.tap("#undo");
    await resumed.until(left(expertCount));
    return {timing,generated,geometry,scrollEdges:true,scrollRestore:{before:savedScroll,after:restoredScroll,realReserve:geometry.realBannerReserve},
      physicalPhone:false,viewport320:true,legacy27Undo:true,legacyWallet:7,
      bottomTouch:true,undo:true,restartAndContinue:true,
      webview:adb("shell","dumpsys","webviewupdate") .split("\n").find(x=>x.includes("Current WebView package"))};
  } finally {resumed.close();stop();}
}
async function verifyHintRepair() {
  const id="book-v1-1821", game=v5Session(1821,[2,3]);
  const settingsFixture={tutorialDone:true,languageChoice:"en",sound:false,vibration:false};
  await fixture({[progress]:{...sample,version:9,active:id,bookRevisions:{[id]:5},
    sessions:{[id]:packed(game)}, meta:{...oldHighMeta,attempts:{[id]:{id:"hint-audit",completed:false,hintKeys:[1,2,3].map(n=>"h1:"+String(n).repeat(64))}}}},[settings]:settingsFixture});
  const records=[];
  for(const size of ["640x1232","780x1784"]){
    adb("shell","wm","size",size);
    launch();
    const ui=await connect();
    try {
      await ui.tap("#resume");
      await ui.until("document.querySelector('#remaining').textContent==='104'");
      const before=profiles().values[progress];
      const start=performance.now();
      await ui.tap("#hint");
      await ui.until("document.querySelectorAll('#board .hinted').length===2");
      const hintMs=Math.round(performance.now()-start);
      const pair=await ui.evaluate("[...document.querySelectorAll('#board .hinted')].map(e=>Number(e.dataset.index))");
      const after=profiles().values[progress];
      assert.deepEqual(after.sessions[id].current.board,before.sessions[id].current.board);
      assert.deepEqual(unpacked(after.sessions[id]).history,unpacked(before.sessions[id]).history);
      assert.equal(after.meta.wallet,before.meta.wallet-(size==="640x1232"?1:0));
      assert(await ui.evaluate("document.querySelector('#recover-task').hidden"));
      const viewport=await ui.evaluate("[innerWidth,innerHeight]");
      shot("hint-repair-"+viewport.join("x"));
      records.push({viewport,pair,hintMs,wallet:after.meta.wallet});
    } finally {ui.close();stop();}
  }
  return records;
}
function assertViewportResult(view) {
  assert.deepEqual([view.w,view.h],[320,568]);
}
async function verifyAppBanner() {
  const report={source:process.env.GITHUB_SHA,physicalPhone:false,device:"Android API35 demo SDK",observed:[]};
  adb("install",candidate);
  adb("shell","wm","density","320");
  adb("shell","wm","size","640x1232");
  let ui, recording = false, guestRecorder;
  let video = resolve(out,"banner-continuity.webm");
  const guestVideo = "/sdcard/seeds-banner-continuity.mp4";
  const captureStart=performance.now();
  const trace=(label, detail={})=>report.observed.push({label,ms:Math.round(performance.now()-captureStart),...detail});
  try {
    // Capture the emulator display on the host without a guest codec or desktop compositor.
    try {
      const start=adb("emu","screenrecord","start","--time-limit","600",video);
      assert(!start.includes("KO"),start);
      report.recorder="emulator-console";
    } catch(error) {
      console.warn("Host recorder unavailable:",String(error));
      video=resolve(out,"banner-continuity.mp4");
      guestRecorder=spawn("adb",["shell","screenrecord","--size","320x616","--time-limit","0",guestVideo],{stdio:"ignore"});
      await new Promise((ready,reject)=>{guestRecorder.once("spawn",ready);guestRecorder.once("error",reject);});
      await wait(500);
      assert.equal(guestRecorder.exitCode,null,"Android screen recorder failed before launch");
      report.recorder="android-screenrecord";
    }
    recording=true;
    launch();
    trace("launch");
    const home = adb("shell","cmd","package","resolve-activity","--brief",
      "-a","android.intent.action.MAIN","-c","android.intent.category.HOME").split("\n").at(-1);
    const launcher = home?.match(/^([a-z][a-z0-9_.]+)\//i)?.[1];
    if (launcher && launcher !== app) adb("shell","am","force-stop",launcher);
    for(let attempt=1;attempt<=3;attempt++){
      try { ui=await connect(); break; }
      catch(error) {
        if(attempt===3) throw error;
        if (launcher && launcher !== app) adb("shell","am","force-stop",launcher);
        stop();
        launch();
        await wait(1000);
      }
    }
    const diagnostics=()=>ui.evaluate(`Promise.race([
      window.Capacitor.Plugins.SeedsMonetization.bannerDiagnostics(),
      new Promise((_,reject)=>setTimeout(()=>reject(Error("Banner diagnostics did not respond")),5000))
    ])`);
    const capturePixels = async () => {
      let raw, width, height;
      for (let attempt=0;attempt<3;attempt++) {
        try {
          const png=execFileSync("adb",["exec-out","screencap","-p"],{maxBuffer:20e6,timeout:12000});
          assert(png.length>24&&png.toString("ascii",1,4)==="PNG","Android returned an incomplete PNG");
          width=png.readUInt32BE(16); height=png.readUInt32BE(20);
          raw=execFileSync("ffmpeg",["-v","error","-threads","1","-f","image2pipe","-vcodec","png","-i","pipe:0",
            "-frames:v","1","-f","rawvideo","-pix_fmt","rgba","-threads","1","pipe:1"],{input:png,maxBuffer:20e6,timeout:12000});
          assert.equal(raw.length,width*height*4,"Android returned an incomplete screenshot");
          break;
        } catch(error) {
          if(attempt===2)throw error;
          await wait(650);
        }
      }
      return {raw,width,height};
    };
    const paint = async frame => {
      const {raw,width,height}=await capturePixels();
      const left=frame.screenLeft, top=frame.screenTop;
      assert(left>=0&&top>=0&&left+frame.width<=width&&top+frame.height<=height,
        "The native banner frame is outside the screenshot");
      const colors=new Set();
      for(let y=top+4;y<top+frame.height-4;y+=3)for(let x=left+4;x<left+frame.width-4;x+=3) {
        const i=(y*width+x)*4;
        colors.add((raw[i]>>4)*256+(raw[i+1]>>4)*16+(raw[i+2]>>4));
      }
      return colors.size;
    };
    let painted, initial;
    for(let i=0;i<36;i++) {
      initial=await diagnostics();
      if(initial.loaded>0&&initial.visible&&(painted=await paint(initial))>20)break;
      await wait(650);
    }
    report.initial=initial;
    report.paintColorBuckets=painted??0;
    if(!(initial.loaded>0&&initial.visible&&painted>20)){
      report.status="UNAVAILABLE";
      throw Error("Android did not paint a demo banner");
    }
    trace("first verified paint",{...initial,paintColorBuckets:painted});
    shot("banner-painted-start");
    const expected=async(visible,reason)=>{
      const mark=()=>ui.evaluate(`window.Capacitor.Plugins.SeedsMonetization.bannerExpectation({visible:${visible}})`);
      try { await mark(); }
      catch(error) {
        if (!String(error).includes("CDP timeout")) throw error;
        // Reattach the debugger without changing the banner or the test expectation.
        ui.close();
        ui=await connect();
        await mark();
      }
      trace(reason,{expected:visible});
    };
    let retained=initial;
    const stable=async(label)=>{
      const current=await diagnostics();
      const dom=await ui.evaluate(`({focus:document.hasFocus(),hidden:document.hidden,active:document.activeElement?.id,
        dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.id),inert:document.querySelector('#app').inert})`);
      trace(label+" observed",{...current,dom});
      assert.equal(current.view,retained.view,label);
      assert.equal(current.request,retained.request,label);
      assert.equal(current.visible,true,label);
      assert.equal(current.hiddenFrames,retained.hiddenFrames,label);
      assert.equal(current.phase,"draw",label+" geometry must belong to a rendered frame");
      assert.equal(current.movedFrames,retained.movedFrames,label+" unexpected physical movement in rendered frames");
      for (const dimension of ["screenLeft","screenTop","width","height"])
        assert.equal(current[dimension],retained[dimension],label+" "+dimension);
      const paintColorBuckets=await paint(current);
      trace(label,{...current,paintColorBuckets});
      assert(paintColorBuckets>20,label+" creative band lost color");
    };
    await expected(true,"ordinary scene transitions begin");
    for(const [a,b,n] of [[8,17,6],[4,5,4],[9,11,2],[7,14,0]]) {
      await ui.tap(digit(a)); await ui.tap(digit(b));
      await ui.until(`document.querySelector('#remaining').textContent==='${n}'`);
    }
    await stable("game to result");
    await ui.tap("#play-again");
    await ui.until("document.querySelector('#mode').textContent.includes('2')");
    await stable("result to game");
    await ui.tap("#menu"); await stable("game to Home");
    await ui.tap("#book-mode"); await stable("Home to notebook");
    await ui.tap("#all-books"); await stable("notebook to picker");
    await ui.tap("#collection-back"); await stable("picker to notebook");
    await ui.tap("#collection-back"); await stable("notebook to Home");
    await expected(false,"language modal opens");
    await ui.tap("#pause-language");
    await ui.until("document.querySelector('#language-sheet').open");
    const hiddenByLanguage=await diagnostics();
    assert.equal(hiddenByLanguage.visible,false);
    trace("real language modal",{...hiddenByLanguage,expected:false});
    await ui.tap("#language-close");
    await stable("language closed");
    await expected(true,"language modal closed");
    await ui.tap("#resume"); await stable("explicit Home to game");
    await ui.tap("#menu"); await stable("Home before background");
    await expected(false,"settings modal opens for theme change");
    await ui.tap("#settings-open");
    assert.equal((await diagnostics()).visible,false);
    await ui.tap("#dark");
    await ui.until("document.documentElement.dataset.theme==='dark'");
    await ui.tap("#settings-back");
    await stable("saved dark theme returns to Home");
    await expected(true,"theme change finished");
    await expected(false,"Home backgrounds");
    adb("shell","am","start","-a","android.settings.SETTINGS");
    await wait(450);
    const hiddenByBackground=await diagnostics();
    assert.equal(hiddenByBackground.visible,false);
    trace("Home in background",{...hiddenByBackground,expected:false});
    launch();
    await ui.until("document.visibilityState==='visible' && document.hasFocus()");
    await wait(500);
    await stable("foreground restored to Home");
    await expected(true,"Home restored");
    // uiMode is handled by MainActivity. Changing fontScale can recreate it.
    adb("shell","cmd","uimode","night","yes");
    await ui.until("document.hasFocus() && document.querySelector('#dialog[data-screen=home]')?.open");
    await stable("Android reconfiguration with the same slot geometry");
    await expected(false,"reload handshake starts");
    await ui.evaluate("setTimeout(() => location.reload(), 50); true");
    await wait(1000);
    await ui.until("document.querySelector('#dialog[data-screen=home]')?.open && document.hasFocus()");
    await stable("WebView reload with retained native banner");
    await expected(false,"Android viewport resize begins");
    adb("shell","wm","size","720x1392");
    let resized;
    for(let i=0;i<30;i++){
      resized=await diagnostics();
      if(resized.width!==initial.width&&resized.loaded>initial.loaded&&resized.visible)break;
      await wait(450);
    }
    assert(resized.width>initial.width && resized.loaded>initial.loaded && resized.visible,"No creative in the resized viewport");
    assert.equal(resized.request,initial.request+1,"One replacement request after resizing");
    assert.notEqual(resized.view,initial.view,"The resized slot has a fresh SDK view");
    ui.close();
    ui=await connect();
    retained=resized;
    await stable("native banner repainted for the wider slot");
    shot("banner-resized");
    await expected(true,"resized creative visible");
    // Wait for the actual initial-grace interval; this test doesn't rewrite ad policy.
    const adPrefs=`/data/user/0/${app}/shared_prefs/seeds-monetization.xml`;
    const lastFullscreen=Number(/name="last_fullscreen" value="(\d+)"/.exec(adb("shell","cat",adPrefs))?.[1]);
    const deviceTime=Number(adb("shell","date","+%s"))*1000;
    assert(lastFullscreen>0&&deviceTime>0,"Native ad interval unavailable");
    const eligibleAt=performance.now()+Math.max(0,lastFullscreen+181000-deviceTime);
    while(performance.now()<eligibleAt) {
      await wait(Math.min(10000,Math.max(0,eligibleAt-performance.now())));
      try { await diagnostics(); }
      catch(error) {
        if (!String(error).includes("timeout")) throw error;
        ui.close();
        ui=await connect();
        await diagnostics();
      }
    }
    // The first field entry after returning to the app is protected. Verify
    // that entry before exercising an internal Home-to-game transition.
    await stable("before protected app entry");
    await ui.tap("#resume");
    await ui.until("!document.querySelector('#dialog').open");
    await stable("protected app entry keeps the banner");
    await ui.tap("#menu");
    await ui.until("document.querySelector('#dialog').open");
    await stable("before genuine interstitial");
    await expected(false,"fullscreen request");
    await ui.tap("#resume");
    let shown;
    for (let attempt=0;attempt<24;attempt++) {
      shown=await diagnostics();
      if(shown.fullscreen && !shown.focused)break;
      await wait(150);
    }
    assert(shown.fullscreen && !shown.focused,"SDK did not open the demo interstitial");
    assert.equal(shown.visible,false);
    trace("genuine interstitial hides native banner",{...shown,expected:false});
    shot("banner-hidden-by-interstitial");
    const dismissFullscreen=async()=>{
    const sdkPlayerStarted=performance.now(), sdkPlayerDeadline=sdkPlayerStarted+160000;
    let backDelivered=false;
    // The demo can serve a multi-part video. Give its own close control time to appear.
    while((await diagnostics()).fullscreen && performance.now()<sdkPlayerDeadline) {
      await wait(6000);
      if(!(await diagnostics()).fullscreen)break;
      // Yandex's demo story also displays an unlabelled Next/Close icon in this rail.
      const {raw,width,height}=await capturePixels();
      const storyNext=findSdkStoryNext(raw,width,height);
      if(storyNext){trace("visible SDK story Next control tapped",storyNext);adb("shell","input","tap",String(storyNext.x),String(storyNext.y));continue;}
      const closeCross=findSdkCloseCross(raw,width,height);
      if(closeCross){trace("visible SDK close control tapped",closeCross);adb("shell","input","tap",String(closeCross.x),String(closeCross.y));continue;}
      // Android Back is a real SDK-window input, not a synthetic dismissal or
      // app-side finish(). Some demo video players expose no close glyph while
      // accessibility remains permanently busy. Require the actual SDK callback.
      if(!backDelivered && performance.now()-sdkPlayerStarted>30000) {
        trace("Android Back delivered to the focused SDK window");
        adb("shell","input","keyevent","KEYCODE_BACK");
        backDelivered=true;
        continue;
      }
      try {
        adb("shell","uiautomator","dump","/sdcard/demo-fullscreen.xml");
        const hierarchy=adb("shell","cat","/sdcard/demo-fullscreen.xml");
        const action=String.raw`Close(?: ad| video)?|Dismiss|Skip(?: ad| video)?|Next|Закрыть(?: рекламу| видео)?|Пропустить(?: рекламу| видео)?|Далее|Следующее видео`;
        const close=hierarchy.match(new RegExp(String.raw`<node [^>]*(?:text|content-desc)="(?:${action})"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"`,"i"));
        if(close){
          adb("shell","input","tap",String((+close[1]+ +close[3])>>1),String((+close[2]+ +close[4])>>1));
          continue;
        }
      } catch(error) { console.warn("Reading the ad close control:",String(error)); }
      if(!(await diagnostics()).fullscreen)break;

    }
    assert(!(await diagnostics()).fullscreen,"Demo creative has not provided an SDK dismissal");
    };
    await dismissFullscreen();
    await ui.until("!document.querySelector('#dialog').open && document.hasFocus()");
    await stable("after genuine interstitial");
    await expected(true,"fullscreen dismissed");
    await expected(false,"explicit QA rewarded bridge request");
    const beforeReward=profiles().values[progress];
    await ui.evaluate(`(async()=>{
      window.__qtRewardResult=null; window.__qtRewardReceipt=null;
      window.__qtRewardHandle=await window.Capacitor.Plugins.SeedsMonetization.addListener("reward",receipt=>window.__qtRewardReceipt=receipt);
      window.Capacitor.Plugins.SeedsMonetization.show({kind:"rewarded",product:"hint_pack_3",
        attempt:${JSON.stringify(beforeReward.meta.attempts[beforeReward.active].id)},intent_id:"qt45-native-acceptance",offer_id:"qt45-native-acceptance"})
        .then(result=>window.__qtRewardResult=result);
      return true;
    })()`);
    let rewardShown;
    for(let i=0;i<50;i++){rewardShown=await diagnostics();if(rewardShown.fullscreen&&!rewardShown.focused)break;await wait(150);}
    assert(rewardShown.fullscreen&&!rewardShown.visible,"SDK did not open/hide the banner for rewarded");
    trace("genuine rewarded hides native banner",rewardShown);
    await dismissFullscreen();
    await ui.until("document.hasFocus() && window.__qtRewardResult!==null");
    const rewardResult=await ui.evaluate("window.__qtRewardResult");
    assert.equal(rewardResult.shown,true);
    await ui.until("Boolean(window.__qtRewardReceipt?.token)");
    const earnedReceipt=await ui.evaluate("window.__qtRewardReceipt");
    // Delivery/receipt settlement is authoritative; the SDK callback is not a fabricated grant.
    await ui.until(`window.Capacitor.Plugins.SeedsMonetization.pending().then(p=>!p.reward)`);
    const afterReward=profiles().values[progress];
    assert.equal(afterReward.meta.wallet,beforeReward.meta.wallet+3);
    assert.equal(afterReward.meta.rewardReceipts.filter(id=>id===earnedReceipt.token).length,1);
    trace("earned rewarded saved exactly once",{token:earnedReceipt.token,walletBefore:beforeReward.meta.wallet,walletAfter:afterReward.meta.wallet});
    await ui.evaluate("window.__qtRewardHandle.remove();true");
    await stable("after genuine rewarded");
    await expected(true,"rewarded dismissed");
    await ui.tap("#menu"); await stable("interstitial round trip to Home");
    report.status="PASS";
    return report;
  } catch(error) {
    if (report.status !== "UNAVAILABLE") report.status="ERROR";
    report.error=String(error);
    try { shot("banner-failure"); } catch (captureError) { console.warn(String(captureError)); }
    throw error;
  } finally {
    if(recording) {
      try {
        if(guestRecorder){
          if(guestRecorder.exitCode===null){
            const closed=new Promise(ready=>guestRecorder.once("exit",ready));
            adb("shell","pkill","-2","screenrecord");
            await closed;
          }
          adb("pull",guestVideo,video);
        } else adb("emu","screenrecord","stop");
        assert(fs.existsSync(video)&&fs.statSync(video).size>1024,"No host screen recording");
        const duration=Number(execFileSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",video],{encoding:"utf8"}));
        report.videoSeconds=duration;
        if(report.status==="PASS")assert(duration>report.observed.at(-1).ms/1000-2,"The video ends before the last measured transition");
      } catch(error) {
        console.warn("Screen recording:",String(error));
        if(report.status==="PASS") { report.status="ERROR"; report.error=String(error); }
      }
    }
    if(ui)try{report.geometryTrace=await ui.evaluate("window.Capacitor.Plugins.SeedsMonetization.bannerGeometryTrace()");}catch(error){report.traceError=String(error);}
    fs.writeFileSync(out+"/banner-continuity.json",JSON.stringify(report,null,2));
    ui?.close();
    try { stop(); adb("uninstall",app); } catch (cleanupError) { console.warn(String(cleanupError)); }
    if(report.status==="ERROR")process.exitCode=1;
  }
}
async function verifyDurableClassic() {
  const records=[], savedProfile=profiles().values;
  const initial=Array.from({length:19},(_,i)=>String(i+1)).join("").replaceAll("0","").split("").map(Number);
  const next=moved(initial,[0,9]);
  try {
    for(let trial=0;trial<20;trial++) {
      const snapshot={board:initial,moves:0,additions:0,scroll:0}, attempt="qt45-native-"+trial;
      const data={version:3,active:"classic",done:[],seen:[],hints:{},sessions:{classic:{rules:1,current:snapshot,history:[]}},
        meta:{version:2,since:"2026-11-26T00:00:00Z",completed:0,unassisted:0,wallet:0,
          attempts:{classic:{id:attempt,completed:false}},classicRun:{version:1,seed:73,difficulty:1,recent:[initial.join("")],current:{attempt,board:initial}}}};
      await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:"en",sound:false,vibration:false,theme:"light"}});
      launch();let ui=await connect();
      try {
        await ui.tap("#resume");await ui.tap(digit(0));
        // Dispatch the final input and observe the counter in the WebView, then
        // force-stop immediately. No post-move sleep or disk polling precedes it.
        await ui.evaluate(`document.querySelector('${digit(9)}').click();true`);
        await ui.until("document.querySelector('#remaining').textContent==='26' && document.querySelector('.game').dataset.persistence==='saved'");
        stop();ui.close();
        const disk=profiles().values[progress];
        assert.deepEqual(disk.sessions.classic.current.board,next);
        assert.equal(disk.sessions.classic.current.moves,1);
        assert.equal((disk.sessions.classic.history??disk.sessions.classic.packedHistory).length,1);
        launch();ui=await connect();await ui.tap("#resume");
        await ui.until("!document.querySelector('#dialog').open && !document.querySelector('#undo').disabled");
        assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),"26");
        await ui.evaluate("document.querySelector('#undo').click();true");
        await ui.until("document.querySelector('#remaining').textContent==='28' && document.querySelector('.game').dataset.persistence==='saved'");
        stop();ui.close();
        const undone=profiles().values[progress];assert.deepEqual(undone.sessions.classic.current.board,initial);
        assert.equal(undone.sessions.classic.current.moves,0);
        assert.equal(undone.jars.meter,2); // Undo does not repay or remove earned depth.
        records.push({trial,forceStopAfterVisible26:true,durableAcknowledgement:true,noPostAcknowledgementSleep:true,restored26:true,undoDurable28:true,attempt});
      }finally{ui.close();stop();}
    }
    return {source:process.env.GITHUB_SHA,device:"Android API35 offline",physicalPhone:false,records,status:"PASS"};
  }finally{await fixture(savedProfile);}
}
async function verifyAppearance() {
  launch();
  const records=[];
  const original=profiles().values[settings]?.theme || "light";
  let ui=await connect();
  const inspect=async(name,dark)=>{
    const state=await ui.evaluate("window.Capacitor.Plugins.SeedsAppearance.diagnostics()");
    assert.equal(state.dark,dark,name+" saved theme");
    assert.equal(state.darkStatusIcons,!dark,name+" status icons");
    assert.equal(state.darkNavigationIcons,!dark,name+" navigation icons");
    await wait(250);
    shot(name);
    const png=fs.readFileSync(out+"/"+name+".png"),w=png.readUInt32BE(16),h=png.readUInt32BE(20);
    const raw=execFileSync("ffmpeg",["-v","error","-threads","1","-i",out+"/"+name+".png","-frames:v","1","-f","rawvideo","-pix_fmt","rgba","-threads","1","pipe:1"],{maxBuffer:20e6});
    const color=(x,y)=>[...raw.subarray((y*w+x)*4,(y*w+x)*4+3)];
    const top=color(8,8),bottom=color(8,h-8);
    const near=(actual,expected)=>actual.every((v,i)=>Math.abs(v-expected[i])<18);
    assert(near(top,dark?[48,62,49]:[229,221,190]),name+" status pixels "+top);
    assert(near(bottom,dark?[35,49,39]:[197,190,159]),name+" navigation pixels "+bottom);
    records.push({name,dark,state,top,bottom});
  };
  try {
    for(const dark of [false,true]) {
      await ui.tap("#settings-open");
      if(await ui.evaluate("document.querySelector('#dark').checked")!==dark)await ui.tap("#dark");
      await ui.until("document.documentElement.dataset.theme==='"+(dark?"dark":"light")+"'");
      await inspect("appearance-"+(dark?"dark":"light")+"-settings",dark);
      adb("shell","cmd","uimode","night",dark?"no":"yes");
      await inspect("appearance-"+(dark?"dark":"light")+"-system-config",dark);
      await ui.tap("#settings-back");
      await ui.tap("#pause-language");await inspect("appearance-"+(dark?"dark":"light")+"-modal",dark);
      adb("shell","input","keyevent","4");await ui.until("!document.querySelector('#language-sheet').open");
      await ui.tap("#resume");await inspect("appearance-"+(dark?"dark":"light")+"-field",dark);
      adb("shell","input","keyevent","3");await wait(150);launch();await inspect("appearance-"+(dark?"dark":"light")+"-resume",dark);
      await ui.tap("#menu");
    }
    ui.close();stop();launch();ui=await connect();await inspect("appearance-dark-cold",true);
    await ui.tap("#settings-open");if((original==="dark")!==await ui.evaluate("document.querySelector('#dark').checked"))await ui.tap("#dark");
    await ui.tap("#settings-back");
    return {records,physicalPhone:false};
  } finally {ui.close();}
}

async function verifyReachValues() {
  const original=profiles().values,records=[];
  try {
    for(const theme of ["light","dark"])for(const kind of ["mixed","invalid"]) {
      const board=Array(45).fill(0);
      for(const [i,n] of [[0,4],[2,kind==="mixed"?4:1],[4,6],[8,6],[9,2],[10,kind==="mixed"?6:3],[20,8],[44,4]])board[i]=n;
      await fixture({
        [settings]:{...original[settings],theme,tutorialDone:true,languageChoice:"en"},
        [progress]:{version:3,active:"classic",done:[],seen:[],hints:{},
          sessions:{classic:{rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]}}},
      });
      launch();const ui=await connect();
      try {
        await ui.tap("#resume");await ui.until("!document.querySelector('#dialog').open");
        await ui.tap(digit(0));await ui.until("document.querySelectorAll('.reachable').length===3");
        const result=await ui.evaluate(`({green:[...document.querySelectorAll('.reachable-valid')].map(e=>+e.dataset.index),
          red:[...document.querySelectorAll('.reachable-invalid')].map(e=>+e.dataset.index),
          blocked:[4,20].every(i=>!document.querySelector('[data-index="'+i+'"]').classList.contains('reachable')),
          redEdges:[...document.querySelectorAll('.reachable-invalid')].map(e=>getComputedStyle(e).outlineStyle)})`);
        assert.deepEqual(result.green,kind==="mixed"?[2,10]:[]);
        assert.deepEqual(result.red,kind==="mixed"?[9]:[2,9,10]);
        assert(result.blocked);assert(result.redEdges.every(edge=>edge==="dashed"));
        shot("reach-"+theme+"-"+kind);
        await ui.tap(digit(0));await ui.until("document.querySelectorAll('.reachable').length===0");
        assert.deepEqual(profiles().values[progress].sessions.classic.current.board,board);
        records.push({theme,kind,...result});
      } finally {ui.close();}
    }
    return {records,physicalPhone:false};
  } finally {await fixture({[settings]:original[settings],[progress]:original[progress]});}
}

async function verifyCoreFeel() {
  const initial = [2,8,4,4,1,9];
  const after = [0,0,4,4,1,9];
  await fixture({
    [progress]: {version:3, active:"classic", done:[], seen:[], hints:{},
      sessions:{classic:{rules:1, current:{board:initial, moves:0, additions:0, scroll:0}, history:[]}}},
    [settings]: {tutorialDone:true, vibration:false, theme:"dark", languageChoice:"en"},
  });
  launch();
  let ui=await connect();
  try {
    await ui.until("performance.getEntriesByType('resource').some(entry=>/seeds-foley-.*[.]ogg$/.test(entry.name))");
    await ui.tap("#settings-open");
    assert(await ui.evaluate("!document.querySelector('#core-feel-profile, #core-feel-pack')"));
    assert(await ui.evaluate("document.querySelector('#sound').checked && !document.querySelector('#vibration').checked"));
    await ui.tap("#sound");
    await ui.tap("#settings-back");
    await ui.tap("#resume");
    await ui.tap(digit(0));
    await ui.tap(digit(1));
    await expectSavedBoard("classic",after);
    ui.close();
    stop();
    launch();
    ui=await connect();
    await ui.tap("#settings-open");
    assert(await ui.evaluate("!document.querySelector('#sound').checked && !document.querySelector('#vibration').checked"));
    await ui.tap("#settings-back");
    await ui.tap("#resume");
    await ui.tap("#undo");
    await expectSavedBoard("classic",initial);
    return {profileSelectorsAbsent:true, soundOnByDefault:true, foleyLoadedOffline:true,
      muteRetainedAfterRestart:true, undoRetained:true, physicalPhone:false};
  } finally {
    ui.close();
  }
}
if(process.env.SEEDS_BANNER_ONLINE==="1"){
  await verifyAppBanner();
  process.exit(process.exitCode??0);
}
try{
  adb("shell","wm","density","320");
  adb("shell","wm","size","780x1688");
  lockDeviceRotation(0);
  const upgrade=await update();
  fs.writeFileSync(out+"/durable-classic.json",JSON.stringify(await verifyDurableClassic(),null,2));
  fs.writeFileSync(out+"/appearance.json",JSON.stringify(await verifyAppearance(),null,2));
  fs.writeFileSync(out+"/reach-values.json",JSON.stringify(await verifyReachValues(),null,2));
  if (process.env.SEEDS_ANDROID_CORE_FEEL === "1") {
    const pilot=await verifyCoreFeel();
    fs.writeFileSync(out+"/core-feel.json",JSON.stringify({source:process.env.GITHUB_SHA,...pilot},null,2));
  }
  adb("uninstall",app);
  adb("install",candidate);
  const versionCode=installedVersionCode();
  assert.equal(versionCode,upgrade.to,"Debug and optimized previews must share a versionCode");
  adb("shell","wm","size","640x1232");
  const gameText={};
  for (const scale of [1,1.5,2]) {
    gameText[scale]=await measureGameText(scale);
    assert.deepEqual(gameText[scale],gameText[1],"Game text changed at system font scale "+scale);
  }
  fs.writeFileSync(out+"/fixed-text.json",JSON.stringify(gameText,null,2));
  assert.equal(adb("shell","pm","clear",app),"Success");
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
  for(const order of [[8,9],[9,8]]) {
    const rotate=order[0]===8;
    // Keep the orientation and touch assertions in the Foley run without the
    // old screen recorder that disconnected its emulator during capture.
    controls.push(await showEdge("640x1232",order,rotate,rotate&&process.env.SEEDS_ANDROID_CORE_FEEL!=="1"));
  }
  fs.writeFileSync(out+"/result.json",JSON.stringify({source:process.env.GITHUB_SHA,package:app,versionCode,
    physicalPhone:false,systemFont:2,forwardedFile:file,upgrade,updatePreservedSave:true,opening,archives,controls,
    webview:adb("shell","dumpsys","webviewupdate").split("\n").find(x=>x.includes("Current WebView package"))},null,2));
  // The player report requires a native touch regression, separate from solver proof.
  const report78=await verifyReport78Taps();
  fs.writeFileSync(out+"/book78-taps.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode, ...report78},null,2));
  if(v5Preview) {
    const catalogue=await verifyContentV5();
    fs.writeFileSync(out+"/content-v5-108.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode,...catalogue},null,2));
  }
  if(openingPreview) {
    const hint=await verifyHintRepair();
    fs.writeFileSync(out+"/hint-repair.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode,hint},null,2));
  }
  const waves=await verifyPairWaves();
  fs.writeFileSync(out+"/pair-waves.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode,waves},null,2));
  const motion=await verifyBoardMotion();
  fs.writeFileSync(out+"/board-motion.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode,...motion},null,2));
  if (classicBundle) {
    const pilot=await classicPilot();
    fs.writeFileSync(out+"/classic-pilot-android.json",JSON.stringify({source:process.env.GITHUB_SHA,versionCode,...pilot},null,2));
  }
  // An optional recording must never turn a passing game regression into a red CI.
  // Log camera/emulator failures separately so the real acceptance result survives.
  try {
    assert.equal(adb("shell","pm","clear",app),"Success");
    launch();
    await firstNotebookEdge([7,14],{recordVideo:true});
    fs.writeFileSync(out+"/video-result.json",JSON.stringify({source:process.env.GITHUB_SHA,package:app,versionCode,physicalPhone:false,recorded:true},null,2));
  } catch(videoError) {
    fs.writeFileSync(out+"/video-failure.txt",String(videoError)+"\n"+videoError.stack);
    console.warn("ANDROID_VIDEO_CAPTURE_FAILED",String(videoError));
  }
}catch(error) {
  try{shot("failed");}catch(screenshotError){console.warn("ANDROID_FAILURE_SCREENSHOT_UNAVAILABLE",String(screenshotError));}
  fs.writeFileSync(out+"/failure.txt",String(error)+"\n"+error.stack);
  throw error;
}
