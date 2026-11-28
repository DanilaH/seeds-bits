import {test,expect} from 'vitest';
import fs from 'node:fs';
import * as core from '../src/core';
import {createSolver} from '../src/solver';
import {notebook,loadNotebook,notebookForTask,dailyForTask,trophy,availableDay,nextTask,puzzleSession} from '../src/puzzles';
import {loadBookV5} from '../src/content-v5';
import {bookRevisionFor,dailyIdFor} from '../src/content-ids';
import {fresh,metadata,serializeProgress,readProgress,startAttempt,recordCompletion,helpProfile} from '../src/progress';
import {collectPair,jars,jarCapacity,jarState,taskSeeds} from '../src/jars';
import {hintKey,spendHint,hintsLeft,grantReward} from '../src/hint-budget';
import {dailyRun} from '../src/daily-run';
import {generateClassic,newClassicRun,readClassicRun,CLASSIC_START_COUNTS,CLASSIC_LEVELS} from '../src/classic-generator';
import {notebookTarget,recordNotebookPlay} from '../src/notebook-navigation';

const out='test-results/functional-audit';
fs.mkdirSync(out,{recursive:true});
const results:any={source:process.env.GITHUB_SHA,baseline:'e592866145b0c2f537f01d21fb62a0e9e471d5e4',checks:{},findings:[]};
function save(){fs.writeFileSync(out+'/model.json',JSON.stringify(results,null,2));}
function check(name:string, f:()=>any){try{const x=f();results.checks[name]={status:'PASS',...x};}catch(e){results.checks[name]={status:'FAIL',error:String(e)};}finally{save();}}
function eq(a:any,b:any,msg:string){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(msg+' '+JSON.stringify({a,b}).slice(0,1000));}
let seed=0x5eed1108;
function rand(n:number){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
type B=readonly number[];
function oracle(b:B,a:number,c:number,w=9){
 if(a===c||!b[a]||!b[c]||(b[a]!==b[c]&&b[a]+b[c]!==10))return false;
 let lo=Math.min(a,c),hi=Math.max(a,c);
 if(b.slice(lo+1,hi).every(x=>x===0))return true;
 const y1=Math.floor(a/w),x1=a%w,y2=Math.floor(c/w),x2=c%w,dy=y2-y1,dx=x2-x1;
 if(dy!==0&&dx!==0&&Math.abs(dy)!==Math.abs(dx))return false;
 const n=Math.max(Math.abs(dy),Math.abs(dx));
 for(let j=1;j<n;j++)if(b[(y1+Math.sign(dy)*j)*w+x1+Math.sign(dx)*j])return false;
 return true;
}
function opairs(b:B,w=9){const p:[number,number][]=[];for(let a=0;a<b.length;a++)for(let c=a+1;c<b.length;c++)if(oracle(b,a,c,w))p.push([a,c]);return p;}
function oremove(b:B,a:number,c:number,w=9){const v=Array.from(b);v[a]=v[c]=0;const result:number[]=[];for(let i=0;i<v.length;i+=w){const row=v.slice(i,i+w);if(row.some(Boolean))result.push(...row);}return result;}
function verifyPuzzle(p:any){if(!p||!p.board.some(Boolean))throw Error('empty/missing puzzle '+p?.id);let b=p.board.slice(),steps=0;for(const m of p.solution){if(!oracle(b,m.a,m.b))throw Error('illegal independent witness '+p.id+' '+steps);b=oremove(b,m.a,m.b);steps++;}if(b.length)throw Error('not cleared '+p.id);return steps;}
test('independent functional model audit',async()=>{
 check('rules_and_compression',()=>{
  let boards=0,queries=0,removals=0;
  const one=(b:number[],w:number)=>{
   const exp=opairs(b,w),actual=core.pairs(b,w).map(p=>[p.a,p.b]);
   eq(actual,exp,'pair enumeration '+b.join(''));
   for(let a=0;a<b.length;a++)for(let c=a+1;c<b.length;c++){
    const yes=oracle(b,a,c,w);if(core.checkPair(b,a,c,w).ok!==yes||core.checkPair(b,c,a,w).ok!==yes)throw Error('pair mismatch');
    queries+=2;
   }
   for(const [a,c] of exp){eq(core.removePair(b,a,c,w),oremove(b,a,c,w),'compression');removals++;}
   boards++;
  };
  for(let code=0;code<3**10;code++){let n=code;const b=Array.from({length:10},()=>{const v=[0,1,9][n%3];n=Math.floor(n/3);return v;});one(b,9);}
  for(let i=0;i<1500;i++)one(Array.from({length:1+rand(72)},()=>rand(10)),9);
  return {boards,queries,removals};
 });
 await loadNotebook();for(const n of [1,601,1201,1801])await loadBookV5('book-v1-'+n);
 check('all_pinned_and_current_notebooks',()=>{
  let count=0,steps=0;const byRevision:any={};
  for(const revision of [1,4,5])for(let n=1;n<=2400;n++){if(n===1&&revision!==1)continue;const id='book-v1-'+n;const p=notebookForTask(id,{done:[],sessions:{},bookRevisions:{[id]:revision}} as any);steps+=verifyPuzzle(p);count++;byRevision[revision]=(byRevision[revision]??0)+1;}
  for(const p of notebook.slice(2400)){steps+=verifyPuzzle(p);count++;byRevision.themes=(byRevision.themes??0)+1;}
  for(let n=1;n<=2400;n++){const id='book-v1-'+n,state={done:[],sessions:{}};if(bookRevisionFor(id,state)===6){steps+=verifyPuzzle(notebookForTask(id,state));count++;byRevision[6]=(byRevision[6]??0)+1;}}
  return {count,steps,byRevision};
 });
 check('daily_witnesses_and_calendar',()=>{
  let count=0,steps=0;const byRevision:any={};const d0=new Date('2025-01-01T12:00:00Z');
  const d=(i:number)=>new Date(d0.getTime()+i*86400000).toISOString().slice(0,10);
  const add=(id:string)=>{steps+=verifyPuzzle(dailyForTask(id));count++;const r=id.slice(0,8);byRevision[r]=(byRevision[r]??0)+1;};
  for(let i=0;i<730;i++)add('daily-v1-'+d(i));
  for(let i=1;i<=24;i++)add('daily-v3-2026-12-'+String(i).padStart(2,'0'));
  for(let i=0;i<365;i++){const day=new Date(Date.parse('2026-12-25T12:00:00Z')+i*86400000).toISOString().slice(0,10);add('daily-v4-'+day);add('daily-v5-'+day);}
  for(let i=0;i<24;i++){const day=new Date(Date.parse('2027-12-25T12:00:00Z')+i*17*86400000).toISOString().slice(0,10);add('daily-v4-'+day);add('daily-v5-'+day);}
  eq(availableDay('2028-02-29','2028-02-29'),true,'leap');eq(availableDay('2027-02-29','2028-02-29'),false,'invalid');eq(availableDay('2028-03-01','2028-02-29'),false,'future');
  const done=Array.from({length:29},(_,i)=>'daily-v5-2028-02-'+String(i+1).padStart(2,'0'));
  eq([6,7,13,14,28,29].map(n=>trophy('2028-02',done.slice(0,n)).tier),[0,1,1,2,2,3],'medals');
  return {count,steps,byRevision};
 });
 check('classic_generation',()=>{
  let deals=0,steps=0,adds=0,fallbacks=0;const distribution:any={};const state=newClassicRun(812739);
  for(let i=0;i<12;i++)for(const level of CLASSIC_LEVELS){const old=state.recent.slice();const p=generateClassic(state,level);if(!CLASSIC_START_COUNTS[level].includes(core.occupied(p.board) as never)||old.includes(p.board.join('')))throw Error('classic generation count/repeat');
   let b=p.board.slice();for(const step of p.proof){if(step===null){if(opairs(b).length||!b.some(Boolean))throw Error('invalid Classic Add');b=[...b,...b.filter(Boolean)];adds++;}else{if(!oracle(b,...step))throw Error('bad Classic pair');b=oremove(b,...step);}steps++;}if(b.length)throw Error('Classic proof incomplete');
   state.recent=[...state.recent,p.board.join('')].slice(-8);state.difficulty=level;state.current={attempt:'audit-'+deals,board:p.board.slice()};if(!readClassicRun(JSON.parse(JSON.stringify(state))))throw Error('classic reload');deals++;fallbacks+=Number(p.fallback);const k=level+':'+core.occupied(p.board);distribution[k]=(distribution[k]??0)+1;}
  return {deals,steps,adds,fallbacks,distribution};
 });
 check('solver_small_exact',()=>{
  let count=0,win=0,dead=0,unknown=0;
  const memo=new Map<string,boolean>();
  const can=(b:B):boolean=>{if(!b.some(Boolean))return true;const k=b.join('');const prev=memo.get(k);if(prev!==undefined)return prev;const v=opairs(b).some(([a,c])=>can(oremove(b,a,c)));memo.set(k,v);return v;};
  for(let i=0;i<1000;i++){const b=Array.from({length:2+rand(16)},()=>rand(10));if(!b.some(Boolean))continue;const exp=can(b),v=createSolver(100000)(b);
   if(v.kind==='unknown'){unknown++;continue;}if((v.kind==='move')!==exp)throw Error('solver disagrees '+b.join(''));if(v.kind==='move'){if(!oracle(b,v.pair.a,v.pair.b)||!can(oremove(b,v.pair.a,v.pair.b)))throw Error('false winning hint');win++;}else dead++;count++;}
  return {count,win,dead,unknown};
 });
 check('state_roundtrip_and_undo',()=>{
  let actions=0,pairs=0,adds=0,undos=0,roundtrips=0;
  for(let i=0;i<60;i++){let p=fresh(),s=p.sessions.classic;s.current.board=Array.from({length:18+rand(42)},()=>1+rand(9));metadata(p);startAttempt(p,'classic');
   for(let j=0;j<60;j++){const opts=opairs(s.current.board);if(s.history.length&&rand(5)===0){s=core.undo(s);undos++;}else if(opts.length){const [a,c]=opts[rand(opts.length)];s=core.commit(s,oremove(s.current.board,a,c),'pair',rand(1000));collectPair(p,s.current.moves);pairs++;}else if(s.current.board.some(Boolean)&&s.current.board.length+core.occupied(s.current.board)<=240){const next=[...s.current.board,...s.current.board.filter(Boolean)];eq(core.addNumbers(s.current.board),next,'Add');s=core.commit(s,next,'add',rand(1000));adds++;}else break;actions++;p.sessions.classic=s;
   if(j%4===0){const q=readProgress(serializeProgress(p));expect(q.sessions.classic).toEqual(s);eq(jars(q),jars(p),'jar reload');p=q;s=q.sessions.classic;roundtrips++;}}
  }return {actions,pairs,adds,undos,roundtrips};
 });
 check('rewards_pins_and_streaks',()=>{
  let p=fresh();metadata(p);const id='classic';startAttempt(p,id);eq([1,2,1,2,3].map(n=>collectPair(p,n)),[2,2,0,0,2],'classic farming');eq(jars(p).meter,6,'classic seeds');
  for(let i=0;i<3;i++)eq(spendHint(p,'key'+i),true,'free hint');eq(hintsLeft(p),0,'hint limit');
  const receipt={token:'audit-receipt',attempt:metadata(p).attempts.classic.id};grantReward(p,receipt);p=readProgress(serializeProgress(p));grantReward(p,receipt);eq(metadata(p).wallet,3,'receipt duplicate');
  eq(spendHint(p,'key0'),true,'same hint');eq(metadata(p).wallet,3,'same hint free');spendHint(p,'new');eq(metadata(p).wallet,2,'wallet charge');
  const base={done:[],sessions:{}};eq(dailyIdFor('2026-12-01',base),'daily-v3-2026-12-01','pilot date');eq(dailyIdFor('2026-12-25',base),'daily-v5-2026-12-25','current date');eq(dailyIdFor('2026-12-25',{...base,done:['daily-v1-2026-12-25']}),'daily-v1-2026-12-25','old date');
  let rewards=0,bookWins=0;for(const b of notebook){const game=notebookForTask(b.id,p);if(!game)throw Error('missing '+b.id);p.active=b.id;const v=bookRevisionFor(b.id,p);if(b.id.startsWith('book-v1-'))(p.bookRevisions??={})[b.id]=v;const s=puzzleSession(game);s.history=[s.current];s.current={board:[],moves:game.solution.length,scroll:0,additions:0};p.sessions[b.id]=s;startAttempt(p,b.id);
   const x=recordCompletion(p,b.id);eq(x.seeds,taskSeeds(core.occupied(game.board)/2),'book reward');rewards+=x.seeds;bookWins++;eq(recordCompletion(p,b.id).seeds,0,'same win');startAttempt(p,b.id);eq(recordCompletion(p,b.id).seeds,0,'replay reward');}
  eq(p.done.length,2496,'book unique');eq(jars(p).meter,rewards+6,'meter total');
  p=readProgress(serializeProgress(p));eq(p.done.length,2496,'full save');eq(notebookTarget(p),undefined,'all completed');
  let streak=fresh();metadata(streak);let streakRewards=0;for(let i=1;i<=28;i++){const day='2027-02-'+String(i).padStart(2,'0'),id='daily-v5-'+day;streak.sessions[id]={rules:1,current:{board:[],moves:1,scroll:0,additions:0},history:[{board:[5,5],moves:0,scroll:0,additions:0}]};startAttempt(streak,id);const x=recordCompletion(streak,id,day);streakRewards+=x.hints;eq(recordCompletion(streak,id,day).hints,0,'daily duplicate');streak=readProgress(serializeProgress(streak));}
  eq(streakRewards,13,'streak credits');eq(dailyRun(streak,'2027-02-28').count,28,'streak');eq(dailyRun(streak,'2027-03-02').count,0,'missed day');eq(trophy('2027-02',streak.done).tier,3,'gold');
  return {bookWins,rewards,streakRewards,wallet:metadata(p).wallet,fullSaveBytes:serializeProgress(p).length};
 });
 const p=fresh();metadata(p).wallet=9;helpProfile(p).inventory={magnet:2,plan:3};metadata(p).rewardReceipts=['earned-before-corruption'];const raw=JSON.parse(serializeProgress(p));raw.meta.unassisted=1;let recoveries=0;const q=readProgress(JSON.stringify(raw),()=>recoveries++);results.findings.push({id:'FA-02',scenario:'independent statistics field invalid; wallet, receipts and paused stock valid before read',before:{wallet:9,stock:raw.meta.help.inventory,receipts:raw.meta.rewardReceipts},after:{wallet:metadata(q).wallet,stock:helpProfile(q).inventory,receipts:metadata(q).rewardReceipts??[]},recoveries});save();
 expect(Object.values(results.checks).filter((v:any)=>v.status==='FAIL')).toEqual([]);
},480000);
