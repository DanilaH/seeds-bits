import { describe, it, expect } from "vitest";
import {
  classic,
  checkPair,
  pairs,
  removePair,
  addNumbers,
  newSession,
  commit,
  undo,
  decode,
  occupied,
} from "../src/core";
describe("rules 0.1", () => {
  it("starts with 28 digits, no zero", () => {
    expect(classic()).toHaveLength(28);
    expect(classic().join("")).toBe("1234567891111213141516171819");
  });
  it("checks values, blockers, both diagonals and reading order", () => {
    expect(checkPair([3, 7], 0, 1).ok).toBe(true);
    expect(checkPair([3, 3, 7], 0, 2)).toEqual({
      ok: false,
      reason: "blocked",
    });
    expect(checkPair([1, 2], 0, 1)).toEqual({ ok: false, reason: "value" });
    expect(checkPair([8, 0, 0, 0, 0, 0, 0, 0, 2], 0, 8, 3).ok).toBe(true);
    expect(checkPair([0, 0, 8, 0, 0, 0, 2], 2, 6, 3).ok).toBe(true);
    expect(checkPair([0, 0, 6, 4], 2, 3, 3)).toEqual({
      ok: true,
      path: { a: 2, b: 3, kind: "reading" },
    });
    expect(checkPair([2, 0, 0, 0, 0, 8], 0, 5, 3).ok).toBe(true);
    expect(checkPair([2, 1, 0, 0, 0, 8], 0, 5, 3)).toEqual({
      ok: false,
      reason: "direction",
    });
  });
  it("rejects same, empty and out of range cells", () => {
    expect(checkPair([5], 0, 0).ok).toBe(false);
    expect(checkPair([5, 0], 0, 1).ok).toBe(false);
    expect(checkPair([5], 0, 3).ok).toBe(false);
  });
  it("removes entire empty rows while preserving holes and partial rows", () => {
    expect(removePair([2, 0, 8, 1, 0, 3, 4], 0, 2, 3)).toEqual([1, 0, 3, 4]);
    expect(removePair([1, 1], 0, 1)).toEqual([]);
  });
  it("appends after logical end including trailing empty slots", () => {
    expect(addNumbers([1, 2, 0], 3)).toEqual([1, 2, 0, 1, 2]);
    expect(() => addNumbers([1, 1])).toThrow("Pairs remain");
    expect(() => addNumbers([])).toThrow("Empty");
    expect(addNumbers([7])).toEqual([7, 7]);
    expect(() => addNumbers([1, 2], 9, 3)).toThrow("limit");
  });
  it("undo restores full board, counters and scroll across serialization", () => {
    let s = newSession();
    const original = s.current.board;
    s = commit(s, removePair(s.current.board, 0, 9), "pair", 123);
    s = decode(JSON.stringify(s));
    s = undo(s);
    expect(s.current.board).toEqual(original);
    expect(s.current.scroll).toBe(123);
    expect(s.current.moves).toBe(0);
    expect(s.history).toHaveLength(0);
  });
  it("validates saved games and all history entries", () => {
    expect(() => decode("{")).toThrow();
    expect(() =>
      decode(JSON.stringify({ ...newSession(), rules: 2 })),
    ).toThrow();
    expect(() =>
      decode(JSON.stringify({ ...newSession(), history: [{ board: [100] }] })),
    ).toThrow();
  });
});
// Independent reference: enumerate all pairs and walk coordinates, without core checkPair.
function reference(b: number[], w: number) {
  const out: string[] = [];
  for (let a = 0; a < b.length; a++)
    for (let z = a + 1; z < b.length; z++) {
      if (!b[a] || !b[z] || (b[a] !== b[z] && b[a] + b[z] !== 10)) continue;
      let valid = b.slice(a + 1, z).every((x) => x === 0);
      const ar = Math.floor(a / w),
        ac = a % w,
        br = Math.floor(z / w),
        bc = z % w;
      if (ar === br || ac === bc || Math.abs(ar - br) === Math.abs(ac - bc)) {
        let r = ar + Math.sign(br - ar),
          c = ac + Math.sign(bc - ac),
          clear = true;
        while (r !== br || c !== bc) {
          if (b[r * w + c]) {
            clear = false;
            break;
          }
          r += Math.sign(br - ar);
          c += Math.sign(bc - ac);
        }
        valid ||= clear;
      }
      if (valid) out.push(`${a}:${z}`);
    }
  return out.sort();
}
it("differentially checks 3000 seeded boards against independent coordinate validator", () => {
  let seed = 15102026;
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let k = 0; k < 3000; k++) {
    const w = 2 + rand(8),
      b = Array.from({ length: 1 + rand(70) }, () => rand(10));
    expect(
      pairs(b, w)
        .map((p) => `${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}`)
        .sort(),
    ).toEqual(reference(b, w));
  }
});
it("100 seeded classical simulations preserve counts, serialize, undo and never corrupt", () => {
  let seed = 98765;
  for (let run = 0; run < 100; run++) {
    let s = newSession();
    for (let turn = 0; turn < 300; turn++) {
      const b = s.current.board,
        ps = pairs(b);
      if (!occupied(b)) break;
      const before = JSON.stringify(s);
      if (ps.length) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const p = ps[seed % ps.length];
        const next = removePair(b, p.a, p.b);
        expect(occupied(next)).toBe(occupied(b) - 2);
        s = commit(s, next, "pair", 0);
      } else {
        if (b.length + occupied(b) > 1800) break;
        s = commit(s, addNumbers(b), "add", 0);
        expect(occupied(s.current.board)).toBe(occupied(b) * 2);
      }
      expect(JSON.stringify(undo(s))).toBe(before);
      expect(decode(JSON.stringify(s))).toEqual(s);
    }
  }
}, 20000);
