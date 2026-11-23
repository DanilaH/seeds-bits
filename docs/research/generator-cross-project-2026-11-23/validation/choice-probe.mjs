/** Research only. No product files are modified. Run: node choice-probe.mjs */
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {core,generator,catalog,catalogProofs,digest,manifest} from './load-product.mjs';

const OUT=path.dirname(fileURLToPath(import.meta.url));
const WIDTH=9;
const CONFIG={normalSeeds:Array.from({length:20},(_,i)=>i+1),hardSeeds:Array.from({length:20},(_,i)=>i+1),legacyIndices:[0,31,32,63,64,95,96,127],phaseFractions:[0,.5,.8],branchBudget:5000,branchLimit:6,oracleMaxOccupied:12,oracleAdditions:0};
const key=b=>b.join('');
const edgeKey=(x,y)=>x<y?`${x}:${y}`:`${y}:${x}`;
const countAdd=p=>p.filter(a=>a===null).length;
const sum=a=>a.reduce((s,n)=>s+n,0);
const avg=a=>a.length?sum(a)/a.length:null;
const distribution=a=>{if(!a.length)return {min:null,median:null,max:null,mean:null};const sorted=[...a].sort((x,y)=>x-y);return {min:sorted[0],median:(sorted[Math.floor((a.length-1)/2)]+sorted[Math.floor(a.length/2)])/2,max:sorted.at(-1),mean:avg(a)};};
function state(board){return {board:[...board],ids:board.map((v,i)=>v?`i${i}`:null),additionsUsed:0,nextId:board.length};}
function pairIds(s,p){return [s.ids[p.a],s.ids[p.b]];}
function edges(s){return core.pairs(s.board).map(p=>({...p,ids:pairIds(s,p),id:edgeKey(...pairIds(s,p))}));}
function byIds(s,ids){const a=s.ids.indexOf(ids[0]),b=s.ids.indexOf(ids[1]);return a>=0&&b>=0&&core.checkPair(s.board,a,b).ok?{a,b}:null;}
function remove(s,p){
  const next=core.removePair(s.board,p.a,p.b),raw=[...s.board],ids=[...s.ids];raw[p.a]=raw[p.b]=0;ids[p.a]=ids[p.b]=null;
  const mapped=[];const replay=[];
  for(let start=0;start<raw.length;start+=WIDTH){const row=raw.slice(start,start+WIDTH);if(row.some(Boolean)){replay.push(...row);mapped.push(...ids.slice(start,start+WIDTH));}}
  assert.deepEqual(replay,next,'stable-ID row remap disagrees with actual core');
  return {...s,board:next,ids:mapped};
}
function add(s){const next=core.addNumbers(s.board),clones=s.board.filter(Boolean).map((_,i)=>`a${s.nextId+i}`);return {board:next,ids:[...s.ids,...clones],additionsUsed:s.additionsUsed+1,nextId:s.nextId+clones.length};}
function advance(s,action){return action===null?add(s):remove(s,{a:action[0],b:action[1]});}
function route(initial,proof){const states=[state(initial)];for(const action of proof)states.push(advance(states.at(-1),action));assert.equal(core.occupied(states.at(-1).board),0,'proof does not clear board');return states;}
function validateProof(initial,proof,allowed){let s=state(initial);for(const action of proof)s=advance(s,action);assert.equal(core.occupied(s.board),0);assert.ok(s.additionsUsed<=allowed);return {status:'FOUND',actions:proof,additions:countAdd(proof)};}
function pairComparison(s,p,q){
  const idsP=pairIds(s,p),idsQ=pairIds(s,q);
  if(idsP.some(id=>idsQ.includes(id)))return 'SHARED_ENDPOINT';
  const pState=remove(s,p),qState=remove(s,q),qAfter=byIds(pState,idsQ),pAfter=byIds(qState,idsP);
  if(!qAfter||!pAfter)return 'DISJOINT_NONCOMMUTING';
  const pq=remove(pState,qAfter),qp=remove(qState,pAfter);
  return key(pq.board)===key(qp.board)&&JSON.stringify(pq.ids)===JSON.stringify(qp.ids)?'COMMUTING':'DISJOINT_NONCOMMUTING';
}
function describeAction(s,p){
  const before=edges(s),afterState=remove(s,p),after=edges(afterState),beforeIDs=new Set(before.map(e=>e.id)),afterIDs=new Set(after.map(e=>e.id)),removedIDs=pairIds(s,p);
  const survivingOld=before.filter(e=>!e.ids.some(id=>removedIDs.includes(id)));
  return {action:[p.a,p.b],cellIds:removedIDs,kind:p.kind??core.checkPair(s.board,p.a,p.b).path.kind,afterBoard:afterState.board,afterBoardSHA256:digest(afterState.board),afterIds:afterState.ids,nextPairs:after.length,newPairs:after.filter(e=>!beforeIDs.has(e.id)).map(e=>({indices:[e.a,e.b],cellIds:e.ids,kind:e.kind})),lostSurvivingPairs:survivingOld.filter(e=>!afterIDs.has(e.id)).map(e=>({indices:[e.a,e.b],cellIds:e.ids})),removedRows:Math.ceil(s.board.length/WIDTH)-Math.ceil(afterState.board.length/WIDTH),removedCells:s.board.length-afterState.board.length,afterState};
}
function structural(s){
  const ps=edges(s),comparisons={SHARED_ENDPOINT:0,COMMUTING:0,DISJOINT_NONCOMMUTING:0};
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)comparisons[pairComparison(s,ps[i],ps[j])]++;
  const actions=ps.map(p=>describeAction(s,p));
  return {occupied:core.occupied(s.board),cells:s.board.length,pairs:ps.length,participatingCells:new Set(ps.flatMap(p=>p.ids)).size,immediateGeometryStates:new Set(actions.map(a=>key(a.afterBoard))).size,pairOfActions:comparisons,newPairs:actions.map(a=>a.newPairs.length),newPairsMean:avg(actions.map(a=>a.newPairs.length)),survivingEdgesLost:sum(actions.map(a=>a.lostSurvivingPairs.length)),rowCompressingActions:actions.filter(a=>a.removedRows>0).length,actions};
}

// Independent exhaustive oracle. It enumerates endpoint pairs rather than using
// core.pairs, computes visibility directly, and drops empty rows independently.
// No node budget: for the selected <=12 occupied, zero-Add states the search is
// finite and strictly reduces occupied cells. Negative conclusions apply ONLY
// to this explicitly restricted zero-Add rule, not to the unlimited-Add game.
function oracleLegal(b,a,c){
  if(a===c||!b[a]||!b[c]||(b[a]!==b[c]&&b[a]+b[c]!==10))return false;
  const lo=Math.min(a,c),hi=Math.max(a,c),r0=Math.floor(lo/9),r1=Math.floor(hi/9),c0=lo%9,c1=hi%9,dr=r1-r0,dc=c1-c0;
  let step=0;if(dr===0)step=1;else if(dc===0)step=9;else if(dr===Math.abs(dc))step=dc>0?10:8;
  if(step){let clear=true;for(let x=lo+step;x<hi;x+=step)if(b[x])clear=false;if(clear)return true;}
  for(let x=lo+1;x<hi;x++)if(b[x])return false;return true;
}
function oraclePairs(b){const p=[];for(let a=0;a<b.length;a++)if(b[a])for(let c=a+1;c<b.length;c++)if(oracleLegal(b,a,c))p.push([a,c]);return p;}
function oracleRemove(b,a,c){const copy=b.map((v,i)=>i===a||i===c?0:v),rows=[];for(let n=0;n<copy.length;n+=9){const row=copy.slice(n,n+9);if(row.some(v=>v!==0))rows.push(...row);}return rows;}
function oracle(board){
  const memo=new Map();let evaluated=0;
  function visit(b){const k=key(b);if(memo.has(k))return memo.get(k);evaluated++;if(!b.some(Boolean)){const r={status:'FOUND',proof:[]};memo.set(k,r);return r;}
    const ps=oraclePairs(b);for(const [a,c]of ps){const r=visit(oracleRemove(b,a,c));if(r.status==='FOUND'){const answer={status:'FOUND',proof:[[a,c],...r.proof]};memo.set(k,answer);return answer;}}
    const r={status:'NO_WIN_PROVEN'};memo.set(k,r);return r;
  }
  const branches=oraclePairs(board).map(([a,b])=>({action:[a,b],...visit(oracleRemove(board,a,b))}));
  const result=visit(board);
  // Independent legal-pair/transition implementation is compared on every
  // memoized state and every outgoing edge, beyond merely replaying solutions.
  for(const k of memo.keys()){const b=[...k].map(Number);assert.deepEqual(oraclePairs(b),core.pairs(b).map(p=>[p.a,p.b]));for(const [a,c]of oraclePairs(b))assert.deepEqual(oracleRemove(b,a,c),core.removePair(b,a,c));}
  if(result.status==='FOUND')validateProof(board,result.proof,0);
  for(const b of branches)if(b.status==='FOUND')validateProof(board,[b.action,...b.proof],0);
  return {...result,branches,evaluated,exhaustive:true,allowedAdditions:0};
}
const samples=[];
for(const [label,level,seeds]of [['Normal',1,CONFIG.normalSeeds],['Hard',2,CONFIG.hardSeeds]])for(const seed of seeds){const g=generator.generateClassic(generator.newClassicRun(seed),level);samples.push({id:`${label}-${seed}`,group:label,seed,initial:g.board,proof:g.proof,fallback:g.fallback});}
for(const i of CONFIG.legacyIndices)samples.push({id:`legacy-${i}`,group:`legacy/${catalog[i].family}`,catalogIndex:i,initial:[...catalog[i].board].map(Number),proof:catalogProofs[i],fallback:false});
const observed=[];let productBranchCalls=0;
for(const sample of samples){
  const states=route(sample.initial,sample.proof);sample.initialSHA256=digest(sample.initial);sample.proofAdditions=countAdd(sample.proof);sample.routeLength=sample.proof.length;
  sample.probes=[];
  for(const [phase,fraction]of [['early',0],['mid',.5],['late',.8]]){
    const offset=Math.min(sample.proof.length-1,Math.floor(sample.proof.length*fraction)),s=states[offset],m=structural(s),remainingAdds=2-s.additionsUsed;
    // Deterministically sample up to six outgoing actions spread across the
    // actual core order, rather than counting every legal edge as a win branch.
    const indices=[...new Set(Array.from({length:Math.min(CONFIG.branchLimit,m.actions.length)},(_,i)=>Math.floor(i*Math.max(0,m.actions.length-1)/Math.max(1,Math.min(CONFIG.branchLimit,m.actions.length)-1))))];
    const outcomes=[];
    for(const i of indices){const action=m.actions[i],p=generator.solveClassic(action.afterBoard,remainingAdds,CONFIG.branchBudget);productBranchCalls++;outcomes.push({action:action.action,cellIds:action.cellIds,status:p?'FOUND':'UNKNOWN',...(p?{proof:p,proofAdditions:countAdd(p)}:{})});if(p)validateProof(action.afterBoard,p,remainingAdds);}
    const exact=core.occupied(s.board)<=CONFIG.oracleMaxOccupied?{...oracle(s.board),additionsAlreadySpent:s.additionsUsed,remainingAllowedAdditions:0,scope:'No further Add from this state; not a claim about ordinary unlimited-Add gameplay'}:null;
    const {actions,...metrics}=m;
    const report={sampleId:sample.id,group:sample.group,phase,proofOffset:offset,board:s.board,ids:s.ids,additionsUsed:s.additionsUsed,boundedAllowedRemainingAdditions:remainingAdds,metrics,boundedOutcomes:outcomes,oracle:exact};
    if(exact){const ps=generator.solveClassic(s.board,0,CONFIG.branchBudget);assert.equal(!!ps,exact.status==='FOUND','small exhaustive result differs from product search');if(ps)validateProof(s.board,ps,0);}
    sample.probes.push(report);observed.push({sample,report,s,actions});
  }
}
const groups={};
for(const group of [...new Set(samples.map(s=>s.group))])for(const phase of ['early','mid','late']){
  const rows=observed.filter(o=>o.sample.group===group&&o.report.phase===phase).map(o=>o.report),rs=rows.map(r=>r.metrics),outcomes=rows.flatMap(r=>r.boundedOutcomes);
  groups[`${group}/${phase}`]={states:rows.length,pairs:distribution(rs.map(r=>r.pairs)),sharedEndpointComparisons:sum(rs.map(r=>r.pairOfActions.SHARED_ENDPOINT)),commutingComparisons:sum(rs.map(r=>r.pairOfActions.COMMUTING)),disjointNoncommutingComparisons:sum(rs.map(r=>r.pairOfActions.DISJOINT_NONCOMMUTING)),newPairsPerAction:distribution(rs.flatMap(r=>r.newPairs)),survivingEdgesLost:sum(rs.map(r=>r.survivingEdgesLost)),boundedBranches:{FOUND:outcomes.filter(o=>o.status==='FOUND').length,UNKNOWN:outcomes.filter(o=>o.status==='UNKNOWN').length},zeroAddOracle:{states:rows.filter(r=>r.oracle).length,FOUND:rows.filter(r=>r.oracle?.status==='FOUND').length,NO_WIN_PROVEN:rows.filter(r=>r.oracle?.status==='NO_WIN_PROVEN').length}};
}

// Control progress: exactly seven pair removals, zero additions, 14 occupied
// cells and the same 28-cell geometry length. Do not compare different points
// of proof routes merely because both are called "midpoint".
const normals=samples.filter(s=>s.group==='Normal');let selected=null;
const atSeven=new Map(normals.map(s=>{const st=route(s.initial,s.proof)[7],{actions,...metrics}=structural(st);return [s.id,{board:st.board,ids:st.ids,prefix:s.proof.slice(0,7),additionsAlreadySpent:st.additionsUsed,remainingAllowedAdditions:2-st.additionsUsed,metrics}];}));
for(let i=0;i<normals.length;i++)for(let j=i+1;j<normals.length;j++){
  const a=normals[i],b=normals[j];assert.deepEqual([...a.initial].sort(),[...b.initial].sort());
  if(a.probes[0].metrics.pairs!==b.probes[0].metrics.pairs)continue;
  const x=atSeven.get(a.id),y=atSeven.get(b.id);if(x.additionsAlreadySpent||y.additionsAlreadySpent||x.metrics.occupied!==14||y.metrics.occupied!==14||x.metrics.cells!==28||y.metrics.cells!==28)continue;
  const diff=Math.abs(x.metrics.pairs-y.metrics.pairs);
  if(!selected||diff>selected.controlledPairDifference)selected={a:a.id,b:b.id,controlledPairDifference:diff};
}
const equalOpeningCase=selected?{selectionRule:'Same 28-cell Normal composition, same opening count, exactly seven pair removals without Add, 14 occupied cells and 28 geometric cells. Largest difference in resulting legal-pair count among seeds 1..20; selected after measurement.',...selected,boards:[selected.a,selected.b].map(id=>{const s=samples.find(s=>s.id===id);return {id,initial:s.initial,initialSHA256:s.initialSHA256,initialMetrics:s.probes[0].metrics,afterSeven:atSeven.get(id),fullProof:s.proof};})}:null;
let zeroAddRiskCase=null;
for(const o of observed){const exact=o.report.oracle;if(!exact||o.report.boundedAllowedRemainingAdditions!==0)continue;const loss=exact.branches.find(b=>b.status==='NO_WIN_PROVEN');if(!loss)continue;const win=exact.branches.find(b=>b.status==='FOUND'&&b.action.some(i=>loss.action.includes(i)))??exact.branches.find(b=>b.status==='FOUND');if(!win)continue;zeroAddRiskCase={sampleId:o.sample.id,initial:o.sample.initial,prefix:o.sample.proof.slice(0,o.report.proofOffset),board:o.s.board,proofOffset:o.report.proofOffset,additionsAlreadySpent:o.s.additionsUsed,remainingAllowedAdditions:0,winning:win,noWin:loss,oracleEvaluated:exact.evaluated,scope:'Exact no-further-Add comparison. Ordinary game can offer another Add after pairs run out; this is not proof of a permanent gameplay trap.'};break;}

// A fully proved pair of incompatible first choices: they share a physical cell
// and have different successor geometry, both with legal winning continuations.
// This is a local branching example, not a human-difficulty proof.
let branchCase=null;
for(const o of observed.filter(o=>o.sample.group==='Normal'&&o.report.phase==='mid')){
  const found=o.report.boundedOutcomes.filter(b=>b.status==='FOUND');
  for(let i=0;i<found.length&&!branchCase;i++)for(let j=i+1;j<found.length&&!branchCase;j++){
    const x=found[i],y=found[j],p={a:x.action[0],b:x.action[1]},q={a:y.action[0],b:y.action[1]};
    if(pairComparison(o.s,p,q)!=='SHARED_ENDPOINT')continue;
    const dx=describeAction(o.s,p),dy=describeAction(o.s,q);
    if(key(dx.afterBoard)===key(dy.afterBoard)||JSON.stringify(dx.newPairs.map(e=>e.cellIds))===JSON.stringify(dy.newPairs.map(e=>e.cellIds)))continue;
    const clean=d=>{const {afterState,...rest}=d;return rest;};
    branchCase={sampleId:o.sample.id,initial:o.sample.initial,prefix:o.sample.proof.slice(0,o.report.proofOffset),proofOffset:o.report.proofOffset,board:o.s.board,ids:o.s.ids,additionsAlreadySpent:o.s.additionsUsed,remainingAdditions:o.report.boundedAllowedRemainingAdditions,relation:'SHARED_ENDPOINT; the first two actions cannot simply be swapped',branches:[{...clean(dx),status:x.status,proof:x.proof,proofAdditions:x.proofAdditions},{...clean(dy),status:y.status,proof:y.proof,proofAdditions:y.proofAdditions}]};
  }
  if(branchCase)break;
}
// Compression counterexample chosen from actual routes: compare pairs by stable
// IDs rather than by their old/current integer coordinates.
let remapCase=null;
for(const o of observed){for(const a of o.actions){if(a.removedRows<=0)continue;const before=edges(o.s),after=edges(a.afterState),oldIDs=new Set(before.map(e=>e.id)),oldIndices=new Set(before.map(e=>`${e.a}:${e.b}`));const falseNew=after.filter(e=>oldIDs.has(e.id)&&!oldIndices.has(`${e.a}:${e.b}`));if(falseNew.length){const {afterState,...detail}=a;remapCase={sampleId:o.sample.id,phase:o.report.phase,prefix:o.sample.proof.slice(0,o.report.proofOffset),board:o.s.board,ids:o.s.ids,...detail,falseNewUnderIndexComparison:falseNew.map(e=>({cellIds:e.ids,newIndices:[e.a,e.b],oldIndices:before.find(p=>p.id===e.id)&&[before.find(p=>p.id===e.id).a,before.find(p=>p.id===e.id).b]}))};break;}}if(remapCase)break;}

const reflectionInput=[0,0,0,0,0,0,0,0,1,9,0,0,0,0,0,0,0,2];
const rowReflect=b=>b.flatMap((_,i)=>i%9===0?[...b.slice(i,i+9)].reverse():[]);
const reflected=rowReflect(reflectionInput);
assert.equal(core.checkPair(reflectionInput,8,9).ok,true);assert.equal(core.checkPair(reflected,0,17).ok,false);
assert.equal(core.pairs(reflectionInput).length,1);assert.equal(core.pairs(reflected).length,0);
const squareInput=Array.from({length:81},()=>2);squareInput[8]=1;squareInput[9]=9;
const squareReflected=rowReflect(squareInput);assert.equal(core.checkPair(squareInput,8,9).ok,true);assert.equal(core.checkPair(squareReflected,0,17).ok,false);
const zeroA=Array(18).fill(0);zeroA[0]=1;zeroA[1]=2;zeroA[17]=1;
const zeroB=Array(18).fill(0);zeroB[0]=1;zeroB[9]=2;zeroB[10]=1;
assert.deepEqual(zeroA.filter(Boolean),zeroB.filter(Boolean));assert.equal(core.pairs(zeroA).length,0);assert.equal(core.pairs(zeroB).length,1);
const commuteState=state([1,1,2,2]);assert.equal(pairComparison(commuteState,{a:0,b:1},{a:2,b:3}),'COMMUTING');
const compressionInput=[1,0,0,0,0,0,0,0,3,0,0,0,2,2,0,0,0,0,0,0,9],compressionState=state(compressionInput),p={a:0,b:20},q={a:12,b:13},afterP=remove(compressionState,p),afterQ=remove(compressionState,q),qAfterP=byIds(afterP,pairIds(compressionState,q)),pAfterQ=byIds(afterQ,pairIds(compressionState,p));
assert.equal(pairComparison(compressionState,p,q),'DISJOINT_NONCOMMUTING');assert.ok(qAfterP);assert.equal(pAfterQ,null);
const compressionFixture={board:compressionInput,actions:{P:[0,20],Q:[12,13]},values:{P:[1,9],Q:[2,2]},afterP:afterP.board,qAfterP:[qAfterP.a,qAfterP.b],afterPThenQ:remove(afterP,qAfterP).board,afterQ:afterQ.board,pMappedAfterQ:[0,11],pResultAfterQ:core.checkPair(afterQ.board,0,11),relation:'DISJOINT_NONCOMMUTING',claim:'Q empties row 1. Compression changes the P diagonal from dr=2,dc=2 to dr=1,dc=2; the remaining 3 blocks reading order. Thus P;Q is legal but Q;P is not.'};
const counterexamples={rowReflection:{board:reflectionInput,transformed:reflected,originalAction:[8,9],mappedAction:[0,17],originalResult:core.checkPair(reflectionInput,8,9),transformedResult:core.checkPair(reflected,0,17),originalPairs:core.pairs(reflectionInput),transformedPairs:core.pairs(reflected),claim:'Horizontal row reflection does not preserve reading-order edges. Treating both layouts as canonically identical can merge non-equivalent puzzles.'},D4:{board:squareInput,transformed:squareReflected,originalAction:[8,9],mappedAction:[0,17],originalResult:core.checkPair(squareInput,8,9),transformedResult:core.checkPair(squareReflected,0,17),claim:'Even on a full 9x9 square, horizontal reflection (one member of D4) is not a rule symmetry; the full D4 quotient is invalid.'},stripZeros:{boards:[zeroA,zeroB],sameNonzeroSequence:zeroA.filter(Boolean),originalPairs:core.pairs(zeroA),otherPairs:core.pairs(zeroB),claim:'Keeping only nonzero values loses geometry: equal length, occupied count, composition and reading order can still have different diagonal pairs.'},commuting:{board:commuteState.board,actions:[[0,1],[2,3]],relation:'COMMUTING',bothOrdersResult:[],claim:'Two available pairs and two possible action orders do not establish two strategically distinct routes.'},compressionNoncommuting:compressionFixture,indexRemap:remapCase};

// A modest hand-built finite exhaustive panel also includes unsolvable states,
// so correctness is not checked only on guaranteed-winning generator proofs.
const oraclePanel=[];
let rng=0x4f17c2a1;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32;};
for(let n=0;n<64;n++){
  const b=Array(18).fill(0),slots=Array.from({length:18},(_,i)=>i);for(let i=slots.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  const occupied=4+2*(n%4);for(const slot of slots.slice(0,occupied))b[slot]=1+Math.floor(rand()*9);
  // Normalize entirely empty rows without changing any occupied cell order.
  const board=b.slice(0,9).some(Boolean)?b:b.slice(9);if(board.length===18&&!board.slice(9).some(Boolean))board.splice(9);
  const result=oracle(board),product=generator.solveClassic(board,0,CONFIG.branchBudget);assert.equal(!!product,result.status==='FOUND');if(product)validateProof(board,product,0);oraclePanel.push({board,status:result.status,evaluated:result.evaluated});
}
const oracleReports=observed.map(o=>o.report.oracle).filter(Boolean);
const results={source:{repo:'DanilaH/seeds-bits',ref:manifest.ref,execution:'Exact SHA-verified TypeScript source stripped by node:module; no product changes',loader:'load-product.mjs'},config:CONFIG,coverage:{boards:samples.length,states:observed.length,productBranchCalls,branchFOUND:observed.flatMap(o=>o.report.boundedOutcomes).filter(o=>o.status==='FOUND').length,branchUNKNOWN:observed.flatMap(o=>o.report.boundedOutcomes).filter(o=>o.status==='UNKNOWN').length,oracleStates:oracleReports.length,oracleStatesEvaluated:sum(oracleReports.map(o=>o.evaluated)),oracleZeroAddFOUND:oracleReports.filter(o=>o.status==='FOUND').length,oracleZeroAddNO_WIN_PROVEN:oracleReports.filter(o=>o.status==='NO_WIN_PROVEN').length,additionalOraclePanel:{states:oraclePanel.length,FOUND:oraclePanel.filter(p=>p.status==='FOUND').length,NO_WIN_PROVEN:oraclePanel.filter(p=>p.status==='NO_WIN_PROVEN').length,evaluated:sum(oraclePanel.map(p=>p.evaluated))}},groups,equalOpeningCase,branchCase,zeroAddRiskCase,counterexamples,oraclePanel,samples,limits:['Seeds 1..20 are a fixed illustrative sample, not population estimates.','Early/mid/late are offsets on one generator/catalog proof, not all possible human play paths.','At most six deterministic branches per sampled state; FOUND replays to empty through actual core, UNKNOWN is a bounded miss and never a trap label.','No-add oracle negative results exclude only clearing without Add; ordinary gameplay allows Add at zero pairs.','Shared-endpoint and disjoint-noncommuting counts are local structural observations, not independent meaningful-choice counts or human difficulty.','One-step new-edge counts cannot quantify deep planning; compression may create and destroy surviving-cell edges.','No phone/UI/player validation.']};
writeFileSync(path.join(OUT,'choice-results.json'),JSON.stringify(results,null,2)+'\n');
const summary={source:results.source,config:CONFIG,coverage:results.coverage,groups,controlledNormalComparison:equalOpeningCase.boards.map(b=>({id:b.id,opening:b.initialMetrics.pairs,openingSharedEndpointComparisons:b.initialMetrics.pairOfActions.SHARED_ENDPOINT,openingCommutingComparisons:b.initialMetrics.pairOfActions.COMMUTING,afterSeven:b.afterSeven.metrics,additionsAlreadySpent:b.afterSeven.additionsAlreadySpent})),files:{allStates:'choice-results.json',fixtures:'choice-fixtures.json',reproducer:'choice-probe.mjs'},limits:results.limits};
writeFileSync(path.join(OUT,'choice-summary.json'),JSON.stringify(summary,null,2)+'\n');
writeFileSync(path.join(OUT,'choice-fixtures.json'),JSON.stringify({source:results.source,equalOpeningCase,branchCase,zeroAddRiskCase,counterexamples},null,2)+'\n');
console.log(JSON.stringify({source:results.source,coverage:results.coverage,groups,equalOpeningCase:selected,branchCase:branchCase&&{sampleId:branchCase.sampleId,offset:branchCase.proofOffset,branches:branchCase.branches.map(b=>({action:b.action,newPairs:b.newPairs.length,additions:b.proofAdditions}))},remapCase:remapCase&&{sampleId:remapCase.sampleId,action:remapCase.action,falseNew:remapCase.falseNewUnderIndexComparison}},null,2));
