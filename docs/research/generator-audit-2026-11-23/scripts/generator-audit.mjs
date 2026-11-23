import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {core,profile,generator,digest,manifest} from './source.mjs';
const output=path.resolve(process.env.SEEDS_AUDIT_OUTPUT??'test-results/seeds-generator-audit');
mkdirSync(output,{recursive:true});
const out=(name,x)=>writeFileSync(path.join(output,name),JSON.stringify(x,null,2)+'\n');
const hist=xs=>xs.reduce((r,x)=>(r[x]=(r[x]??0)+1,r),{});
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),i=(a.length-1)/2;return (a[Math.floor(i)]+a[Math.ceil(i)])/2;};
function replay(g){let b=g.board,adds=0,removals=0;const addStates=[];for(const move of g.proof){if(move===null){assert.equal(core.pairs(b).length,0);addStates.push({before:b,shape:profile.classicStructure(b),occupied:core.occupied(b),removals,logical:b.length});b=core.addNumbers(b);adds++;}else{b=core.removePair(b,...move);removals++;}}assert.deepEqual(b,[]);return {addStates,adds,removals};}
const rows=[],bad=[],changedStyle=[];const started=performance.now();
for(let level=0;level<4;level++){
 for(let seed=30000;seed<31000;seed++){
  const run=generator.newClassicRun(seed),g=generator.generateClassic(run,level),route=replay(g);
  assert.equal(g.board.length,generator.CLASSIC_SIZES[level]);assert.equal(core.occupied(g.board),g.board.length);
  assert.ok(g.board.every(v=>Number.isInteger(v)&&v>=1&&v<=9));
  if(level===1)assert.deepEqual([...g.board].sort(),core.classic().sort());
  if(level===0)assert.equal(profile.tryClassicOrder(g.board,'first',0,9).outcome,'FOUND');
  const row={level,seed,boardSha256:digest(g.board),style:g.style,recipe:g.recipe,fallback:g.fallback,profile:g.profile,diagnostics:g.diagnostics,addStates:route.addStates.map(({before,...rest})=>rest),policies:Object.fromEntries(['first','last','random'].map(order=>[order,profile.tryClassicOrder(g.board,order,2,180,seed).outcome]))};
  rows.push(row);if(g.recipe&&g.recipe!==g.style&&changedStyle.length<12)changedStyle.push({...row,board:g.board,proof:g.proof});
 }
 console.log('verified level',level);
}
const sequences=[];
for(let level=0;level<4;level++){
 let state=generator.newClassicRun(12081),previous=[];
 const rows=[];
 for(let index=0;index<100;index++){
  const before=generator.readClassicRun(JSON.parse(JSON.stringify(state))),probe=generator.readClassicRun(before),g=generator.generateClassic(probe,level),route=replay(g);
  const game=generator.takeGeneratedClassic(state,'audit-'+index,level);assert.deepEqual(game.current.board,g.board);
  assert.ok(!before.recent.includes(g.board.join('')));
  const shapes=route.addStates.map(s=>s.shape),repeatedPreviousCore=previous.flatMap((p)=>p.shapes.map(shape=>({previousIndex:p.index,shape}))).filter(p=>shapes.includes(p.shape));
  rows.push({index,style:g.style,recipe:g.recipe,profile:g.profile,boardSha256:digest(g.board),shapes,repeatedPreviousCore});
  previous=[...previous,{index,shapes}].slice(-8);state=generator.readClassicRun(JSON.parse(JSON.stringify(state)));
 }
 sequences.push({level,rows});
}
const summary={source:manifest.ref,kind:'ACTUAL_PRODUCT_TS_EXECUTION',seeds:[30000,30999],count:rows.length,verifiedProofs:rows.length,runtime:process.version,byLevel:Object.fromEntries([0,1,2,3].map(level=>{
 const rs=rows.filter(r=>r.level===level),d=level>=2;
 return[level,{fields:rs.length,styleCounts:hist(rs.map(r=>r.style)),recipeCounts:hist(rs.map(r=>r.recipe)),styleRecipeMismatch:rs.filter(r=>r.recipe&&r.recipe!==r.style).length,fallback:rs.filter(r=>r.fallback).length,candidates:hist(rs.map(r=>r.diagnostics.candidates)),policies:Object.fromEntries(['first','last','random'].map(p=>[p,hist(rs.map(r=>r.policies[p]))])),byStyle:Object.fromEntries(['open','gaps','stock'].map(style=>{const ss=rs.filter(r=>r.style===style);return[style,{count:ss.length,openingMedian:median(ss.map(r=>r.profile.opening)),gapMedian:median(ss.map(r=>r.profile.gapMoves)),newMedian:median(ss.map(r=>r.profile.newPairs)),firstAdd:hist(ss.map(r=>r.profile.firstAdd)),addOccupied:hist(ss.flatMap(r=>r.addStates.map(s=>s.occupied))),addCoreShapes:hist(ss.flatMap(r=>r.addStates.map(s=>s.shape)))}];}))}];})),sequenceSummary:sequences.map(({level,rows})=>({level,games:rows.length,styleRecipeMismatch:rows.filter(r=>r.recipe&&r.recipe!==r.style).length,coreRepeatedInPrevious8:rows.filter(r=>r.repeatedPreviousCore.length).length,styleCounts:hist(rows.map(r=>r.style)),recipeCounts:hist(rows.map(r=>r.recipe))})),elapsedSeconds:(performance.now()-started)/1000,limits:['One generator witness and three simple policies are not human difficulty.','Core repetition is measured at pre-Add certificate states, not every possible route.','Node is not phone timing.','Research observations, no production modifications.']};
out('generator-results.json',{summary,rows,sequences,changedStyle});out('generator-summary.json',summary);out('generator-fixtures.json',{source:manifest.ref,changedStyle,sequences:sequences.filter(s=>s.level>=2)});console.log(JSON.stringify({byLevel:Object.fromEntries(Object.entries(summary.byLevel).map(([k,v])=>[k,{fields:v.fields,mismatch:v.styleRecipeMismatch,recipes:v.recipeCounts,fallback:v.fallback,policies:v.policies,byStyle:Object.fromEntries(Object.entries(v.byStyle).map(([s,x])=>[s,{count:x.count,opening:x.openingMedian,gaps:x.gapMedian,new:x.newMedian,firstAdd:x.firstAdd,addOccupied:x.addOccupied,uniqueAddCoreShapes:Object.keys(x.addCoreShapes).length}]))}])),sequences:summary.sequenceSummary,elapsedSeconds:summary.elapsedSeconds},null,2));
