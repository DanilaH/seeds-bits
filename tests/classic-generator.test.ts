import { test, expect } from "vitest";
import {
  CLASSIC_DEFAULT,
  CLASSIC_SIZES,
  CLASSIC_SCENARIO_HISTORY,
  generateClassic,
  newClassicRun,
  readClassicRun,
  takeGeneratedClassic,
  type ClassicDifficulty,
} from "../src/classic-generator";
import { addNumbers, classic, commit, occupied, pairs, removePair, undo } from "../src/core";
import { classicStructure, measureClassic, tryClassicOrder } from "../src/classic-profile";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
  startAttempt,
} from "../src/progress";

test("four bands generate new, playable fields; normal retains the original digit multiset", () => {
  for (const level of [0, 1, 2, 3] as ClassicDifficulty[]) {
    const fields = new Set<string>();
    for (let seed = 0; seed < 160; seed++) {
      const state = newClassicRun(seed);
      const { board: initial, proof } = generateClassic(state, level);
      fields.add(initial.join(""));
      expect(initial).toHaveLength(CLASSIC_SIZES[level]);
      expect(occupied(initial)).toBe(CLASSIC_SIZES[level]);
      expect(initial.join("")).not.toBe(classic().join(""));
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
      if (level >= 2) expect(additions).toBeGreaterThanOrEqual(1);
    }
    expect(fields.size).toBe(160);
  }
}, 30000);

test("selection is deterministic across saves, remembers the band and avoids recent fields", () => {
  let state = newClassicRun(123);
  expect(state.difficulty).toBe(CLASSIC_DEFAULT);
  for (let n = 0; n < 48; n++) {
    const before = readClassicRun(state)!;
    const parallel = readClassicRun(state)!;
    const level = (n % 4) as ClassicDifficulty;
    const game = takeGeneratedClassic(state, `attempt-${n}`, level);
    expect(game).toEqual(takeGeneratedClassic(parallel, `attempt-${n}`, level));
    expect(before.recent).not.toContain(game.current.board.join(""));
    expect(state.recent.length).toBeLessThanOrEqual(8);
    const scenario = state.scenarios![level]!.at(-1);
    const selected = generateClassic(before, level);
    expect(scenario).toEqual({ recipe: selected.recipe, motif: selected.profile.motif });
    expect(state.scenarios![level]!.length).toBeLessThanOrEqual(CLASSIC_SCENARIO_HISTORY);
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
    { ...m.classicRun, difficulty: 4 },
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


test("exhausting attempts produces a certified same-size field, without repeating its recent deals", () => {
  for (const level of [0, 1, 2, 3] as const) {
    const state = newClassicRun(12081);
    const first = generateClassic(state, level, { attempts: 0 });
    expect(first.fallback).toBe(true);
    const next = newClassicRun(12081);
    next.recent.push(first.board.join(""));
    const second = generateClassic(next, level, { attempts: 0 });
    expect(second.fallback).toBe(true);
    expect(second.board).not.toEqual(first.board);
    expect(second.diagnostics).toMatchObject({ attempts: 0, candidates: 0, fallbackAttempts: 2 });
    expect(second.board.length).toBe(CLASSIC_SIZES[level]);
    expect(occupied(second.board)).toBe(CLASSIC_SIZES[level]);
    expect(measureClassic(second.board, second.proof).additions).toBe(Number(level >= 2));
    if (!level) expect(tryClassicOrder(second.board, "first", 0, 9).outcome).toBe("FOUND");
  }
});

test("legacy High keeps its 27-digit board, Undo and generator seed in the new format", () => {
  const initial = [1,6,1,5,1,5,6,1,4,1,8,1,9,8,7,1,7,1,2,1,4,3,1,3,1,9,2];
  const p = fresh();
  startAttempt(p, "classic");
  const m = metadata(p);
  const run = newClassicRun(3384638011);
  m.classicRun = { ...run, difficulty: 2, recent: [initial.join("")],
    current: { attempt: m.attempts.classic.id, board: initial } };
  p.sessions.classic.current.board = initial;
  p.sessions.classic = commit(p.sessions.classic, removePair(initial, 0, 9), "pair", 19);
  p.jars!.seeds = 74;
  m.wallet = 7;
  const restored = readProgress(serializeProgress(p));
  expect(restored).toEqual(p);
  expect(undo(restored.sessions.classic).current.board).toEqual(initial);
  expect(takeGeneratedClassic(restored.meta!.classicRun!, "next", 2).current.board).toHaveLength(45);
});

test("structural identity preserves geometry and complementary value roles", () => {
  expect(classicStructure([1, 9, 5, 2, 8])).toBe(classicStructure([4, 6, 5, 7, 3]));
  expect(classicStructure([1, 9, 5, 2, 8])).not.toBe(classicStructure([1, 1, 5, 2, 8]));
  expect(classicStructure([1, 0, 2, 1])).not.toBe(classicStructure([1, 2, 1, 0]));
  expect(tryClassicOrder([1, 2, 3], "last", 0, 12).outcome).toBe("UNKNOWN");
});

test("a scenario records the winning recipe when the requested preference loses", () => {
  const state = newClassicRun(15);
  const selected = generateClassic(newClassicRun(15), 2);
  expect(selected.style).toBe("gaps");
  expect(selected.recipe).toBe("stock");
  takeGeneratedClassic(state, "actual-recipe", 2);
  const restored = readClassicRun(JSON.parse(JSON.stringify(state)))!;
  expect(restored.scenarios?.[2]).toEqual([{ recipe: "stock", motif: selected.profile.motif }]);

  const legacy = { ...restored, scenarios: undefined, rotation: { 2: ["stock", "gaps"] } };
  const migrated = readClassicRun(legacy)!;
  expect(migrated.scenarios).toBeUndefined();
  expect(migrated.current).toEqual(restored.current);
  expect(migrated.recent).toEqual(restored.recent);
  expect(migrated.seed).toBe(restored.seed);
});

test("the audited High45 series varies the first Add on deals 29 and 30", () => {
  let state = newClassicRun(12081);
  const motifs = [];
  for (let number = 1; number <= 30; number++) {
    takeGeneratedClassic(state, `audit-${number}`, 2);
    state = readClassicRun(JSON.parse(JSON.stringify(state)))!;
    if (number >= 29) motifs.push(state.scenarios![2]!.at(-1)!.motif);
  }
  expect(motifs.map(motif => motif.stage)).toEqual(["first-add", "first-add"]);
  expect(motifs[0].structure).not.toBe(motifs[1].structure);
});
