/** Rules v0.1. Zero is an empty logical cell, never a playable number. */
export const RULES_VERSION = 1;
export const WIDTH = 9;
/** Provisional guard, not a measured device limit or a loss condition. */
export const MAX_CELLS = 1800;
export type Board = readonly number[];
export type Connection = { a: number; b: number; kind: "straight" | "reading" };
export type Rejection = "same" | "empty" | "value" | "blocked" | "direction";
export type PairResult =
  { ok: true; path: Connection } | { ok: false; reason: Rejection };
export function classic(): number[] {
  return Array.from({ length: 19 }, (_, i) => String(i + 1))
    .join("")
    .replaceAll("0", "")
    .split("")
    .map(Number);
}
export function occupied(board: Board): number {
  return board.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
}
export function checkPair(
  board: Board,
  a: number,
  b: number,
  width = WIDTH,
): PairResult {
  if (a === b) return { ok: false, reason: "same" };
  if (!Number.isInteger(a) || !Number.isInteger(b) || !board[a] || !board[b])
    return { ok: false, reason: "empty" };
  if (board[a] !== board[b] && board[a] + board[b] !== 10)
    return { ok: false, reason: "value" };
  const lo = Math.min(a, b),
    hi = Math.max(a, b),
    dr = Math.floor(hi / width) - Math.floor(lo / width),
    dc = (hi % width) - (lo % width);
  const aligned = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
  if (aligned) {
    const step = dr === 0 ? 1 : dc === 0 ? width : width + Math.sign(dc);
    let clear = true;
    for (let i = lo + step; i < hi; i += step)
      if (board[i]) {
        clear = false;
        break;
      }
    if (clear) return { ok: true, path: { a, b, kind: "straight" } };
  }
  let clear = true;
  for (let i = lo + 1; i < hi; i++)
    if (board[i]) {
      clear = false;
      break;
    }
  if (clear) return { ok: true, path: { a, b, kind: "reading" } };
  return { ok: false, reason: aligned ? "blocked" : "direction" };
}
/** First visible occupied cell along each ray, plus reading-order neighbours. */
export function pairs(board: Board, width = WIDTH): Connection[] {
  const result: Connection[] = [],
    seen = new Set<string>();
  let previous = -1;
  const add = (a: number, b: number) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const r = checkPair(board, a, b, width);
    if (r.ok) result.push(r.path);
  };
  for (let a = 0; a < board.length; a++)
    if (board[a]) {
      if (previous >= 0) add(previous, a);
      previous = a;
      const row = Math.floor(a / width),
        col = a % width;
      for (const [dy, dx] of [
        [0, 1],
        [1, 0],
        [1, -1],
        [1, 1],
      ]) {
        let r = row + dy,
          c = col + dx;
        while (c >= 0 && c < width && r * width + c < board.length) {
          const b = r * width + c;
          if (board[b]) {
            add(a, b);
            break;
          }
          r += dy;
          c += dx;
        }
      }
    }
  return result.sort((x, y) => x.a - y.a || x.b - y.b);
}
export function removePair(
  board: Board,
  a: number,
  b: number,
  width = WIDTH,
): number[] {
  if (!checkPair(board, a, b, width).ok) throw new Error("Illegal pair");
  const next = [...board];
  next[a] = 0;
  next[b] = 0;
  return next.flatMap((_, i) =>
    i % width === 0
      ? next.slice(i, i + width).some(Boolean)
        ? next.slice(i, i + width)
        : []
      : [],
  );
}
export function addNumbers(
  board: Board,
  width = WIDTH,
  max = MAX_CELLS,
): number[] {
  if (!occupied(board)) throw new Error("Empty board");
  if (pairs(board, width).length) throw new Error("Pairs remain");
  const values = board.filter(Boolean);
  if (board.length + values.length > max) throw new Error("Board limit");
  return [...board, ...values];
}
export type Snapshot = {
  board: number[];
  scroll: number;
  additions: number;
  moves: number;
};
export type Session = { rules: 1; current: Snapshot; history: Snapshot[] };
export function newSession(): Session {
  return {
    rules: 1,
    current: { board: classic(), scroll: 0, additions: 0, moves: 0 },
    history: [],
  };
}
export function commit(
  session: Session,
  board: number[],
  action: "pair" | "add",
  scroll: number,
): Session {
  return {
    rules: 1,
    current: {
      board,
      scroll,
      additions: session.current.additions + (action === "add" ? 1 : 0),
      moves: session.current.moves + (action === "pair" ? 1 : 0),
    },
    history: [...session.history, { ...session.current, scroll }],
  };
}
export function undo(session: Session): Session {
  return session.history.length
    ? {
        rules: 1,
        current: session.history[session.history.length - 1],
        history: session.history.slice(0, -1),
      }
    : session;
}
export function decode(raw: string): Session {
  const s = JSON.parse(raw);
  const integer = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  const valid = (v: any) =>
    v &&
    Array.isArray(v.board) &&
    v.board.length <= MAX_CELLS &&
    v.board.every((n: unknown) => integer(n) && Number(n) <= 9) &&
    typeof v.scroll === "number" &&
    Number.isFinite(v.scroll) &&
    v.scroll >= 0 &&
    integer(v.moves) &&
    integer(v.additions);
  if (
    s?.rules !== RULES_VERSION ||
    !valid(s.current) ||
    !Array.isArray(s.history) ||
    !s.history.every(valid)
  )
    throw new Error("Invalid saved game");
  return s as Session;
}
