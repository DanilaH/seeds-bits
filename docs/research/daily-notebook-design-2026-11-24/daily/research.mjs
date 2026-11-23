import {writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import assert from 'node:assert/strict';
import {core,profile,puzzles,solver,manifest,digest} from './source.mjs';
const output=path.resolve(process.env.SEEDS_DAILY_OUTPUT??'test-results/daily-content-design');
mkdirSync(output,{recursive:true});
const save=(name,data)=>writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n');
const days=Array.from({length:12},(_,i)=>puzzles.days('2026-'+String(i+1).padStart(2,'0'))).flat();
const rows=days.map(day=>{
 const p=puzzles.daily(day),proof=p.solution.map(x=>[x.a,x.b]);
 const measured=profile.measureClassic(p.board,proof);
 const policies=['first','last','random'].map((order,i)=>profile.tryClassicOrder(p.board,order,0,20,82657+i));
 return {day,id:p.id,occupied:core.occupied(p.board),logical:p.board.length,profile:measured,policies:policies.map(x=>({outcome:x.outcome,remaining:x.remaining})),board:p.board,proof,hash:digest(p.board)};
});
const catalogue=new Map(rows.map(x=>[x.day,x]));
const selection=[
 {id:'daily-proposal-flow-24',day:'2026-02-25',role:'Свободная зачистка',weekDay:'Пн'},
 {id:'daily-proposal-reveal-24',day:'2026-06-17',role:'Открывающиеся связи',weekDay:'Вт'},
 {id:'daily-proposal-reading-24',day:'2026-10-21',role:'Переход через край строки',weekDay:'Ср'},
 {id:'daily-proposal-reset-24',day:'2026-02-03',role:'Спокойная середина недели',weekDay:'Чт'},
 {id:'daily-proposal-order-24',day:'2026-03-06',role:'Порядок снятия',weekDay:'Пт'},
 {id:'daily-proposal-mix-24',day:'2026-05-12',role:'Сочетание приёмов',weekDay:'Сб'},
 {id:'daily-proposal-compression-24',day:'2026-03-30',role:'Сжатие меняет связи',weekDay:'Вс'},
 {id:'daily-negative-reading-start',day:'2026-10-16',role:'Отклонённый кандидат спокойного чтения: невыигрышный первый ход'},
 {id:'daily-control-compression-24',day:'2026-09-18',role:'Контроль того же объёма и числа пар'},
 {id:'daily-proposal-flow-16',day:'2026-03-11',role:'Короткая передышка'},
 {id:'daily-proposal-reset-16',day:'2026-06-09',role:'Другая короткая передышка'},
 {id:'daily-proposal-mix-32',day:'2026-05-16',role:'Более длинная комбинация'},
];
const edge=(ids,a,b)=>[ids[a],ids[b]].sort((x,y)=>x-y).join(':');
function trace(row){
 let board=[...row.board],ids=board.map((x,i)=>x?i+1:0);
 const steps=[];
 for(let index=0;index<row.proof.length;index++){
  const [a,b]=row.proof[index],legal=core.pairs(board),move=legal.find(x=>x.a===a&&x.b===b);
  assert(move,'witness legal');
  const beforePairs=new Map(legal.map(x=>[edge(ids,x.a,x.b),x]));
  const withHoles=[...board];withHoles[a]=withHoles[b]=0;
  const holePairs=new Map(core.pairs(withHoles).map(x=>[edge(ids,x.a,x.b),x]));
  const after=core.removePair(board,a,b),nextIds=profile.remainingIds(ids,a,b);
  const afterPairs=new Map(core.pairs(after).map(x=>[edge(nextIds,x.a,x.b),x]));
  const newPairs=[...afterPairs].filter(([id])=>!beforePairs.has(id)).map(([id,pair])=>({stableIds:id,pair}));
  const compressionNew=after.length!==board.length?[...afterPairs].filter(([id])=>!holePairs.has(id)).map(([id,pair])=>({stableIds:id,pair})):[];
  const compressionLost=after.length!==board.length?[...holePairs].filter(([id])=>!afterPairs.has(id)).map(([id,pair])=>({stableIds:id,pair})):[];
  steps.push({index,before:board,action:{...move,values:[board[a],board[b]],stableIds:edge(ids,a,b)},after,legalBefore:legal.length,legalAfter:afterPairs.size,newPairs,compressionNew,compressionLost,rowsRemoved:(board.length-after.length)/9,gap:profile.crossesEmptyCell(move)});
  board=after;ids=nextIds;
 }
 assert.deepEqual(board,[]);return steps;
}
const fixtures=selection.map(s=>({...catalogue.get(s.day),...s,originTaskId:catalogue.get(s.day).id,origin:'Existing actual daily-v1 date used as an offline exemplar; no calendar assignment changed',trace:trace(catalogue.get(s.day))}));

// Exact source bounded search. A failed simple policy is never called a dead state.
// Fresh memo per branch; no known witness is supplied, so alternatives stand on their own.
const probeDays=new Set(['2026-03-06','2026-03-30','2026-09-18','2026-02-25','2026-10-16','2026-10-21']);
const probes=[];
for(const f of fixtures.filter(x=>probeDays.has(x.day))){
 for(const [stage,index] of [['early',0],['middle',5],['late',9]]){
  const board=f.trace[index].before;
  const branches=core.pairs(board).map(pair=>{
   let work=core.removePair(board,pair.a,pair.b);const after=[...work],advise=solver.createSolver(5000),first=advise(work);
   if(first.kind==='dead')return {pair,after,outcome:'NO_WIN_PROVEN',proof:null};
   if(first.kind==='unknown')return {pair,after,outcome:'UNKNOWN',proof:null};
   const proof=[];let advice=first;
   while(core.occupied(work)){
    assert.equal(advice.kind,'move');proof.push([advice.pair.a,advice.pair.b]);
    work=core.removePair(work,advice.pair.a,advice.pair.b);advice=advise(work);
   }
   assert.deepEqual(work,[]);return {pair,after,outcome:'FOUND',proof};
  });
  probes.push({fixtureId:f.id,day:f.day,stage,witnessIndex:index,board,remaining:core.occupied(board),limitStatesPerBranch:5000,branches,counts:branches.reduce((out,x)=>(out[x.outcome]=(out[x.outcome]??0)+1,out),{})});
 }
}
const selectedExamples=[];
for(const f of fixtures){
 const wanted=f.id.includes('reading')?'reading':f.id.includes('compression')?'compression':f.id.includes('reveal')?'reveal':null;
 if(!wanted)continue;
 const candidates=f.trace.filter(s=>wanted==='reading'?s.action.kind==='reading':wanted==='compression'?(s.compressionNew.length+s.compressionLost.length)>0:s.newPairs.length>0);
 candidates.sort((a,b)=>wanted==='reading'?a.index-b.index:wanted==='compression'?(b.compressionNew.length+b.compressionLost.length)-(a.compressionNew.length+a.compressionLost.length):b.newPairs.length-a.newPairs.length);
 selectedExamples.push({fixtureId:f.id,day:f.day,wanted,episode:candidates[0]??null});
}
// Close the reachable state graph for each proved-dead sampled branch independently.
const noWinChecks=[];
for(const state of probes)for(const branch of state.branches.filter(x=>x.outcome==='NO_WIN_PROVEN')){
 const pending=[branch.after],seen=new Set([branch.after.join('')]);let transitions=0,terminals=0;
 for(let i=0;i<pending.length;i++){
  const board=pending[i];assert(core.occupied(board)>0,'A claimed dead branch reached a win');
  const legal=core.pairs(board);if(!legal.length)terminals++;
  for(const pair of legal){
   transitions++;const next=core.removePair(board,pair.a,pair.b),key=next.join('');
   if(!seen.has(key)){seen.add(key);pending.push(next);}
  }
  assert(pending.length<=50000,'Independent graph verification budget exceeded');
 }
 noWinChecks.push({fixtureId:state.fixtureId,day:state.day,stage:state.stage,pair:branch.pair,outcome:'NO_WIN_PROVEN',reachableStates:pending.length,transitions,nonemptyTerminalStates:terminals});
}
save('no-win-graph-checks.json',noWinChecks);
const counts=probes.reduce((acc,p)=>{for(const [k,v] of Object.entries(p.counts))acc[k]=(acc[k]??0)+v;return acc},{});
const summary={source:manifest.ref,runtime:process.version,scope:'Own Seeds daily; actual-source calendar sample, not live users; one chosen witness per board; no original APK observations',dates:rows.length,allDailyWitnessesPassed:rows.length,selectedFixtures:fixtures.length,selectionMethod:'Researcher selected examples after inspecting all365 profiles; these dates are exploratory, not a held-out quality estimate',constantVolumeWeek:fixtures.filter(x=>x.weekDay).map(x=>({id:x.id,originDay:x.day,weekDay:x.weekDay,role:x.role,occupied:x.occupied,logical:x.logical,opening:x.profile.opening,profiles:x.profile,policies:x.policies})),volumeRhythmProposal:[16,24,24,16,24,32,24],matchedPair:['2026-03-30','2026-09-18'],probeStates:probes.length,probeBranches:probes.reduce((n,p)=>n+p.branches.length,0),probeOutcomes:counts,independentClosedGraphs:noWinChecks,perBranchBudget:5000,phone:'UNKNOWN',liveAudience:'UNKNOWN'};
save('summary.json',summary);save('fixtures.json',fixtures);save('episodes.json',selectedExamples);save('choice-probes.json',probes);
writeFileSync(path.join(output,'profiles.json.gz'),gzipSync(JSON.stringify({source:manifest.ref,dates:365,rows:rows.map(({board,proof,...row})=>row)})+'\n',{mtime:0}));
console.log(JSON.stringify({dates:summary.dates,fixtures:summary.selectedFixtures,probeStates:summary.probeStates,probeBranches:summary.probeBranches,outcomes:counts,episodes:selectedExamples.map(x=>({id:x.fixtureId,index:x.episode?.index,action:x.episode?.action,newPairs:x.episode?.newPairs.length,compressionNew:x.episode?.compressionNew.length,compressionLost:x.episode?.compressionLost.length}))},null,2));
