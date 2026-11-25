import { checkPair, occupied, pairs, removePair, type Board, type Connection, type Snapshot } from "./core";
import { survivingIndices } from "./content-v5-generator";

type StablePair = readonly [number, number];
type KnownStep = { board: Board; origins: number[]; pair: Connection; stable: StablePair };

function survivingOrigins(board: Board, origins: number[], { a, b }: Connection) {
  const blank = [...board];
  blank[a] = blank[b] = 0;
  return survivingIndices(blank).map(i => origins[i]);
}

export function traceWitness(initial: Board, solution: readonly Connection[]): KnownStep[] {
  let board = initial;
  let origins = initial.map((_, i) => i);
  const steps: KnownStep[] = [];
  for (const { a, b } of solution) {
    const checked = checkPair(board, a, b);
    if (!checked.ok) return [];
    const pair = checked.path;
    steps.push({ board, origins, pair, stable: [origins[a], origins[b]] });
    origins = survivingOrigins(board, origins, pair);
    board = removePair(board, a, b);
  }
  return occupied(board) ? [] : steps;
}

const same = (a: Board, b: Board) => a.length === b.length && a.every((digit, i) => digit === b[i]);

function historicalPair(before: Board, after: Board): Connection | undefined {
  if (after.length > before.length) return;
  if (after.length === before.length) {
    const changed = before.flatMap((digit, i) => digit !== after[i] ? [i] : []);
    if (changed.length !== 2 || changed.some(i => after[i])) return;
    const checked = checkPair(before, changed[0], changed[1]);
    if (checked.ok) return checked.path;
    return;
  }
  return pairs(before).find(pair => same(removePair(before, pair.a, pair.b), after));
}

/** Keep any still-legal witness pairs, retrying deferred pairs after blockers move. */
export function* repairWitness(
  initial: Board,
  history: readonly Snapshot[],
  trace: readonly KnownStep[],
) {
  // A notebook without Add can remove at most one pair for each archived step.
  if (!history.length || history.length >= trace.length) return;
  const start = trace.findIndex(step => same(step.board, history[0].board));
  if (start < 0) return;
  let origins = trace[start].origins;
  for (let i = 0; i < history.length; i++) {
    const board = history[i].board;
    const next = history[i + 1]?.board ?? initial;
    const pair = historicalPair(board, next);
    if (!pair) return;
    origins = survivingOrigins(board, origins, pair);
  }
  const stable = trace.slice(start).map(step => step.stable);
  for (const schedule of [stable, stable.slice(1)]) {
    // When a witness pair uses the same digits differently, the residual search
    // can need those digits available even though the original pair is legal.
    if (schedule !== stable && (!initial[origins.indexOf(stable[0][0])] ||
        !initial[origins.indexOf(stable[0][1])])) continue;
    let board = initial;
    let currentOrigins = origins;
    const prefix: Connection[] = [];
    let pending = schedule;
    while (pending.length && occupied(board)) {
      const deferred: StablePair[] = [];
      for (const [left, right] of pending) {
        const a = currentOrigins.indexOf(left), b = currentOrigins.indexOf(right);
        if (!board[a] || !board[b]) continue;
        const checked = checkPair(board, a, b);
        if (!checked.ok) {
          deferred.push([left, right]);
          continue;
        }
        prefix.push(checked.path);
        currentOrigins = survivingOrigins(board, currentOrigins, checked.path);
        board = removePair(board, a, b);
      }
      if (deferred.length === pending.length) break;
      pending = deferred;
    }
    if (prefix.length) yield { board, prefix };
  }
}
