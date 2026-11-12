// Offline only. Every accepted field ships with a replayable proof in test fixtures.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";
const writeJson = async (path, data) =>
  writeFileSync(path, await format(JSON.stringify(data), { parser: "json" }));
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
});
try {
  const { checkPair, pairs, removePair, occupied, addNumbers } =
    await vite.ssrLoadModule("/src/core.ts");
  const { hash } = await vite.ssrLoadModule("/src/puzzles.ts");
  const random = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const indices = (b) =>
    b
      .map((_, i) => i)
      .filter((i) =>
        b.slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9).some(Boolean),
      );
  function solveSmall(initial) {
    const dead = new Set();
    let visits = 0;
    function visit(b) {
      if (!occupied(b)) return [];
      const key = b.join("");
      if (dead.has(key) || ++visits > 5000) return null;
      for (const p of pairs(b)) {
        const rest = visit(removePair(b, p.a, p.b));
        if (rest) return [[p.a, p.b], ...rest];
      }
      dead.add(key);
      return null;
    }
    return visit(initial);
  }
  const kernels = [];
  for (let seed = 1; kernels.length < 64 && seed < 100000; seed++) {
    const rand = random(hash("classic-kernel-v1:" + seed)),
      b = Array(35).fill(0);
    for (let row = 0; row < 4; row++)
      b[row * 9 + Math.floor(rand() * (row === 3 ? 8 : 9))] =
        1 + Math.floor(rand() * 9);
    while (occupied(b) < 5) {
      const index = Math.floor(rand() * b.length);
      if (!b[index]) b[index] = 1 + Math.floor(rand() * 9);
    }
    if (pairs(b).length) continue;
    const path = solveSmall(addNumbers(b));
    if (path) kernels.push(b);
  }
  if (kernels.length < 64) throw Error("Not enough one-add kernels");

  function construct(seed, length, count, kernel) {
    const rand = random(seed),
      board = kernel ? [...kernel] : Array(length).fill(0),
      order = [];
    for (let pair = 0; pair < count; pair++) {
      const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0),
        candidates = [];
      for (let i = 0; i < empty.length; i++)
        for (let j = i + 1; j < empty.length; j++)
          candidates.push([empty[i], empty[j]]);
      let chosen;
      while (candidates.length) {
        const at = Math.floor(rand() * candidates.length),
          [a, b] = candidates[at];
        candidates[at] = candidates.at(-1);
        candidates.pop();
        board[a] = board[b] = 5;
        const ids = indices(board),
          valid = checkPair(
            ids.map((i) => board[i]),
            ids.indexOf(a),
            ids.indexOf(b),
          ).ok;
        board[a] = board[b] = 0;
        if (valid) {
          chosen = [a, b];
          break;
        }
      }
      if (!chosen) break;
      const [a, b] = chosen,
        value = 1 + Math.floor(rand() * 9);
      board[a] = value;
      board[b] = rand() < 0.5 ? value : 10 - value;
      order.push([a, b]);
    }
    let ids = indices(board),
      work = ids.map((i) => board[i]);
    const initial = [...work],
      proof = [];
    for (const [a, b] of order.reverse()) {
      const x = ids.indexOf(a),
        y = ids.indexOf(b);
      if (!checkPair(work, x, y).ok)
        throw Error("Reverse construction mismatch");
      proof.push([x, y]);
      const blank = [...work];
      blank[x] = blank[y] = 0;
      ids = ids.filter((_, i) =>
        blank
          .slice(Math.floor(i / 9) * 9, Math.floor(i / 9) * 9 + 9)
          .some(Boolean),
      );
      work = removePair(work, x, y);
    }
    if (kernel) {
      if (occupied(work) !== 5 || pairs(work).length) return null;
      const rest = solveSmall(addNumbers(work));
      if (!rest) return null;
      proof.push(null, ...rest);
    } else if (occupied(work)) throw Error("Incomplete proof");
    return { board: initial, proof };
  }
  function canonical(board) {
    const groups = new Map();
    return board
      .map((v) => {
        if (!v) return "0";
        if (v === 5) return "X";
        const group = Math.min(v, 10 - v);
        if (!groups.has(group)) groups.set(group, [groups.size + 1, v]);
        const [n, first] = groups.get(group);
        return n + (v === first ? "a" : "b");
      })
      .join(",");
  }
  function shape(board) {
    const reflected = board.flatMap((_, i) =>
      i % 9 ? [] : board.slice(i, i + 9).reverse(),
    );
    return [canonical(board), canonical(reflected)].sort()[0];
  }
  function measure(b, proof) {
    const openings = pairs(b),
      directions = new Set();
    let gapMoves = 0,
      crossing = 0,
      same = 0,
      additions = 0;
    for (const step of proof) {
      if (!step) {
        b = addNumbers(b);
        additions++;
        continue;
      }
      const [a, z] = step,
        result = checkPair(b, a, z);
      if (!result.ok) throw Error("Illegal certificate step");
      const dr = Math.abs(Math.floor(z / 9) - Math.floor(a / 9)),
        dc = Math.abs((z % 9) - (a % 9));
      directions.add(
        result.path.kind === "reading"
          ? "reading"
          : !dr
            ? "horizontal"
            : !dc
              ? "vertical"
              : "diagonal",
      );
      if (
        Math.max(dr, dc) > 1 ||
        (result.path.kind === "reading" && Math.abs(z - a) > 1)
      )
        gapMoves++;
      if (dr) crossing++;
      if (b[a] === b[z]) same++;
      b = removePair(b, a, z);
    }
    if (occupied(b)) throw Error("Certificate does not finish");
    return {
      openings: openings.length,
      directions: [...directions],
      gapMoves,
      crossing,
      sameRatio: same / (proof.length - additions),
      additions,
    };
  }
  const specs = [
    {
      family: "compact",
      cells: (s) => (s % 2 ? 24 : 28),
      digits: (s) => (s % 2 ? 24 : 28),
      min: 5,
      max: 22,
      directions: 2,
      gaps: 2,
    },
    {
      family: "dense",
      cells: () => 36,
      digits: () => 36,
      min: 10,
      max: 28,
      directions: 3,
      gaps: 3,
    },
    {
      family: "bridges",
      cells: () => 45,
      digits: () => 32,
      min: 4,
      max: 22,
      directions: 3,
      gaps: 4,
    },
    {
      family: "addition",
      cells: () => 35,
      digits: () => 35,
      min: 7,
      max: 26,
      directions: 3,
      gaps: 3,
    },
  ];
  const catalog = [],
    proofs = [],
    report = [],
    seen = new Set();
  for (const spec of specs) {
    let accepted = 0,
      tries = 0;
    for (let n = 0; accepted < 32 && n < 50000; n++) {
      tries++;
      const seed = hash(`seeds-classic-v1:${spec.family}:${n}`),
        length = spec.cells(seed),
        digits = spec.digits(seed),
        kernel =
          spec.family === "addition"
            ? kernels[seed % kernels.length]
            : undefined;
      const p = construct(
        seed,
        length,
        (digits - (kernel ? 5 : 0)) / 2,
        kernel,
      );
      if (!p || occupied(p.board) !== digits || p.board.length !== length)
        continue;
      const counts = Array.from(
        { length: 9 },
        (_, i) => p.board.filter((v) => v === i + 1).length,
      );
      if (
        counts.filter(Boolean).length < 7 ||
        Math.max(...counts) > Math.ceil(digits * 0.34)
      )
        continue;
      const m = measure(p.board, p.proof),
        key = shape(p.board);
      if (
        m.openings < spec.min ||
        m.openings > spec.max ||
        m.directions.length < spec.directions ||
        m.gapMoves < spec.gaps ||
        m.sameRatio < 0.2 ||
        m.sameRatio > 0.8 ||
        seen.has(key)
      )
        continue;
      const id = catalog.length;
      seen.add(key);
      catalog.push({ family: spec.family, board: p.board.join("") });
      proofs.push(p.proof);
      report.push({ id, family: spec.family, cells: length, digits, ...m });
      accepted++;
    }
    if (accepted !== 32)
      throw Error(
        `${spec.family}: only ${accepted} fields in ${tries} attempts`,
      );
    console.log(
      `${spec.family}: ${accepted} certified fields / ${tries} candidates`,
    );
  }
  mkdirSync("scripts/classic-variety", { recursive: true });
  mkdirSync("docs/classic-variety-2026-11-12", { recursive: true });
  await writeJson("src/classic-catalog.json", catalog);
  await writeJson("scripts/classic-variety/proofs.json", proofs);
  await writeJson("docs/classic-variety-2026-11-12/content.json", {
    version: 1,
    fields: catalog.length,
    uniqueShapesUpToRenamingAndReflection: seen.size,
    proofMeaning:
      "At least one legal winning route; not all choices are guaranteed to win",
    families: specs.map((s) => s.family),
    fieldsMeasured: report,
  });
} finally {
  await vite.close();
}
