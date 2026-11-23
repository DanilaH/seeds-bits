// Replays both generators from their actual source. Node and WebView timings
// are separate measurements. Usage: node scripts/classic-pilot.mjs [--bundle path]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { rolldown } from "rolldown";

const previous = "0c8fbba9c8864f39a398c5a6517b7b493ae3b1fc";
const source = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const entry = resolve("src/classic-generator.ts");
async function bundle(input, file, format = "esm", plugins = []) {
  await mkdir(dirname(file), { recursive: true });
  const build = await rolldown({ input, platform: "browser", plugins });
  try {
    await build.write({ file, format, name: "SeedsClassicQA" });
  } finally {
    await build.close();
  }
  return file;
}
const load = file => import(pathToFileURL(file));
const history = [0, 1, 2, 3];
const quantile = (sorted, q) => sorted[Math.ceil(sorted.length * q) - 1];
const timing = ms => {
  const sorted = [...ms].sort((a, b) => a - b);
  return { p50: quantile(sorted, .5), p95: quantile(sorted, .95), max: sorted.at(-1) };
};

if (process.argv[2] === "--bundle") {
  await bundle("classic-qa", resolve(process.argv[3]), "iife", [{
    name: "classic-qa-entry",
    resolveId(id) {
      if (id === "classic-qa") return "\0classic-qa";
    },
    load(id) {
      if (id !== "\0classic-qa") return;
      return `export { generateClassic, newClassicRun } from ${JSON.stringify(entry)};
        export { classic, pairs, removePair } from ${JSON.stringify(resolve("src/core.ts"))};`;
    },
  }]);
} else {
  const scratch = await mkdtemp(join(tmpdir(), "seeds-classic-pilot-"));
  try {
    const folder = "test-results/classic-pilot";
    await mkdir(folder, { recursive: true });
    const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
    for (const file of ["core", "classic-generator"])
      await writeFile(join(scratch, file + ".ts"), git("show", `${previous}:src/${file}.ts`));
    const before = await load(await bundle(join(scratch, "classic-generator.ts"), join(scratch, "before.mjs")));
    const now = await load(await bundle(entry, join(scratch, "now.mjs")));
    const core = await load(await bundle(resolve("src/core.ts"), join(scratch, "core.mjs")));
    const profile = await load(await bundle(resolve("src/classic-profile.ts"), join(scratch, "profile.mjs")));

    function validate(board, proof) {
      let state = board;
      for (const move of proof) {
        if (!move) {
          assert.equal(core.pairs(state).length, 0);
          state = core.addNumbers(state);
          continue;
        }
        const [a, b] = move;
        assert(core.checkPair(state, a, b).ok);
        // Independent row deletion model, keeping the actual trailing width.
        const next = [];
        for (let i = 0; i < state.length; i += core.WIDTH) {
          const row = state.slice(i, i + core.WIDTH)
            .map((digit, col) => i + col === a || i + col === b ? 0 : digit);
          if (row.some(Boolean)) next.push(...row);
        }
        state = core.removePair(state, a, b);
        assert.deepEqual(state, next);
      }
      assert.deepEqual(state, []);
    }
    function run(api, level, seed) {
      const start = performance.now();
      const result = api.generateClassic(api.newClassicRun(seed), level);
      const ms = performance.now() - start;
      validate(result.board, result.proof);
      assert.equal(result.board.length, result.board.filter(Boolean).length);
      const metrics = profile.measureClassic(result.board, result.proof);
      const policies = Object.fromEntries(["first", "last", "random"].map(order => {
        const { proof, ...stats } = profile.tryClassicOrder(result.board, order, 2, 180, seed);
        if (stats.outcome === "FOUND") validate(result.board, proof);
        return [order, stats];
      }));
      return { level, seed, ...result, profile: metrics, ms, policies };
    }
    function summarize(rows) {
      const middle = key => quantile(rows.map(r => r.profile[key]).sort((a,b) => a-b), .5);
      return {
        count: rows.length, size: rows[0].board.length,
        fallback: rows.filter(r => r.fallback).length,
        medianOpening: middle("opening"), medianOpeningFirstFourRows: middle("openingInFirstFourRows"),
        medianGapMoves: middle("gapMoves"), medianNewPairs: middle("newPairs"),
        medianRemovals: middle("removals"), medianPeakLength: middle("peakLength"),
        compressionChanged: rows.filter(r => r.profile.compressionChanges > 0).length,
        firstPolicyClearedWithoutAdd: rows.filter(r => r.policies.first.outcome === "FOUND" && !r.policies.first.additions).length,
        additions: Object.fromEntries([0,1,2].map(n => [n, rows.filter(r => r.profile.additions === n).length])),
        policiesFound: Object.fromEntries(["first","last","random"].map(order => [order,rows.filter(r => r.policies[order].outcome === "FOUND").length])),
        medianCandidates: rows[0].diagnostics ? quantile(rows.map(r => r.diagnostics.candidates).sort((a,b) => a-b), .5) : null,
        generationMs: timing(rows.map(r => r.ms)),
      };
    }
    function probe({ board, proof }) {
      let state = board, adds = 0;
      const steps = [0, Math.floor(proof.length / 2), Math.floor(proof.length * .8)];
      const samples = [];
      for (const [index, move] of proof.entries()) {
        if (move && steps.includes(index)) {
          const other = core.pairs(state).filter(p => p.a !== move[0] || p.b !== move[1]);
          for (const pair of [...new Set([other[0], other.at(-1)])].filter(Boolean)) {
            const alternate = core.removePair(state, pair.a, pair.b);
            const suffix = now.solveClassic(alternate, 2 - adds, 400);
            if (suffix) validate(state, [[pair.a,pair.b], ...suffix]);
            samples.push({ afterActions: index, legalAlternatives: other.length,
              move: [pair.a,pair.b], remainingAddBudget: 2 - adds,
              outcome: suffix ? "FOUND" : "UNKNOWN", replay: suffix ?? null });
          }
        }
        if (move) state = core.removePair(state, ...move);
        else { state = core.addNumbers(state); adds++; }
      }
      return samples;
    }
    const summary = { source, previous, node: process.version, seeds: "10000–10999",
      model: "Two Add per order probe; 180 actions; UNKNOWN is a bounded outcome", old: [], pilot: [] };
    const examples = [];
    for (const level of history) {
      for (let seed = 9990; seed < 10000; seed++) {
        now.generateClassic(now.newClassicRun(seed), level);
        if (level < 3) before.generateClassic(before.newClassicRun(seed), level);
      }
      const oldRows = [], newRows = [];
      for (let seed = 10000; seed < 11000; seed++) {
        if (level < 3) oldRows.push(run(before, level, seed));
        newRows.push(run(now, level, seed));
      }
      if (oldRows.length) summary.old.push(summarize(oldRows));
      summary.pilot.push(summarize(newRows));
      const open = newRows.filter(r => !r.fallback && r.style === "open" && (!r.recipe || r.recipe === r.style))
        .sort((a,b) => a.profile.gapMoves - b.profile.gapMoves || b.profile.opening - a.profile.opening)[0];
      const gaps = newRows.filter(r => !r.fallback && r.style === "gaps" && (!r.recipe || r.recipe === r.style))
        .sort((a,b) => b.profile.gapMoves - a.profile.gapMoves || b.profile.newPairs - a.profile.newPairs)[0];
      const stock = newRows.filter(r => !r.fallback && r.style === "stock" && (!r.recipe || r.recipe === r.style) && (level === 0 || r.profile.firstAdd !== null))
        .sort((a,b) => (a.profile.firstAdd ?? 0) - (b.profile.firstAdd ?? 0) ||
          b.profile.compressionChanges - a.profile.compressionChanges || b.profile.newPairs - a.profile.newPairs)[0];
      for (const row of [open, gaps, stock]) {
        const { ms, ...fields } = row;
        examples.push({ ...fields, branchProbes: probe(row) });
      }
    }
    const forcedFallback = history.map(level => {
      const run = now.newClassicRun(12081);
      const start = performance.now();
      const result = now.generateClassic(run, level, { attempts: 0 });
      const generationMs = performance.now() - start;
      assert(result.fallback && result.diagnostics.attempts === 0);
      validate(result.board, result.proof);
      return { level, seed: 12081, generationMs, ...result };
    });
    await writeFile(join(folder, "comparison.json"), JSON.stringify(summary, null, 2) + "\n");
    await writeFile(join(folder, "examples.json"), JSON.stringify({ source, examples }, null, 2) + "\n");
    await writeFile(join(folder, "fallback.json"), JSON.stringify({ source, forcedFallback }, null, 2) + "\n");
    console.log(JSON.stringify(summary));
    console.log(JSON.stringify(examples.map(({ level, seed, style, profile, policies }) => ({ level, seed, style, profile, policies }))));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
