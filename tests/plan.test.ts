import {test,expect} from "vitest";
import {fresh,helpProfile,serializeProgress,readProgress,recordCompletion} from "../src/progress";
import {hintAttempt} from "../src/hint-budget";
import {searchHelp,verifyHelpProof} from "../src/help-search";
import {helpIntent,applyPlan,planPosition,planBoards} from "../src/help-actions";
import {commit,removePair,undo} from "../src/core";
const board=[5,5,0,0,0,0,0,0,0,7,3,2,8];
const limits={candidates:128,nodes:4000,ms:2000};
function setup(){const p=fresh();p.sessions.classic.current.board=[...board];hintAttempt(p).help={version:1,assisted:false};return p;}
function found(){const r=searchHelp(board,"plan",limits);expect(r.status).toBe("found");return r.proof!;}
test("P01/02: full goal from current board, no single ordinary move sold as a premium plan",()=>{
  const proof=found();expect(proof.path).toHaveLength(3);expect(proof.goal).toBe("clear");expect(verifyHelpProof(board,proof,"plan")).toBe(true);
  expect(searchHelp([5,5],"plan",limits).status).toBe("not_found");
  const trivial=[5,5,0,0,0,0,0,0,0,1,1,3];
  const r=searchHelp(trivial,"plan",limits);expect(r.proof?.goal).not.toBe("row");
});
test("P05/06/09: one charge pays the entire path, row compaction, Undo and reload resume without another debit",()=>{
  let p=setup();helpProfile(p).inventory.plan=2;helpProfile(p).demo.plan=true;
  const intent=helpIntent(p,"plan",found());p=applyPlan(p,intent).progress;
  expect(helpProfile(p).inventory.plan).toBe(1);expect(planBoards(intent)?.at(-1)).toEqual([]);
  const first=planPosition(p)!.pair!;
  p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,first.a,first.b),"pair",9);
  p=readProgress(serializeProgress(p));expect(planPosition(p)!.index).toBe(1);
  expect(applyPlan(p,intent).duplicate).toBe(true);expect(helpProfile(p).inventory.plan).toBe(1);
  p.sessions.classic=undo(p.sessions.classic);expect(planPosition(p)!.index).toBe(0);
  for(const pair of intent.proof!)p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,...pair),"pair",0);
  expect(planPosition(p)!.complete).toBe(true);recordCompletion(p,"classic");expect(p.meta!.unassisted).toBe(0);
});
test("P03/04/07: invalid/stale proof or different branch never causes a new debit or automatic undo",()=>{
  const p=setup(),intent=helpIntent(p,"plan",found());
  expect(Object.isFrozen(intent)).toBe(true);expect(Object.isFrozen(intent.proof![0])).toBe(true);
  const paid=applyPlan(p,intent).progress;
  // Remove the last pair first: a legal player deviation from the frozen plan.
  paid.sessions.classic=commit(paid.sessions.classic,removePair(board,11,12),"pair",0);
  const current=[...paid.sessions.classic.current.board];expect(planPosition(paid)!.index).toBe(-1);
  expect(()=>applyPlan(paid,intent)).toThrow();expect(paid.sessions.classic.current.board).toEqual(current);
  paid.sessions.classic=undo(paid.sessions.classic);expect(planPosition(paid)!.index).toBe(0);
  const stale=setup();stale.sessions.classic.current.board=[5,5];expect(()=>applyPlan(stale,intent)).toThrow();
  expect(searchHelp(board,"plan",{candidates:0,nodes:0,ms:0}).status).toBe("unknown");
});
test("P10: preview constructs a proof without a debit or assisted marker; demo survives a new attempt",()=>{
  const p=setup(),before=serializeProgress(p),intent=helpIntent(p,"plan",found());expect(serializeProgress(p)).toBe(before);
  expect(hintAttempt(p).help!.assisted).toBe(false);const applied=applyPlan(p,intent).progress;
  const q=readProgress(serializeProgress(applied));expect(helpProfile(q).demo.plan).toBe(true);expect(hintAttempt(q).help!.assisted).toBe(true);
  expect(helpProfile(q).demo.magnet).toBe(false);expect(q.meta!.wallet).toBe(0);
});
