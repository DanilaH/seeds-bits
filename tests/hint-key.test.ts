import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compactHintKey } from "../src/hint-key";
import { hintKey, hintAttempt, hintsLeft, spendHint } from "../src/hint-budget";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
} from "../src/progress";

test("compact hint hashes match SHA-256 across block boundaries and large boards", () => {
  for (const n of [1, 49, 50, 51, 55, 56, 63, 64, 65, 120, 1800]) {
    const raw = `${"1234509876".repeat(n).slice(0, n)}:0:${n - 1}`;
    expect(compactHintKey(raw)).toBe(
      "h1:" + createHash("sha256").update(raw).digest("hex"),
    );
    expect(compactHintKey(compactHintKey(raw))).toBe(compactHintKey(raw));
  }
});
test("legacy hint history migrates without charging a repeated hint or changing credits", () => {
  const p = fresh(),
    a = hintAttempt(p),
    board = p.sessions.classic.current.board;
  a.hintBonus = 3;
  a.hintKeys = [`${board.join("")}:0:1`];
  const restored = readProgress(serializeProgress(p)),
    attempt = hintAttempt(restored);
  expect(spendHint(attempt, hintKey(board, 1, 0))).toBe(true);
  expect(attempt.hintKeys).toHaveLength(1);
  expect(hintsLeft(attempt)).toBe(5);
});
test("malformed optional fields preserve statistics, valid attempts, receipts and used credits", () => {
  const p = fresh(),
    m = metadata(p);
  m.completed = 120;
  m.unassisted = 100;
  m.attempts.classic.hintBonus = "broken" as never;
  m.attempts.classic.hintKeys = ["1111:0:1", null as never, "valid"];
  m.attempts["book-v1-1"] = { id: "intact", completed: true, hintBonus: 6 };
  m.rewardReceipts = ["kept", 42 as never];
  let recovered = 0;
  const q = readProgress(serializeProgress(p), () => recovered++),
    result = metadata(q);
  expect(recovered).toBeGreaterThan(0);
  expect(result.completed).toBe(120);
  expect(result.unassisted).toBe(100);
  expect(result.attempts["book-v1-1"]).toEqual(m.attempts["book-v1-1"]);
  expect(result.rewardReceipts).toEqual(["kept"]);
  expect(result.attempts.classic.hintKeys).toHaveLength(3);
  expect(hintsLeft(result.attempts.classic)).toBe(0);
});
