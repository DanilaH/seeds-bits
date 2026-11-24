import { beforeAll, expect, test } from "vitest";
import { checkPair, commit, MAX_CELLS, occupied, removePair, undo } from "../src/core";
import { continueV5Daily, dailyV5Size, packV5, replayV5, survivingIndices } from "../src/content-v5-generator";
import { bookV5, loadBookV5 } from "../src/content-v5";
import { bookV4 } from "../src/content-v4";
import { bookRevisionFor, dailyIdFor, dailyV5Index } from "../src/content-ids";
import { dailyForTask, loadNotebook, notebook, notebookForTask, puzzleSession, trophy } from "../src/puzzles";
import { fresh, helpProfile, metadata, ProtectedContentProgress, FutureProgress, readProgress, recordCompletion, serializeProgress, startAttempt } from "../src/progress";
import { jars } from "../src/jars";
import { createSolver } from "../src/solver";

beforeAll(async () => {
  await loadNotebook();
  await Promise.all([1, 601, 1201, 1801].map(n => loadBookV5("book-v1-" + n)));
});

test.each([[63,64],[63,107],[64,107],[0,MAX_CELLS-1]])("v5 integer witness round-trips indices %d and %d", (a,b) => {
  const board = Array<number>(b+1).fill(0);
  board[a] = board[b] = 5;
  const checked = checkPair(board,a,b);
  if (!checked.ok) throw Error("Invalid fixture");
  const field = {board,solution:[checked.path]};
  expect(replayV5(packV5(field))).toEqual(field);
  expect(survivingIndices(board)).toContain(b);
  expect(() => replayV5([board.join(""),[a,b+1]])).toThrow();
});

test("version 8 pins survive v5 assignment with both distant legacy sessions and full undo", () => {
  const profile = fresh();
  const ids = ["book-v1-78","book-v1-2400"];
  profile.bookRevisions = Object.fromEntries(ids.map(id=>[id,1]));
  for (const [i,id] of ids.entries()) {
    const old = notebook.find(p=>p.id===id)!;
    let game = puzzleSession(old);
    for (const [step,move] of old.solution.slice(0,3).entries())
      game = commit(game,removePair(game.current.board,move.a,move.b),"pair",47+i+step);
    profile.sessions[id]=game;
  }
  profile.active=ids[1];
  profile.done=["book-v1-36","daily-v1-2026-12-24"];
  profile.hints={"book-v1-49":1};
  const daily = dailyForTask("daily-v4-2026-12-25")!;
  profile.sessions[daily.id]=puzzleSession(daily);
  const meta=metadata(profile);
  meta.wallet=37;
  meta.daily={lastDay:"2026-12-24",count:7,best:8,reward:3};
  meta.attempts["book-v1-51"]={id:"seen",completed:false};
  const help=helpProfile(profile);
  help.inventory={magnet:4,plan:3};
  help.grant={token:"retained-receipt",intent:"retained-intent",product:"plan_1"};
  const classic=meta.attempts.classic={id:"legacy",completed:false,help:{version:1 as const,assisted:true,
    magnet:{id:"earned", applications:["old-use"], applicationSequence:1, intent:{version:1 as const,id:"paid",offer:"offer",
      product:"magnet_1" as const,task:"classic",attempt:"legacy",rules:1 as const,algorithm:"magnet-v1",
      board:[5,5,4,6],pair:[0,1] as [number,number],after:[4,6]}}}};
  jars(profile).seeds=204;
  const oldWire=JSON.parse(serializeProgress(profile));
  expect(oldWire.version).toBe(8);
  delete oldWire.dailyAssignments; // infer this ID from the actual v4 session
  const migrated=readProgress(JSON.stringify(oldWire));
  expect(migrated.sessions).toEqual(profile.sessions);
  expect(migrated.done).toEqual(profile.done);
  expect(migrated.hints).toEqual(profile.hints);
  expect(dailyIdFor("2026-12-25",migrated)).toBe(daily.id);
  expect(dailyIdFor("2026-12-26",migrated)).toBe("daily-v5-2026-12-26");
  expect(helpProfile(migrated)).toEqual(help);
  expect(metadata(migrated).attempts.classic).toEqual(classic);
  expect(metadata(migrated).daily).toEqual(meta.daily);
  expect(metadata(migrated).wallet).toBe(37);
  expect(jars(migrated)).toEqual(jars(profile));
  expect(migrated.bookRevisions).toMatchObject({"book-v1-36":1,"book-v1-49":1,"book-v1-51":1});
  for (const id of ids) {
    expect(undo(migrated.sessions[id])).toEqual(undo(profile.sessions[id]));
    expect(notebookForTask(id,migrated)).toEqual(notebook.find(p=>p.id===id));
  }

  const newId="book-v1-2397", task=bookV5(newId)!;
  expect(occupied(task.board)).toBe(108);
  expect(bookRevisionFor(newId,migrated)).toBe(5);
  migrated.active=newId;
  migrated.bookRevisions![newId]=5;
  migrated.sessions[newId]=puzzleSession(task);
  startAttempt(migrated,newId);
  const solver=createSolver(0,task);
  for (const move of task.solution) {
    const session=migrated.sessions[newId];
    expect(solver(session.current.board).kind).toBe("move");
    migrated.sessions[newId]=commit(session,removePair(session.current.board,move.a,move.b),"pair",110);
  }
  expect(recordCompletion(migrated,newId).seeds).toBeGreaterThan(0);
  const wire=serializeProgress(migrated);
  expect(JSON.parse(wire).version).toBe(9);
  const restored=readProgress(wire);
  expect(restored.sessions).toEqual(migrated.sessions);
  expect(restored.bookRevisions![newId]).toBe(5);
  const seeds=jars(restored).seeds;
  startAttempt(restored,newId);
  expect(recordCompletion(restored,newId).seeds).toBe(0);
  expect(jars(restored).seeds).toBe(seeds);

  const pinned=fresh();
  pinned.bookRevisions={[newId]:4};
  pinned.sessions[newId]=puzzleSession(bookV4(newId)!);
  const stillV4=readProgress(serializeProgress(pinned));
  expect(notebookForTask(newId,stillV4)).toEqual(bookV4(newId));
  expect(notebookForTask(newId,stillV4)).not.toEqual(task);
});

test("wire identity conflicts and bad revisions fail closed", () => {
  const id="book-v1-79", day="2026-12-25";
  const profile=fresh();
  profile.bookRevisions={[id]:5};
  profile.hints[id]=2;
  profile.dailyAssignments={[day]:"daily-v5-"+day};
  const raw=JSON.parse(serializeProgress(profile));
  expect(raw.version).toBe(9);
  const missing={...raw,bookRevisions:{}};
  expect(()=>readProgress(JSON.stringify(missing))).toThrow(ProtectedContentProgress);
  expect(()=>readProgress(JSON.stringify({...raw,bookRevisions:{[id]:6}}))).toThrow(ProtectedContentProgress);
  expect(()=>readProgress(JSON.stringify({...raw,done:["daily-v4-"+day]}))).toThrow(ProtectedContentProgress);
  expect(()=>readProgress(JSON.stringify({...raw,dailyAssignments:{[day]:"daily-v5-2026-12-26"}}))).toThrow(ProtectedContentProgress);
  expect(()=>readProgress(JSON.stringify({...raw,version:10}))).toThrow(FutureProgress);
  expect(()=>readProgress(JSON.stringify({...raw,version:8}))).toThrow(ProtectedContentProgress);
});

test("a daily date is one reward across v1, v4 and v5 aliases",()=>{
  const p=fresh(),day="2026-12-25";
  for (const rev of [4,5,1]) {
    const id=`daily-v${rev}-${day}`;
    p.sessions[id]=puzzleSession(dailyForTask(id)!);
    startAttempt(p,id);
    const reward=recordCompletion(p,id,day);
    expect(rev===4 ? reward.seeds>0 : reward.seeds===0).toBe(true);
  }
  expect(trophy("2026-12",p.done).count).toBe(1);
});

test("the new schedule has 52 banked long dates, leap and post-bank deterministic proofs",()=>{
  const long=[];
  for(let i=0;i<365;i++) {
    const d=new Date(Date.UTC(2026,11,25+i)).toISOString().slice(0,10);
    const n=occupied(dailyForTask("daily-v5-"+d)!.board);
    expect(n).toBe(dailyV5Size(i));
    if (n>=38) long.push(n);
  }
  expect(long).toHaveLength(52);
  expect(new Set(long).size).toBe(9);
  for (const d of ["2027-12-25","2028-02-29","2028-12-31","2029-01-01","2100-03-01","2400-02-29"]) {
    const generated=continueV5Daily(d,dailyV5Index(d));
    expect(replayV5(packV5(generated))).toEqual(dailyForTask("daily-v5-"+d) && {
      board:dailyForTask("daily-v5-"+d)!.board, solution:dailyForTask("daily-v5-"+d)!.solution,
    });
  }
});
