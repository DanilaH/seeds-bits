import {addNumbers,checkPair,commit,decode,newSession,occupied,pairs,removePair,undo,type Session} from "./core";
import tasks from "../fixtures/lab/trials.json";
import {sameBoard} from "./help-contract";
export const trialTasks=tasks;
export const TRIAL_KEY="seeds-bits.lab.trials.v1";
type BonusProof={before:number[];after:number[];pair:[number,number]};
type MockReceipt={version:1;product:"trial_add_1";sequence:number;attempt:string;proof:BonusProof};
export type Trials={version:1;task:string;attempt:string;session:Session;bonus:boolean;lastEarned:number;rewardClaimed:boolean;entitlement?:BonusProof;pending?:MockReceipt};
const clone=(p:Trials):Trials=>structuredClone(p);
export function freshTrials():Trials{return startTrial({version:1,task:"trial-1",attempt:"",session:newSession(),bonus:false,lastEarned:0,rewardClaimed:false},"trial-1");}
export function startTrial(p:Trials,id:string):Trials{
 const task=tasks.find(t=>t.id===id);if(!task)throw Error("Unknown trial");
 const q=clone(p);q.task=id;q.attempt=crypto.randomUUID();q.session={rules:1,current:{board:[...task.board],scroll:0,moves:0,additions:0},history:[]};q.rewardClaimed=false;delete q.entitlement;return q;
}
export function trialStopped(p:Trials){return occupied(p.session.current.board)>0&&!pairs(p.session.current.board).length&&p.session.current.additions>=2;}
export function trialBonusProof(p:Trials):BonusProof|undefined{
 if(!trialStopped(p)||p.entitlement)return;
 try{const after=addNumbers(p.session.current.board),pair=pairs(after)[0];if(pair)return {before:[...p.session.current.board],after,pair:[pair.a,pair.b]};}catch{}
}
export function trialPair(p:Trials,a:number,b:number,scroll=0):Trials{
 if(!checkPair(p.session.current.board,a,b).ok)throw Error("Illegal pair");const q=clone(p);q.session=commit(q.session,removePair(q.session.current.board,a,b),"pair",scroll);return q;
}
export function trialAdd(p:Trials,scroll=0):Trials{
 const before=p.session.current.board;
 if(p.session.current.additions>=2){
  if(!p.entitlement||!sameBoard(before,p.entitlement.before)||p.session.current.additions!==2)throw Error("No Add budget");
  const q=clone(p);q.session=commit(q.session,addNumbers(before),"add",scroll);return q;
 }
 const q=clone(p);q.session=commit(q.session,addNumbers(before),"add",scroll);return q;
}
export function trialUndo(p:Trials):Trials{const q=clone(p);q.session=undo(q.session);return q;}
export function mockTrialReceipt(p:Trials):MockReceipt{
 const proof=trialBonusProof(p);if(!proof||p.rewardClaimed||p.bonus||p.pending)throw Error("No rewarded offer");
 return {version:1,product:"trial_add_1",sequence:p.lastEarned+1,attempt:p.attempt,proof};
}
export function storeTrialEarned(p:Trials,r:MockReceipt):Trials{
 if(r.version!==1||r.product!=="trial_add_1"||r.sequence<=p.lastEarned)return p;
 if(r.sequence!==p.lastEarned+1||p.pending&&p.pending.sequence!==r.sequence)throw Error("Out of order mock receipt");
 const q=clone(p);q.pending=structuredClone(r);return q;
}
export function grantTrialEarned(p:Trials):Trials{
 if(!p.pending)return p;const q=clone(p),r=q.pending!;
 if(r.sequence>q.lastEarned){q.bonus=true;q.lastEarned=r.sequence;if(q.attempt===r.attempt)q.rewardClaimed=true;}
 delete q.pending;return q;
}
export function applyTrialBonus(p:Trials,scroll=0):Trials{
 const proof=trialBonusProof(p);if(!proof||!p.bonus)throw Error("No useful bonus");
 const q=clone(p);q.bonus=false;q.entitlement=proof;q.session=commit(q.session,proof.after,"add",scroll);return q;
}
export function readTrials(raw:string):Trials{
 const p=JSON.parse(raw);
 if(p?.version!==1||!tasks.some(t=>t.id===p.task)||typeof p.attempt!=="string"||typeof p.bonus!=="boolean"||typeof p.rewardClaimed!=="boolean"||!Number.isSafeInteger(p.lastEarned)||p.lastEarned<0)throw Error("Protected trial save");
 p.session=decode(JSON.stringify(p.session));if(p.session.current.additions>3)throw Error("Invalid Add budget");
 const proof=(v:BonusProof)=>{if(!v||!Array.isArray(v.before)||!Array.isArray(v.after)||!Array.isArray(v.pair))throw Error("Invalid bonus proof");const after=addNumbers(v.before);if(!sameBoard(after,v.after)||!checkPair(after,...v.pair).ok)throw Error("Invalid bonus proof");};
 if(p.entitlement)proof(p.entitlement);
 if(p.pending){if(p.pending.version!==1||p.pending.product!=="trial_add_1"||!Number.isSafeInteger(p.pending.sequence)||p.pending.sequence!==p.lastEarned+1||typeof p.pending.attempt!=="string")throw Error("Protected mock receipt");proof(p.pending.proof);}
 return p;
}
