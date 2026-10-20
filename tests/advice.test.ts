import { it, expect } from "vitest";
import { createSolver } from "../src/solver";
import { notebook, daily, days } from "../src/puzzles";
import { occupied, removePair } from "../src/core";
it("exact search solves the original 24 notebook puzzles and a month of daily puzzles", () => {
  const solve = createSolver();
  for (const p of [...notebook.slice(0, 24), ...days("2026-10").map(daily)]) {
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
it("known solution seeds solve all 730 daily puzzles without searching", () => {
  for (let n = 0; n < 730; n++) {
    const p = daily(
      new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10),
    );
    const solve = createSolver(0, p);
    let board = p.board;
    while (occupied(board)) {
      const a = solve(board);
      expect(a.kind, p.id).toBe("move");
      if (a.kind !== "move") break;
      board = removePair(board, a.pair.a, a.pair.b);
    }
    expect(occupied(board)).toBe(0);
  }
}, 30000);
it("invalid supplied solutions cannot certify a move", () => {
  const p = notebook[0];
  expect(
    createSolver(0, {
      board: p.board,
      solution: [{ a: 0, b: 0, kind: "straight" }],
    })(p.board).kind,
  ).toBe("unknown");
});
