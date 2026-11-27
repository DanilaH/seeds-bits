import {test,expect} from 'vitest';
import fs from 'node:fs';
import {fresh,metadata,startAttempt,recordCompletion,serializeProgress,readProgress,helpProfile} from '../src/progress';
import {notebook,loadNotebook,notebookForTask,puzzleSession,dailyForTask} from '../src/puzzles';
import {loadBookV5} from '../src/content-v5';
import {bookRevisionFor,dailyIdFor} from '../src/content-ids';
import {commit,removePair,occupied} from '../src/core';
import {jars} from '../src/jars';
const out='test-results/functional-profiles';
test('FA05 real complete histories, 1/3/5-year archives and large unfinished Classic',async()=>{
 fs.mkdirSync(out,{recursive:true});await loadNotebook();for(const n of [1,601,1201,1801])await loadBookV5('book-v1-'+n);
 const p=fresh();metadata(p);let moves=0;
 function solve(id:string,game:NonNullable<ReturnType<typeof dailyForTask>>,day?:string){
  startAttempt(p,id);let s=puzzleSession(game);for(const m of game.solution){s=commit(s,removePair(s.current.board,m.a,m.b),'pair',0);moves++;}
  expect(occupied(s.current.board)).toBe(0);p.sessions[id]=s;recordCompletion(p,id,day);
 }
 for(const game of notebook){const id=game.id;if(id.startsWith('book-v1-'))(p.bookRevisions??={})[id]=bookRevisionFor(id,p);solve(id,notebookForTask(id,p)!);}
 const reports=[];let index=0;
 for(let year=1;year<=5;year++){
  const end=`${2025+year}-01-01`;
  for(;;){const day=new Date(Date.UTC(2025,0,1+index)).toISOString().slice(0,10);if(day>=end)break;index++;
   const id=dailyIdFor(day,p);(p.dailyAssignments??={})[day]=id;solve(id,dailyForTask(id)!,day);
  }
  if(![1,3,5].includes(year))continue;
  p.active='classic';startAttempt(p,'classic');p.sessions.classic={rules:1,current:{board:Array(1800).fill(1),moves:0,additions:0,scroll:0},history:[]};
  for(let n=0;n<20;n++){const s=p.sessions.classic;const indexes=s.current.board.flatMap((v,i)=>v?[i]:[]);p.sessions.classic=commit(s,removePair(s.current.board,indexes[0],indexes[1]),'pair',0);}
  const m=metadata(p);m.wallet=999;helpProfile(p).inventory={magnet:2,plan:3};m.rewardReceipts=Array.from({length:2048},(_,i)=>`archive-receipt-${i}`);m.attempts.classic.hintKeys=Array.from({length:100},(_,i)=>`archive-hint-${i}`);jars(p).highWater=20;
  const serialize=[],read=[];let raw='';for(let sample=0;sample<15;sample++){let t=performance.now();raw=serializeProgress(p);serialize.push(performance.now()-t);t=performance.now();const q=readProgress(raw);read.push(performance.now()-t);expect(q.done).toEqual(p.done);expect(q.sessions.classic.history).toHaveLength(20);expect(metadata(q).rewardReceipts).toHaveLength(2048);expect(helpProfile(q).inventory).toEqual({magnet:2,plan:3});}
  const quantile=(v:number[],n:number)=>[...v].sort((a,b)=>a-b)[Math.ceil(v.length*n)-1];
  reports.push({years:year,days:index,done:p.done.length,moves,bytes:Buffer.byteLength(raw),serialize:{p50:quantile(serialize,.5),p95:quantile(serialize,.95)},deserialize:{p50:quantile(read,.5),p95:quantile(read,.95)},heap:process.memoryUsage()});
  fs.writeFileSync(`${out}/archive-${year}.json`,raw);
 }
 fs.writeFileSync(`${out}/measurements.json`,JSON.stringify({source:process.env.GITHUB_SHA,environment:'Node CI runner, not Android',reports},null,2));
},300000);
