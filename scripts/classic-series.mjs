// Run in a checkout with both revisions and Node 24. Outputs are deterministic.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

const baseline = "7f8ac0e05a338d4101d10f680720343b6881ba9a";
const git = (...args) => execFileSync("git", args);
const { values: args } = parseArgs({ options: {
  before: { type: "string", default: baseline },
  after: { type: "string", default: "HEAD" },
  fresh: { type: "string", default: "30000:30999" },
  control: { type: "string", default: "40000:40999" },
  "series-seeds": { type: "string", default: "12081,42081,52081" },
  "series-count": { type: "string", default: "100" },
  out: { type: "string", default: "test-results/classic-series" },
} });
const hash = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
const seedNumber = value => {
  assert(/^\d+$/.test(value) && Number(value) <= 0xffffffff, "Expected a uint32 seed");
  return Number(value);
};
function readRange(value) {
  const [first, last, extra] = value.split(":").map(seedNumber);
  assert(extra === undefined && last >= first, "Expected first:last for inclusive seed range");
  return [first, last];
}
const fresh = readRange(args.fresh), control = readRange(args.control);
assert(fresh[1] < control[0] || control[1] < fresh[0], "Use a disjoint control range");
const seriesSeeds = args["series-seeds"].split(",").map(seedNumber);
assert(new Set(seriesSeeds).size === seriesSeeds.length);
const seriesCount = seedNumber(args["series-count"]);
assert(seriesCount > 8, "Series must extend past the eight-deal warmup");
const sizes = [18, 28, 45, 81];
const historyWindow = 4;
const scratch = mkdtempSync(join(tmpdir(), "seeds-classic-series-"));

async function load(revision, directory) {
  const sha = git("rev-parse", "--verify", revision + "^{commit}").toString().trim();
  const root = join(scratch, directory);
  mkdirSync(root);
  const files = {};
  for (const name of ["core", "classic-profile", "classic-dense", "classic-generator"]) {
    const path = "src/" + name + ".ts";
    const bytes = git("show", sha + ":" + path);
    const blob = git("rev-parse", sha + ":" + path).toString().trim();
    assert.equal(hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), "sha1"), blob);
    files[path] = { blob, sha256: hash(bytes) };
    const text = stripTypeScriptTypes(bytes.toString(), { mode: "strip" })
      .replace(/(\bfrom\s+["']\.\/[^"']+)(["'])/g, "$1.mjs$2");
    writeFileSync(join(root, name + ".mjs"), text);
  }
  const module = name => import(pathToFileURL(join(root, name + ".mjs")));
  return { sha, files, api: await module("classic-generator"), core: await module("core"), profile: await module("classic-profile") };
}
const increment = (counts, value) => { counts[value] = (counts[value] ?? 0) + 1; };

try {
  const before = await load(args.before, "before"), after = await load(args.after, "after");
  const { measureClassic, classicStructure, tryClassicOrder, classicMotifSimilarity, CLOSE_CLASSIC_MOTIF } = after.profile;
  const rows = [], summary = [], reproduction = [];

  function deal(engine, variant, mode, level, index, state, seriesSeed = null, options = {}) {
    const { api, core } = engine;
    const input = api.readClassicRun(JSON.parse(JSON.stringify(state)));
    assert(input, "Generator state must survive a read/save roundtrip");
    const candidateState = api.readClassicRun(input);
    const selected = api.generateClassic(candidateState, level, options);
    const profile = measureClassic(selected.board, selected.proof);
    const size = core.occupied(selected.board);
    const counts = api.CLASSIC_START_COUNTS?.[level] ?? [sizes[level]];
    const holes = selected.board.length - size;
    assert(counts.includes(size), "Wrong digit count");
    assert([0, api.CLASSIC_START_HOLES?.[level] ?? 0].includes(holes), "Wrong starting geometry");
    assert(selected.board.every(digit => Number.isInteger(digit) && digit >= 0 && digit <= 9));
    assert(!input.recent.includes(selected.board.join("")));
    if (level === 0) assert.equal(tryClassicOrder(selected.board, "first", 0, size / 2).outcome, "FOUND");
    if (level === 1 && size === 28) assert.deepEqual(selected.board.filter(Boolean).sort(), core.classic().sort());
    if (size % 2) assert(profile.additions > 0);
    if (selected.choice) {
      const { at, alternative } = selected.choice;
      assert(alternative[0].some(index => selected.proof[at].includes(index)));
      assert.notDeepEqual(alternative[0], selected.proof[at]);
      measureClassic(selected.board, [...selected.proof.slice(0, at), ...alternative]);
    }
    const recipe = selected.recipe ?? (selected.fallback ? "fallback" : "shuffle");
    const row = {
      variant, mode, level, size, holes, index, seriesSeed, seed: input.seed,
      seedAfter: candidateState.seed, stateSha256: hash(JSON.stringify(input)), recentCount: input.recent.length,
      requestedStyle: selected.style, actualRecipe: recipe,
      board: selected.board.join(""), structure: classicStructure(selected.board), proof: selected.proof,
      profile, ...(selected.choice ? { choice: selected.choice } : {}), openingSimilarity: selected.similarity, diagnostics: selected.diagnostics,
      budget: selected.budget ?? {
        attemptLimit: options.attempts ?? [40, 16, 4, 4][level],
        maxCandidates: level < 2 ? 3 : 4,
        solverVisitsPerAttempt: level === 1 ? 600 : null,
        greedyStepsPerAttempt: level === 0 ? 9 : null,
      },
      fallback: selected.fallback,
    };
    if (mode === "series") {
      const session = api.takeGeneratedClassic(state, `series-${index}`, level);
      assert.deepEqual(session.current.board, selected.board);
      assert.equal(state.seed, candidateState.seed);
      const output = api.readClassicRun(JSON.parse(JSON.stringify(state)));
      assert(output);
      if (variant === "after") {
        assert.deepEqual(output.scenarios[level].at(-1), { recipe, motif: profile.motif });
        assert(output.scenarios[level].length <= api.CLASSIC_SCENARIO_HISTORY);
      }
      row.writtenHistory = output.scenarios?.[level] ?? output.rotation?.[level];
      return { row, output, input };
    }
    return { row };
  }

  function summarize(group, start = 0) {
    const repeats = { adjacentRecipe: 0, adjacentMotif: 0, adjacentCloseMotif: 0, recent4Motif: 0,
      recent4CloseMotif: 0, recent8Board: 0, recent8Structure: 0 };
    let adjacentComparisons = 0;
    const requested = {}, recipes = {}, requestedToActual = {}, motifs = {};
    const fields = ["opening", "openingInFirstFourRows", "removals", "additions", "firstAdd",
      "gapMoves", "readingMoves", "diagonalMoves", "newPairs", "compressionChanges", "maxDigits", "peakLength"];
    const distributions = Object.fromEntries([...fields, "attempts", "candidates", "solverVisits", "fallbackAttempts"].map(k => [k, {}]));
    let fallback = 0, certifiedChoices = 0;
    const startCounts = {}, startHoles = {};
    for (let i = start; i < group.length; i++) {
      const row = group[i], previous = group[i - 1];
      const motif = row.profile.motif;
      const recent = group.slice(Math.max(0, i - historyWindow), i);
      const lastBoards = group.slice(Math.max(0, i - 8), i);
      increment(requested, row.requestedStyle);
      increment(recipes, row.actualRecipe);
      increment(requestedToActual[row.requestedStyle] ??= {}, row.actualRecipe);
      increment(motifs[motif.stage] ??= {}, motif.structure);
      for (const name of fields) increment(distributions[name], row.profile[name]);
      for (const [name, count] of Object.entries(row.diagnostics)) increment(distributions[name], count);
      if (row.fallback) fallback++;
      if (row.choice) certifiedChoices++;
      increment(startCounts, row.size);
      increment(startHoles, row.holes);
      if (previous) {
        adjacentComparisons++;
        const similarity = classicMotifSimilarity(motif, previous.profile.motif);
        repeats.adjacentRecipe += Number(row.actualRecipe === previous.actualRecipe);
        repeats.adjacentMotif += Number(similarity === 1);
        repeats.adjacentCloseMotif += Number(similarity >= CLOSE_CLASSIC_MOTIF);
      }
      const similarity = Math.max(0, ...recent.map(prev => classicMotifSimilarity(motif, prev.profile.motif)));
      repeats.recent4Motif += Number(similarity === 1);
      repeats.recent4CloseMotif += Number(similarity >= CLOSE_CLASSIC_MOTIF);
      repeats.recent8Board += Number(lastBoards.some(prev => row.board === prev.board));
      repeats.recent8Structure += Number(lastBoards.some(prev => row.structure === prev.structure));
    }
    return { count: group.length - start, adjacentComparisons, fallback, certifiedChoices, startCounts, startHoles, requested, recipes, requestedToActual,
      motifs, repeats, distributions };
  }

  for (const [variant, engine] of [["before",before], ["after",after]]) {
    for (const [level, size] of sizes.entries()) {
      for (const [mode,[first,last]] of [["fresh",fresh],["control",control]]) {
        const group = [];
        for (let seed = first; seed <= last; seed++)
          group.push(deal(engine, variant, mode, level, seed - first + 1, engine.api.newClassicRun(seed)).row);
        summary.push({variant,mode,level,size, ...summarize(group)});
        rows.push(...group);
      }
      for (const seriesSeed of seriesSeeds) {
        let state = engine.api.newClassicRun(seriesSeed);
        const group = [];
        for (let index = 1; index <= seriesCount; index++) {
          const { row, output, input } = deal(engine, variant, "series", level, index, state, seriesSeed);
          if (seriesSeed === 12081 && level === 2 && (index === 29 || index === 30))
            reproduction.push({variant, input, row});
          group.push(row);
          state = output;
        }
        summary.push({variant,mode:"series",level,size,seriesSeed,
          all:summarize(group), filledHistory:summarize(group,8)});
        rows.push(...group);
      }
      const forced = deal(engine, variant, "forced-fallback", level, 1,
        engine.api.newClassicRun(12081), null, {attempts:0}).row;
      assert(forced.fallback && forced.diagnostics.attempts === 0);
      rows.push(forced);
    }
  }
  if (before.sha === baseline && seriesSeeds.includes(12081) && seriesCount >= 30) {
    const [a,b] = reproduction.filter(e => e.variant === "before").map(e => e.row);
    assert.deepEqual([a.requestedStyle,b.requestedStyle], ["stock","gaps"]);
    assert.deepEqual([a.actualRecipe,b.actualRecipe], ["stock","stock"]);
    assert.equal(a.profile.motif.structure, "151592342327634151695000000");
    assert.deepEqual(a.profile.motif,b.profile.motif);
  }
  const pilot = after.api.CLASSIC_START_COUNTS;
  const examples = pilot?.flatMap((counts, level) => counts.map((size, position) => {
    const eligible = rows.filter(row => row.variant === "after" && row.mode === "fresh" &&
      row.level === level && row.size === size && !row.fallback);
    const preference = [
      row => row.profile.opening - row.profile.gapMoves,
      row => row.profile.gapMoves + row.profile.newPairs,
      row => row.profile.compressionChanges + (row.profile.firstAdd === null ? 0 : row.size - 2 * row.profile.firstAdd),
    ][position];
    // Show visible contrast and an independently replayable competing pair.
    eligible.sort((a, b) => Number(Boolean(b.choice)) - Number(Boolean(a.choice)) ||
      Number(Boolean(b.holes) === (position === 1)) - Number(Boolean(a.holes) === (position === 1)) ||
      preference(b) - preference(a));
    assert(eligible[0], `Missing example for level ${level} size ${size}`);
    return eligible[0];
  }));
  const output = resolve(args.out);
  mkdirSync(output, { recursive:true });
  const artifacts = {
    "deals.jsonl.gz": gzipSync(rows.map(row => JSON.stringify(row)).join("\n") + "\n"),
    "summary.json": JSON.stringify(summary,null,2) + "\n",
    "audit-29-30.json": JSON.stringify(reproduction,null,2) + "\n",
    ...(examples ? { "pilot-examples.json": JSON.stringify(examples, null, 2) + "\n" } : {}),
  };
  const manifest = {
    node: process.version, before: before.sha, after: after.sha, sources: {before:before.files, after:after.files},
    command: `node scripts/classic-series.mjs --before ${before.sha} --after ${after.sha} --fresh ${args.fresh} --control ${args.control} --series-seeds ${args["series-seeds"]} --series-count ${seriesCount}`,
    fresh, control, seriesSeeds, seriesCount, historyWindow, warmup: 8, closeMotifThreshold:CLOSE_CLASSIC_MOTIF,
    freshSequence: "Independent deals; comparison windows follow seed order only for measurement.",
    motif: "Canonical coordinates before first Add, or at the halfway removal when the witness has no Add.",
    counts: rows.reduce((result,row) => {increment(result[row.variant] ??= {}, row.mode); return result;}, {}),
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name,bytes]) => [name,hash(bytes)])),
  };
  for (const [name, bytes] of Object.entries(artifacts))
    writeFileSync(join(output,name),bytes);
  writeFileSync(join(output,"manifest.json"),JSON.stringify(manifest,null,2) + "\n");
  console.log(JSON.stringify({before:before.sha,after:after.sha,counts:manifest.counts}, null, 2));
} finally {
  rmSync(scratch, { recursive:true, force:true });
}
