import { test, expect } from "vitest";
import {
  CLASSIC_DEFAULT,
  generateClassic,
  newClassicRun,
  readClassicRun,
  takeGeneratedClassic,
  type ClassicDifficulty,
} from "../src/classic-generator";
import { addNumbers, classic, occupied, pairs, removePair } from "../src/core";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
  startAttempt,
} from "../src/progress";

test("three bands generate new, playable fields; normal retains the original digit multiset", () => {
  for (const level of [0, 1, 2] as ClassicDifficulty[]) {
    const fields = new Set<string>();
    for (let seed = 0; seed < 160; seed++) {
      const state = newClassicRun(seed);
      const { board: initial, proof } = generateClassic(state, level);
      fields.add(initial.join(""));
      expect(initial).toHaveLength([18, 28, 27][level]);
      expect(new Set(initial).size).toBeGreaterThanOrEqual(6);
      expect(pairs(initial).length).toBeGreaterThan(0);
      if (level === 1) expect([...initial].sort()).toEqual(classic().sort());
      let board = initial;
      let additions = 0;
      for (const move of proof) {
        if (move) board = removePair(board, move[0], move[1]);
        else {
          expect(pairs(board)).toEqual([]);
          board = addNumbers(board);
          additions++;
        }
      }
      expect(occupied(board), `level ${level}, seed ${seed}`).toBe(0);
      if (level === 0) {
        expect(additions).toBe(0);
        let simple = initial;
        for (let move = 0; move < 9; move++) {
          const pair = pairs(simple)[0];
          expect(pair).toBeDefined();
          simple = removePair(simple, pair.a, pair.b);
        }
        expect(occupied(simple)).toBe(0);
      }
      if (level === 2) expect(additions).toBeGreaterThanOrEqual(1);
    }
    expect(fields.size).toBe(160);
  }
});

test("selection is deterministic across saves, remembers the band and avoids recent fields", () => {
  let state = newClassicRun(123);
  expect(state.difficulty).toBe(CLASSIC_DEFAULT);
  for (let n = 0; n < 48; n++) {
    const before = readClassicRun(state)!;
    const parallel = readClassicRun(state)!;
    const level = (n % 3) as ClassicDifficulty;
    const game = takeGeneratedClassic(state, `attempt-${n}`, level);
    expect(game).toEqual(takeGeneratedClassic(parallel, `attempt-${n}`, level));
    expect(before.recent).not.toContain(game.current.board.join(""));
    expect(state.difficulty).toBe(level);
    expect(state.current!.board).toEqual(game.current.board);
    state = readClassicRun(JSON.parse(JSON.stringify(state)))!;
  }
});

test("legacy saves keep the actual game, while corrupt generation metadata recovers separately", () => {
  const p = fresh();
  const m = metadata(p);
  expect(readProgress(serializeProgress(p)).meta?.classicRun).toBeUndefined();
  startAttempt(p, "classic");
  m.classicRun = newClassicRun(123);
  p.sessions.classic = takeGeneratedClassic(
    m.classicRun,
    m.attempts.classic.id,
  );
  const raw = serializeProgress(p);
  expect(readProgress(raw)).toEqual(p);
  for (const bad of [
    null,
    { version: 2 },
    { ...m.classicRun, difficulty: 3 },
    { ...m.classicRun, seed: -1 },
    { ...m.classicRun, current: { attempt: "", board: classic() } },
    { ...m.classicRun, difficulty: 0 },
  ]) {
    const modified = JSON.parse(raw);
    modified.meta.classicRun = bad;
    let recoveries = 0;
    const recovered = readProgress(
      JSON.stringify(modified),
      () => recoveries++,
    );
    expect(recovered.sessions).toEqual(p.sessions);
    expect(recovered.meta!.attempts).toEqual(m.attempts);
    expect(recovered.meta!.classicRun).toBeUndefined();
    expect(recoveries).toBe(1);
  }
});
