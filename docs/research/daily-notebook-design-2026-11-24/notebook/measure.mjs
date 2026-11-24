import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {core,solver,catalogue,sourceManifest,hash} from './source.mjs';
const output=path.resolve(process.env.SEEDS_NOTEBOOK_OUTPUT??'test-results/notebook-content-design');
mkdirSync(output,{recursive:true});
const pairKey=(ids,p)=>[ids[p.a],ids[p.b]].sort((a,b)=>a-b).join(':');
function advance(board,ids,pair){
 const marked=board.map((v,i)=>i===pair.a||i===pair.b?0:v),b=[],id=[],removedRows=[];
 for(let i=0;i<marked.length;i+=9){
  const row=marked.slice(i,i+9);
  if(row.some(Boolean)){b.push(...row);id.push(...ids.slice(i,i+9));}else removedRows.push(i/9);
 }
 assert.deepEqual(core.removePair(board,pair.a,pair.b),b);
 return {board:b,ids:id,marked,removedRows};
}
function simplePolicy(initial,last=false){
 let b=initial;const actions=[];
 while(core.occupied(b)){
  const legal=core.pairs(b);if(!legal.length)return {cleared:false,remaining:core.occupied(b),moves:actions.length};
  const p=last?legal.at(-1):legal[0];actions.push(p);b=core.removePair(b,p.a,p.b);
 }
 return {cleared:true,remaining:0,moves:actions.length};
}
function profile(task){
 let board=task.board,ids=board.map((_,i)=>i);const episodes=[];
 for(let step=0;step<task.solution.length;step++){
  const move=task.solution[step],check=core.checkPair(board,move.a,move.b);assert(check.ok,task.id+' illegal');
  const before=core.pairs(board),beforeKeys=new Set(before.map(p=>pairKey(ids,p)));
  const next=advance(board,ids,move),after=core.pairs(next.board);
  const added=after.filter(p=>!beforeKeys.has(pairKey(next.ids,p)));
  const compressionOnly=added.filter(p=>!core.checkPair(next.marked,ids.indexOf(next.ids[p.a]),ids.indexOf(next.ids[p.b])).ok);
  const deletedIds=new Set([ids[move.a],ids[move.b]]),afterKeys=new Set(after.map(p=>pairKey(next.ids,p)));
  const lost=before.filter(p=>!deletedIds.has(ids[p.a])&&!deletedIds.has(ids[p.b])&&!afterKeys.has(pairKey(ids,p)));
  const oldPositions=new Map(ids.map((id,i)=>[id,i]));
  const opened=added.filter(p=>!compressionOnly.includes(p));
  const opening=opened.map(p=>({stableIds:[next.ids[p.a],next.ids[p.b]],before:[oldPositions.get(next.ids[p.a]),oldPositions.get(next.ids[p.b])],after:p,kind:p.kind}));
  episodes.push({step,phase:step<task.solution.length/3?'early':step<2*task.solution.length/3?'mid':'late',
   remaining:core.occupied(board),legalBefore:before.length,kind:check.path.kind,
   readingEarly:check.path.kind==='reading'&&step<task.solution.length*.75,
   added:added.length,opened:opened.length,compressionOnly:compressionOnly.length,lost:lost.length,
   removedRows:next.removedRows,move,stablePair:[ids[move.a],ids[move.b]],
   opening,compressionPairs:compressionOnly.map(p=>({stableIds:[next.ids[p.a],next.ids[p.b]],before:[oldPositions.get(next.ids[p.a]),oldPositions.get(next.ids[p.b])],after:p})),
   before:board.join(''),beforeIds:ids,after:next.board.join(''),afterIds:next.ids,
  });
  board=next.board;ids=next.ids;
 }
 assert.equal(core.occupied(board),0,task.id+' not solved');
 return {id:task.id,number:+task.id.split('-').at(-1),occupied:core.occupied(task.board),logical:task.board.length,
   openingPairs:core.pairs(task.board).length,firstPolicy:simplePolicy(task.board),lastPolicy:simplePolicy(task.board,true),
   moves:task.solution.length,reading:episodes.filter(x=>x.kind==='reading').length,
   earlyReading:episodes.filter(x=>x.readingEarly).length,
   openingEpisodes:episodes.filter(x=>x.opened>=2&&x.removedRows.length===0).length,
   compressionEpisodes:episodes.filter(x=>x.compressionOnly>0).length,
   compressionLost:episodes.filter(x=>x.lost>0).length,
   totalNew:episodes.reduce((s,x)=>s+x.added,0),episodes};
}
const short=catalogue.filter(t=>core.occupied(t.board)>=8&&core.occupied(t.board)<=32&&t.board.length<=54);
const profiles=short.map(profile);
const summaries=profiles.map(({episodes,...p})=>p);
const counts={totalCatalogue:catalogue.length,shortScanned:profiles.length,
 shortDefinition:{occupiedMin:8,occupiedMax:32,logicalMax:54},
 openingAtLeastOne:profiles.filter(p=>p.openingEpisodes).length,
 compressionAtLeastOne:profiles.filter(p=>p.compressionEpisodes).length,
 earlyReadingAtLeastOne:profiles.filter(p=>p.earlyReading).length,
 firstPolicyStuck:profiles.filter(p=>!p.firstPolicy.cleared).length,
 lastPolicyStuck:profiles.filter(p=>!p.lastPolicy.cleared).length,
 firstAndLastClear:profiles.filter(p=>p.firstPolicy.cleared&&p.lastPolicy.cleared).length};
writeFileSync(path.join(output,'scan.json'),JSON.stringify({source:sourceManifest.ref,level:'PRECOMPUTED_DATA_PLUS_ACTUAL_CORE_REPLAY',runtime:process.version,counts,profiles:summaries},null,2)+'\n');
writeFileSync(path.join(output,'profiles-full.json.gz'),gzipSync(JSON.stringify(profiles)+'\n'));
console.log(JSON.stringify({counts},null,2));
