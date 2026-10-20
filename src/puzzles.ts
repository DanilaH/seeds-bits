import notebookData from "./notebook.json" with { type: "json" };
import { checkPair, removePair, type Connection, type Session } from "./core";
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
];
export function daily(day: string) {
  return makePuzzle(
    `daily-v1-${day}`,
    hash(`seeds-daily-v1:${day}`),
    8 + (hash(day) % 9),
    4 + (hash(day) % 2),
  );
}
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
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
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    day.slice(0, 7) >= FIRST_MONTH &&
    day <= now &&
    days(day.slice(0, 7)).includes(day)
  );
}
export function trophy(month: string, done: readonly string[]) {
  const n = days(month).filter((d) => done.includes(`daily-v1-${d}`)).length;
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
): string | undefined {
  const finished = new Set(done);
  const index = notebook.findIndex((p) => p.id === id);
  if (index >= 0)
    return [...notebook.slice(index + 1), ...notebook.slice(0, index)].find(
      (p) => !finished.has(p.id),
    )?.id;
  if (!id.startsWith("daily-v1-")) return;
  const start = id.slice(9);
  const step = (day: string, delta: number) => {
    const [y, m, d] = day.split("-").map(Number);
    return today(new Date(y, m - 1, d + delta));
  };
  for (let day = step(start, 1); day <= now; day = step(day, 1))
    if (availableDay(day, now) && !finished.has(`daily-v1-${day}`))
      return `daily-v1-${day}`;
  for (
    let day = step(start > now ? step(now, 1) : start, -1);
    day >= `${FIRST_MONTH}-01`;
    day = step(day, -1)
  )
    if (!finished.has(`daily-v1-${day}`)) return `daily-v1-${day}`;
}
