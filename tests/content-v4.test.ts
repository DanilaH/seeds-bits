import {test,expect,beforeAll} from "vitest";
import {readFileSync} from "node:fs";
import * as core from "../src/core";
import {bookV5,loadBookV5} from "../src/content-v5";
import {bookV4,bookV4Count,dailyV4Count} from "../src/content-v4";
import {pilotBooks,pilotDaily} from "../src/content-pilot";
import {notebook,loadNotebook,notebookForTask,daily,dailyForTask,futureDailyV4,puzzleSession,trophy} from "../src/puzzles";
import {bookRevisionFor,dailyIdFor,dailyDone,DAILY_V4_START,DAILY_V4_BANK_END} from "../src/content-ids";
import {fresh,readProgress,serializeProgress,metadata,helpProfile,startAttempt,recordCompletion,FutureProgress} from "../src/progress";
import {jars} from "../src/jars";
import {dailyRun} from "../src/daily-run";
import {createSolver} from "../src/solver";
const {checkPair,removePair,occupied,commit,undo}=core;
const root="docs/research/daily-notebook-design-2026-11-24/catalogue-v4/";
const dayAt=(i:number,base=DAILY_V4_START)=>new Date(Date.parse(base+"T12:00:00Z")+i*86400000).toISOString().slice(0,10);
const canonical=(b:readonly number[])=>{
 const m=new Map<number,number>();
 return b.map(d=>{if(!d||d===5)return d;if(!m.has(d)){const n=m.size/2+1;m.set(d,n);m.set(10-d,10-n)}return m.get(d)}).join("");
};
const mask=(b:readonly number[])=>b.map(Boolean).map(Number).join("");
beforeAll(loadNotebook);
test("all 2765 frozen starts replay on the shipped core, match author records and exclude full historical catalogues", {timeout:120000},()=>{
 expect(bookV4Count).toBe(2400);expect(dailyV4Count).toBe(365);
 const prior=[...notebook.slice(0,2400),...pilotBooks,...Array.from({length:24},(_,i)=>pilotDaily("daily-v3-2026-12-"+String(i+1).padStart(2,"0"))!)];
 for(let d="2025-01-01";d<="2027-12-31";d=dayAt(1,d))prior.push(daily(d));
 const keys=new Set(prior.map(p=>canonical(p.board))), masks=new Set(prior.map(p=>mask(p.board)));
 const bank=[...Array.from({length:2400},(_,i)=>bookV4("book-v1-"+(i+1))!),...Array.from({length:365},(_,i)=>dailyForTask("daily-v4-"+dayAt(i))!)];
 const records=["books-1","books-2","books-3","books-4","daily-365"].flatMap(p=>JSON.parse(readFileSync(root+p+".json","utf8")));
 expect(records.length).toBe(bank.length);
 let moves=0;const profiles:Record<string,number>={};
 for(const [i,p] of bank.entries()){
  const row=records[i];
  expect(p.board.join(""),p.id).toBe(row[0]);
  expect(occupied(p.board),p.id).toBe(row[5]);
  expect(p.board.length,p.id).toBe(row[6]*9);
  expect(occupied(p.board)).toBeGreaterThanOrEqual(12);
  expect(occupied(p.board)).toBeLessThanOrEqual(26);
  expect(keys.has(canonical(p.board)),p.id).toBe(false);
  expect(masks.has(mask(p.board)),p.id).toBe(false);
  keys.add(canonical(p.board));masks.add(mask(p.board));
  const hint=createSolver(0,p);let b=p.board;
  for(const step of p.solution){
   expect(checkPair(b,step.a,step.b).ok,p.id).toBe(true);
   expect(hint(b).kind,p.id).toBe("move");
   b=removePair(b,step.a,step.b);moves++;
  }
  expect(b,p.id).toEqual([]);
  expect(row[7]).toBeGreaterThanOrEqual(2);
  expect(core.pairs(p.board).length).toBe(row[8]);
  profiles[row[2]]=(profiles[row[2]]??0)+1;
 }
 expect(moves).toBe(23611);
 expect(profiles).toEqual({flow:939,moderate:1274,tactical:552});
});
test.each([2,3,4,5,6,7])("legacy wire %i keeps exact boards, undo, completed/replay identities and earned rights",async version=>{
 const p=fresh(),old=notebook[77],m=old.solution[0];
 p.active=old.id;p.sessions[old.id]=commit(puzzleSession(old),removePair(old.board,m.a,m.b),"pair",77);
 p.done=["book-v1-1","book-v1-2400","daily-v1-2026-12-25"];
 p.hints["book-v1-4"]=2;
 metadata(p).attempts["book-v1-24"]={id:"historic",completed:false};
 metadata(p).wallet=19;helpProfile(p).inventory.magnet=4;helpProfile(p).inventory.plan=2;
 jars(p).seeds=321;jars(p).meter=321;
 metadata(p).daily={lastDay:"2026-12-25",count:7,best:7,reward:3};
 const raw=version<4?{...p,version}:{...JSON.parse(serializeProgress(p)),version};
 delete raw.bookRevisions;delete raw.dailyAssignments;
 const q=readProgress(JSON.stringify(raw));
 expect(q.active).toBe(old.id);expect(q.sessions[old.id]).toEqual(p.sessions[old.id]);
 expect(undo(q.sessions[old.id]).current.board).toEqual(old.board);
 expect(q.done).toEqual(p.done);expect(q.hints).toEqual(p.hints);
 expect(q.bookRevisions).toMatchObject({[old.id]:1,"book-v1-1":1,"book-v1-2400":1,"book-v1-4":1,"book-v1-24":1});
 expect(notebookForTask(old.id,q)).toEqual(old);
 expect(notebookForTask("book-v1-2400",q)).toEqual(notebook[2399]);
 await loadBookV5("book-v1-79");
 expect(notebookForTask("book-v1-79",q)).toEqual(bookV5("book-v1-79"));
 expect(dailyIdFor("2026-12-25",q)).toBe("daily-v1-2026-12-25");
 expect(metadata(q).wallet).toBe(19);expect(helpProfile(q).inventory).toEqual(helpProfile(p).inventory);
 expect(jars(q)).toEqual(jars(p));expect(metadata(q).daily).toEqual(metadata(p).daily);
 const wire=serializeProgress(q);expect(JSON.parse(wire).version).toBe(8);
 const restored=readProgress(wire);
 expect(restored.sessions).toEqual(q.sessions);expect(restored.bookRevisions).toEqual(q.bookRevisions);expect(restored.dailyAssignments).toEqual(q.dailyAssignments);
});
test("previously assigned logical slot keeps v4; reload, undo, restart and replay keep the same reward identity",()=>{
 const p=fresh(),id="book-v1-2400";
 p.bookRevisions={[id]:4};
 const task=notebookForTask(id,p)!;
 expect(notebookForTask("book-v1-1",p)).toEqual(notebook[0]);
 expect(bookRevisionFor(id,p)).toBe(4);
 expect(task).toEqual(bookV4(id));expect(task.board).not.toEqual(notebook[2399].board);
 p.bookRevisions={[id]:4};p.active=id;p.sessions[id]=puzzleSession(task);startAttempt(p,id);
 const step=task.solution[0];p.sessions[id]=commit(p.sessions[id],removePair(task.board,step.a,step.b),"pair",5);
 const wire=serializeProgress(p),q=readProgress(wire);
 expect(JSON.parse(wire).version).toBe(8);expect(q.sessions[id]).toEqual(p.sessions[id]);
 expect(undo(q.sessions[id]).current.board).toEqual(task.board);expect(notebookForTask(id,q)).toEqual(task);
 q.sessions[id]=puzzleSession(notebookForTask(id,q)!);startAttempt(q,id);
 for(const step of task.solution)q.sessions[id]=commit(q.sessions[id],removePair(q.sessions[id].current.board,step.a,step.b),"pair",0);
 const gain=recordCompletion(q,id);expect(gain.seeds).toBeGreaterThan(0);
 const r=readProgress(serializeProgress(q));const seeds=jars(r).seeds;
 startAttempt(r,id);expect(recordCompletion(r,id).seeds).toBe(0);expect(jars(r).seeds).toBe(seeds);expect(r.done).toEqual([id]);
 const bad=JSON.parse(wire);delete bad.bookRevisions;
 expect(()=>readProgress(JSON.stringify(bad))).toThrow(FutureProgress);
 bad.bookRevisions={[id]:99};expect(()=>readProgress(JSON.stringify(bad))).toThrow(FutureProgress);
 bad.bookRevisions={[id]:4};bad.version=10;expect(()=>readProgress(JSON.stringify(bad))).toThrow(FutureProgress);
});
test("damaged optional legacy board or metadata still pins its old content rather than silently reassigning",()=>{
 const p=fresh();const q=readProgress(JSON.stringify({...p,active:"book-v1-78",sessions:{...p.sessions,"book-v1-78":{broken:true}},meta:{version:2,attempts:{"book-v1-77":{broken:true}}}}));
 expect(q.active).toBe("classic");expect(q.bookRevisions).toMatchObject({"book-v1-78":1,"book-v1-77":1});
 expect(notebookForTask("book-v1-78",q)).toEqual(notebook[77]);
 expect(readProgress(serializeProgress(q)).bookRevisions).toEqual(q.bookRevisions);
});
test("daily version boundaries, alias deduplication and streaks across v3/v4, old future assignment remains v1",()=>{
 const p=fresh();
 expect(dailyIdFor("2026-11-30",p)).toBe("daily-v1-2026-11-30");
 expect(dailyIdFor("2026-12-24",p)).toBe("daily-v3-2026-12-24");
 expect(dailyIdFor(DAILY_V4_START,p)).toBe("daily-v5-"+DAILY_V4_START);
 expect(dayAt(364)).toBe(DAILY_V4_BANK_END);
 const play=(id:string,date:string)=>{p.sessions[id]=puzzleSession(dailyForTask(id)!);startAttempt(p,id);return recordCompletion(p,id,date)};
 play("daily-v3-2026-12-24","2026-12-24");play("daily-v4-2026-12-25","2026-12-25");
 const before=jars(p).seeds;expect(play("daily-v1-2026-12-25","2026-12-25")).toEqual({seeds:0,hints:0});
 expect(jars(p).seeds).toBe(before);expect(trophy("2026-12",p.done).count).toBe(2);
 expect(dailyDone(p.done,"2026-12-25")).toBe(true);expect(play("daily-v4-2026-12-26","2026-12-26").hints).toBe(1);expect(dailyRun(p,"2026-12-26").count).toBe(3);
 const legacy=fresh();legacy.done=["daily-v1-2028-02-29"];
 const q=readProgress(JSON.stringify(legacy));expect(dailyIdFor("2028-02-29",q)).toBe("daily-v1-2028-02-29");
 expect(dailyIdFor("2028-03-01",q)).toBe("daily-v5-2028-03-01");
});
test("post-bank generator remains deterministic, solvable and varied across 365 sample dates and leap/century boundaries",{timeout:120000},()=>{
 const keys=new Set<string>(),sizes=new Set<number>(),rows=new Set<number>();
 for(const day of [...Array.from({length:365},(_,i)=>dayAt(i,"2027-12-25")),"2100-03-01","2400-02-29"]){
  const p=dailyForTask("daily-v4-"+day)!;
  expect(p).toEqual(futureDailyV4(day));
  let b=p.board;for(const step of p.solution){expect(checkPair(b,step.a,step.b).ok,p.id).toBe(true);b=removePair(b,step.a,step.b)}
  expect(b,p.id).toEqual([]);keys.add(canonical(p.board));sizes.add(occupied(p.board));rows.add(p.board.length);
 }
 expect(keys.size).toBe(367);expect(sizes.size).toBeGreaterThanOrEqual(5);expect(rows.size).toBeGreaterThanOrEqual(3);
});
