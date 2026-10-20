import { test, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { daily } from "../../src/puzzles";
import { removePair, occupied } from "../../src/core";
import { createSolver } from "../../src/solver";
test("730 daily puzzles finish by verified hints", () => {
  let max = 0,
    worst = "";
  const failures: any[] = [];
  let completed = 0;
  for (let n = 0; n < 730; n++) {
    const solve = createSolver();
    const day = new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
    let b = daily(day).board;
    for (let k = 0; occupied(b) && k < 30; k++) {
      const t = performance.now(),
        a = solve(b),
        elapsed = performance.now() - t;
      if (elapsed > max) {
        max = elapsed;
        worst = day;
      }
      if (a.kind !== "move") {
        failures.push({ day, step: k, kind: a.kind, ms: elapsed, board: b });
        break;
      }
      b = removePair(b, a.pair.a, a.pair.b);
    }
    if (!occupied(b)) completed++;
  }
  const result = {
    dailyCount: 730,
    completed,
    maxHintMs: max,
    worst,
    failures,
  };
  mkdirSync("docs/audit-2026-10-20", { recursive: true });
  writeFileSync(
    "docs/audit-2026-10-20/daily-census.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  expect(failures.filter((f) => f.kind === "dead")).toEqual([]);
}, 120000);
