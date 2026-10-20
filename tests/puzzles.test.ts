import { describe, it, expect, beforeAll } from "vitest";
import {
  notebook,
  loadNotebook,
  daily,
  days,
  trophy,
  availableDay,
  monthDays,
} from "../src/puzzles";
import { checkPair, removePair, occupied } from "../src/core";
import { fresh, readProgress } from "../src/progress";
describe("verified content and calendar", () => {
  beforeAll(loadNotebook);
  it(
    "solves every notebook task with distinct arrangements",
    { timeout: 120000 },
    () => {
      expect(new Set(notebook.map((p) => JSON.stringify(p.board))).size).toBe(
        2400,
      );
      for (const p of notebook) {
        let b = p.board;
        expect(b.length).toBeLessThanOrEqual(1000);
        expect(occupied(b)).toBeGreaterThanOrEqual(8);
        for (const pair of p.solution) {
          expect(checkPair(b, pair.a, pair.b).ok).toBe(true);
          b = removePair(b, pair.a, pair.b);
        }
        expect(b).toEqual([]);
      }
    },
  );
  it("constructs solvable deterministic daily tasks across leap and year boundaries", () => {
    for (const month of ["2026-10", "2026-12", "2027-01", "2028-02"])
      for (const d of days(month)) {
        const p = daily(d);
        expect(daily(d)).toEqual(p);
        let b = p.board;
        for (const pair of p.solution) b = removePair(b, pair.a, pair.b);
        expect(b).toEqual([]);
      }
    expect(monthDays("2028-02")).toBe(29);
  });
  it("awards each tier by distinct completed dates, no future dates", () => {
    const d = days("2026-10").map((d) => "daily-v1-" + d);
    expect(trophy("2026-10", d.slice(0, 6)).tier).toBe(0);
    expect(trophy("2026-10", [...d.slice(0, 7), ...d.slice(0, 7)]).tier).toBe(
      1,
    );
    expect(trophy("2026-10", d.slice(0, 14)).tier).toBe(2);
    expect(trophy("2026-10", d).tier).toBe(3);
    expect(availableDay("2026-10-16", "2026-10-15")).toBe(false);
    expect(availableDay("2024-12-31", "2026-10-15")).toBe(false);
    expect(availableDay("2026-10-01", "2026-10-15")).toBe(true);
  });
  it("roundtrips multiple games without sharing state", () => {
    const p = fresh();
    p.done = ["book-v1-1", "book-v1-1"];
    p.hints.classic = 3;
    const result = readProgress(JSON.stringify(p));
    expect(result.done).toEqual(["book-v1-1"]);
    expect(result.hints.classic).toBe(3);
    expect(() => readProgress('{"version":4}')).toThrow();
  });
});
