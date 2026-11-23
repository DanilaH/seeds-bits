// Independently replay saved example certificates, without the constructor or metrics helper.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {core,digest,manifest} from './load-product.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(path.join(root,'feasibility-examples.json'),'utf8'));
const results=[];
for(const example of data.examples){
 const board=example.board;
 if(board.length!==example.target||!board.every(n=>Number.isInteger(n)&&n>=1&&n<=9))throw Error('Initial field not dense target');
 if(digest(board)!==example.boardSha256)throw Error('Board digest mismatch');
 if(createHash('sha256').update(JSON.stringify(example.proof)).digest('hex')!==example.proofSha256)throw Error('Proof digest mismatch');
 let state=[...board],adds=0,moves=0,peak=state.length;
 const trace=[];
 for(const step of example.proof){
  const beforeDigest=digest(state);
  if(step===null){
   if(core.pairs(state).length!==0)throw Error('Add is not available');
   state=core.addNumbers(state,9,1800);adds++;
  }else{
   const[a,b]=step;if(!core.checkPair(state,a,b,9).ok)throw Error('Illegal pair');state=core.removePair(state,a,b,9);moves++;
  }
  if(state.length>1800)throw Error('Logical board capacity exceeded');
  peak=Math.max(peak,state.length);trace.push({beforeDigest,afterDigest:digest(state)});
 }
 if(state.length!==0)throw Error('Certificate failed to clear field');
 if(trace.length!==example.replay.trace.length||trace.some((t,i)=>t.beforeDigest!==example.replay.trace[i].beforeDigest||t.afterDigest!==example.replay.trace[i].afterDigest))throw Error('Recorded state digest trace mismatch');
 results.push({id:example.id,boardSha256:example.boardSha256,proofSha256:example.proofSha256,dense:true,legal:true,terminalEmpty:true,moves,adds,peakCells:peak,stateDigestTraceMatches:true});
}
const report={kind:'ACTUAL_CORE_SAVED_CERTIFICATE_REPLAY',source:manifest.ref??manifest,exampleCount:results.length,results,limitations:'Certifies this route only; does not imply all choices win, runtime generation reliability, phone timing, or human difficulty.'};
writeFileSync(path.join(root,'feasibility-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
