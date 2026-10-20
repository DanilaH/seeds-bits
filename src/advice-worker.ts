import { createSolver } from "./solver";
import type { Puzzle } from "./puzzles";
import type { Board, Snapshot } from "./core";
self.onmessage = (
  event: MessageEvent<{ board: Board; history: Snapshot[]; puzzle: Puzzle }>,
) => {
  const { board, history, puzzle } = event.data;
  const solve = createSolver(50000, puzzle),
    advice = solve(board);
  let recovery = -1;
  if (advice.kind === "dead")
    for (let i = history.length - 1; i >= 0; i--) {
      if (solve(history[i].board).kind === "move") {
        recovery = i;
        break;
      }
    }
  self.postMessage({ advice, recovery });
};
