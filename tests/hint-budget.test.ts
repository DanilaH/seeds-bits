import { test, expect } from "vitest";
import {
  fresh,
  startAttempt,
  readProgress,
  serializeProgress,
  metadata,
} from "../src/progress";
import {
  hintAttempt,
  hintKey,
  hintsLeft,
  spendHint,
  grantReward,
} from "../src/hint-budget";
import { commit, removePair, undo } from "../src/core";
test("three free reveals; same board and unordered pair never charges twice", () => {
  const p = fresh(),
    a = hintAttempt(p),
    board = [5, 5, 5, 5, 5, 5, 5, 5];
  for (let i = 0; i < 3; i++)
    expect(spendHint(a, hintKey(board, i * 2, i * 2 + 1))).toBe(true);
  expect(hintsLeft(a)).toBe(0);
  expect(spendHint(a, hintKey(board, 1, 0))).toBe(true);
  expect(hintsLeft(a)).toBe(0);
  expect(spendHint(a, hintKey(board, 6, 7))).toBe(false);
});
test("undo and reload preserve hint usage; explicit new attempt gets a fresh budget", () => {
  const p = fresh();
  p.sessions.classic.current.board = [5, 5, 5, 5];
  const a = hintAttempt(p),
    key = hintKey(p.sessions.classic.current.board, 0, 1);
  spendHint(a, key);
  p.sessions.classic = undo(
    commit(
      p.sessions.classic,
      removePair(p.sessions.classic.current.board, 0, 1),
      "pair",
      0,
    ),
  );
  const restored = readProgress(serializeProgress(p));
  expect(hintsLeft(hintAttempt(restored))).toBe(2);
  expect(spendHint(hintAttempt(restored), key)).toBe(true);
  expect(hintsLeft(hintAttempt(restored))).toBe(2);
  startAttempt(restored, "classic");
  expect(hintsLeft(hintAttempt(restored))).toBe(3);
});
test("native reward receipt is idempotent across save/reload and belongs to its attempt", () => {
  const p = fresh(),
    a = hintAttempt(p),
    r = { token: "one-reward", attempt: a.id };
  p.active = "book-v1-1";
  const other = hintAttempt(p);
  expect(grantReward(p, r)).toBe(true);
  expect(grantReward(p, r)).toBe(true);
  expect(a.hintBonus).toBe(3);
  expect(other.hintBonus).toBeUndefined();
  const q = readProgress(serializeProgress(p));
  expect(grantReward(q, r)).toBe(true);
  expect(metadata(q).attempts.classic.hintBonus).toBe(3);
  expect(grantReward(q, { token: "unknown", attempt: "missing" })).toBe(false);
});
