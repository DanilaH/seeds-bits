import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {core,solver,catalogue,sourceManifest} from './source.mjs';
const output=path.resolve(process.env.SEEDS_NOTEBOOK_OUTPUT??'test-results/notebook-content-design');
mkdirSync(output,{recursive:true});
const profiles=JSON.parse(gunzipSync(readFileSync(path.join(output,'profiles-full.json.gz'))));
const selected=[6,84,216,148,241,78,70,73,33,52,317];
const budget=5000;
function continuation(initial){
 const solve=solver.createSolver(budget);let board=initial;const proof=[];
 while(core.occupied(board)){
  const advice=solve(board);
  if(advice.kind==='dead')return {status:proof.length?'INCONSISTENT':'NO_WIN_PROVEN',proof,remaining:board.join('')};
  if(advice.kind==='unknown')return {status:'UNKNOWN',proof,remaining:board.join('')};
  assert.equal(advice.kind,'move');assert(core.checkPair(board,advice.pair.a,advice.pair.b).ok);
  proof.push(advice.pair);board=core.removePair(board,advice.pair.a,advice.pair.b);
 }
 return {status:'FOUND',proof,remaining:''};
}
const tasks=[];
for(const number of selected){
 const task=catalogue[number-1],p=profiles.find(p=>p.id===task.id);assert(p);
 const steps=[0,Math.floor(task.solution.length/2),Math.max(0,task.solution.length-2)];
 const states=[];
 for(const step of [...new Set(steps)]){
  const e=p.episodes[step],board=[...e.before].map(Number);
  const alternatives=core.pairs(board).map(move=>{
   const next=core.removePair(board,move.a,move.b),c=continuation(next);
   assert.notEqual(c.status,'INCONSISTENT');
   return {move,stableIds:[e.beforeIds[move.a],e.beforeIds[move.b]],after:next.join(''),...c};
  });
  states.push({step,phase:step===0?'early':step===steps[1]?'mid':'late',before:e.before,stableIds:e.beforeIds,
   witnessMove:e.move,alternatives,counts:Object.fromEntries(['FOUND','NO_WIN_PROVEN','UNKNOWN'].map(k=>[k,alternatives.filter(a=>a.status===k).length]))});
 }
 tasks.push({id:task.id,board:task.board.join(''),proof:task.solution,profile:p,states});
}
const counts={tasks:tasks.length,states:tasks.reduce((n,t)=>n+t.states.length,0),
 alternatives:tasks.flatMap(t=>t.states.flatMap(s=>s.alternatives)).length,
 status:Object.fromEntries(['FOUND','NO_WIN_PROVEN','UNKNOWN'].map(k=>[k,tasks.flatMap(t=>t.states.flatMap(s=>s.alternatives)).filter(a=>a.status===k).length]))};
writeFileSync(path.join(output,'fixtures.json'),JSON.stringify({source:sourceManifest.ref,level:'ACTUAL_SOURCE_NODE',runtime:process.version,
 method:'Exact pinned core and bounded createSolver; all legal immediate actions at three witness states per selected task. Only returned FOUND paths are replayed. NO_WIN_PROVEN means actual solver exhausted its graph within budget. UNKNOWN remains unknown.',
 budgetPerAdviceCall:budget,counts,tasks},null,2)+'\n');
console.log(JSON.stringify({counts,states:tasks.map(t=>({id:t.id,states:t.states.map(s=>({step:s.step,phase:s.phase,...s.counts}))}))},null,2));
