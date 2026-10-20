import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { notebook, loadNotebook, daily, availableDay } from "../src/puzzles";
import { createSolver } from "../src/solver";
import { removePair, occupied } from "../src/core";
function shape(board: readonly number[]) {
  const groups = new Map<number, [number, number]>();
  return board
    .map((v) => {
      if (!v) return "0";
      if (v === 5) return "X";
      const g = Math.min(v, 10 - v);
      if (!groups.has(g)) groups.set(g, [groups.size + 1, v]);
      const [n, first] = groups.get(g)!;
      return `${n}${v === first ? "a" : "b"}`;
    })
    .join(",");
}
test("all 2400 layouts differ even after renaming equal/complementary digits; original content remains exact", async () => {
  await loadNotebook();
  const old = JSON.parse(readFileSync("src/notebook.json", "utf8"));
  expect(notebook.slice(0, 24)).toEqual(old);
  expect(new Set(notebook.map((p) => shape(p.board))).size).toBe(2400);
  expect(
    Math.min(...notebook.slice(-24).map((p) => occupied(p.board))),
  ).toBeGreaterThan(400);
});
test(
  "every volume has a fully verified, zero-search hint path including the largest boards",
  { timeout: 120000 },
  async () => {
    await loadNotebook();
    for (let v = 0; v < 100; v++) {
      const p = notebook[v * 24 + 23],
        solve = createSolver(0, p);
      let b = p.board;
      while (occupied(b)) {
        const a = solve(b);
        expect(a.kind, p.id).toBe("move");
        if (a.kind !== "move") throw Error(p.id);
        b = removePair(b, a.pair.a, a.pair.b);
      }
    }
  },
);
test("archive dates are deterministic back to Jan 2025 and through June 2028", () => {
  for (const day of ["2025-01-01", "2025-12-31", "2028-06-20"]) {
    const p = daily(day);
    expect(daily(day)).toEqual(p);
    let b = p.board;
    for (const pair of p.solution) b = removePair(b, pair.a, pair.b);
    expect(b).toEqual([]);
  }
  expect(availableDay("2024-12-31", "2028-06-20")).toBe(false);
  expect(availableDay("2025-01-01", "2028-06-20")).toBe(true);
  expect(availableDay("2028-06-21", "2028-06-20")).toBe(false);
});
