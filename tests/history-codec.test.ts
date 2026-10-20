import { test, expect } from "vitest";
import { packSession, unpackSession } from "../src/history-codec";
import {
  fresh,
  readProgress,
  serializeProgress,
  FutureProgress,
} from "../src/progress";
import {
  newSession,
  commit,
  removePair,
  addNumbers,
  pairs,
  undo,
} from "../src/core";
import { notebook, loadNotebook, puzzleSession } from "../src/puzzles";
import { writeFileSync, mkdirSync } from "node:fs";
test("legacy migration preserves every undo including additions, collapse and branches", () => {
  for (let run = 0; run < 30; run++) {
    let s = newSession();
    for (let step = 0; step < 80; step++) {
      const ps = pairs(s.current.board);
      if (!s.current.board.length) break;
      try {
        s = commit(
          s,
          ps.length
            ? removePair(
                s.current.board,
                ps[(run + step) % ps.length].a,
                ps[(run + step) % ps.length].b,
              )
            : addNumbers(s.current.board),
          ps.length ? "pair" : "add",
          step * 3.5,
        );
      } catch {
        break;
      }
    }
    const p = fresh();
    p.sessions.classic = s;
    for (const version of [2, 3]) {
      const migrated = readProgress(JSON.stringify({ ...p, version }));
      let restored = readProgress(serializeProgress(migrated)).sessions.classic,
        original = s;
      expect(restored).toEqual(original);
      while (original.history.length) {
        restored = undo(restored);
        original = undo(original);
        expect(restored).toEqual(original);
      }
    }
    let branch = undo(s);
    const ps = pairs(branch.current.board);
    if (ps.length) {
      branch = commit(
        branch,
        removePair(branch.current.board, ps[0].a, ps[0].b),
        "pair",
        99,
      );
      expect(unpackSession(packSession(branch))).toEqual(branch);
    }
  }
});
test("partial rows, repeated rows and mutable current scroll round-trip exactly", () => {
  let s = newSession();
  s.current.board = Array(44).fill(5);
  s = commit(s, removePair(s.current.board, 0, 1), "pair", 4);
  packSession(s);
  s.current.scroll = 123.5;
  expect(unpackSession(packSession(s))).toEqual(s);
});
test("damaged packed history preserves current board and other tasks with recovery notice", () => {
  const p = fresh();
  p.sessions["book-v1-1"] = newSession();
  const raw = JSON.parse(serializeProgress(p));
  raw.sessions.classic.packedHistory = [[0, 0, 0, [[9999, 9]]]];
  let recovered = 0;
  const restored = readProgress(JSON.stringify(raw), () => recovered++);
  expect(restored.sessions.classic.current).toEqual(p.sessions.classic.current);
  expect(restored.sessions.classic.history).toEqual([]);
  expect(restored.sessions["book-v1-1"]).toEqual(p.sessions["book-v1-1"]);
  expect(recovered).toBe(1);
  expect(() => readProgress(JSON.stringify({ ...raw, version: 5 }))).toThrow(
    FutureProgress,
  );
});
test("all hundred unfinished notebooks fit comfortably and every snapshot survives", async () => {
  await loadNotebook();
  const p = fresh();
  for (let v = 0; v < 100; v++) {
    const puzzle = notebook[v * 24 + 23];
    let s = puzzleSession(puzzle);
    for (const pair of puzzle.solution.slice(
      0,
      Math.min(100, puzzle.solution.length - 1),
    ))
      s = commit(
        s,
        removePair(s.current.board, pair.a, pair.b),
        "pair",
        s.current.moves * 1.25,
      );
    p.sessions[puzzle.id] = s;
  }
  const legacy = JSON.stringify(p),
    t = performance.now(),
    packed = serializeProgress(p),
    encodeMs = performance.now() - t;
  const restored = readProgress(packed);
  const warmStart = performance.now();
  serializeProgress(p);
  const warmEncodeMs = performance.now() - warmStart;
  writeFileSync("/tmp/seeds052-compact-fixture.json", packed);
  expect(restored.sessions).toEqual(p.sessions);
  expect(packed.length).toBeLessThan(legacy.length * 0.3);
  expect(packed.length).toBeLessThan(1_500_000);
  mkdirSync("docs/releases/0.5.2-evidence", { recursive: true });
  writeFileSync(
    "docs/releases/0.5.2-evidence/compact-history.json",
    JSON.stringify(
      {
        legacyChars: legacy.length,
        packedChars: packed.length,
        reductionPercent: 100 * (1 - packed.length / legacy.length),
        encodeMs,
        warmEncodeMs,
        historyEntries: Object.values(p.sessions).reduce(
          (n, s) => n + s.history.length,
          0,
        ),
      },
      null,
      2,
    ),
  );
}, 120000);
