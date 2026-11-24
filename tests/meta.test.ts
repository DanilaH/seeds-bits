import { test, expect, vi } from "vitest";
import {
  fresh,
  metadata,
  readProgress,
  recordCompletion,
  startAttempt,
} from "../src/progress";
import { nextTask, trophy } from "../src/puzzles";
import { type Language, useLanguage } from "../src/i18n";
import { trophyMark } from "../src/trophies";
test("migration preserves wins and does not invent past statistics", () => {
  const p = fresh();
  p.done = ["book-v1-1"];
  p.sessions.classic.current.board = [];
  const restored = readProgress(JSON.stringify(p));
  expect(restored.done).toEqual(p.done);
  recordCompletion(restored, "classic");
  expect(metadata(restored).completed).toBe(0);
  startAttempt(restored, "classic");
  recordCompletion(restored, "classic");
  expect(metadata(restored).completed).toBe(1);
});
test("reload and undo/re-win cannot duplicate a result; explicit repeat can", () => {
  let p = fresh();
  metadata(p);
  recordCompletion(p, "book-v1-1");
  p = readProgress(JSON.stringify(p));
  recordCompletion(p, "book-v1-1");
  expect(metadata(p).completed).toBe(1);
  startAttempt(p, "book-v1-1");
  p.hints["book-v1-1"] = 1;
  recordCompletion(p, "book-v1-1");
  expect(metadata(p)).toMatchObject({ completed: 2, unassisted: 1 });
  expect(p.done).toEqual(["book-v1-1"]);
});
test("next notebook skips wins and wraps; exhausted notebook has no next", () => {
  expect(nextTask("book-v1-1", ["book-v1-1", "book-v1-2"])).toBe("book-v1-3");
  expect(nextTask("book-v1-24", ["book-v1-24"])).toBe("book-v1-25");
  expect(nextTask("book-v1-2400", ["book-v1-2400"])).toBe("book-v1-1");
  expect(
    nextTask(
      "book-v1-2400",
      Array.from({ length: 2400 }, (_, i) => `book-v1-${i + 1}`),
    ),
  ).toBeUndefined();
});
test("daily advances then searches backwards without opening future dates", () => {
  expect(
    nextTask("daily-v1-2026-10-01", ["daily-v1-2026-10-01"], "2026-10-03"),
  ).toBe("daily-v1-2026-10-02");
  expect(
    nextTask("daily-v1-2026-10-03", ["daily-v1-2026-10-03"], "2026-10-03"),
  ).toBe("daily-v1-2026-10-02");
  expect(
    nextTask("daily-v1-2025-01-01", ["daily-v1-2025-01-01"], "2025-01-01"),
  ).toBeUndefined();
  expect(nextTask("daily-v1-2028-02-28", [], "2028-03-01")).toBe(
    "daily-v1-2028-02-29",
  );
});
test("existing medal thresholds stay 7 and 14, leap month gold needs 29", () => {
  const done = Array.from(
    { length: 29 },
    (_, i) => `daily-v1-2028-02-${String(i + 1).padStart(2, "0")}`,
  );
  expect(
    [6, 7, 13, 14, 28, 29].map((n) => trophy("2028-02", done.slice(0, n)).tier),
  ).toEqual([0, 1, 1, 2, 2, 3]);
});
test("the medal preview uses the same pluralized count in text and its label", () => {
  const examples: Array<[Language, string[]]> = [
    ["ru", ["Ещё 1 задача", "Ещё 2 задачи", "Ещё 5 задач", "Ещё 11 задач", "Ещё 21 задача"]],
    ["en", ["1 puzzle to go", "2 puzzles to go", "5 puzzles to go", "11 puzzles to go", "21 puzzles to go"]],
    ["es", ["Falta 1 reto", "Faltan 2 retos", "Faltan 5 retos", "Faltan 11 retos", "Faltan 21 retos"]],
    ["tr", ["1 bulmaca kaldı", "2 bulmaca kaldı", "5 bulmaca kaldı", "11 bulmaca kaldı", "21 bulmaca kaldı"]],
    ["pt-BR", ["Falta 1 desafio", "Faltam 2 desafios", "Faltam 5 desafios", "Faltam 11 desafios", "Faltam 21 desafios"]],
  ];
  vi.stubGlobal("document", { documentElement: { lang: "ru" } });
  try {
    for (const [locale, expected] of examples) {
      useLanguage(locale);
      for (const [i, count] of [1, 2, 5, 11, 21].entries()) {
        // Use a synthetic gold threshold to exercise counts the calendar cannot show.
        const html = trophyMark("2026-11", 14, 14 + count);
        expect(html).toContain(`class="next-count">${expected[i]}<`);
        expect(html).toContain(`. ${expected[i]}"`);
      }
    }
  } finally {
    useLanguage("ru");
    vi.unstubAllGlobals();
  }
});
test("unknown metadata cannot silently erase statistics", () => {
  const p = fresh();
  metadata(p);
  const raw = JSON.stringify(p).replace(
    '"meta":{"version":2',
    '"meta":{"version":99',
  );
  expect(() => readProgress(raw)).toThrow();
});
