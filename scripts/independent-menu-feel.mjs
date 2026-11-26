import {chromium} from 'playwright';
import fs from 'node:fs';
const out='test-results/menu-reward-feel';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const result={source:process.env.GITHUB_SHA,baseline:'125606e4a90e06b844fe6eb8f83249032cb7057f',cases:[],errors:[]};
const key='seeds-bits.progress.v2';
const book=n=>'book-v1-'+n;
const days=n=>Array.from({length:n},(_,i)=>'daily-v1-2026-11-'+String(i+1).padStart(2,'0'));
const mk=(kind,meter=20)=>{
 let active=kind==='classic'||kind==='nav'?'classic':kind.startsWith('daily')?'daily-v1-2026-11-13':kind==='task'?book(9):kind==='page'||kind==='replay-page'?book(6):book(24);
 const n=kind==='page'?5:kind==='book'?23:kind==='replay-page'?6:kind==='replay-book'?24:0;
 const done=kind.startsWith('daily')?days(kind==='daily-medal'?6:3):Array.from({length:n},(_,i)=>book(i+1));
 const board=kind==='nav'?[4,0,6,7,0,3,0,0,1,5,5,8,0,2,9,0,2,0]:[5,5];
 const session={rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]};
 return {version:3,active,done,seen:[],sessions:{[active]:session},hints:{},jars:{version:2,meter,seeds:meter,wins:3,attempt:'audit',highWater:1},meta:{version:2,since:'2026-11-01',wallet:1,completed:10,unassisted:10,attempts:{[active]:{id:'audit',completed:false}}}};
};
async function start(name,kind,{width=390,height=844,theme='light',reduced=false,meter=20}={}){
 const ctx=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference',locale:'ru-RU',recordVideo:{dir:out+'/video',size:{width,height}}});
 const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push({name,error:String(e)}));
 await p.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
 await p.addInitScript(({save,theme,key})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));
  if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',theme,sound:false,vibration:false}));
  window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),pending:async()=>({}),show:async()=>({status:'unavailable'})};
  const orig=Element.prototype.animate;window.auditAnimations=[];
  Element.prototype.animate=function(k,o){let a=orig.call(this,k,o);window.auditAnimations.push({at:performance.now(),id:this.id,cls:typeof this.className==='string'?this.className:this.getAttribute('class'),frames:Array.isArray(k)?[k[0],k[k.length-1]]:k,duration:typeof o==='number'?o:o?.duration,delay:o?.delay});return a;};
 },{save:mk(kind,meter),theme,key});
 await p.goto('/');await p.locator('#dialog[data-screen="home"][open]').waitFor({timeout:10000});await p.evaluate(()=>document.fonts.ready);
 await p.waitForTimeout(200);
 return {p,ctx};
}
async function click(p,s){await p.locator(s).first().click({timeout:5000});}
const snap=async p=>p.evaluate(key=>{
 const info=s=>{let e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,visible:e.checkVisibility()&&r.width>0&&r.height>0,transform:cs.transform,opacity:cs.opacity,text:e.innerText?.slice(0,180)}};
 const root=document.querySelector('#dialog');
 const a=JSON.parse(localStorage.getItem(key)||'{}');
 return {ms:performance.now(),screen:root.open?root.dataset.screen:'field',kind:document.querySelector('#win')?.dataset.resultKind,win:info('#win'),paper:info('.quiet-result-page'),next:info('#play-again'),home:info('#result-home'),award:info('#award'),gains:info('#result-gains'),jar:info('#result-jar-glass'),jarAmount:info('#result-jar-amount'),headerJar:info('#jar-glass'),banner:info('#ad-space'),flights:document.querySelectorAll('#seed-flights .flying-seed').length,spill:document.querySelectorAll('#jar-spill i').length,burst:document.querySelectorAll('.result-seed-burst i').length,medal:document.querySelectorAll('.trophy-confetti i').length,activeAnimations:document.getAnimations().filter(x=>x.playState==='running').length,durable:{meter:a.jars?.meter,seeds:a.jars?.seeds,done:a.done?.length,completed:a.meta?.completed,attempt:a.meta?.attempts?.[a.active]?.completed}};
 },key);
async function run(name,kind,options,fn){let c;const rec={name,kind,options,samples:[],animations:[]};result.cases.push(rec);
 try{c=await start(name,kind,options);await fn(c.p,rec);rec.animations=await c.p.evaluate(()=>window.auditAnimations);await c.p.screenshot({path:out+'/'+name+'-settled.png'});}
 catch(e){result.errors.push({name,error:String(e)});if(c)await c.p.screenshot({path:out+'/'+name+'-error.png'}).catch(()=>{});}
 finally{if(c){const v=c.p.video();await c.ctx.close();await v?.saveAs(out+'/'+name+'.webm');}}
}
for(const [name,kind,opt] of [
 ['task-jar-threshold','task',{meter:22}],['classic-jar-threshold','classic',{meter:22}],['page-new','page',{}],['book-new','book',{}],['page-replay','replay-page',{}],['book-replay','replay-book',{}],['daily-ordinary','daily',{}],['daily-bronze','daily-medal',{width:320,height:568,theme:'dark',meter:22}],['book-reduced','book',{reduced:true,width:320,height:568}],['book-immediate-next','book',{}]
])await run(name,kind,opt,async(p,rec)=>{
 await click(p,'#resume');await p.locator('#dialog').waitFor({state:'hidden'});await p.waitForTimeout(300);
 rec.before=await snap(p);await p.evaluate(()=>window.auditAnimations.length=0);
 await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await p.locator('#win').waitFor({state:'visible'});rec.samples.push(await snap(p));
 if(name==='book-immediate-next'){await click(p,'#play-again');await p.waitForTimeout(1000);rec.samples.push(await snap(p));return;}
 for(let i=0;i<28;i++){await p.waitForTimeout(65);rec.samples.push(await snap(p));}
});
await run('navigation','nav',{},async(p,rec)=>{
 const go=async(s,label)=>{await click(p,s);await p.waitForTimeout(55);rec.samples.push({label,...await snap(p)});await p.waitForTimeout(240);};
 await go('#book-mode','Home to notebook');await go('#all-books','notebook to picker');await go('[data-book-range="4"]','range');await go('#book-section-themes','themes');await go('#collection-back','back notebook');await go('#collection-back','back Home');
 await go('#home-jar','Home jar to collection');await go('#trophies-mode','medals');await go('#jars-tab','jars');await go('#collection-back','back Home');
 await go('#calendar-open','calendar');await go('#prev-month','previous month');await go('#next-month','next month');await go('#calendar-picker summary','month selection');await go('#calendar-picker summary','close selection');await go('#collection-back','back Home');
 await go('#settings-open','settings');await go('#dark','theme');await go('#settings-back','back Home');await go('#pause-language','language');await p.keyboard.press('Escape');await go('#classic-mode','classic sheet');await go('#next-classic','difficulty sheet');await p.keyboard.press('Escape');await p.waitForTimeout(300);
});
fs.writeFileSync(out+'/metrics.json',JSON.stringify(result,null,2));console.log(JSON.stringify({cases:result.cases.length,errors:result.errors}));await browser.close();
