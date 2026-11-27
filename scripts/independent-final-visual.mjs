import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out=process.env.SEEDS_VISUAL_OUT || 'test-results/visual-final';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM || undefined,args:['--no-sandbox']});
const result={baseline:process.env.SEEDS_VISUAL_BASELINE || '634583a9a08d8e1a1941c4611a1e0f2d0b77d159',audited:process.env.GITHUB_SHA || 'working-tree',source:process.env.GITHUB_SHA,frames:[],errors:[]};
const base='http://127.0.0.1:5173';
const doneBooks=Array.from({length:8},(_,i)=>'book-v1-'+(i+1));
const doneDaily=Array.from({length:6},(_,i)=>'daily-v1-2026-11-'+String(i+1).padStart(2,'0'));
const session=(board,moves=1)=>({rules:1,current:{board,moves,additions:0,scroll:0},history:[]});
function fixture(kind) {
  const active=kind==='daily'?'daily-v1-2026-11-13':kind==='task'?'book-v1-9':kind==='page'?'book-v1-6':kind==='book'?'book-v1-24':kind==='dead'?'book-v1-25':'classic';
  const reach=Array(45).fill(0);for(const [i,v]of [[0,4],[2,kind==='reachmixed'?4:1],[4,6],[8,6],[9,2],[10,kind==='reachmixed'?6:3],[20,8],[44,4]])reach[i]=v;
  const board=kind.startsWith('reach')?reach:kind==='dead'?[1,2,3,4]:(kind==='normal'||kind==='large')?[4,0,6,7,0,3,0,0,1,5,5,8,0,2,9,0,2,0]:[5,5];
  const done=kind==='book'?Array.from({length:23},(_,i)=>'book-v1-'+(i+1)):kind==='page'?Array.from({length:5},(_,i)=>'book-v1-'+(i+1)):doneBooks;
  const jarMeter=kind==='large'?250000:kind==='daily'?22:3004;
  return {version:3,active,sessions:{[active]:session(board),...(active==='classic'?{'book-v1-9':session([4,0,0,6],1)}:{})},seen:[],done:[...done,...doneDaily],hints:{},jars:{version:2,seeds:jarMeter,meter:jarMeter,wins:7,attempt:'audit',highWater:1},meta:{version:2,since:'2026-11-01',wallet:kind==='large'?12345:0,completed:kind==='large'?123456:21,unassisted:kind==='large'?98765:17,attempts:{[active]:{id:'audit',completed:false}}}};
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
 await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));await page.goto(base);await page.locator('#dialog[data-screen="home"][open]').waitFor({timeout:12000});await page.evaluate(()=>document.fonts.ready);
 return {ctx,page};
}

// Audit actual rendered text at word granularity, clipping ancestors, and independent hit points.
// Distinguish expected content scroll from controls intended to be fixed.
const results=[];
async function shot(p,name,extra={}) {
 await p.waitForTimeout(55);
 const m=await p.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const visible=e=>e.checkVisibility()&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
  const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document.querySelector('.game');
  const controls=[],brokenWords=[],textClips=[],nonTargets=[];
  const clips=e=>{let l=0,t=0,r=innerWidth,b=innerHeight;for(let a=e.parentElement;a;a=a.parentElement){const c=getComputedStyle(a),q=a.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(c.overflowX)){l=Math.max(l,q.left+a.clientLeft);r=Math.min(r,q.left+a.clientLeft+a.clientWidth);}if(/hidden|clip|auto|scroll/.test(c.overflowY)){t=Math.max(t,q.top+a.clientTop);b=Math.min(b,q.top+a.clientTop+a.clientHeight);}}return {l,t,r,b};};
  const relevant=e=>!e.closest('svg, [aria-hidden="true"], .cell, .task, .seed-grains, .jar-grains');
  const rgb=s=>{const a=s.match(/[\d.]+/g)?.map(Number);return a?.length>=3?a:null;};
  const lum=a=>a.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
  for(const e of root.querySelectorAll('button, [role=button],select,input,summary,a[href]')){
   if(!visible(e)||!relevant(e))continue;
   const q=rect(e),c=clips(e),id=e.id||e.getAttribute('data-game')||e.getAttribute('data-volume')||e.className, disabled=e.disabled||e.getAttribute('aria-disabled')==='true';
   const label=(e.getAttribute('aria-label')||e.innerText||e.title||'').trim().slice(0,100);
   const whole=q.x>=c.l-1&&q.right<=c.r+1&&q.y>=c.t-1&&q.bottom<=c.b+1;
   const intersect=q.x<c.r&&q.right>c.l&&q.y<c.b&&q.bottom>c.t;
   let hits=[];if(whole&&!disabled)for(const [x,y] of [[.5,.5],[.18,.18],[.82,.18],[.18,.82],[.82,.82]]){const h=document.elementFromPoint(q.x+q.w*x,q.y+q.h*y);hits.push(Boolean(h&&(e===h||e.contains(h))));}
   const s=getComputedStyle(e);
   controls.push({id,label,disabled,rect:q,whole,intersect,hits,clip:c,scrollAncestors:[...function*(a){while(a){const st=getComputedStyle(a);if(a.scrollHeight>a.clientHeight+2&&/auto|scroll/.test(st.overflowY))yield {id:a.id||a.className,top:a.scrollTop,max:a.scrollHeight-a.clientHeight};a=a.parentElement;}}(e.parentElement)],font:s.fontSize,fg:s.color,bg:s.backgroundColor});
   if(!disabled&&whole&&hits.length&&!hits[0])nonTargets.push({id,label,q,hits});
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const contrast=[];
  for(let n=walker.nextNode();n;n=walker.nextNode()){
   const e=n.parentElement;if(!e||!visible(e)||!relevant(e)||!n.textContent?.trim())continue;
   const text=n.textContent,s=getComputedStyle(e),q=rect(e),owner=e.closest('button,[role=button],summary,h1,h2,h3,p,dd,dt')||e;
   if(!visible(owner))continue;
   const id=owner.id||owner.className||owner.tagName, cr=rect(owner),c=clips(e);
   for(const w of text.matchAll(/[^\s\u200b]{5,}/gu)){
     if(!/[\p{L}]/u.test(w[0]))continue;
     const range=document.createRange();range.setStart(n,w.index);range.setEnd(n,w.index+w[0].length);const rs=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1);
     if(rs.length>1&&new Set(rs.map(r=>Math.round(r.top))).size>1&&!w[0].includes('-'))brokenWords.push({id,word:w[0].slice(0,80),label:owner.textContent.trim().slice(0,100),rect:cr,lines:rs.map(r=>[r.x,r.y,r.width,r.height])});
   }
   const rr=document.createRange();rr.selectNodeContents(n);const rs=[...rr.getClientRects()].filter(r=>r.width>1&&r.height>1);
   // Check own control bounds separately from clipping by scrolling ancestors.
   if(owner.matches('button,[role=button],summary,h1,h2,h3'))for(const r of rs){if(r.left<cr.x-2||r.right>cr.right+2||r.top<cr.y-2||r.bottom>cr.bottom+2)textClips.push({id,text:text.trim().slice(0,100),rect:cr,textRect:[r.x,r.y,r.width,r.height]});}
   let bg=null,unknown=false;
   for(let a=e;a;a=a.parentElement){const cs=getComputedStyle(a),v=rgb(cs.backgroundColor);if(cs.backgroundImage!=='none'){unknown=true;break;}if(v&&(v.length===3||v[3]>=.999)){bg=v;break;}if(v&&v.length>3&&v[3]>0){unknown=true;break;}}
   const fg=rgb(s.color);
   if(!unknown&&bg&&fg&&rs.some(r=>r.x>=c.l&&r.right<=c.r&&r.y>=c.t&&r.bottom<=c.b)){
     const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
     if(ratio<4.5&&!owner.closest(':disabled,[aria-disabled=true]'))contrast.push({id,text:text.trim().slice(0,100),ratio:Number(ratio.toFixed(2)),fg:s.color,bg,font:s.fontSize,weight:s.fontWeight});
   }
  }
  const boxes={};for(const sel of ['#dialog','#collection','#menu-content','#home-notebook','.home-notebook-hit','#resume','#book-quick','#calendar-open','.home-links','#ad-space','#viewport','#win','#result-actions','#play-again','#result-home','#result-reminder','#award','#no-moves-card','#hint-offer','#language-sheet','#classic-new-sheet','#settings-panel','#save-notice','#read-notice','#notebook-dock','#today-task','.calendar','.jar-overview','.jar-history','.month-nav','.dialog-head']){const e=document.querySelector(sel);if(e&&visible(e))boxes[sel]={...rect(e),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY};}
  return {screen:root.dataset.screen||'field',root:root.id,width:innerWidth,height:innerHeight,language:document.documentElement.lang,theme:document.documentElement.dataset.theme,controls,boxes,brokenWords,textClips,nonTargets,contrast,focus:document.activeElement?.id||document.activeElement?.className,docScroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}};
 });
 await p.screenshot({path:out+'/'+name+'.png',animations:'disabled'});results.push({name,...extra,...m});
}
async function click(p,s){await p.locator(s).first().click({timeout:4500});}
async function capture(prefix,w,h,dark,lang,kind,fn,meter){let c;try{c=await start(w,h,dark,lang,kind,meter);await fn(c.page,(name,extra)=>shot(c.page,prefix+'-'+name,extra));}catch(e){result.errors.push({prefix,kind,error:String(e)});if(c)await shot(c.page,prefix+'-error').catch(()=>{});}finally{if(c)await c.ctx.close();}}
async function nav(p,save){
 await save('home');
 await click(p,'#book-mode');await save('notebook');await click(p,'#all-books');await save('catalog');await click(p,'[data-book-range="4"]');await save('catalog-end');await click(p,'#book-section-themes');await save('themes');
 await click(p,'#collection-back');await click(p,'#collection-back');
 await click(p,'#progress-open');await save('progress');await click(p,'#progress-jar');await save('jars');await click(p,'#trophies-mode');await save('medals');await click(p,'#collection-back');await click(p,'#collection-back');
 await click(p,'#calendar-open');await save('calendar');await click(p,'#calendar-picker summary');await save('month-picker');await click(p,'#calendar-picker summary');await click(p,'#calendar-extras summary');await save('calendar-extras');await click(p,'#collection-back');
 await click(p,'#settings-open');await save('settings');await click(p,'#privacy-open');await save('privacy');await click(p,'#privacy-back');await click(p,'#settings-back');
 await click(p,'#pause-language');await save('language');await p.keyboard.press('Escape');
 await click(p,'#classic-mode');await save('classic-entry');if(await p.locator('#next-classic').isVisible())await click(p,'#next-classic');await save('difficulty');await click(p,'[data-classic-level="2"]');await save('confirm');
}
const configs=[];
for(const lang of ['ru','en','es','tr','pt-BR'])for(const dark of [false,true])configs.push([320,520,dark,lang]);
configs.push([360,640,false,'es'],[390,844,true,'en'],[568,320,false,'ru'],[844,390,true,'pt-BR'],[800,1280,false,'ru']);
for(const [w,h,dark,lang] of configs){
 const prefix=w+'x'+h+'-'+(dark?'dark':'light')+'-'+lang;
 await capture(prefix,w,h,dark,lang,'large',nav);
 for(const kind of ['classic','task','page','book','daily','dead']){
  await capture(prefix+'-'+kind,w,h,dark,lang,kind,async(p,save)=>{
   await click(p,'#resume');await p.locator('#dialog').waitFor({state:'hidden',timeout:6000});await save('field');
   if(kind==='dead')return;
   await click(p,'[data-index="0"]');await click(p,'[data-index="1"]');await p.locator('#win').waitFor({state:'visible',timeout:8000});await p.waitForTimeout(280);await save('result');
  });
 }
}
for(const [lang,dark]of [['ru',false],['es',true],['pt-BR',false]]){
 const prefix='320x568-enlarged-'+lang+(dark?'-dark':'-light');
 await capture(prefix,320,568,dark,lang,'normal',async(p,save)=>{
  await p.evaluate(()=>{document.documentElement.style.fontSize='32px';});
  await save('home');await click(p,'#book-mode');await save('notebook');await click(p,'#all-books');await save('catalog');await click(p,'#collection-back');await click(p,'#collection-back');await click(p,'#calendar-open');await save('calendar');await click(p,'#collection-back');await click(p,'#settings-open');await save('settings');await click(p,'#settings-back');await click(p,'#pause-language');await save('language');
 });
}
for(const kind of ['reachmixed','reachred','normal'])await capture('320x520-'+kind,320,520,true,'ru',kind,async(p,save)=>{
 await click(p,'#resume');await p.locator('#dialog').waitFor({state:'hidden'});await click(p,kind==='normal'?'#hint':'[data-index="0"]');await save('highlight');
});
await capture('320x520-hint-empty',320,520,false,'ru','normal',async(p,save)=>{
 await p.evaluate(()=>{let a=JSON.parse(localStorage.getItem('seeds-bits.progress.v2'));a.meta.attempts.classic.hintKeys=['used1','used2','used3'];localStorage.setItem('seeds-bits.progress.v2',JSON.stringify(a));});await p.reload();await p.locator('#dialog[open]').waitFor();await click(p,'#resume');await click(p,'#hint');await p.locator('#hint-offer').waitFor({state:'visible'});await save('rewarded-offer');
});
fs.writeFileSync(out+'/metrics.json',JSON.stringify({source:process.env.GITHUB_SHA,baseline:'e592866145b0c2f537f01d21fb62a0e9e471d5e4',frames:results,errors:result.errors},null,2));console.log('captured',results.length,'errors',JSON.stringify(result.errors));
await browser.close();
