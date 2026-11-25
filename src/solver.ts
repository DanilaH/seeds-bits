import { pairs, removePair, occupied, type Board, type Connection, type Snapshot } from "./core";
import { repairWitness, traceWitness } from "./repair-witness";

export type Advice =
  { kind: "move"; pair: Connection } | { kind: "solved" | "dead" | "unknown" };

const exhausted = Symbol("search budget");
const LARGE_NOTEBOOK_DIGITS = 56;
const REPAIR_SEARCH_LIMIT = 256;
const REPAIR_MAX_DIGITS = 20;

/** Exact with a node budget. Every returned pair has a complete winning continuation. */
export function createSolver(
  limit = 50000,
  known?: { board: Board; solution: Connection[] },
) {
  const memo = new Map<string, Connection | null>();
  const trace = known ? traceWitness(known.board, known.solution) : [];
  const canRepair = known && occupied(known.board) >= LARGE_NOTEBOOK_DIGITS;
  for (const { board, pair } of trace) memo.set(board.join(""), pair);

  return (initial: Board, history: readonly Snapshot[] = []): Advice => {
    let visited = 0;
    let budget = limit;
    const search = (board: Board): Connection | null => {
      if (!occupied(board)) return null;
      const key = board.join("");
      if (memo.has(key)) return memo.get(key)!;
      if (visited >= budget) throw exhausted;
      visited++;
      for (const pair of pairs(board)) {
        const next = removePair(board, pair.a, pair.b);
        if (!occupied(next) || search(next)) {
          memo.set(key, pair);
          return pair;
        }
      }
      memo.set(key, null);
      return null;
    };
    if (!occupied(initial)) return { kind: "solved" };
    try {
      if (limit && canRepair && history.length && !memo.has(initial.join(""))) {
        // Both repairs share a small part of the original exact-search budget.
        budget = Math.min(limit, REPAIR_SEARCH_LIMIT);
        for (const repaired of repairWitness(initial, history, trace)) {
          if (occupied(repaired.board) > REPAIR_MAX_DIGITS) continue;
          let completes = false;
          try {
            completes = !occupied(repaired.board) || Boolean(search(repaired.board));
          } catch (error) {
            if (error !== exhausted) throw error;
          }
          if (completes) {
            let board = initial;
            for (const pair of repaired.prefix) {
              memo.set(board.join(""), pair);
              board = removePair(board, pair.a, pair.b);
            }
            break;
          }
        }
        budget = limit;
      }
      const pair = search(initial);
      // Bound cache growth across daily tasks.
      if (memo.size > 100000) memo.clear();
      return pair ? { kind: "move", pair } : { kind: "dead" };
    } catch (error) {
      if (error !== exhausted) throw error;
      return { kind: "unknown" };
    }
  };
}
