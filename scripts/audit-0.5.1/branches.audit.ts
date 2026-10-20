import { test, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { notebook, loadNotebook, daily } from "../../src/puzzles";
import { pairs, removePair, occupied } from "../../src/core";
import { createSolver } from "../../src/solver";
test("sample off-path choices in ten late notebooks and daily date boundaries", async () => {
  await loadNotebook();
  const results = [];
  for (const v of [0, 1, 9, 19, 39, 59, 79, 89, 98, 99]) {
    const p = notebook[v * 24 + 23];
    const alternatives = pairs(p.board)
      .filter((q) => q.a !== p.solution[0].a || q.b !== p.solution[0].b)
      .slice(0, 3);
    for (const q of alternatives) {
      const b = removePair(p.board, q.a, q.b),
        start = performance.now(),
        a = createSolver(occupied(b) > 100 ? 2000 : 50000, p)(b);
      if (a.kind === "move")
        expect(pairs(b).some((r) => r.a === a.pair.a && r.b === a.pair.b)).toBe(
          true,
        );
      results.push({
        id: p.id,
        pair: q,
        kind: a.kind,
        ms: Math.round(performance.now() - start),
      });
    }
  }
  const dates = [
    "2025-01-01",
    "2028-02-29",
    "2028-06-20",
    "2099-12-31",
    "2100-02-28",
    "2400-02-29",
  ];
  for (const date of dates) {
    const p = daily(date);
    let b = p.board;
    for (const q of p.solution) b = removePair(b, q.a, q.b);
    expect(occupied(b)).toBe(0);
    expect(daily(date)).toEqual(p);
  }
  writeFileSync(
    "docs/audit-0.5.1/branches.json",
    JSON.stringify({ results, dates }, null, 2),
  );
});
