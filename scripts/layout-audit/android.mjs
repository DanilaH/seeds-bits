import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
const app = 'com.seedsbits.game.preview';
const output = 'test-results/layout-android';
fs.mkdirSync(output, {recursive:true});
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8'}).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
async function attach() {
  let target;
  for (let i=0; i<60; ++i) {
    try {
      const pid = adb('shell','pidof',app);
      adb('forward','tcp:9223','localabstract:webview_devtools_remote_'+pid);
      target = (await (await fetch('http://127.0.0.1:9223/json/list')).json()).find(t=>t.type==='page');
      if (target) break;
    } catch {}
    await wait(500);
  }
  if (!target) throw Error('No preview WebView');
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  const pending=new Map();
  let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
  const evaluate=async expression=>{
    const id=++seq;
    const result=new Promise(resolve=>pending.set(id,resolve));
    ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
    const reply=await result;
    if(reply.error||reply.result.exceptionDetails) throw Error(JSON.stringify(reply));
    return reply.result.result.value;
  };
  return {evaluate, close:()=>ws.close()};
}
const evidence=[];
const apk=process.argv[2];
fs.writeFileSync(output+'/build.json',JSON.stringify({package:app,sha256:createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),version:adb('shell','dumpsys','package',app).split('\n').filter(l=>/versionName=|versionCode=/.test(l)).map(l=>l.trim()),webview:adb('shell','dumpsys','webviewupdate').split('\n').find(l=>l.includes('Current WebView package')),commit:process.env.GITHUB_SHA},null,2));
for(const scale of ['1.0','1.5','2.0']){
  adb('shell','am','force-stop',app);
  adb('shell','pm','clear',app);
  adb('shell','settings','put','system','font_scale',scale);
  adb('shell','monkey','-p',app,'1');
  const {evaluate,close}=await attach();
  async function until(expression){for(let n=0;n<60;n++){if(await evaluate(expression)) return;await wait(500)}throw Error('Timed out: '+expression)}
  const click=async s=>{await evaluate('document.querySelector('+JSON.stringify(s)+').click()');await wait(400)};
  async function record(state){
    const row=await evaluate(`(()=>{const r=s=>{const el=document.querySelector(s);if(!el)return null;const b=el.getBoundingClientRect();return [b.x,b.y,b.width,b.height].map(Math.round)};const v=r('#viewport'),j=r('#hint-jump');const hit=[...document.querySelectorAll("#board [data-index]")].filter(e=>{if(!e.textContent.trim()||!j[2])return false; const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return x>=v[0]&&x<v[0]+v[2]&&y>=v[1]&&y<v[1]+v[3]&&document.elementFromPoint(x,y)?.closest("#hint-jump")}).map(e=>+e.dataset.index);return {hit,screen:[innerWidth,innerHeight],board:v,first:r('[data-index="0"]'),lesson:r('#lesson'),next:r('#lesson-next'),jump:j,overlap:Math.max(0,Math.min(j[1]+j[3],v[1]+v[3])-Math.max(j[1],v[1])),text:document.querySelector('#status').textContent}})()`);
    evidence.push({scale,state,...row});
    fs.writeFileSync(output+'/measurements.json',JSON.stringify(evidence,null,2));
    fs.writeFileSync(output+'/'+scale+'-'+state+'.png',execFileSync('adb',['exec-out','screencap','-p']));
  }
  await until("document.querySelector('#app') && !document.querySelector('#app').inert && !document.querySelector('#lesson').hidden");
  await record('tutorial-start');
  await click('[data-index="0"]');await click('[data-index="1"]');
  await until("!document.querySelector('#lesson-next').hidden");
  await record('tutorial-pair');
  await evaluate(`(()=>{localStorage.clear();localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));const board=Array.from({length:180},(_,i)=>i%9===0?0:1);board[0]=board[171]=5;localStorage.setItem('seeds-bits.session.v1',JSON.stringify({rules:1,current:{board,moves:0,scroll:0,additions:0},history:[]}));setTimeout(()=>location.reload(),10)})()`);
  await wait(1600);await until("document.querySelector('#dialog')?.open && !document.querySelector('#app').inert");
  await click('#resume');await click('#hint');await until("document.querySelector('#hint-jump')?.hidden===false");
  await wait(800);await record('distant-hint');await wait(8000);await record('idle-8s');await click('#hint-jump');await wait(800);await record('after-jump');close();
}
