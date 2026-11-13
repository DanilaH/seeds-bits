import {test, expect} from "vitest";
import fixture from "../fixtures/assistance/magnet-example.json";
import {checkPair, removePair, pairs, commit, undo, addNumbers, newSession} from "../src/core";
import {searchHelp, removeMagnetPair, verifyHelpProof, type HelpProof} from "../src/help-search";
import {helpIntent, applyMagnet, storedHelp} from "../src/help-actions";
import {fresh, helpProfile, metadata, readProgress, serializeProgress, recordCompletion, startAttempt} from "../src/progress";
import {hintAttempt} from "../src/hint-budget";
import {jars, collectPair} from "../src/jars";
function position() {
  const p=fresh();p.sessions.classic.current.board=[...fixture.start];
  for(const [a,b] of fixture.normal_prefix)p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,a,b),"pair",17);
  hintAttempt(p).help={version:1,assisted:false};
  const j=jars(p);j.highWater=p.sessions.classic.current.moves;j.attempt=hintAttempt(p).id;
  return p;
}
const limits={candidates:128,nodes:4000,ms:2000};
function candidate() {const result=searchHelp(fixture.before,"magnet",limits);expect(result.status).toBe("found");return result.proof!;}
test("M01: independent supplied fixture and exact ordinary continuation",()=>{
  expect(pairs(fixture.before)).toEqual([]);expect(checkPair(fixture.before,3,14)).toEqual(fixture.ordinary_rejection);
  expect(()=>removePair(fixture.before,3,14)).toThrow();
  const after=removeMagnetPair(fixture.before,3,14);expect(after).toEqual(fixture.after_magnet);
  let board=after;for(const step of fixture.normal_continuation){expect(board).toEqual(step.before);expect(checkPair(board,...step.pair as [number,number]).ok).toBe(true);board=removePair(board,...step.pair as [number,number]);expect(board).toEqual(step.after);}
  expect(board).toEqual([]);expect(candidate().goal).toBe("clear");
});
test.each([[3,3],[0,14],[2,3],[4,15]])("M02/03 invalid or ordinary pair %j cannot be a Magnet",(a,b)=>{
  // [4,15] is only ordinary after the real magnet, so use that board for this control.
  const board=a===4?fixture.after_magnet:fixture.before;
  expect(()=>removeMagnetPair(board,a,b)).toThrow();
});
test("M05/06: proof is rechecked, unknown is not absence, legal pairs are never sold",()=>{
  const proof=candidate();expect(verifyHelpProof(fixture.before,proof,"magnet")).toBe(true);
  expect(verifyHelpProof(fixture.before,{...proof,after:[5,5]},"magnet")).toBe(false);
  expect(searchHelp(fixture.before,"magnet",{candidates:0,nodes:0,ms:0}).status).toBe("unknown");
  expect(searchHelp([5,5],"magnet",limits).status).toBe("not_found");
});
test("M08–16: demo, undo, exact replay, idempotency, branching and stock survive the actual wire",()=>{
  const p=position(), before=serializeProgress(p), intent=helpIntent(p,"magnet",candidate());
  const applied=applyMagnet(p,intent,intent.id+":1",71.5);
  expect(serializeProgress(p)).toBe(before); // constructing a candidate is not a debit.
  let q=readProgress(serializeProgress(applied.progress));
  expect(helpProfile(q).demo.magnet).toBe(true);expect(q.sessions.classic.current.moves).toBe(6);
  expect(q.sessions.classic.current.assists).toBe(1);expect(jars(q).highWater).toBe(6);expect(jars(q).seeds).toBe(jars(p).seeds);
  expect(applyMagnet(q,intent,intent.id+":1",0).duplicate).toBe(true);
  q.sessions.classic=undo(q.sessions.classic);expect(q.sessions.classic.current.board).toEqual(fixture.before);
  expect(q.sessions.classic.current.scroll).toBe(71.5);expect(hintAttempt(q).help?.assisted).toBe(true);
  expect(storedHelp(q,intent)).toBe("replay");
  const replay=applyMagnet(q,intent,intent.id+":2",71.5);expect(replay.source).toBe("replay");
  q=readProgress(serializeProgress(replay.progress));expect(helpProfile(q).inventory.magnet).toBe(0);
  q.sessions.classic=undo(q.sessions.classic);q.sessions.classic=commit(q.sessions.classic,addNumbers(fixture.before),"add",4);
  q=readProgress(serializeProgress(q));expect(()=>applyMagnet(q,intent,intent.id+":3",0)).toThrow();
  q.sessions.classic=undo(q.sessions.classic);expect(storedHelp(q,intent)).toBe("replay");
  startAttempt(q,"classic");hintAttempt(q).help={version:1,assisted:false};expect(helpProfile(q).demo.magnet).toBe(true);
  const next=helpIntent(q,"magnet",candidate());expect(storedHelp(q,next)).toBeUndefined();
});
test("M09/17: stored charge is separate, completion is assisted and ordinary high-water cannot be farmed",()=>{
  let p=position();helpProfile(p).demo.magnet=true;helpProfile(p).inventory.magnet=2;
  const intent=helpIntent(p,"magnet",candidate());p=applyMagnet(p,intent,intent.id+":1",0).progress;
  expect(helpProfile(p).inventory.magnet).toBe(1);
  for(const step of fixture.normal_continuation){p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,...step.pair as [number,number]),"pair",0);collectPair(p,p.sessions.classic.current.moves);}
  const seeds=jars(p).seeds;recordCompletion(p,"classic");expect(metadata(p).completed).toBe(1);expect(metadata(p).unassisted).toBe(0);
  p.sessions.classic=undo(p.sessions.classic);const pair=fixture.normal_continuation.at(-1)!.pair as [number,number];
  p.sessions.classic=commit(p.sessions.classic,removePair(p.sessions.classic.current.board,...pair),"pair",0);expect(collectPair(p,p.sessions.classic.current.moves)).toBe(0);expect(jars(p).seeds).toBe(seeds);
});
test("M18: legacy unfinished attempts are not retroactively eligible",()=>{
  const p=position();delete hintAttempt(p).help;
  const q=readProgress(serializeProgress(p));expect(hintAttempt(q).help).toBeUndefined();expect(()=>helpIntent(q,"magnet",candidate())).toThrow();
});
test("M04: full and partial row compaction keeps the real core semantics",()=>{
  // A forbidden diagonal with an occupied blocker between two rows.
  for(const board of [[1,0,0,0,0,0,0,0,0,2,1],[1,2,0,0,0,0,0,0,0,1]]){
    for(let a=0;a<board.length;a++)for(let b=a+1;b<board.length;b++)if(board[a]&&board[b]&&(board[a]===board[b]||board[a]+board[b]===10)&&!checkPair(board,a,b).ok){
      const expected=[...board];expected[a]=expected[b]=0;
      const rows=[];for(let i=0;i<expected.length;i+=9)if(expected.slice(i,i+9).some(Boolean))rows.push(...expected.slice(i,i+9));
      expect(removeMagnetPair(board,a,b)).toEqual(rows);
    }
  }
});

test("old application callbacks remain idempotent after the bounded log rolls over",()=>{
  let p=position();const intent=helpIntent(p,"magnet",candidate());
  for(let i=1;i<=40;i++){p=applyMagnet(p,intent,`${intent.id}:${i}`,0).progress;p.sessions.classic=undo(p.sessions.classic);}
  expect(hintAttempt(p).help!.magnet!.applications).toHaveLength(32);
  expect(applyMagnet(p,intent,`${intent.id}:1`,0).duplicate).toBe(true);
  expect(p.sessions.classic.current.board).toEqual(fixture.before);expect(helpProfile(p).demo.magnet).toBe(true);
});
