import { it, expect } from "vitest";
import { createSolver } from "../src/solver";
import { notebook, daily, days } from "../src/puzzles";
import { occupied, removePair } from "../src/core";
it("verified advice solves all notebook puzzles and a month of daily puzzles", () => {
  const solve = createSolver();
  for (const p of [...notebook, ...days("2026-10").map(daily)]) {
    let board = p.board;
    for (let i = 0; i < 24 && occupied(board); i++) {
      const advice = solve(board);
      expect(advice.kind, p.id).toBe("move");
      if (advice.kind === "move")
        board = removePair(board, advice.pair.a, advice.pair.b);
    }
    expect(occupied(board), p.id).toBe(0);
  }
});
it("detects the former task-seven hint trap and respects the search budget", () => {
  let board = notebook[6].board;
  for (const [a, b] of [
    [2, 22],
    [7, 25],
    [9, 10],
  ])
    board = removePair(board, a, b);
  expect(createSolver()(board).kind).toBe("dead");
  expect(createSolver(0)(notebook[6].board).kind).toBe("unknown");
});
