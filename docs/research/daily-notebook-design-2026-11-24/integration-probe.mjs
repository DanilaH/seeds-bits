// Research-only probes of the EXISTING reader and date accounting.
// Hypothetical v2 identifiers do not represent a shipped feature or regression.
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {progress, puzzles, dailyRun, notebooks, manifest} from './integration-source.mjs';

const out={source:manifest.ref,level:'ACTUAL_SOURCE_NODE',scope:'Controlled hypothetical future IDs against unchanged existing product; no implementation',cases:[]};
const day='2026-11-24';
const seedState=()=>{
 const p=progress.fresh();
 progress.metadata(p).since='2026-11-24T00:00:00.000Z';
 progress.metadata(p).attempts.classic={id:'research-attempt-classic',completed:false};
 return p;
};
for(const id of ['book-v2-links-1',`daily-v2-${day}`]){
 const p=seedState();
 p.sessions[id]=puzzles.puzzleSession(puzzles.daily(day));
 p.hints[id]=1;p.done.push(id);
 progress.metadata(p).attempts[id]={id:'research-attempt-future',completed:true};
 let recoveries=0;
 const q=progress.readProgress(progress.serializeProgress(p),()=>recoveries++);
 out.cases.push({case:'future-id-in-inactive-records',id,wire:6,sessionPreserved:!!q.sessions[id],hintPreserved:id in q.hints,donePreserved:q.done.includes(id),attemptPreserved:!!progress.metadata(q).attempts[id],recoveries});
 p.active=id;
 try{progress.readProgress(progress.serializeProgress(p));out.cases.push({case:'future-id-active',id,unexpectedlyRead:true});}
 catch(error){out.cases.push({case:'future-id-active',id,error:error.message,futureProgress:error instanceof progress.FutureProgress});}
 const wire=JSON.parse(progress.serializeProgress(p));wire.version=7;
 try{progress.readProgress(JSON.stringify(wire));out.cases.push({case:'future-wire-guard',unexpectedlyRead:true});}
 catch(error){out.cases.push({case:'future-wire-guard',id,error:error.message,futureProgress:error instanceof progress.FutureProgress});}
}
const dailyState=seedState();
progress.metadata(dailyState).daily={lastDay:'2026-11-23',count:2,best:2,reward:0};
const original=progress.serializeProgress(dailyState);
const v2=progress.readProgress(original),v1=progress.readProgress(original);
out.cases.push({case:'today-streak-hardcoded-v1',day,v1Reward:dailyRun.recordDaily(v1,`daily-v1-${day}`,day),v2Reward:dailyRun.recordDaily(v2,`daily-v2-${day}`,day),v1Count:progress.metadata(v1).daily.count,v2Count:progress.metadata(v2).daily.count});
const doneV1=Array.from({length:7},(_,i)=>`daily-v1-2026-11-${String(i+1).padStart(2,'0')}`);
const doneV2=doneV1.map(id=>id.replace('daily-v1-','daily-v2-'));
out.cases.push({case:'monthly-trophy-hardcoded-v1',v1:puzzles.trophy('2026-11',doneV1),v2:puzzles.trophy('2026-11',doneV2)});
out.cases.push({case:'next-and-notebook-number-hardcoded',v2DailyNext:puzzles.nextTask(`daily-v2-${day}`,[],day)??null,v2BookVolume:Number.isNaN(notebooks.volumeOf('book-v2-links-1'))?'NaN':notebooks.volumeOf('book-v2-links-1')});
out.interpretation='Adding a new prefix without a content/save migration loses inactive entries, rejects an active task, and misses streak/trophy/next-task. Existing wire7 guard already refuses future saves as FutureProgress. These are compatibility requirements, not bugs in currently supported v1 content.';
const output=path.resolve(process.env.SEEDS_CONTENT_OUTPUT??'test-results/daily-notebook-design');
mkdirSync(output,{recursive:true});
writeFileSync(path.join(output,'integration-probe.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
