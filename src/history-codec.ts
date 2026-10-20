import { decode, MAX_CELLS, type Session, type Snapshot } from "./core";
type Segment = string | [number, number];
type Frame = [number, number, number, Segment[]];
type Packed = { rules: 1; current: Snapshot; packedHistory: Frame[] };
const cache = new WeakMap<
  Session,
  { board: number[]; history: Snapshot[]; frames: Frame[] }
>();
const deltas = new WeakMap<
  number[],
  { newer: number[]; segments: Segment[] }
>();
/** Reverse row deltas preserve every snapshot, including row collapse and additions. */
export function packSession(s: Session): Packed {
  let cached = cache.get(s);
  if (
    !cached ||
    cached.board !== s.current.board ||
    cached.history !== s.history
  ) {
    const frames: Frame[] = [];
    let newer = s.current.board;
    for (let n = s.history.length - 1; n >= 0; n--) {
      const old = s.history[n];
      let delta = deltas.get(old.board);
      if (!delta || delta.newer !== newer) {
        const rows = new Map<string, number>();
        for (let i = 0; i < newer.length; i += 9) {
          const row = newer.slice(i, i + 9).join("");
          if (!rows.has(row)) rows.set(row, i);
        }
        const segments: Segment[] = [];
        for (let i = 0; i < old.board.length; i += 9) {
          const row = old.board.slice(i, i + 9).join(""),
            at = newer.slice(i, i + 9).join("") === row ? i : rows.get(row),
            last = segments.at(-1);
          if (at !== undefined) {
            if (Array.isArray(last) && last[0] + last[1] === at)
              last[1] += row.length;
            else segments.push([at, row.length]);
          } else if (typeof last === "string")
            segments[segments.length - 1] = last + row;
          else segments.push(row);
        }
        delta = { newer, segments };
        deltas.set(old.board, delta);
      }
      const segments = delta.segments;
      frames.push([old.scroll, old.moves, old.additions, segments]);
      newer = old.board;
    }
    cached = { board: s.current.board, history: s.history, frames };
    cache.set(s, cached);
  }
  return { rules: s.rules, current: s.current, packedHistory: cached.frames };
}
export function unpackSession(value: unknown): Session {
  const p = value as Packed;
  // Validate the current board even if optional history is damaged.
  const current = decode(
    JSON.stringify({ rules: p?.rules, current: p?.current, history: [] }),
  ).current;
  if (!Array.isArray(p.packedHistory)) throw Error("Invalid packed history");
  let newer = current.board;
  const history: Snapshot[] = [];
  for (const frame of p.packedHistory) {
    if (!Array.isArray(frame) || frame.length !== 4 || !Array.isArray(frame[3]))
      throw Error("Invalid history frame");
    const board: number[] = [];
    for (const part of frame[3]) {
      if (typeof part === "string") {
        if (!/^[0-9]+$/.test(part) || board.length + part.length > MAX_CELLS)
          throw Error("Invalid history digits");
        for (const digit of part) board.push(Number(digit));
      } else {
        if (
          !Array.isArray(part) ||
          part.length !== 2 ||
          !part.every(Number.isSafeInteger) ||
          part[0] < 0 ||
          part[1] <= 0 ||
          part[0] + part[1] > newer.length ||
          board.length + part[1] > MAX_CELLS
        )
          throw Error("Invalid history reference");
        board.push(...newer.slice(part[0], part[0] + part[1]));
      }
    }
    history.push({
      board,
      scroll: frame[0],
      moves: frame[1],
      additions: frame[2],
    });
    newer = board;
  }
  history.reverse();
  return decode(JSON.stringify({ rules: 1, current, history }));
}
