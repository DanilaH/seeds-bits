import { test, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
} from "../../src/progress";
import { loadNotebook, notebook, puzzleSession } from "../../src/puzzles";
import {
  hintKey,
  hintAttempt,
  spendHint,
  grantReward,
} from "../../src/hint-budget";
import { commit, removePair } from "../../src/core";
const out = "test-results/regression-061";
mkdirSync(out, { recursive: true });
test("M01 hundred unfinished notebooks with legitimately earned hints remain compact", async () => {
  await loadNotebook();
  const p = fresh();
  let hintCount = 0;
  for (let volume = 0; volume < 100; volume++) {
    const task = notebook[volume * 24 + 23];
    p.active = task.id;
    let s = puzzleSession(task);
    p.sessions[p.active] = s;
    const attempt = hintAttempt(p);
    for (const pair of task.solution.slice(
      0,
      Math.min(100, task.solution.length - 1),
    )) {
      if (!(3 + (attempt.hintBonus ?? 0) - (attempt.hintKeys?.length ?? 0)))
        grantReward(p, {
          token: `reward-${volume}-${s.current.moves}`,
          attempt: attempt.id,
        });
      expect(spendHint(attempt, hintKey(s.current.board, pair.a, pair.b))).toBe(
        true,
      );
      hintCount++;
      s = commit(s, removePair(s.current.board, pair.a, pair.b), "pair", 0);
    }
    p.sessions[p.active] = s;
  }
  p.active = "classic";
  const packed = serializeProgress(p),
    restored = readProgress(packed);
  expect(restored.meta).toEqual(p.meta);
  writeFileSync("/tmp/regression061-heavy-hints.json", packed);
  writeFileSync(
    `${out}/M01-heavy-hints.json`,
    JSON.stringify(
      {
        sessions: Object.keys(p.sessions).length,
        hintCount,
        serializedChars: packed.length,
        utf16Bytes: packed.length * 2,
        receiptCount: metadata(p).rewardReceipts?.length,
      },
      null,
      2,
    ),
  );
  expect(packed.length).toBeLessThan(2500000);
});
test("M02 malformed optional hint metadata should preserve unrelated completion statistics", () => {
  const p = fresh();
  metadata(p).completed = 120;
  metadata(p).unassisted = 100;
  metadata(p).attempts.classic.hintBonus = "bad" as any;
  let recovery = 0;
  const q = readProgress(serializeProgress(p), () => recovery++);
  writeFileSync(
    `${out}/M02-corrupt-hint-metadata.json`,
    JSON.stringify(
      { recovery, completedBefore: 120, completedAfter: metadata(q).completed },
      null,
      2,
    ),
  );
  expect(metadata(q).completed).toBe(120);
});
