import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out=process.env.SEEDS_VISUAL_OUT || 'test-results/quiet-polish';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM || undefined,args:['--no-sandbox']});
const result={baseline:'634583a9a08d8e1a1941c4611a1e0f2d0b77d159',audited:process.env.GITHUB_SHA || 'working-tree',source:process.env.GITHUB_SHA,frames:[],errors:[]};
const base='http://127.0.0.1:5173';
const doneBooks=Array.from({length:8},(_,i)=>'book-v1-'+(i+1));
const doneDaily=Array.from({length:6},(_,i)=>'daily-v1-2026-11-'+String(i+1).padStart(2,'0'));
const session=(board,moves=1)=>({rules:1,current:{board,moves,additions:0,scroll:0},history:[]});
function fixture(kind) {
  const active=kind==='daily'?'daily-v1-2026-11-13':kind==='task'?'book-v1-9':kind==='page'?'book-v1-6':kind==='book'?'book-v1-24':kind==='dead'?'book-v1-25':'classic';
  const reach=Array(45).fill(0);for(const [i,v]of [[0,4],[2,kind==='reachmixed'?4:1],[4,6],[8,6],[9,2],[10,kind==='reachmixed'?6:3],[20,8],[44,4]])reach[i]=v;
  const board=kind.startsWith('reach')?reach:kind==='dead'?[1,2,3,4]:kind==='normal'?[4,0,6,7,0,3,0,0,1,5,5,8,0,2,9,0,2,0]:[5,5];
  const done=kind==='book'?Array.from({length:23},(_,i)=>'book-v1-'+(i+1)):kind==='page'?Array.from({length:5},(_,i)=>'book-v1-'+(i+1)):doneBooks;
  const jarMeter=3004;
  return {version:3,active,sessions:{[active]:session(board),...(active==='classic'?{'book-v1-9':session([4,0,0,6],1)}:{})},seen:[],done:[...done,...doneDaily],hints:{},jars:{version:2,seeds:jarMeter,meter:jarMeter,wins:7,attempt:'audit',highWater:1},meta:{version:2,since:'2026-11-01',wallet:0,completed:21,unassisted:17,attempts:{[active]:{id:'audit',completed:false}}}};
}
async function start(w,h,dark,lang,kind,jarMeter) {
 const ctx=await browser.newContext({viewport:{width:w,height:h},reducedMotion:'reduce',locale:lang==='ru'?'ru-RU':lang});
 const page=await ctx.newPage();
 page.on('pageerror',err=>result.errors.push({kind,phase:'pageerror',error:String(err)}));
 await page.addInitScript(({dark,lang,save,jarMeter})=>{
  if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:lang,theme:dark?'dark':'light',sound:false,vibration:false}));
  if(save&&!localStorage.getItem('seeds-bits.progress.v2')){if(jarMeter!==undefined){save.jars.meter=save.jars.seeds=jarMeter;}localStorage.setItem('seeds-bits.progress.v2',JSON.stringify(save));}
  window.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:{state:'ready'}}),addListener:async()=>({remove:async()=>{}}),readiness:async()=>({state:'ready'}),preload:async()=>{},banner:async()=>{},report:async()=>({accepted:true}),pending:async()=>({}),show:async()=>({status:'unavailable'})};
 },{dark,lang,save:kind==='fresh'?null:fixture(kind),jarMeter});
 await page.goto(base);await page.locator('#dialog[data-screen="home"][open]').waitFor({timeout:12000});await page.evaluate(()=>document.fonts.ready);
 return {ctx,page};
}
async function shot(page,name) {
 await page.waitForTimeout(130);
 const m=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
   const visible=e=>e.checkVisibility()&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
   const selects=['#dialog','#dialog .dialog-head','#collection','#menu-content','#home-notebook','#resume','.mode-nav','#book-quick','#calendar-open','.home-links','#ad-space','#viewport','#win','#result-actions','#play-again','#result-home','.jar-overview','.jar-overview .progress-hero','.jar-history','.jar-shelf','#jar-play','#progress-trophies','#today-task','#notebook-dock','#award','#no-moves-card'];
   const boxes={}; for(const sel of selects){let e=document.querySelector(sel);if(e&&visible(e)){let cs=getComputedStyle(e);boxes[sel]={...rect(e),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,bg:cs.backgroundColor,fg:cs.color,display:cs.display,overflow:cs.overflowY};}}
   const activeDialog=[...document.querySelectorAll('dialog[open]')].at(-1);
   const root=activeDialog||document.querySelector('.game');
   const failures=[],hiddenButtons=[],small=[],overlaps=[],buttons=[];
   for(const e of root.querySelectorAll('button,select,input,summary')){
      if(!visible(e))continue;
      const r=e.getBoundingClientRect(), label=(e.innerText||e.getAttribute('aria-label')||e.id||e.tagName).trim().slice(0,90);
      const b={id:e.id||e.getAttribute('data-game')||e.getAttribute('data-volume')||e.className,label,...rect(e)};
      if(!e.matches('.cell,.task')){buttons.push(b);if(!e.disabled && (r.width<44 || r.height<44))small.push(b);}
      const topmost=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)));
      if(r.bottom>innerHeight||r.top<0)hiddenButtons.push(b);
      else if(!e.disabled && topmost&&!e.contains(topmost)&&!topmost.contains(e))overlaps.push({...b,hit:topmost.id||topmost.className});
      let walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
      for(let n=walker.nextNode();n;n=walker.nextNode()){
        if(!n.textContent?.trim()||!n.parentElement?.checkVisibility())continue;
        let range=document.createRange();range.selectNodeContents(n);
        for(let t of range.getClientRects())if(t.left<r.left-1.5||t.right>r.right+1.5||t.top<r.top-1.5||t.bottom>r.bottom+1.5)failures.push({label,word:n.textContent.trim(),id:b.id,box:rect(e),text:{left:t.left,right:t.right,top:t.top,bottom:t.bottom}});
      }
   }
   const topPixels=[0,1,5,10,20,30,44].map(y=>{const e=document.elementFromPoint(innerWidth/2,y);return {y,tag:e?.tagName,id:e?.id,bg:e?getComputedStyle(e).backgroundColor:null};});
   return {width:innerWidth,height:innerHeight,screen:activeDialog?.dataset.screen||'game',theme:document.documentElement.dataset.theme,boxes,buttons,small,overlaps,hiddenButtons,failures,topPixels,bodyBg:getComputedStyle(document.body).backgroundColor};
 });
 await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
 result.frames.push({name,...m});
}
async function click(p,s){await p.locator(s).first().click({timeout:4500});}
async function capture(prefix,w,h,dark,lang,kind,fn,meter){
 let c;
 try{c=await start(w,h,dark,lang,kind,meter);await fn(c.page,(name)=>shot(c.page,prefix+'-'+name));}
 catch(e){result.errors.push({prefix,kind,error:String(e)});if(c)await shot(c.page,prefix+'-error').catch(()=>{});}
 finally{if(c)await c.ctx.close();}
}
async function nav(p,save){
 await save('home');await click(p,'#book-mode');await save('notebook');await click(p,'#all-books');await save('catalog');
 await click(p,'[data-book-range="4"]');await save('catalog-81-100');
 await click(p,'#book-section-themes');await save('themes');
 await click(p,'#collection-back');await click(p,'#collection-back');
 await click(p,'#progress-open');await save('progress');await click(p,'#progress-trophies');await save('jars');
 await p.locator('#collection').evaluate(e=>{const x=e.closest('dialog'); if(x)x.scrollTop=x.scrollHeight;});
 await p.locator('#jar-play').scrollIntoViewIfNeeded().catch(()=>{});await save('jars-bottom');
 await click(p,'#trophies-mode');await save('medals');
 await click(p,'#collection-back');await click(p,'#collection-back');
 await click(p,'#calendar-open');await save('calendar');await click(p,'#calendar-picker summary');await save('calendar-picker');await click(p,'#calendar-picker summary');await click(p,'#calendar-extras summary');await save('calendar-extras');
 await click(p,'#collection-back');await click(p,'#settings-open');await save('settings');await click(p,'#privacy-open');await save('privacy');await click(p,'#privacy-back');await click(p,'#settings-back');
 await click(p,'#pause-language');await save('language');await p.keyboard.press('Escape');
 await click(p,'#classic-mode');await save('classic-entry');if(await p.locator('#next-classic').isVisible())await click(p,'#next-classic');await save('difficulty');await click(p,'[data-classic-level="2"]');await save('confirm-replace');
}
for(const [w,h,dark,lang] of [[390,844,false,'ru'],[320,568,false,'ru'],[390,844,true,'ru'],[320,568,true,'pt-BR']]){
 const prefix=w+'-'+(dark?'dark':'light')+'-'+lang;
 await capture(prefix,w,h,dark,lang,'normal',nav);
 for(const kind of ['classic','task','page','book','daily','dead']){
  await capture(prefix+'-'+kind,w,h,dark,lang,kind,async(p,save)=>{
   await click(p,'#resume');await p.locator('#dialog').waitFor({state:'hidden',timeout:6000});await save('field');
   if(kind==='dead')return;
   await click(p,'[data-index="0"]');await save('selected');
   await click(p,'[data-index="1"]');await p.locator('#win').waitFor({state:'visible',timeout:8000});
   await p.waitForTimeout(400);await save('result');
  });
 }
}
await capture('390-empty-jars',390,844,false,'ru','normal',async(p,save)=>{await click(p,'#progress-open');await click(p,'#progress-trophies');await save('jars');},0);
await capture('320-empty-jars',320,568,false,'ru','normal',async(p,save)=>{await click(p,'#progress-open');await click(p,'#progress-trophies');await save('jars');},0);
await capture('320-hint',320,568,true,'ru','normal',async(p,save)=>{await click(p,'#resume');await click(p,'#hint');await save('hint');});
await capture('320-learn',320,568,false,'ru','normal',async(p,save)=>{await click(p,'#learn');await save('lesson');});
await capture('320-fresh',320,568,false,'ru','fresh',async(p,save)=>{await save('home');});
for(const [w,h,dark]of [[320,568,false],[390,844,true]])for(const kind of ['reachmixed','reachred'])await capture(w+'-'+(dark?'dark':'light')+'-'+kind,w,h,dark,'ru',kind,async(p,save)=>{await click(p,'#resume');await click(p,'[data-index="0"]');await save('selected');});
fs.writeFileSync(out+'/metrics.json',JSON.stringify(result,null,2));console.log('Captured',result.frames.length,'frames; route errors',result.errors);
await browser.close();
if(result.errors.length || result.frames.some(f=>f.failures.length)) process.exitCode=1;
