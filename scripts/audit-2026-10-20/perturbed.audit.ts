import { test } from "vitest";
import { writeFileSync } from "node:fs";
import { daily } from "../../src/puzzles";
import { pairs, removePair } from "../../src/core";
import { createSolver } from "../../src/solver";
test("perturbed positions in currently available daily puzzles", () => {
  let checked = 0,
    max = 0;
  const unknown: any[] = [];
  for (let d = 1; d <= 20; d++) {
    const date = `2026-10-${String(d).padStart(2, "0")}`,
      b = daily(date).board;
    for (const p of pairs(b).slice(0, 5)) {
      const next = removePair(b, p.a, p.b),
        t = performance.now(),
        a = createSolver()(next),
        ms = performance.now() - t;
      checked++;
      max = Math.max(max, ms);
      if (a.kind === "unknown") unknown.push({ date, pair: p, ms });
    }
  }
  writeFileSync(
    "docs/audit-2026-10-20/perturbed-daily.json",
    JSON.stringify({ checked, maxMs: max, unknown }, null, 2),
  );
}, 120000);
