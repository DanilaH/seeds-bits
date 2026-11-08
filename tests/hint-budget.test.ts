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
    expect(spendHint(p, hintKey(board, i * 2, i * 2 + 1))).toBe(true);
  expect(hintsLeft(p)).toBe(0);
  expect(spendHint(p, hintKey(board, 1, 0))).toBe(true);
  expect(hintsLeft(p)).toBe(0);
  expect(spendHint(p, hintKey(board, 6, 7))).toBe(false);
});
test("undo and reload preserve hint usage; explicit new attempt gets a fresh budget", () => {
  const p = fresh();
  p.sessions.classic.current.board = [5, 5, 5, 5];
  const a = hintAttempt(p),
    key = hintKey(p.sessions.classic.current.board, 0, 1);
  spendHint(p, key);
  p.sessions.classic = undo(
    commit(
      p.sessions.classic,
      removePair(p.sessions.classic.current.board, 0, 1),
      "pair",
      0,
    ),
  );
  const restored = readProgress(serializeProgress(p));
  expect(hintsLeft(restored)).toBe(2);
  expect(spendHint(restored, key)).toBe(true);
  expect(hintsLeft(restored)).toBe(2);
  startAttempt(restored, "classic");
  expect(hintsLeft(restored)).toBe(3);
});
test("native reward receipt is idempotent across save/reload and survives attempt replacement and is shared", () => {
  const p = fresh(),
    a = hintAttempt(p),
    r = { token: "one-reward", attempt: a.id };
  p.active = "book-v1-1";
  const other = hintAttempt(p);
  expect(grantReward(p, r)).toBe(true);
  expect(grantReward(p, r)).toBe(true);
  expect(metadata(p).wallet).toBe(3);
  expect(other.hintBonus).toBeUndefined();
  const q = readProgress(serializeProgress(p));
  expect(grantReward(q, r)).toBe(true);
  expect(metadata(q).wallet).toBe(3);
  startAttempt(q, "classic");
  expect(hintsLeft(q)).toBe(6);
  expect(grantReward(q, { token: "unknown", attempt: "missing" })).toBe(true);
  expect(metadata(q).wallet).toBe(6);
});

test("unused legacy bonus migrates once; earned wallet is spent after free hints", () => {
  const p = fresh();
  const m = metadata(p);
  const a = hintAttempt(p);
  a.hintKeys = ["used1", "used2", "used3", "used4"];
  a.hintBonus = 6;
  const old = JSON.parse(JSON.stringify(p));
  old.meta.version = 1;
  delete old.meta.wallet;
  const q = readProgress(JSON.stringify(old));
  expect(metadata(q).wallet).toBe(5);
  expect(spendHint(q, "new")).toBe(true);
  expect(metadata(q).wallet).toBe(4);
  const r = readProgress(serializeProgress(q));
  expect(metadata(r).wallet).toBe(4);
  startAttempt(r, "classic");
  spendHint(r, "free");
  expect(metadata(r).wallet).toBe(4);
});
