import { createSolver } from "./solver";
import type { Puzzle } from "./puzzles";
import { occupied, type Board, type Snapshot } from "./core";
self.onmessage = (
  event: MessageEvent<{ board: Board; history: Snapshot[]; puzzle: Puzzle }>,
) => {
  const { board, history, puzzle } = event.data;
  const solve = createSolver(occupied(board) > 100 ? 2000 : 50000, puzzle),
    advice = solve(board);
  let recovery = -1;
  const recoverySolve =
    advice.kind === "unknown" ? createSolver(0, puzzle) : solve;
  if (advice.kind === "dead" || advice.kind === "unknown")
    for (let i = history.length - 1; i >= 0; i--) {
      if (recoverySolve(history[i].board).kind === "move") {
        recovery = i;
        break;
      }
    }
  self.postMessage({ advice, recovery });
};
