import { test, expect } from "vitest";
import { pairs, checkPair, removePair } from "../../src/core";
import { createSolver } from "../../src/solver";
function legal(b: number[], a: number, c: number) {
  if (a === c || !b[a] || !b[c] || (b[a] !== b[c] && b[a] + b[c] !== 10))
    return false;
  let lo = Math.min(a, c),
    hi = Math.max(a, c);
  if (b.slice(lo + 1, hi).every((v) => !v)) return true;
  let x = a % 9,
    y = Math.floor(a / 9),
    X = c % 9,
    Y = Math.floor(c / 9),
    dx = X - x,
    dy = Y - y;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  let steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let k = 1; k < steps; k++)
    if (b[(y + Math.sign(dy) * k) * 9 + x + Math.sign(dx) * k]) return false;
  return true;
}
let seed = 20261020;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
test("independent geometric oracle on 1200 seeded boards", () => {
  for (let n = 0; n < 1200; n++) {
    let b = Array.from({ length: 1 + Math.floor(rand() * 55) }, () =>
      rand() < 0.35 ? 0 : 1 + Math.floor(rand() * 9),
    );
    let found = new Set(pairs(b).map((p) => `${p.a}:${p.b}`));
    for (let a = 0; a < b.length; a++)
      for (let c = a + 1; c < b.length; c++) {
        let ok = legal(b, a, c);
        expect(checkPair(b, a, c).ok).toBe(ok);
        expect(found.has(`${a}:${c}`)).toBe(ok);
      }
  }
}, 30000);
test("solver versus independent exhaustive oracle on 250 tiny boards", () => {
  const brute = (b: number[]): boolean => {
    if (!b.some(Boolean)) return true;
    for (let a = 0; a < b.length; a++)
      for (let c = a + 1; c < b.length; c++)
        if (legal(b, a, c)) {
          const next = b.map((v, i) => (i === a || i === c ? 0 : v));
          const compact = [];
          for (let row = 0; row < next.length; row += 9)
            if (next.slice(row, row + 9).some(Boolean))
              compact.push(...next.slice(row, row + 9));
          if (brute(compact)) return true;
        }
    return false;
  };
  const solve = createSolver();
  for (let n = 0; n < 250; n++) {
    const b = Array.from({ length: 2 + Math.floor(rand() * 11) }, () =>
      rand() < 0.3 ? 0 : 1 + Math.floor(rand() * 9),
    );
    const a = solve(b),
      expected = brute(b);
    expect(a.kind === "move" || a.kind === "solved").toBe(expected);
    if (a.kind === "move")
      expect(brute(removePair(b, a.pair.a, a.pair.b))).toBe(true);
  }
});
