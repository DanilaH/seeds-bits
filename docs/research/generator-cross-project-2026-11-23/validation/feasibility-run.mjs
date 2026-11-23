// Research only; does not write any production path.
import {writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {core, catalog, catalogProofs, manifest, digest, readSource} from './load-product.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const started=performance.now(), deadline=started+120000;
const PROTOCOL={wallBudgetMs:120000,kernelTarget:64,kernelAttemptCap:99999,smallSolverVisits:5000,fixedSeedsPerVariantAndSize:16,illustrationExtraAttemptsPerSize:256,illustrationTargetPerSize:4,targets:[45,81],variants:['literal','padded-unfiltered','padded-verified'],seedNamespace:'feasibility-45-81-v1'};
class BudgetEnd extends Error {}
const checkTime=()=>{if(performance.now()>deadline)throw new BudgetEnd('wall budget exhausted');};
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const puzzlesSource=readSource('src/puzzles.ts');
const expectedSourceHash='export function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }';
if(!puzzlesSource.replace(/\s+/g,' ').includes(expectedSourceHash))throw new Error('Copied FNV1a differs from verified source function');
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const {WIDTH,MAX_CELLS,checkPair,pairs,removePair,occupied,addNumbers}=core;
if(WIDTH!==9||MAX_CELLS!==1800)throw new Error('Unexpected actual-core constraints');
readSource('scripts/generate-classic.mjs');
const indices=b=>b.map((_,i)=>i).filter(i=>b.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean));
const solveCache=new Map();
function solveSmall(initial){
 const key0=initial.join(',');if(solveCache.has(key0))return solveCache.get(key0);
 const dead=new Set();let visits=0,exhausted=false;
 function visit(b){
  if(!occupied(b))return[];
  const key=b.join('');if(dead.has(key))return null;
  if(++visits>PROTOCOL.smallSolverVisits){exhausted=true;return null;}
  if(!(visits%128))checkTime();
  for(const p of pairs(b)){const rest=visit(removePair(b,p.a,p.b));if(rest)return[[p.a,p.b],...rest];}
  dead.add(key);return null;
 }
 const proof=visit(initial),result={proof,visits,exhausted};solveCache.set(key0,result);return result;
}
function shape(board){
 const groups=new Map();return board.map(v=>{if(!v)return'0';if(v===5)return'X';const g=Math.min(v,10-v);if(!groups.has(g))groups.set(g,[groups.size+1,v]);const[n,first]=groups.get(g);return n+(v===first?'a':'b');}).join(',');
}
function replay(board,proof,withTrace=false){
 let b=[...board],pairMoves=0,adds=0,same=0,legacyGapMoves=0,actualGapMoves=0,crossing=0,adjacentIndexMoves=0,rowCollapseMoves=0,peakCells=b.length,opening=pairs(b).length;
 const directions={},addEvents=[],trace=[];
 for(let i=0;i<proof.length;i++){
  const step=proof[i],beforeLength=b.length,beforeOccupied=occupied(b),beforeDigest=digest(b),legalPairs=pairs(b).length;
  if(step===null){
   if(legalPairs!==0)throw new Error('Add while pairs exist');
   b=addNumbers(b,WIDTH,MAX_CELLS);adds++;
   addEvents.push({proofStep:i,afterPairMoves:pairMoves,beforeOccupied,beforeCells:beforeLength,afterCells:b.length});
  }else{
   if(!Array.isArray(step)||step.length!==2)throw new Error('Malformed certificate');
   const[a,z]=step,r=checkPair(b,a,z);if(!r.ok)throw new Error('Illegal certificate move');
   const dr=Math.abs(Math.floor(z/9)-Math.floor(a/9)),dc=Math.abs(z%9-a%9),direction=r.path.kind==='reading'?'reading':!dr?'horizontal':!dc?'vertical':'diagonal';
   directions[direction]=(directions[direction]??0)+1;
   if(Math.max(dr,dc)>1||(r.path.kind==='reading'&&Math.abs(z-a)>1))legacyGapMoves++;
   if(r.path.kind==='reading'?Math.abs(z-a)>1:Math.max(dr,dc)>1)actualGapMoves++;
   if(dr)crossing++;if(Math.abs(z-a)===1)adjacentIndexMoves++;if(b[a]===b[z])same++;
   b=removePair(b,a,z);pairMoves++;if(b.length<beforeLength)rowCollapseMoves++;
  }
  if(b.length>MAX_CELLS)throw new Error('Max-cells exceeded');
  if(b.some(v=>!Number.isInteger(v)||v<0||v>9))throw new Error('Digit contract violated');
  peakCells=Math.max(peakCells,b.length);
  if(withTrace)trace.push({step:i,action:step,legalPairs,beforeDigest,afterDigest:digest(b),beforeOccupied,afterOccupied:occupied(b),beforeLength,afterLength:b.length});
 }
 if(b.length||occupied(b))throw new Error('Certificate not terminal empty');
 return{opening,pairMoves,adds,directions,distinctDirections:Object.keys(directions).length,legacyGapMoves,actualGapMoves,crossing,adjacentIndexMoves,rowCollapseMoves,sameRatio:same/pairMoves,peakCells,addEvents,...withTrace?{trace}:{}};
}
function construct(seed,length,count,kernel,variant){
 const rand=random(seed),board=variant==='literal'?[...kernel]:[...kernel,...Array(length-kernel.length).fill(0)],order=[];
 let candidateChecks=0;
 for(let pair=0;pair<count;pair++){
  checkTime();
  const empty=board.map((v,i)=>v?-1:i).filter(i=>i>=0),candidates=[];
  for(let i=0;i<empty.length;i++)for(let j=i+1;j<empty.length;j++)candidates.push([empty[i],empty[j]]);
  let chosen;
  while(candidates.length){
   if(!(candidateChecks%128))checkTime();candidateChecks++;
   const at=Math.floor(rand()*candidates.length),[a,b]=candidates[at];candidates[at]=candidates.at(-1);candidates.pop();
   board[a]=board[b]=5;
   const ids=indices(board),valid=checkPair(ids.map(i=>board[i]),ids.indexOf(a),ids.indexOf(b)).ok;
   board[a]=board[b]=0;
   if(valid){chosen=[a,b];break;}
  }
  if(!chosen)break;
  const[a,b]=chosen,value=1+Math.floor(rand()*9);board[a]=value;board[b]=rand()<0.5?value:10-value;order.push([a,b]);
 }
 let ids=indices(board),work=ids.map(i=>board[i]);const initial=[...work],proof=[];
 for(const[a,b]of [...order].reverse()){
  const x=ids.indexOf(a),y=ids.indexOf(b);if(!checkPair(work,x,y).ok)throw new Error('Reverse construction mismatch');proof.push([x,y]);
  const blank=[...work];blank[x]=blank[y]=0;ids=ids.filter((_,i)=>blank.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean));work=removePair(work,x,y);
 }
 const info={board:initial,insertedPairs:order.length,candidateChecks,remainingKernel:work,reverseProof:proof};
 if(occupied(work)!==5||pairs(work).length)return{...info,reason:'kernel-no-longer-no-pair'};
 const rest=solveSmall(addNumbers(work,WIDTH,MAX_CELLS));
 if(!rest.proof)return{...info,reason:rest.exhausted?'kernel-solver-UNKNOWN-budget':'kernel-no-winning-route-found',kernelSolveVisits:rest.visits};
 return{...info,proof:[...proof,null,...rest.proof],kernelSolveVisits:rest.visits};
}
function screen(board,m,target){
 const counts=Array.from({length:9},(_,i)=>board.filter(v=>v===i+1).length),failures=[];
 if(board.length!==target||occupied(board)!==target)failures.push('not-dense-target');
 if(counts.filter(Boolean).length<7)failures.push('fewer-than-seven-digits');
 if(Math.max(...counts)>Math.ceil(target*.34))failures.push('digit-concentration');
 if(m.sameRatio<.2||m.sameRatio>.8)failures.push('same-pair-ratio');
 if(m.distinctDirections<3)failures.push('fewer-than-three-directions');
 if(m.actualGapMoves<3)failures.push('fewer-than-three-actual-gap-moves');
 return{pass:failures.length===0,failures,counts};
}
const result={kind:'MODEL_EXECUTION_OFFLINE_RESEARCH',createdAt:new Date().toISOString(),protocol:PROTOCOL,source:manifest,sourceBoundary:{core:'Actual TS executed after type stripping',constructor:'Research reproduction of source reverse insertion; zero padding and verified kernel selection are explicit variants',hash:'FNV1a body checked against byte-verified src/puzzles.ts',nativeViteScriptExecuted:false},protocolSha256:sha(readFileSync(path.join(root,'feasibility-protocol.md'),'utf8')),kernels:{attempts:0,original:[],verifiedFullRow:[],paddingChanges:[]},attempts:[],examples:[],referenceFamilies:[],timings:{},completed:false};
const examplesBySize=new Map([[45,new Set()],[81,new Set()]]);
let phase='kernel-discovery';
try{
 const t=performance.now(),kernels=[];
 for(let seed=1;kernels.length<64&&seed<=PROTOCOL.kernelAttemptCap;seed++){
  checkTime();result.kernels.attempts++;
  const rand=random(hash('classic-kernel-v1:'+seed)),b=Array(35).fill(0);
  for(let row=0;row<4;row++)b[row*9+Math.floor(rand()*(row===3?8:9))]=1+Math.floor(rand()*9);
  while(occupied(b)<5){const i=Math.floor(rand()*b.length);if(!b[i])b[i]=1+Math.floor(rand()*9);}
  if(pairs(b).length)continue;const solved=solveSmall(addNumbers(b));if(!solved.proof)continue;
  kernels.push({id:kernels.length,sourceSeed:seed,board:b,proof:[null,...solved.proof]});
 }
 if(kernels.length!==64)throw new Error('Insufficient source kernels within fixed cap');
 result.kernels.original=kernels;
 const verified=[];
 for(const k of kernels){
  replay(k.board,k.proof);
  const b=[...k.board,0],noPairs=pairs(b).length===0,solve=noPairs?solveSmall(addNumbers(b)):null;
  let unchangedOldProofReplays=true,unchangedOldProofError=null;
  try{replay(b,k.proof);}catch(e){unchangedOldProofReplays=false;unchangedOldProofError=e.message;}
  result.kernels.paddingChanges.push({kernelId:k.id,originalLength:35,paddedSurvivingLength:36,pairs:pairs(b).length,source35ProofReplays:true,unchangedOldProofReplays,unchangedOldProofError,hasReplayedFreshAddProof:!!solve?.proof,solverVisits:solve?.visits??0,solverExhausted:solve?.exhausted??false});
  if(solve?.proof){replay(b,[null,...solve.proof]);verified.push(k);}
 }
 result.kernels.verifiedFullRow=verified.map(k=>k.id);result.timings.kernelDiscoveryAndPaddingMs=performance.now()-t;
 console.log(JSON.stringify({phase:'kernels',attempts:result.kernels.attempts,sourceKernels:kernels.length,paddedVerified:verified.length,elapsedMs:performance.now()-started}));
 if(!verified.length)throw new Error('No source kernel has positive full-row padded proof');
 function attempt(variant,target,n,category){
  const seedText=`${PROTOCOL.seedNamespace}:${category}:${variant}:${target}:${n}`,seed=hash(seedText),pool=variant==='padded-verified'?verified:kernels,kernel=pool[seed%pool.length],t=performance.now();
  const built=construct(seed,target,(target-5)/2,kernel.board,variant),elapsedMs=performance.now()-t;
  const rec={variant,target,n,category,seedText,seed,kernelId:kernel.id,elapsedMs,logicalCells:built.board.length,occupied:occupied(built.board),insertedPairs:built.insertedPairs,requestedPairs:(target-5)/2,candidateChecks:built.candidateChecks,boardSha256:digest(built.board),remainingKernelCells:built.remainingKernel.length,hasCertificate:!!built.proof,reason:built.reason??null};
  if(built.proof){
   const m=replay(built.board,built.proof),s=screen(built.board,m,target);Object.assign(rec,{metrics:m,screen:s});
   if(s.pass){
    const key=shape(built.board),seen=examplesBySize.get(target);
    if(!seen.has(key)&&seen.size<PROTOCOL.illustrationTargetPerSize){
     seen.add(key);result.examples.push({id:`dense-${target}-example-${seen.size}`,constructionFamily:'reverse-pairs-to-five-digit-tail-one-add',variant,target,seedText,seed,kernelId:kernel.id,board:built.board,proof:built.proof,boardSha256:digest(built.board),proofSha256:sha(built.proof),shapeSha256:sha(key),screen:s,replay:replay(built.board,built.proof,true)});
    }
   }
  }
  result.attempts.push(rec);
 }
 phase='fixed-samples';const fixedStart=performance.now();
 for(const variant of PROTOCOL.variants)for(const target of PROTOCOL.targets){
  for(let n=0;n<PROTOCOL.fixedSeedsPerVariantAndSize;n++)attempt(variant,target,n,'fixed');
  const sample=result.attempts.filter(a=>a.variant===variant&&a.target===target&&a.category==='fixed');
  console.log(JSON.stringify({phase,variant,target,count:sample.length,fullyDense:sample.filter(a=>a.logicalCells===target&&a.occupied===target).length,certifiedDense:sample.filter(a=>a.hasCertificate&&a.logicalCells===target&&a.occupied===target).length,screenPass:sample.filter(a=>a.screen?.pass).length,elapsedMs:performance.now()-started}));
 }
 result.timings.fixedSamplesMs=performance.now()-fixedStart;
 phase='illustration-search';const searchStart=performance.now();
 for(const target of PROTOCOL.targets){
  for(let n=0;n<PROTOCOL.illustrationExtraAttemptsPerSize&&examplesBySize.get(target).size<PROTOCOL.illustrationTargetPerSize;n++)attempt('padded-verified',target,n,'illustration-search');
  console.log(JSON.stringify({phase,target,extraAttempts:result.attempts.filter(a=>a.target===target&&a.category==='illustration-search').length,illustrativeCertificates:examplesBySize.get(target).size,elapsedMs:performance.now()-started}));
 }
 result.timings.illustrationSearchMs=performance.now()-searchStart;
 phase='reference-family-replay';const referenceStart=performance.now();
 for(let i=0;i<catalog.length;i++){
  checkTime();const c=catalog[i];if(!['dense','bridges','addition'].includes(c.family))continue;
  const b=typeof c.board==='string'?c.board.split('').map(Number):c.board;
  result.referenceFamilies.push({id:i,family:c.family,logicalCells:b.length,occupied:occupied(b),boardSha256:digest(b),metrics:replay(b,catalogProofs[i])});
 }
 result.timings.referenceReplayMs=performance.now()-referenceStart;result.completed=true;
}catch(e){result.stoppedAtPhase=phase;result.error={name:e.name,message:e.message,stack:e instanceof BudgetEnd?undefined:e.stack};if(!(e instanceof BudgetEnd))process.exitCode=1;}
result.elapsedMs=performance.now()-started;
function range(values){if(!values.length)return null;const s=[...values].sort((a,b)=>a-b);return{n:s.length,min:s[0],p50:s[Math.floor((s.length-1)*.5)],p90:s[Math.floor((s.length-1)*.9)],max:s.at(-1),mean:s.reduce((a,b)=>a+b,0)/s.length};}
result.summaries=[];
for(const category of ['fixed','illustration-search'])for(const variant of PROTOCOL.variants)for(const target of PROTOCOL.targets){
 const a=result.attempts.filter(x=>x.category===category&&x.variant===variant&&x.target===target);if(!a.length)continue;
 const dense=a.filter(x=>x.logicalCells===target&&x.occupied===target),certDense=dense.filter(x=>x.hasCertificate);
 result.summaries.push({category,variant,target,attempts:a.length,fullyDense:dense.length,certifiedDense:certDense.length,screenPass:a.filter(x=>x.screen?.pass).length,occupied:range(a.map(x=>x.occupied)),logicalCells:range(a.map(x=>x.logicalCells)),elapsedMs:range(a.map(x=>x.elapsedMs)),totalElapsedMs:a.reduce((s,x)=>s+x.elapsedMs,0),candidateChecks:range(a.map(x=>x.candidateChecks)),reasons:Object.fromEntries([...new Set(a.map(x=>x.reason??'certified-partial-or-full'))].map(k=>[k,a.filter(x=>(x.reason??'certified-partial-or-full')===k).length])),denseMetrics:Object.fromEntries(['opening','distinctDirections','legacyGapMoves','actualGapMoves','crossing','adjacentIndexMoves','rowCollapseMoves','sameRatio','adds'].map(k=>[k,range(certDense.map(x=>x.metrics[k]))]))});
}
result.referenceSummary=[];
for(const family of ['dense','bridges','addition']){
 const a=result.referenceFamilies.filter(x=>x.family===family);result.referenceSummary.push({family,boards:a.length,metrics:Object.fromEntries(['opening','distinctDirections','legacyGapMoves','actualGapMoves','crossing','adjacentIndexMoves','rowCollapseMoves','sameRatio','adds'].map(k=>[k,range(a.map(x=>x.metrics[k]))]))});
}
result.runnerSha256=sha(readFileSync(fileURLToPath(import.meta.url),'utf8'));
writeFileSync(path.join(root,'feasibility-results.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(path.join(root,'feasibility-examples.json'),JSON.stringify({source:result.source,protocolSha256:result.protocolSha256,runnerSha256:result.runnerSha256,examples:result.examples},null,2)+'\n');
console.log(JSON.stringify({completed:result.completed,error:result.error,elapsedMs:result.elapsedMs,summaries:result.summaries.map(({category,variant,target,attempts,fullyDense,certifiedDense,screenPass,occupied,totalElapsedMs})=>({category,variant,target,attempts,fullyDense,certifiedDense,screenPass,occupied,totalElapsedMs})),examples:result.examples.map(({id,boardSha256,proofSha256,replay:r})=>({id,boardSha256,proofSha256,opening:r.opening,directions:r.directions,actualGapMoves:r.actualGapMoves,legacyGapMoves:r.legacyGapMoves,adds:r.adds,addEvents:r.addEvents}))}));
