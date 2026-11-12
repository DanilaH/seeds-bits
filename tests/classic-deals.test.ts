import { test, expect } from "vitest";
import {
  classicCatalog,
  newClassicDeals,
  readClassicDeals,
  takeClassicDeal,
  restartClassic,
} from "../src/classic-deals";
import {
  addNumbers,
  pairs,
  removePair,
  occupied,
  commit,
  newSession,
  classic,
} from "../src/core";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
  startAttempt,
} from "../src/progress";
import proofs from "../scripts/classic-variety/proofs.json";

test("all immutable catalog fields have a legal clear route, including forced additions", () => {
  expect(classicCatalog).toHaveLength(128);
  expect(new Set(classicCatalog.map((entry) => entry.board)).size).toBe(128);
  expect(
    classicCatalog.some((entry) => entry.board === classic().join("")),
  ).toBe(false);
  classicCatalog.forEach((entry, id) => {
    let board = entry.board.split("").map(Number),
      additions = 0;
    expect(new Set(board.filter(Boolean)).size).toBeGreaterThanOrEqual(7);
    expect(pairs(board).length).toBeGreaterThan(0);
    for (const move of proofs[id]) {
      if (move === null) {
        expect(pairs(board)).toEqual([]);
        expect(occupied(board)).toBeGreaterThan(1);
        board = addNumbers(board);
        additions++;
      } else board = removePair(board, move[0], move[1]);
    }
    expect(occupied(board), `field ${id}`).toBe(0);
    expect(additions).toBe(entry.family === "addition" ? 1 : 0);
    if (entry.family === "addition")
      expect(occupied(entry.board.split("").map(Number)) % 2).toBe(1);
  });
});
test("shuffle bag varies shapes, survives reload, and avoids cycle-edge repeats", () => {
  for (let seed = 0; seed < 40; seed++) {
    let state = newClassicDeals(seed);
    const ids: number[] = [];
    for (let n = 0; n < 384; n++) {
      const untouched = readClassicDeals(state)!;
      const parallel = readClassicDeals(state)!;
      expect(takeClassicDeal(state, `attempt-${n}`)).toEqual(
        takeClassicDeal(parallel, `attempt-${n}`),
      );
      expect(untouched.recent).toEqual(ids.slice(-8));
      const id = state.current!.id;
      expect(ids.slice(-8)).not.toContain(id);
      if (n)
        expect(classicCatalog[id].family).not.toBe(
          classicCatalog[ids.at(-1)!].family,
        );
      else expect(classicCatalog[id].family).toBe("compact");
      ids.push(id);
      state = readClassicDeals(JSON.parse(JSON.stringify(state)))!;
    }
    for (let n = 0; n < 3; n++)
      expect(new Set(ids.slice(n * 128, (n + 1) * 128)).size).toBe(128);
  }
});
test("restart repeats the actual field; stale origin cannot overwrite a legacy game", () => {
  const state = newClassicDeals(7);
  let game = takeClassicDeal(state, "current");
  const initial = [...game.current.board];
  const [pair] = pairs(initial);
  game = commit(game, removePair(initial, pair.a, pair.b), "pair", 0);
  expect(restartClassic(game, state, "current").current.board).toEqual(initial);
  expect(state.recent).toHaveLength(1);
  const legacy = newSession();
  legacy.current.board = [3, 7, 2, 8];
  expect(restartClassic(legacy, state, "different").current.board).toEqual([
    3, 7, 2, 8,
  ]);
  expect(restartClassic(game, undefined, "current").current.board).toEqual(
    initial,
  );
});
test("migration keeps all legacy state and recovers a malformed optional deal bag locally", () => {
  const p = fresh(),
    m = metadata(p);
  m.wallet = 17;
  startAttempt(p, "classic");
  const old = readProgress(serializeProgress(p));
  expect(old.sessions).toEqual(p.sessions);
  expect(old.meta?.classicDeals).toBeUndefined();
  m.classicDeals = newClassicDeals(51);
  p.sessions.classic = takeClassicDeal(m.classicDeals, m.attempts.classic.id);
  const saved = serializeProgress(p);
  expect(readProgress(saved)).toEqual(p);
  for (const bad of [
    null,
    { version: 2 },
    { ...m.classicDeals, bag: [128] },
    { ...m.classicDeals, bag: [1, 1] },
    { ...m.classicDeals, seed: -1 },
    { ...m.classicDeals, current: { id: 0, attempt: "" } },
  ]) {
    const raw = JSON.parse(saved);
    raw.meta.classicDeals = bad;
    let recovered = 0;
    const clean = readProgress(JSON.stringify(raw), () => recovered++);
    expect(clean.sessions).toEqual(p.sessions);
    expect(clean.meta?.wallet).toBe(17);
    expect(clean.meta?.attempts).toEqual(m.attempts);
    expect(clean.meta?.classicDeals).toBeUndefined();
    expect(recovered).toBe(1);
  }
});
