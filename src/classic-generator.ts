import {
  addNumbers,
  classic,
  newSession,
  occupied,
  pairs,
  removePair,
  type Session,
} from "./core";

import { clearInReadingOrder, constructDense, denseFallback } from "./classic-dense";
import {
  CLASSIC_STYLES, CLOSE_CLASSIC_MOTIF, classicMotifSimilarity, classicStructure,
  measureClassic, openingEdges, openingSimilarity, tryClassicOrder,
  type ClassicMotif, type ClassicProof, type ClassicStyle,
} from "./classic-profile";
export type { ClassicProof } from "./classic-profile";

export const CLASSIC_MIN = 0;
export const CLASSIC_DEFAULT = 1;
export const CLASSIC_MAX = 3;
export const CLASSIC_SIZES = [18, 28, 45, 81] as const;
export const CLASSIC_LEVELS = [0, 1, 2, 3] as const;
export type ClassicDifficulty = (typeof CLASSIC_LEVELS)[number];
export const classicDifficultyNames = ["Лёгкая", "Обычная", "Высокая", "Эксперт"];
export const CLASSIC_SCENARIO_HISTORY = 4;
const CLASSIC_RECIPES = [...CLASSIC_STYLES, "shuffle", "fallback"] as const;
type ClassicRecipe = (typeof CLASSIC_RECIPES)[number];
type Scenario = { recipe: ClassicRecipe; motif: ClassicMotif };
type ScenarioHistory = Partial<Record<ClassicDifficulty, Scenario[]>>;
export type ClassicRun = {
  version: 1;
  seed: number;
  difficulty: ClassicDifficulty;
  recent: string[];
  scenarios?: ScenarioHistory;
  current?: { attempt: string; board: number[] };
};
export const isClassicDifficulty = (v: unknown): v is ClassicDifficulty =>
  Number.isInteger(v) && Number(v) >= CLASSIC_MIN && Number(v) <= CLASSIC_MAX;
const isBoard = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  [18, 27, 28, 45, 81].includes(v.length) &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= 9);

export function readClassicRun(value: unknown): ClassicRun | undefined {
  const v = value as ClassicRun | undefined;
  if (
    !v ||
    v.version !== 1 ||
    !Number.isInteger(v.seed) ||
    v.seed < 0 ||
    v.seed > 0xffffffff ||
    !isClassicDifficulty(v.difficulty) ||
    !Array.isArray(v.recent) ||
    v.recent.length > 8 ||
    !v.recent.every(
      (b) => typeof b === "string" && /^(?:[1-9]{18}|[1-9]{27,28}|[1-9]{45}|[1-9]{81})$/.test(b),
    ) ||
    new Set(v.recent).size !== v.recent.length ||
    (v.current !== undefined &&
      (typeof v.current?.attempt !== "string" ||
        !v.current.attempt.length ||
        v.current.attempt.length > 100 ||
        !isBoard(v.current.board) ||
        (v.current.board.length !== CLASSIC_SIZES[v.difficulty] &&
          !(v.difficulty === 2 && v.current.board.length === 27))))
  )
    return;
  // Previous saves recorded a preference, which cannot identify the dealt route.
  // Read optional scenario metadata independently of the board and Undo.
  const scenarios: ScenarioHistory = {};
  for (const level of CLASSIC_LEVELS) {
    const entries = v.scenarios?.[level];
    if (!Array.isArray(entries)) continue;
    const recent = entries.slice(-CLASSIC_SCENARIO_HISTORY)
      .filter(entry => entry && CLASSIC_RECIPES.includes(entry.recipe) &&
        (entry.motif?.stage === "first-add" || entry.motif?.stage === "midpoint") &&
        typeof entry.motif.structure === "string" &&
        entry.motif.structure.length <= CLASSIC_SIZES[level] &&
        /^[0-9]*[1-9][0-9]*$/.test(entry.motif.structure));
    if (recent.length)
      scenarios[level] = recent.map(({ recipe, motif }) => ({ recipe, motif: { ...motif } }));
  }
  return {
    version: 1,
    seed: v.seed,
    difficulty: v.difficulty,
    recent: [...v.recent],
    ...(Object.keys(scenarios).length ? { scenarios } : {}),
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
  onVisit?: () => void,
): ClassicProof | undefined {
  const dead = new Set<string>();
  let visits = 0;
  function visit(
    board: readonly number[],
    left: number,
  ): ClassicProof | undefined {
    if (!board.some(Boolean)) return [];
    if (++visits > budget) return;
    onVisit?.();
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
const MAX_ATTEMPTS = 40;

type Deal = { board: number[]; proof: ClassicProof };
type Candidate = Deal & {
  profile: ReturnType<typeof measureClassic>;
  similarity: number;
  recipe: ClassicRecipe;
};
type PolicyBudget = { attempts?: number; visits?: number };

function smallCandidate(level: 0 | 1, state: ClassicRun, visits: number, onVisit: () => void): Deal | undefined {
  const board = shuffle(level === 0 ? easyNumbers(state) : classic(), state);
  if (new Set(board).size < 6) return;
  const opening = pairs(board).length;
  if (level === 0 && opening < 11 || level === 1 && (opening < 18 || opening > 26)) return;
  if (level === 0) {
    const first = tryClassicOrder(board, "first", 0, visits);
    return first.outcome === "FOUND" ? { board, proof: first.proof } : undefined;
  }
  const proof = solveClassic(board, 2, visits, onVisit);
  return proof && { board, proof };
}

function smallFallback(level: 0 | 1, state: ClassicRun): number[][] {
  return level === 0
    ? Array.from({ length: 9 }, (_, i) => [i + 1, random(state) < 0.5 ? i + 1 : 9 - i])
    : [
      ...Array.from({ length: 6 }, () => [1, 1]),
      ...Array.from({ length: 8 }, (_, i) => [i + 2, i + 2]),
    ];
}

function styleScore(candidate: Candidate, style: ClassicStyle, level: ClassicDifficulty) {
  const { profile } = candidate;
  switch (style) {
    case "open":
      return profile.opening * 2 - 7 * profile.additions;
    case "gaps":
      return 3 * profile.gapMoves + profile.newPairs - (level === 1 ? 6 * profile.additions : 0);
    case "stock":
      return level === 0
        ? 3 * profile.newPairs + profile.diagonalMoves
        : 2 * profile.newPairs + 4 * profile.compressionChanges +
          (profile.firstAdd === null ? 0 : (CLASSIC_SIZES[level] - 2 * profile.firstAdd) * 4);
  }
}

/** Compare a bounded pool within the chosen level, with a certified fallback. */
export function generateClassic(state: ClassicRun, level: ClassicDifficulty, options: PolicyBudget = {}) {
  const size = CLASSIC_SIZES[level];
  const nextInt = (max: number) => Math.floor(random(state) * max);
  const recent = state.recent.filter(board => board.length === size).map(board => [...board].map(Number));
  const structures = new Set(recent.map(classicStructure));
  const previousEdges = recent.map(openingEdges);
  const original = classic().join("");
  const history = state.scenarios?.[level] ?? [];
  const previousRecipe = history.at(-1)?.recipe;
  const styleOrder = shuffle([...CLASSIC_STYLES], state)
    .sort((a, b) => Number(a === previousRecipe) - Number(b === previousRecipe));
  const style = styleOrder[0];
  const diagnostics = { attempts: 0, candidates: 0, solverVisits: 0, fallbackAttempts: 0 };
  const pool: Candidate[] = [];
  const qualify = (deal: Deal | undefined, recipe: ClassicRecipe): Candidate | undefined => {
    if (!deal || deal.board.length !== size || occupied(deal.board) !== size ||
        new Set(deal.board).size < 6) return;
    const key = deal.board.join("");
    if (key === original || state.recent.includes(key)) return;
    const structure = classicStructure(deal.board);
    if (recipe !== "fallback" && structures.has(structure)) return;
    const currentEdges = openingEdges(deal.board);
    const similarity = Math.max(0, ...previousEdges.map(edges => openingSimilarity(currentEdges, edges)));
    const profile = measureClassic(deal.board, deal.proof);
    if (!profile.opening) return;
    structures.add(structure);
    return { ...deal, similarity, profile, recipe };
  };
  const dense = size === 45 || size === 81;
  const maxCandidates = dense ? 4 : 3;
  const recipes = [style, ...styleOrder];
  const attemptLimit = Math.min(MAX_ATTEMPTS, options.attempts ?? (level === 0 ? MAX_ATTEMPTS : level === 1 ? 16 : recipes.length));
  const visits = Math.min(600, options.visits ?? (level === 0 ? 9 : 600));
  const budget = {
    attemptLimit, maxCandidates,
    solverVisitsPerAttempt: level === 1 ? visits : null,
    greedyStepsPerAttempt: level === 0 ? visits : null,
  };
  while (diagnostics.attempts < attemptLimit && pool.length < maxCandidates) {
    const recipe = recipes[diagnostics.attempts % recipes.length];
    diagnostics.attempts++;
    const deal = size === 45 || size === 81
      ? constructDense(size, recipe, nextInt)
      : smallCandidate(level as 0 | 1, state, visits, () => diagnostics.solverVisits++);
    const candidate = qualify(deal, dense ? recipe : "shuffle");
    if (candidate) pool.push(candidate);
  }
  diagnostics.candidates = pool.length;
  function score(candidate: Candidate) {
    const recipeBonus = candidate.recipe === style ? size * .6 : 0;
    let motifPenalty = 0, recipePenalty = 0;
    for (const [index, previous] of history.entries()) {
      const recency = 1 / (history.length - index);
      const similarity = classicMotifSimilarity(candidate.profile.motif, previous.motif);
      if (similarity >= CLOSE_CLASSIC_MOTIF)
        motifPenalty = Math.max(motifPenalty, size * (similarity === 1 ? 4 : .6) * recency);
      if (dense && candidate.recipe === previous.recipe)
        recipePenalty = Math.max(recipePenalty, size * .95 * recency);
    }
    return recipeBonus + styleScore(candidate, style, level) -
      candidate.similarity * 70 - motifPenalty - recipePenalty;
  }
  pool.sort((a, b) => score(b) - score(a));
  if (pool.length) return { ...pool[0], style, fallback: false, diagnostics, budget };

  const { blocks, last } = size === 45 || size === 81
    ? denseFallback(size, nextInt)
    : { blocks: smallFallback(level as 0 | 1, state), last: undefined };
  shuffle(blocks, state);
  const distinct = new Set<number>();
  for (const [index, block] of blocks.entries()) {
    if (distinct.has(block[0])) continue;
    distinct.add(block[0]);
    diagnostics.fallbackAttempts++;
    // Distinct first digits guarantee at least nine different rotations.
    // At most eight exact boards are in history.
    const board = [...blocks.slice(index), ...blocks.slice(0, index)].flat();
    if (last !== undefined) board.push(last);
    const candidate = qualify({ board, proof: clearInReadingOrder(board, last !== undefined) }, "fallback");
    if (candidate) return { ...candidate, style, fallback: true, diagnostics, budget };
  }
  throw new Error("Cannot prepare a fresh classic game");
}

/** Mutate only a candidate; the caller publishes it after saving succeeds. */
export function takeGeneratedClassic(
  state: ClassicRun,
  attempt: string,
  level = state.difficulty,
): Session {
  if (!isClassicDifficulty(level)) throw new Error("Invalid classic difficulty");
  const { board, recipe, profile } = generateClassic(state, level);
  state.difficulty = level;
  state.recent = [...state.recent, board.join("")].slice(-8);
  state.current = { attempt, board: [...board] };
  state.scenarios ??= {};
  state.scenarios[level] = [...(state.scenarios[level] ?? []), { recipe, motif: profile.motif }]
    .slice(-CLASSIC_SCENARIO_HISTORY);
  const game = newSession();
  game.current.board = board;
  return game;
}
