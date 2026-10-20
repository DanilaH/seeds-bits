import {
  pairs,
  removePair,
  occupied,
  type Board,
  type Connection,
} from "./core";
export type Advice =
  { kind: "move"; pair: Connection } | { kind: "solved" | "dead" | "unknown" };
/** Bounded exact search for small puzzles only. Never present an unverified move as help. */
export function createSolver(
  limit = 50000,
  known?: { board: Board; solution: Connection[] },
) {
  const memo = new Map<string, Connection | null>();
  if (known) {
    let board = known.board;
    const verified: [string, Connection][] = [];
    try {
      for (const pair of known.solution) {
        verified.push([board.join(""), pair]);
        board = removePair(board, pair.a, pair.b);
      }
      if (!occupied(board))
        for (const [key, pair] of verified) memo.set(key, pair);
    } catch {
      /* Ignore invalid supplied paths; exact search remains available. */
    }
  }
  return (initial: Board): Advice => {
    let visited = 0;
    const search = (board: Board): Connection | null => {
      if (!occupied(board)) return null;
      const key = board.join("");
      if (memo.has(key)) return memo.get(key)!;
      if (++visited > limit) throw new Error("budget");
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
      const pair = search(initial);
      // Bound cache growth across daily tasks.
      if (memo.size > 100000) memo.clear();
      return pair ? { kind: "move", pair } : { kind: "dead" };
    } catch {
      return { kind: "unknown" };
    }
  };
}
