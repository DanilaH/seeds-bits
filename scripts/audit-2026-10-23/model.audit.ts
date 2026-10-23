import {test,expect,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {checkPair,pairs,removePair,commit,undo,addNumbers,newSession,occupied} from '../../src/core';
import {notebook,loadNotebook,daily,availableDay,puzzleSession,today,days} from '../../src/puzzles';
import {fresh,metadata,readProgress,serializeProgress,startAttempt} from '../../src/progress';
import {collectPair,jars,jarState,jarCapacity} from '../../src/jars';
import {hintAttempt,grantReward,spendHint,hintsLeft} from '../../src/hint-budget';
const out='test-results/audit-2026-10-23';mkdirSync(out,{recursive:true});
function report(name:string,value:any){writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2));}
let seed=0x23c0ffee;function rnd(n:number){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;}
function legal(b:number[],a:number,c:number,w:number){
 if(a===c||!b[a]||!b[c]||!(b[a]===b[c]||b[a]+b[c]===10))return false;
 const ar=Math.floor(a/w),ac=a%w,br=Math.floor(c/w),bc=c%w;
 const dr=br-ar,dc=bc-ac;
 if(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)){
  const dy=Math.sign(dr),dx=Math.sign(dc);let r=ar+dy,k=ac+dx,clear=true;
  while(r!==br||k!==bc){if(b[r*w+k]){clear=false;break;}r+=dy;k+=dx;}
  if(clear)return true;
 }
 for(let i=Math.min(a,c)+1;i<Math.max(a,c);i++)if(b[i])return false;
 return true;
}
test('A01 independent geometric oracle agrees with legal pairs on 5000 random fields',()=>{
 let comparisons=0;
 for(let n=0;n<5000;n++){
  const w=[3,5,9][rnd(3)],b=Array.from({length:1+rnd(54)},()=>rnd(10));
  const actual=new Set(pairs(b,w).map(p=>`${p.a}:${p.b}`));
  for(let a=0;a<b.length;a++)for(let c=a+1;c<b.length;c++){
   const ok=legal(b,a,c,w);comparisons++;
   if(checkPair(b,a,c,w).ok!==ok||actual.has(`${a}:${c}`)!==ok)throw Error(JSON.stringify({w,b,a,c,ok}));
   if(checkPair(b,c,a,w).ok!==ok)throw Error('asymmetric legality');
   if(ok){const copy=[...b];copy[a]=copy[c]=0;const expected=[];
    for(let row=0;row<copy.length;row+=w){const part=copy.slice(row,row+w);if(part.some(Boolean))expected.push(...part);}
    if(JSON.stringify(removePair(b,a,c,w))!==JSON.stringify(expected))throw Error('row collapse differs');
   }
  }
 }
 report('A01-rules',{fields:5000,comparisons,seed:'23c0ffee',passed:true});
});
test('A02 every notebook solution reaches an empty board and catalog ids are unique',async()=>{
 await loadNotebook();const ids=new Set(),boards=new Set();let steps=0,maxCells=0,maxDigits=0;const start=performance.now();
 for(const p of notebook){if(ids.has(p.id))throw Error('duplicate id '+p.id);ids.add(p.id);boards.add(p.board.join(''));
  maxCells=Math.max(maxCells,p.board.length);maxDigits=Math.max(maxDigits,occupied(p.board));let b=[...p.board];
  for(const pair of p.solution){if(!legal(b,pair.a,pair.b,9))throw Error('invalid solution '+p.id);b=removePair(b,pair.a,pair.b);steps++;}
  if(occupied(b))throw Error('incomplete '+p.id);
 }
 report('A02-catalog',{tasks:ids.size,uniqueBoards:boards.size,steps,maxCells,maxDigits,elapsedMs:performance.now()-start});expect(ids.size).toBe(2400);
});
test('A03 2000 daily tasks including distant dates and century leap boundaries are deterministic and solvable',()=>{
 const samples=new Set(['2025-01-01','2028-02-29','2028-06-20','2100-02-28','2100-03-01','2200-03-01','2228-06-20']);
 for(let i=0;i<2000;i++)samples.add(today(new Date(2025+Math.floor(i/12),i%12,1+i%27)));
 let steps=0;for(const day of samples){const p=daily(day);expect(daily(day)).toEqual(p);let b=[...p.board];for(const pair of p.solution){if(!legal(b,pair.a,pair.b,9))throw Error(day);b=removePair(b,pair.a,pair.b);steps++;}if(occupied(b))throw Error('unsolved '+day);}
 for(const day of ['2028-02-29','2228-06-20'])expect(availableDay(day,'2228-12-31')).toBe(true);
 const invalidDates=Object.fromEntries(['2024-12-31','2100-02-29','2200-02-29','2026-13-01','2026-00-01','2026-02-30'].map(day=>[day,availableDay(day,'2228-12-31')]));
 report('A03-daily',{dates:samples.size,steps,generatedTasksSolvable:true,invalidDates});
 for(const [day,valid] of Object.entries(invalidDates))expect(valid,day).toBe(false);
 expect(days('2100-02')).toHaveLength(28);
});
test('A04 200 random 100-action histories survive compact serialization, undo and rewards',()=>{
 let actions=0,roundTrips=0;
 for(let n=0;n<200;n++){
  let p=fresh();metadata(p);let s=newSession();p.sessions.classic=s;
  for(let i=0;i<100;i++){
   const ps=pairs(s.current.board),choice=rnd(5);
   if(choice===0&&s.history.length)s=undo(s);
   else if(ps.length){const pair=ps[rnd(ps.length)];s=commit(s,removePair(s.current.board,pair.a,pair.b),'pair',rnd(2000));collectPair(p,s.current.moves);}
   else if(occupied(s.current.board)){try{s=commit(s,addNumbers(s.current.board),'add',rnd(2000));}catch{break;}}
   else{startAttempt(p,'classic');s=newSession();}
   p.sessions.classic=s;actions++;
   if(i%7===0){const a=hintAttempt(p),token='r-'+n+'-'+i;grantReward(p,{token,attempt:a.id});const bonus=a.hintBonus;grantReward(p,{token,attempt:a.id});expect(a.hintBonus).toBe(bonus);spendHint(a,'key-'+i);}
   if(i%10===0){const raw=serializeProgress(p),q=readProgress(raw);expect(q).toEqual(p);expect(hintsLeft(hintAttempt(q))).toBe(hintsLeft(hintAttempt(p)));p=q;s=q.sessions.classic;roundTrips++;}
  }
 }
 report('A04-state-fuzz',{traces:200,actions,roundTrips,passed:true});
});
test('A05 corrupt optional metadata and packed history retain the valid current board',()=>{
 const p=fresh();p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,0,9),'pair',77);metadata(p);
 const raw=JSON.parse(serializeProgress(p));let recoveries=0,cases=0;
 for(const damaged of [null,{},'bad',[[1,2,3,[[99999,12]]]],[[1,2,3,['xyz']]],[[0,0,0,[[0,-1]]]]]){
  const x=structuredClone(raw);x.sessions.classic.packedHistory=damaged;const q=readProgress(JSON.stringify(x),()=>recoveries++);expect(q.sessions.classic.current).toEqual(p.sessions.classic.current);cases++;
 }
 for(const damaged of [null,{},'bad',[],{version:1,since:'notdate'}]){
  const x=structuredClone(raw);x.meta=damaged;const q=readProgress(JSON.stringify(x),()=>recoveries++);expect(q.sessions.classic.current).toEqual(p.sessions.classic.current);cases++;
 }
 report('A05-damaged-save',{cases,recoveries,passed:true});
});
test('A06 jar thresholds remain continuous across 1000 milestones and huge progress',()=>{
 let total=0;for(let i=0;i<1000;i++){
  const capacity=jarCapacity(i);expect(jarState(total).index).toBe(i);expect(jarState(total).filled).toBe(0);expect(jarState(total+capacity-1).index).toBe(i);total+=capacity;
 }
 const state=jarState(Number.MAX_SAFE_INTEGER);expect(Number.isFinite(state.index)).toBe(true);expect(state.filled).toBeGreaterThanOrEqual(0);expect(state.filled).toBeLessThan(state.capacity);report('A06-jars',{milestones:1000,total,state});
});
test('A07 sound resumes after pausing with all six voices occupied',async()=>{
 vi.resetModules();let resumes=0,suspends=0,started=0;
 class AudioFake {currentTime=0;destination={};resume(){resumes++;return Promise.resolve();}suspend(){suspends++;return Promise.resolve();}createOscillator(){return {type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){started++;},stop(){},onended:null};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}}
 vi.stubGlobal('AudioContext',AudioFake);vi.stubGlobal('document',{hidden:false});
 const sound=await import('../../src/sound');for(let i=0;i<6;i++)sound.playSound('full',true);
 sound.blockSound(true);sound.blockSound(false);const before=resumes;sound.playSound('pair',true);
 report('A07-audio-pause',{started,suspends,resumesBefore:before,resumesAfter:resumes,expectedResume:true,scope:'module stress; natural UI reachability assessed separately'});
 vi.unstubAllGlobals();expect(resumes).toBeGreaterThan(before);
});
