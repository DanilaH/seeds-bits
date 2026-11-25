import { pilotBooks, pilotDaily } from "./content-pilot";
import { dailyDay, dailyDone, LEGACY_BOOK_TASKS, dailyV4Index, bookRevisionFor, legacyBookNumber } from "./content-ids";
import { bookV5, dailyV5 } from "./content-v5";
import { bookV4, bankDailyV4 } from "./content-v4";
import { openingPuzzle } from "./notebook-opening";
import { validDay } from "./calendar";
import notebookData from "./notebook.json" with { type: "json" };
import { checkPair, removePair, pairs, occupied, type Connection, type Session } from "./core";
let extra: (string | number[])[][] | undefined;
export async function loadNotebook() {
  extra ??= (await import("./notebook-extra.json")).default;
}
export const FIRST_MONTH = "2025-01";
export type Puzzle = { id: string; board: number[]; solution: Connection[] };
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** Reverse construction: every inserted pair is legal; replay removes them in reverse order. */
export function makePuzzle(
  id: string,
  seed: number,
  count: number,
  rows: number,
): Puzzle {
  const rand = random(seed),
    board = Array(rows * 9).fill(0),
    order: number[][] = [];
  for (let p = 0; p < count; p++) {
    const candidates: number[][] = [];
    for (let a = 0; a < board.length; a++)
      if (!board[a])
        for (let b = a + 1; b < board.length; b++)
          if (!board[b]) candidates.push([a, b]);
    let chosen: number[] | undefined;
    while (candidates.length) {
      const index = Math.floor(rand() * candidates.length),
        [a, b] = candidates[index];
      candidates[index] = candidates[candidates.length - 1];
      candidates.pop();
      board[a] = board[b] = 5;
      const ids = board
        .map((_, i) => i)
        .filter((i) =>
          board
            .slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9)
            .some(Boolean),
        );
      const ok = checkPair(
        ids.map((i) => board[i]),
        ids.indexOf(a),
        ids.indexOf(b),
      ).ok;
      board[a] = board[b] = 0;
      if (ok) {
        chosen = [a, b];
        break;
      }
    }
    if (!chosen) break;
    const [a, b] = chosen;
    const v = 1 + Math.floor(rand() * 9);
    board[a] = v;
    board[b] = rand() < 0.5 ? v : 10 - v;
    order.push([a, b]);
  }
  let ids = board
    .map((_, i) => i)
    .filter((i) =>
      board
        .slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9)
        .some(Boolean),
    );
  const initial = ids.map((i) => board[i]);
  let work = [...initial];
  const solution: Connection[] = [];
  for (const [oa, ob] of order.reverse()) {
    const a = ids.indexOf(oa),
      b = ids.indexOf(ob),
      r = checkPair(work, a, b);
    if (!r.ok) throw Error("Invalid construction");
    solution.push(r.path);
    const blank = [...work];
    blank[a] = blank[b] = 0;
    ids = ids.filter((_, i) =>
      blank
        .slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9)
        .some(Boolean),
    );
    work = removePair(work, a, b);
  }
  return { id, board: initial, solution };
}
export const notebook: Puzzle[] = [
  ...(notebookData as Puzzle[]),
  ...Array.from({ length: 2376 }, (_, i) => {
    let decoded: number[] | undefined, path: Connection[] | undefined;
    return {
      id: `book-v1-${i + 25}`,
      get board() {
        return (decoded ??= [...(extra![i][0] as string)].map(Number));
      },
      get solution() {
        if (!path) {
          path = [];
          const flat = extra![i][1] as number[];
          for (let j = 0; j < flat.length; j += 3)
            path.push({
              a: flat[j],
              b: flat[j + 1],
              kind: flat[j + 2] ? "reading" : "straight",
            });
        }
        return path;
      },
    };
  }),
  ...pilotBooks,
];
/** A logical notebook ID stays constant. Its assigned start/witness must not. */
export function notebookForTask(id:string,state:Parameters<typeof bookRevisionFor>[1]):Puzzle|undefined {
  const slot = legacyBookNumber(id);
  if (slot) {
    const revision = bookRevisionFor(id, state);
    if (revision === 6) return openingPuzzle(id, slot);
    if (revision === 5) return bookV5(id);
    if (revision === 4) return bookV4(id);
  }
  return notebook.find(p=>p.id===id);
}
export function daily(day: string) {
  return makePuzzle(
    `daily-v1-${day}`,
    hash(`seeds-daily-v1:${day}`),
    8 + (hash(day) % 9),
    4 + (hash(day) % 2),
  );
}
export function dailyForTask(id: string): Puzzle | undefined {
  const day = dailyDay(id);
  if(!day)return;
  if(id.startsWith("daily-v3-"))return pilotDaily(id);
  if(id.startsWith("daily-v4-"))return bankDailyV4(id)??futureDailyV4(day);
  if(id.startsWith("daily-v5-"))return dailyV5(id);
  return daily(day);
}

// Frozen v4 continuation beyond the authored 365-day pack. This uses a bounded
// causal witness score, not an asserted exact human difficulty or risk class.
export function futureDailyV4(day:string):Puzzle {
  const index=dailyV4Index(day);
  if(index<0)throw Error("Invalid v4 date");
  const id="daily-v4-"+day;
  const wave=[12,16,20,14,18,24,16],role=(index+Math.floor(index/7))%5;
  const n=wave[(index+Math.floor(index/14))%wave.length];
  let best:Puzzle|undefined,bestScore=-Infinity;
  const edge=(a:number,b:number)=>Math.min(a,b)*64+Math.max(a,b);
  const connections=(b:number[],ids:number[])=>new Set(pairs(b).map(p=>edge(ids[p.a],ids[p.b])));
  for(let i=0;i<8;i++){
    const rows=Math.max(Math.ceil(n/9),3+(index+i)%4);
    const p=makePuzzle(id,hash("seeds-daily-v4-future:"+day+":"+i),n/2,rows);
    if(occupied(p.board)!==n||p.board.length!==rows*9||new Set(p.board.filter(Boolean)).size<4)continue;
    let b=p.board,ids=b.map((v,j)=>v?j+1:0),reveal=0,shift=0,gaps=0,reading=0,chain=0,streak=0;
    let previous=new Set<number>();
    for(const move of p.solution){
      const before=connections(b,ids),hole=b.slice(),hi=ids.slice();
      hole[move.a]=hole[move.b]=hi[move.a]=hi[move.b]=0;
      const next=removePair(b,move.a,move.b),ni=hi.filter((_,j)=>hole.slice(j-j%9,j-j%9+9).some(Boolean));
      const unc=connections(hole,hi),after=connections(next,ni);
      if(previous.has(edge(ids[move.a],ids[move.b])))streak++;else streak=0;
      if(streak>=2)chain++;
      previous=new Set([...after].filter(x=>!before.has(x)&&unc.has(x)));
      reveal+=Number(previous.size>0);shift+=Number([...after].some(x=>!unc.has(x)));
      reading+=Number(move.kind==="reading");
      gaps+=Number(move.kind==="reading"?Math.abs(move.a-move.b)>1:Math.max(Math.abs(move.a%9-move.b%9),Math.abs(Math.floor(move.a/9)-Math.floor(move.b/9)))>1);
      b=next;ids=ni;
    }
    const opening=pairs(p.board).length;
    if(opening<2)continue;
    const score=[reveal*4+chain*5,chain*12+reveal*2,shift*7+reveal,reading*4+gaps,shift*3+reveal*3+gaps][role]
      +Math.min(10,opening)*.1;
    if(score>bestScore){best=p;bestScore=score}
  }
  if(best)return best;
  // Guaranteed legal, dated emergency construction; never call v1's date schedule.
  const r=random(hash("seeds-daily-v4-fallback:"+day));
  const board:number[]=Array(27).fill(0);
  for(let row=0;row<3;row++){
    const starts=[0,2,4,6];
    const k=Math.floor(r()*4),l=(k+1+Math.floor(r()*3))%4;
    for(const j of [starts[k],starts[l]]){const v=1+Math.floor(r()*9);board[row*9+j]=v;board[row*9+j+1]=r()<.5?v:10-v}
  }
  let b=board,solution:Connection[]=[];
  while(b.length){
    // Select only the disjoint adjacent construction groups.
    let found:Connection|undefined;
    for(let row=0;row<b.length/9&&!found;row++)for(let j=0;j<8;j+=2){const x=checkPair(b,row*9+j,row*9+j+1);if(x.ok){found=x.path;break}}
    if(!found)throw Error("Invalid v4 fallback");
    solution.push(found);b=removePair(b,found.a,found.b);
  }
  return {id,board,solution};
}

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!validDay(`${month}-01`)) return 0;
  return new Date(y, m, 0).getDate();
}
export function days(month: string) {
  return Array.from(
    { length: monthDays(month) },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function availableDay(day: string, now = today()) {
  return (
    validDay(day) &&
    validDay(now) &&
    day.slice(0, 7) >= FIRST_MONTH &&
    day <= now &&
    days(day.slice(0, 7)).includes(day)
  );
}
export function trophy(month: string, done: readonly string[]) {
  const n = days(month).filter((d) => dailyDone(done,d)).length;
  return {
    count: n,
    tier: n === monthDays(month) ? 3 : n >= 14 ? 2 : n >= 7 ? 1 : 0,
  };
}
export function puzzleSession(p: Puzzle): Session {
  return {
    rules: 1,
    current: { board: [...p.board], scroll: 0, moves: 0, additions: 0 },
    history: [],
  };
}

export function nextTask(
  id: string,
  done: readonly string[],
  now = today(),
  resolveDay: (day: string) => string = day => `daily-v1-${day}`,
): string | undefined {
  const finished = new Set(done);
  const index = notebook.findIndex((p) => p.id === id);
  if (index >= 0) {
    const start = index < LEGACY_BOOK_TASKS ? 0 : Math.floor(index / 24) * 24;
    const end = index < LEGACY_BOOK_TASKS ? LEGACY_BOOK_TASKS : start + 24;
    return [...notebook.slice(index+1,end), ...notebook.slice(start,index)].find(p=>!finished.has(p.id))?.id;
  }
  const start = dailyDay(id);
  if (!start) return;
  const step = (day: string, delta: number) => {
    const [y, m, d] = day.split("-").map(Number);
    return today(new Date(y, m - 1, d + delta));
  };
  for (let day = step(start, 1); day <= now; day = step(day, 1))
    if (availableDay(day, now) && !dailyDone(done, day))
      return resolveDay(day);
  for (
    let day = step(start > now ? step(now, 1) : start, -1);
    day >= `${FIRST_MONTH}-01`;
    day = step(day, -1)
  )
    if (!dailyDone(done, day)) return resolveDay(day);
}
