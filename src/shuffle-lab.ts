import {checkPair,decode,newSession,occupied,pairs,undo,MAX_CELLS,type Session,type Snapshot} from "./core";
import {sameBoard} from "./help-contract";
import fixture from "../fixtures/assistance/magnet-example.json";
export const SHUFFLE_KEY="seeds-bits.lab.shuffle.v1";
export type ShuffleProof={before:number[];after:number[];pair:[number,number]};
export type ShuffleIntent={attempt:string;source:Snapshot;proof:ShuffleProof};
type MockReceipt={version:1;product:"shuffle_1";sequence:number;intent:ShuffleIntent};
export type ShuffleLab={version:1;attempt:string;session:Session;demoUsed:boolean;credit:boolean;lastEarned:number;entitlement?:ShuffleIntent;pending?:MockReceipt};
const clone=(p:ShuffleLab):ShuffleLab=>structuredClone(p);
const digits=(b:readonly number[])=>b.filter(Boolean).sort((a,b)=>a-b);
export function verifyShuffle(proof:ShuffleProof){
 return proof.before.length<=MAX_CELLS&&proof.before.every(n=>Number.isInteger(n)&&n>=0&&n<=9)&&proof.after.every(n=>Number.isInteger(n)&&n>=1&&n<=9)&&!sameBoard(proof.before,proof.after)&&sameBoard(digits(proof.before),digits(proof.after))&&checkPair(proof.after,...proof.pair).ok;
}
export function searchShuffle(board:readonly number[],limit=128,ms=120){
 const start=performance.now();let candidates=0;const finish=(status:"found"|"not_found"|"unknown",proof?:ShuffleProof)=>({status,proof,stats:{candidates,ms:performance.now()-start}});
 if(board.length>MAX_CELLS||!board.every(n=>Number.isInteger(n)&&n>=0&&n<=9))return finish("unknown");
 const compact=board.filter(Boolean);if(!compact.length)return finish("not_found");
 let seed=2166136261;for(const n of board)seed=Math.imul(seed^n,16777619)>>>0;
 for(let run=0;run<128;run++){
  if(candidates>=limit||performance.now()-start>ms)return finish("unknown");candidates++;
  const after=[...compact];
  if(run)for(let i=after.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[after[i],after[j]]=[after[j],after[i]];}
  const pair=pairs(after)[0];if(pair){const proof:ShuffleProof={before:[...board],after,pair:[pair.a,pair.b]};if(verifyShuffle(proof))return finish("found",proof);}
 }
 return finish("not_found");
}
export function freshShuffle():ShuffleLab{return restartShuffle({version:1,attempt:"",session:newSession(),demoUsed:false,credit:false,lastEarned:0});}
export function restartShuffle(p:ShuffleLab):ShuffleLab{const q=clone(p);q.attempt=crypto.randomUUID();q.session={rules:1,current:{board:[...fixture.before],scroll:0,moves:0,additions:0},history:[]};delete q.entitlement;return q;}
export function shuffleIntent(p:ShuffleLab,proof:ShuffleProof):ShuffleIntent{if(!verifyShuffle(proof)||!sameBoard(p.session.current.board,proof.before)||p.entitlement)throw Error("Invalid preview");return {attempt:p.attempt,source:structuredClone(p.session.current),proof:structuredClone(proof)};}
const matches=(p:ShuffleLab,i:ShuffleIntent)=>p.attempt===i.attempt&&sameBoard(p.session.current.board,i.source.board)&&p.session.current.moves===i.source.moves&&p.session.current.additions===i.source.additions&&(p.session.current.assists??0)===(i.source.assists??0);
export function canReplayShuffle(p:ShuffleLab){return Boolean(p.entitlement&&matches(p,p.entitlement));}
export function applyShuffle(p:ShuffleLab,i:ShuffleIntent,scroll=0):ShuffleLab{
 if(!matches(p,i)||!verifyShuffle(i.proof)||!sameBoard(i.source.board,i.proof.before))throw Error("Stale shuffle");
 const q=clone(p);
 if(q.entitlement){if(JSON.stringify(q.entitlement)!==JSON.stringify(i))throw Error("Attempt limit");}
 else{if(q.credit)q.credit=false;else if(!q.demoUsed)q.demoUsed=true;else throw Error("No lab charge");q.entitlement=structuredClone(i);}
 q.session={rules:1,current:{...q.session.current,board:[...i.proof.after],scroll,assists:(q.session.current.assists??0)+1},history:[...q.session.history,{...q.session.current,scroll}]};return q;
}
export function undoShuffle(p:ShuffleLab):ShuffleLab{const q=clone(p);q.session=undo(q.session);return q;}
export function mockShuffleReceipt(p:ShuffleLab,intent:ShuffleIntent):MockReceipt{
 if(p.entitlement||p.pending||p.credit||!p.demoUsed||!matches(p,intent)||!verifyShuffle(intent.proof))throw Error("No mock offer");return {version:1,product:"shuffle_1",sequence:p.lastEarned+1,intent:structuredClone(intent)};
}
export function storeShuffleEarned(p:ShuffleLab,r:MockReceipt):ShuffleLab{
 if(r.version!==1||r.product!=="shuffle_1"||r.sequence<=p.lastEarned)return p;if(r.sequence!==p.lastEarned+1||p.pending&&p.pending.sequence!==r.sequence)throw Error("Invalid mock sequence");const q=clone(p);q.pending=structuredClone(r);return q;
}
export function grantShuffleEarned(p:ShuffleLab):ShuffleLab{if(!p.pending)return p;const q=clone(p);q.credit=true;q.lastEarned=q.pending!.sequence;delete q.pending;return q;}
export function readShuffle(raw:string):ShuffleLab{
 const p=JSON.parse(raw);if(p?.version!==1||typeof p.attempt!=="string"||typeof p.demoUsed!=="boolean"||typeof p.credit!=="boolean"||!Number.isSafeInteger(p.lastEarned)||p.lastEarned<0)throw Error("Protected shuffle save");p.session=decode(JSON.stringify(p.session));
 const intent=(i:ShuffleIntent)=>{if(typeof i?.attempt!=="string"||!verifyShuffle(i.proof)||!sameBoard(i.source.board,i.proof.before))throw Error("Invalid shuffle proof");decode(JSON.stringify({rules:1,current:i.source,history:[]}));};
 if(p.entitlement)intent(p.entitlement);
 if(p.pending){if(p.pending.version!==1||p.pending.product!=="shuffle_1"||p.pending.sequence!==p.lastEarned+1)throw Error("Protected mock receipt");intent(p.pending.intent);}
 return p;
}
export function shuffleCount(p:ShuffleLab){return occupied(p.session.current.board);}
