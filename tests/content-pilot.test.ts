import {test,expect} from "vitest";
import {readFileSync} from "node:fs";
import {notebook,loadNotebook,daily,dailyForTask,puzzleSession,nextTask,trophy,availableDay} from "../src/puzzles";
import {pilotBooks,pilotDaily} from "../src/content-pilot";
import {dailyIdFor,dailyDone,dailyDay,pilotBookId,validContentId,PILOT_START,PILOT_END} from "../src/content-ids";
import {volumeOf,volumeTasks,puzzleNumberInVolume,VOLUMES,themeOf} from "../src/notebooks";
import {checkPair,removePair,commit,undo,occupied,pairs} from "../src/core";
import {fresh,metadata,helpProfile,readProgress,serializeProgress,recordCompletion,startAttempt,FutureProgress} from "../src/progress";
import {createSolver} from "../src/solver";
import {jars,taskSeeds} from "../src/jars";
import {dailyRun} from "../src/daily-run";
import {resultKind} from "../src/result-presentation";
const day=(n:number)=>"2026-12-"+String(n).padStart(2,"0");
const scheduled=()=>Array.from({length:24},(_,i)=>dailyForTask("daily-v3-"+day(i+1))!);
const canonical=(board:readonly number[])=>{
  const roles=new Map<number,number>();
  return board.map(d=>{
    if(!d||d===5)return d;
    if(!roles.has(d)){const v=roles.size/2+1;roles.set(d,v);roles.set(10-d,10-v)}
    return roles.get(d);
  }).join("");
};
test("frozen pilot paths solve all 120 starts with actual rules and hints",()=>{
  const all=[...pilotBooks,...scheduled()];
  expect(all.length).toBe(120);
  expect(new Set(all.map(p=>p.id)).size).toBe(120);
  let moves=0;
  for(const p of all){
    const n=occupied(p.board);
    expect(n).toBeGreaterThanOrEqual(12);expect(n).toBeLessThanOrEqual(24);
    expect(p.board.length).toBeLessThanOrEqual(54);
    const hint=createSolver(0,p);
    let b=p.board;
    for(const step of p.solution){
      expect(checkPair(b,step.a,step.b).ok,p.id).toBe(true);
      expect(hint(b).kind,p.id).toBe("move");
      b=removePair(b,step.a,step.b);moves++;
    }
    expect(b,p.id).toEqual([]);
  }
  expect(moves).toBe(1032);
});
test("full legacy catalogue and 2025–2027 v1 archive contain no canonical duplicate of any pilot start",{timeout:120000},async()=>{
  await loadNotebook();
  const old=JSON.parse(readFileSync("src/notebook.json","utf8"));
  expect(notebook.slice(0,24)).toEqual(old);
  expect(notebook[2399].id).toBe("book-v1-2400");
  const historical=new Set(notebook.slice(0,2400).map(p=>canonical(p.board)));
  for(let d=new Date("2025-01-01T12:00:00Z");d<=new Date("2027-12-31T12:00:00Z");d.setUTCDate(d.getUTCDate()+1)){
    historical.add(canonical(daily(d.toISOString().slice(0,10)).board));
  }
  for(const p of [...pilotBooks,...scheduled()]){
    const key=canonical(p.board);
    expect(historical.has(key),p.id).toBe(false);
    historical.add(key);
  }
});
test("104 volumes, stable v1 order and local thematic next task / completion",()=>{
  expect(VOLUMES).toBe(104);expect(notebook.length).toBe(2496);
  for(let i=0;i<4;i++){
    const tasks=volumeTasks(100+i);
    expect(tasks.length).toBe(24);
    expect(themeOf(100+i)).toBeDefined();
    tasks.forEach((p,j)=>{expect(pilotBookId(p.id)).toBe(true);expect(volumeOf(p.id)).toBe(100+i);expect(puzzleNumberInVolume(p.id)).toBe(j+1)});
    const done=tasks.slice(0,23).map(p=>p.id);
    const last=tasks[23].id;
    expect(nextTask(tasks[22].id,done)).toBe(last);
    expect(resultKind(last,[...done,last],notebook)).toBe("book");
    expect(nextTask(last,[...done,last])).toBeUndefined();
    expect(resultKind(last,[last],notebook)).toBe("task");
  }
  expect(themeOf(99)).toBeUndefined();
  expect(nextTask("book-v1-2400",["book-v1-2400"])).toBe("book-v1-2377");
});
test("dated bank is frozen and finite, preserves v1 generation and blocks future/unknown IDs",()=>{
  const p=fresh();
  expect(PILOT_START).toBe(day(1));expect(PILOT_END).toBe(day(24));
  expect(dailyIdFor("2026-11-30",p)).toBe("daily-v1-2026-11-30");
  expect(dailyIdFor(day(1),p)).toBe("daily-v3-"+day(1));
  expect(dailyIdFor(day(24),p)).toBe("daily-v3-"+day(24));
  expect(dailyIdFor(day(25),p)).toBe("daily-v5-"+day(25));
  expect(dailyForTask("daily-v1-"+day(1))).toEqual(daily(day(1)));
  expect(dailyForTask("daily-v3-"+day(1))).toEqual(pilotDaily("daily-v3-"+day(1)));
  expect(availableDay(day(2),day(1))).toBe(false);
  expect(validContentId("daily-v3-"+day(25))).toBe(false);
  expect(validContentId("book-v3-links-25")).toBe(false);
  expect(validContentId("book-v1-2401")).toBe(false);
  expect(dailyDay("daily-v3-2026-02-29")).toBeUndefined();
});
test("legacy assignment takes precedence even for unplayed completed / in-progress window days",()=>{
  const p=fresh();
  const old=daily(day(1));
  p.sessions[old.id]=puzzleSession(old);
  const move=old.solution[0];
  p.sessions[old.id]=commit(p.sessions[old.id],removePair(old.board,move.a,move.b),"pair",13);
  p.active=old.id;
  p.hints[old.id]=1;
  p.done.push("daily-v1-"+day(2),"book-v1-1");
  metadata(p).wallet=7;helpProfile(p).inventory.magnet=3;
  const wire=serializeProgress(p);
  expect(JSON.parse(wire).version).toBe(8);
  const q=readProgress(wire);
  expect(q.sessions[old.id]).toEqual(p.sessions[old.id]);
  expect(q.active).toBe(old.id);
  expect(dailyIdFor(day(1),q)).toBe(old.id);
  expect(dailyIdFor(day(2),q)).toBe("daily-v1-"+day(2));
  expect(dailyIdFor(day(3),q)).toBe("daily-v3-"+day(3));
  expect(metadata(q).wallet).toBe(7);expect(helpProfile(q).inventory.magnet).toBe(3);
});
test("new content survives v7 restart, undo and hints; invalid assignment is protected",()=>{
  const p=fresh(), task=pilotBooks[0], newDaily=scheduled()[0];
  const move=task.solution[0];
  p.active=task.id;p.sessions[task.id]=commit(puzzleSession(task),removePair(task.board,move.a,move.b),"pair",9);
  p.hints[task.id]=1;
  p.sessions[newDaily.id]=puzzleSession(newDaily);p.dailyAssignments={[day(1)]:newDaily.id};
  metadata(p).wallet=12;helpProfile(p).inventory.plan=2;
  const wire=serializeProgress(p), q=readProgress(wire);
  expect(JSON.parse(wire).version).toBe(7);
  expect(q.active).toBe(task.id);expect(q.sessions[task.id]).toEqual(p.sessions[task.id]);
  expect(undo(q.sessions[task.id]).current.board).toEqual(task.board);
  expect(q.hints[task.id]).toBe(1);expect(q.sessions[newDaily.id]).toEqual(p.sessions[newDaily.id]);
  expect(dailyIdFor(day(1),q)).toBe(newDaily.id);
  expect(metadata(q).wallet).toBe(12);expect(helpProfile(q).inventory.plan).toBe(2);
  const broken=JSON.parse(wire);broken.dailyAssignments[day(1)]="daily-v3-"+day(2);
  expect(()=>readProgress(JSON.stringify(broken))).toThrow(FutureProgress);
  broken.version=10;expect(()=>readProgress(JSON.stringify(broken))).toThrow(FutureProgress);
});
test("mixed date identities count one trophy day and one reward, preserve streak across v1/v3",()=>{
  const p=fresh();
  const play=(id:string,date:string)=>{
    const task=dailyForTask(id)!;p.sessions[id]=puzzleSession(task);startAttempt(p,id);
    return recordCompletion(p,id,date);
  };
  const a=play("daily-v1-2026-11-30","2026-11-30");
  const b=play("daily-v3-"+day(1),day(1));
  expect(a.seeds).toBeGreaterThan(0);expect(b.seeds).toBe(taskSeeds(occupied(scheduled()[0].board)/2));
  const before=jars(p).seeds;
  expect(play("daily-v1-"+day(1),day(1))).toEqual({seeds:0,hints:0});
  expect(jars(p).seeds).toBe(before);
  expect(play("daily-v3-"+day(2),day(2)).hints).toBe(1);
  expect(dailyRun(p,day(2)).count).toBe(3);
  expect(trophy("2026-12",[...p.done,"daily-v1-"+day(1)]).count).toBe(2);
  expect(dailyDone(p.done,day(1))).toBe(true);
  expect(nextTask("daily-v3-"+day(1),p.done,day(3),d=>dailyIdFor(d,p))).toBe("daily-v3-"+day(3));
});
