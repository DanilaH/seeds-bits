import { test, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { daily, notebook, days, trophy, nextTask } from "../../src/puzzles";
import { removePair, occupied, commit, undo, decode } from "../../src/core";
import { createSolver } from "../../src/solver";
import {
  fresh,
  metadata,
  recordCompletion,
  startAttempt,
  readProgress,
} from "../../src/progress";
test("1461 dates + notebook: verified hints clear each board; full undo and serialization preserve every position", () => {
  let max = 0,
    totalMoves = 0;
  for (const p of [
    ...notebook,
    ...Array.from({ length: 1461 }, (_, i) =>
      daily(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)),
    ),
  ]) {
    const solve = createSolver(0, p);
    let s = {
      rules: 1 as const,
      current: { board: p.board, scroll: 0, moves: 0, additions: 0 },
      history: [] as any[],
    };
    const initial = JSON.stringify(s.current);
    while (occupied(s.current.board)) {
      const t = performance.now(),
        a = solve(s.current.board);
      max = Math.max(max, performance.now() - t);
      expect(a.kind).toBe("move");
      if (a.kind !== "move") break;
      const before = occupied(s.current.board);
      s = commit(s, removePair(s.current.board, a.pair.a, a.pair.b), "pair", 0);
      expect(occupied(s.current.board)).toBe(before - 2);
      totalMoves++;
    }
    s = decode(JSON.stringify(s));
    while (s.history.length) s = undo(s);
    expect(JSON.stringify(s.current)).toBe(initial);
  }
  writeFileSync(
    "docs/audit-0.4.0/content.json",
    JSON.stringify(
      { dates: 1461, notebook: 24, totalMoves, maxVerifiedHintMs: max },
      null,
      2,
    ),
  );
}, 120000);
test("1000 attempts with deterministic hint/reload/rewin variation match independent counters", () => {
  let p = fresh(),
    wins = 0,
    clean = 0;
  metadata(p);
  for (let i = 0; i < 1000; i++) {
    const id = i % 3 === 0 ? "classic" : `book-v1-${1 + (i % 24)}`;
    startAttempt(p, id);
    p.hints[id] = i % 4 === 0 ? 1 : 0;
    recordCompletion(p, id);
    wins++;
    if (!p.hints[id]) clean++;
    p = readProgress(JSON.stringify(p));
    recordCompletion(p, id);
    expect(metadata(p).completed).toBe(wins);
    expect(metadata(p).unassisted).toBe(clean);
  }
  expect(p.done.length).toBe(16);
});
test("all month lengths and archived days give one nondecreasing medal per month", () => {
  for (let year = 2026; year <= 2030; year++)
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, "0")}`,
        dates = days(month);
      let rank = 0;
      for (let n = 0; n <= dates.length; n++) {
        const done = dates.slice(0, n).map((d) => "daily-v1-" + d);
        const t = trophy(month, [...done, ...done]);
        expect(t.count).toBe(n);
        expect(t.tier).toBeGreaterThanOrEqual(rank);
        expect(t.tier).toBe(
          n === dates.length ? 3 : n >= 14 ? 2 : n >= 7 ? 1 : 0,
        );
        rank = t.tier;
      }
    }
});
test("daily next selection agrees with independent finite list for every gap", () => {
  const ids = Array.from(
    { length: 120 },
    (_, i) =>
      "daily-v1-" +
      new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
  );
  for (let i = 0; i < ids.length; i++) {
    const done = ids.filter((_, j) => j % 7 !== i % 7 || j === i);
    const expected = [...ids.slice(i + 1), ...ids.slice(0, i).reverse()].find(
      (id) => !done.includes(id),
    );
    expect(nextTask(ids[i], done, ids.at(-1)!.slice(9))).toBe(expected);
  }
});
