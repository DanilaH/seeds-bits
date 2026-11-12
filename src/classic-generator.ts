import {
  addNumbers,
  classic,
  newSession,
  pairs,
  removePair,
  type Session,
} from "./core";

export const CLASSIC_MIN = 0;
export const CLASSIC_DEFAULT = 1;
export const CLASSIC_MAX = 2;
export type ClassicDifficulty = 0 | 1 | 2;
export const classicDifficultyNames = ["Лёгкая", "Обычная", "Высокая"];
export type ClassicProof = ([number, number] | null)[];
export type ClassicRun = {
  version: 1;
  seed: number;
  difficulty: ClassicDifficulty;
  recent: string[];
  current?: { attempt: string; board: number[] };
};
const isDifficulty = (v: unknown): v is ClassicDifficulty =>
  Number.isInteger(v) && Number(v) >= CLASSIC_MIN && Number(v) <= CLASSIC_MAX;
const isBoard = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  [18, 27, 28].includes(v.length) &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= 9);

export function readClassicRun(value: unknown): ClassicRun | undefined {
  const v = value as ClassicRun | undefined;
  if (
    !v ||
    v.version !== 1 ||
    !Number.isInteger(v.seed) ||
    v.seed < 0 ||
    v.seed > 0xffffffff ||
    !isDifficulty(v.difficulty) ||
    !Array.isArray(v.recent) ||
    v.recent.length > 8 ||
    !v.recent.every(
      (b) => typeof b === "string" && /^(?:[1-9]{18}|[1-9]{27,28})$/.test(b),
    ) ||
    new Set(v.recent).size !== v.recent.length ||
    (v.current !== undefined &&
      (typeof v.current?.attempt !== "string" ||
        !v.current.attempt.length ||
        v.current.attempt.length > 100 ||
        !isBoard(v.current.board) ||
        v.current.board.length !== [18, 28, 27][v.difficulty]))
  )
    return;
  return {
    version: 1,
    seed: v.seed,
    difficulty: v.difficulty,
    recent: [...v.recent],
    ...(v.current
      ? { current: { attempt: v.current.attempt, board: [...v.current.board] } }
      : {}),
  };
}

export function newClassicRun(
  seed = crypto.getRandomValues(new Uint32Array(1))[0],
): ClassicRun {
  return {
    version: 1,
    seed: seed >>> 0,
    difficulty: CLASSIC_DEFAULT,
    recent: [],
  };
}

function random(state: ClassicRun) {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(items: T[], state: ClassicRun) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Bounded search proves one route; it does not rank human difficulty. */
export function solveClassic(
  initial: readonly number[],
  additions: number,
  budget = 600,
): ClassicProof | undefined {
  const dead = new Set<string>();
  let visits = 0;
  function visit(
    board: readonly number[],
    left: number,
  ): ClassicProof | undefined {
    if (!board.some(Boolean)) return [];
    if (++visits > budget) return;
    const key = board.join("") + ":" + left;
    if (dead.has(key)) return;
    const moves = pairs(board);
    if (!moves.length) {
      if (left) {
        const rest = visit(addNumbers(board), left - 1);
        if (rest) return [null, ...rest];
      }
    } else {
      for (const p of moves) {
        if (visits >= budget) break;
        const rest = visit(removePair(board, p.a, p.b), left);
        if (rest) return [[p.a, p.b], ...rest];
      }
    }
    dead.add(key);
  }
  return visit(initial, additions);
}

function easyNumbers(state: ClassicRun) {
  const values: number[] = [];
  for (let i = 0; i < 9; i++) {
    const value = 1 + Math.floor(random(state) * 9);
    values.push(value, random(state) < 0.5 ? value : 10 - value);
  }
  return values;
}
function baseNumbers(level: ClassicDifficulty, state: ClassicRun) {
  const values = level === 0 ? easyNumbers(state) : classic();
  // Odd length guarantees at least one legal addition is needed on hard.
  if (level === 2) values.splice(values.indexOf(1), 1);
  return values;
}

/** Runtime generation, with fixed work limits and a constructive fallback. */
export function generateClassic(state: ClassicRun, level: ClassicDifficulty) {
  const original = classic().join("");
  const unseen = (board: number[]) =>
    !state.recent.includes(board.join("")) && board.join("") !== original;
  for (let n = 0; n < 64; n++) {
    const board = shuffle(baseNumbers(level, state), state);
    if (!unseen(board) || new Set(board).size < 6) continue;
    const opening = pairs(board).length;
    if (
      (level === 0 && opening < 11) ||
      (level === 1 && (opening < 18 || opening > 26)) ||
      (level === 2 && (opening < 6 || opening > 17))
    )
      continue;
    // On easy, the first available pair must keep working all the way to a
    // clear. A hidden no-add solution alone would still demand foresight.
    const proof = solveClassic(
      board,
      level === 0 ? 0 : 2,
      level === 0 ? 10 : 600,
    );
    if (proof) return { board, proof, fallback: false };
  }
  // Pair blocks are generated afresh, not drawn from a fixed catalog. Their
  // adjacent clear route remains valid when empty rows are removed.
  for (let n = 0; n < 64; n++) {
    let blocks: number[][];
    if (level === 0) {
      const values = easyNumbers(state);
      blocks = Array.from({ length: 9 }, (_, i) =>
        values.slice(i * 2, i * 2 + 2),
      );
    } else {
      blocks = [
        ...Array.from({ length: level === 2 ? 5 : 6 }, () => [1, 1]),
        ...Array.from({ length: 8 }, (_, i) => [i + 2, i + 2]),
      ];
    }
    const board = shuffle(blocks, state).flat();
    if (level === 2) board.push(1);
    if (!unseen(board) || new Set(board).size < 6) continue;
    const proof = solveClassic(board, level === 2 ? 1 : 0, 1000);
    if (proof) return { board, proof, fallback: true };
  }
  throw new Error("Cannot prepare a fresh classic game");
}

/** Mutate only a candidate; the caller publishes it after saving succeeds. */
export function takeGeneratedClassic(
  state: ClassicRun,
  attempt: string,
  level = state.difficulty,
): Session {
  if (!isDifficulty(level)) throw new Error("Invalid classic difficulty");
  const { board } = generateClassic(state, level);
  state.difficulty = level;
  state.recent = [...state.recent, board.join("")].slice(-8);
  state.current = { attempt, board: [...board] };
  const game = newSession();
  game.current.board = board;
  return game;
}
