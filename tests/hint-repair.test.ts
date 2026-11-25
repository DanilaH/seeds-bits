import { expect, test } from "vitest";
import { checkPair, commit, occupied, removePair, undo } from "../src/core";
import { bookV5, loadBookV5 } from "../src/content-v5";
import { puzzleSession } from "../src/puzzles";
import { createSolver } from "../src/solver";
import { packSession, unpackSession } from "../src/history-codec";
import raw from "./hint-repair-cases.json" with { type: "json" };

const cases = raw as unknown as [number, [number, number], number[], boolean][];

test("all 98 audit alternatives return a verifiable continuation, including all 22 former UNKNOWN", async () => {
  expect(cases.filter(([, , , unknown]) => unknown)).toHaveLength(22);
  for (const [slot, first, suffix] of cases) {
    const id = "book-v1-" + slot;
    await loadBookV5(id);
    const puzzle = bookV5(id)!;
    const original = puzzleSession(puzzle);
    let current = commit(original, removePair(puzzle.board, ...first), "pair", 0);
    let certified = current.current.board;
    for (let i = 0; i < suffix.length; i += 2)
      certified = removePair(certified, suffix[i], suffix[i + 1]);
    expect(certified, `audit certificate ${slot}:${first}`).toEqual([]);
    const solve = createSolver(occupied(current.current.board) > 100 ? 2000 : 50000, puzzle);
    while (current.current.board.length) {
      const help = solve(current.current.board, current.history);
      if (help.kind !== "move") throw Error(`${slot}:${first} at move ${current.current.moves}: ${help.kind}`);
      const { a, b } = help.pair;
      expect(checkPair(current.current.board, a, b).ok).toBe(true);
      current = commit(current, removePair(current.current.board, a, b), "pair", 0);
    }
    expect(solve(current.current.board)).toEqual({ kind: "solved" });
  }
});

test("a fresh solver can recover after arbitrary moves, packed history, row compression and Undo", async () => {
  const id = "book-v1-1821";
  await loadBookV5(id);
  const puzzle = bookV5(id)!;
  const first = [2, 3] as const;
  const suffix = cases.find(([slot, pair]) => slot === 1821 && pair[0] === 2)![2];
  let game = puzzleSession(puzzle);
  game = commit(game, removePair(game.current.board, ...first), "pair", 10);
  const freshSolver = createSolver(2000, puzzle);
  expect(freshSolver(game.current.board)).toEqual({ kind: "unknown" });
  expect(freshSolver(game.current.board, [{ ...game.history[0], board: [5,5] }])).toEqual({ kind: "unknown" });
  let collapsed = false;
  for (let i = 0; i < suffix.length; i += 2) {
    const before = game.current.board;
    game = commit(game, removePair(before, suffix[i], suffix[i + 1]), "pair", i + 11);
    if (game.current.board.length < before.length && game.current.board.length) {
      collapsed = true;
      break;
    }
  }
  expect(collapsed).toBe(true);
  const restored = unpackSession(packSession(game));
  expect(restored).toEqual(game);
  for (const state of [restored, undo(restored)]) {
    const solver = createSolver(2000, puzzle);
    expect(solver(state.current.board, state.history).kind).toBe("move");
  }
  expect(createSolver(100, puzzle)([1,2])).toEqual({ kind: "dead" });
  expect(createSolver(0, puzzle)([1,2])).toEqual({ kind: "unknown" });
});
