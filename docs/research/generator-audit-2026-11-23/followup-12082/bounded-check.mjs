// Targeted GA-01 regression audit, not a repetition of the 4000-field audit.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generator, core, profile, manifest, digest, previous, writeResult} from './generator-load.mjs';

const clone = value => {
  const state = generator.readClassicRun(JSON.parse(JSON.stringify(value)));
  assert.ok(state); return state;
};
let proofChecks = 0;
function verify(selected, level, attemptLimit = [40, 16, 4, 4][level]) {
  const size = generator.CLASSIC_SIZES[level];
  assert.equal(selected.board.length, size);
  assert.equal(core.occupied(selected.board), size);
  assert.ok(selected.board.every(n => Number.isInteger(n) && n >= 1 && n <= 9));
  assert.ok(new Set(selected.board).size >= 6);
  assert.ok(core.pairs(selected.board).length > 0);
  if (level === 1) assert.deepEqual([...selected.board].sort(), core.classic().sort());
  if (level === 0) assert.equal(profile.tryClassicOrder(selected.board, 'first', 0, 9).outcome, 'FOUND');
  let board = [...selected.board], removals = 0, additions = 0, firstAdd, midpoint;
  for (const move of selected.proof) {
    if (move === null) {
      assert.equal(core.pairs(board).length, 0);
      firstAdd ??= {stage: 'first-add', structure: profile.classicStructure(board)};
      additions++; board = core.addNumbers(board);
    } else {
      assert.equal(core.checkPair(board, ...move).ok, true);
      board = core.removePair(board, ...move); removals++;
      if (removals === Math.ceil(size / 4)) midpoint = {stage: 'midpoint', structure: profile.classicStructure(board)};
    }
  }
  assert.deepEqual(board, []);
  if (level === 0) assert.equal(additions, 0);
  if (level === 1) assert.ok(additions <= 2);
  if (level >= 2) assert.equal(additions, 1);
  if (selected.profile.motif) assert.deepEqual(selected.profile.motif, firstAdd ?? midpoint);
  if (selected.budget) {
    assert.deepEqual(selected.budget, {attemptLimit, maxCandidates: level < 2 ? 3 : 4,
      solverVisitsPerAttempt: level === 1 ? 600 : null,
      greedyStepsPerAttempt: level === 0 ? 9 : null});
    assert.ok(selected.diagnostics.attempts <= attemptLimit);
    assert.ok(selected.diagnostics.candidates <= selected.budget.maxCandidates);
    assert.ok(selected.diagnostics.solverVisits <= selected.diagnostics.attempts * 600);
  }
  proofChecks++;
}
const rowOf = (selected, input, index, level) => ({index, level, inputSeed: input.seed,
  inputSha256: digest(input), boardSha256: digest(selected.board), style: selected.style,
  recipe: selected.recipe, motif: selected.profile.motif, fallback: selected.fallback,
  profile: selected.profile, diagnostics: selected.diagnostics, budget: selected.budget});
const sameMotif = (a, b) => a.stage === b.stage && a.structure === b.structure;

const fresh = [];
for (let level = 0; level < 4; level++) {
  for (let seed = 30000; seed <= 30015; seed++) {
    const before = previous.generator.generateClassic(previous.generator.newClassicRun(seed), level);
    const after = generator.generateClassic(generator.newClassicRun(seed), level);
    verify(before, level); verify(after, level);
    assert.deepEqual(before.board, after.board);
    assert.deepEqual(before.proof, after.proof);
    fresh.push({level, seed, boardSha256: digest(after.board), sameBoardAndProof: true});
  }
}

const series = [];
function serial(initialSeed, levels, label) {
  let state = generator.newClassicRun(initialSeed);
  const rows = [], recent = new Map();
  for (const [index, level] of levels.entries()) {
    const input = clone(state), probe = clone(input);
    const selected = generator.generateClassic(probe, level);
    verify(selected, level);
    const game = generator.takeGeneratedClassic(state, `${label}-${index}`, level);
    assert.deepEqual(game.current.board, selected.board);
    assert.equal(state.seed, probe.seed);
    assert.ok(!input.recent.includes(selected.board.join('')));
    if (!selected.fallback) assert.ok(!input.recent.filter(b => b.length === selected.board.length)
      .map(b => profile.classicStructure([...b].map(Number))).includes(profile.classicStructure(selected.board)));
    assert.deepEqual(state.scenarios[level].at(-1), {recipe: selected.recipe, motif: selected.profile.motif});
    assert.ok(state.scenarios[level].length <= generator.CLASSIC_SCENARIO_HISTORY);
    for (let other = 0; other < 4; other++) if (other !== level)
      assert.deepEqual(state.scenarios[other], input.scenarios?.[other]);
    const history = recent.get(level) ?? [];
    const row = rowOf(selected, input, index, level);
    row.exactInPrevious4 = history.some(p => sameMotif(p.motif, row.motif));
    row.exactInPrevious1 = !!history.length && sameMotif(history.at(-1).motif, row.motif);
    row.recipeInPrevious1 = !!history.length && history.at(-1).recipe === row.recipe;
    rows.push(row); recent.set(level, [...history, row].slice(-4));
    const restored = clone(state); assert.deepEqual(restored, state); state = restored;
  }
  series.push({label, initialSeed, rows});
}
for (let level = 0; level < 4; level++) serial(12081, Array(100).fill(level), `audit-level-${level}`);
for (const level of [2, 3]) serial(62081, Array(32).fill(level), `independent-level-${level}`);
serial(72081, Array.from({length: 32}, (_, i) => i % 4), 'mixed');

const fallback = [];
for (let level = 0; level < 4; level++) {
  const recent = [];
  for (let count = 0; count <= 8; count++) {
    const state = generator.newClassicRun(12081); state.recent = [...recent];
    const selected = generator.generateClassic(state, level, {attempts: 0});
    verify(selected, level, 0);
    assert.equal(selected.recipe, 'fallback'); assert.equal(selected.fallback, true);
    assert.ok(!recent.includes(selected.board.join('')));
    assert.equal(selected.diagnostics.fallbackAttempts, count + 1);
    recent.push(selected.board.join(''));
    fallback.push({level, recentCount: count, attempts: selected.diagnostics.fallbackAttempts,
      boardSha256: digest(selected.board), motif: selected.profile.motif});
  }
}

const saved = [];
const oldFixtures = JSON.parse(readFileSync(new URL('legacy-inputs.json', import.meta.url)));
for (const {index, input} of oldFixtures.fixtures) {
  const restored = clone(input);
  assert.equal(restored.scenarios, undefined); assert.ok(!('rotation' in restored));
  for (const key of ['version', 'seed', 'difficulty', 'recent', 'current']) assert.deepEqual(restored[key], input[key]);
  saved.push({case: `old-rotation-${index}`, seed: restored.seed, currentPreserved: true});
}
const actualState = generator.newClassicRun(15);
const actual = generator.generateClassic(generator.newClassicRun(15), 2);
assert.equal(actual.style, 'gaps'); assert.equal(actual.recipe, 'stock');
generator.takeGeneratedClassic(actualState, 'actual-recipe', 2);
const actualRestored = clone(actualState);
assert.deepEqual(actualRestored.scenarios[2], [{recipe: 'stock', motif: actual.profile.motif}]);
saved.push({case: 'actual-recipe-not-preference', style: actual.style, saved: actualRestored.scenarios[2]});

const fallbackState = generator.newClassicRun(30089);
const fallbackSelected = generator.generateClassic(clone(fallbackState), 0);
assert.equal(fallbackSelected.fallback, true); verify(fallbackSelected, 0);
generator.takeGeneratedClassic(fallbackState, 'natural-fallback', 0);
assert.deepEqual(clone(fallbackState).scenarios[0].at(-1), {recipe: 'fallback', motif: fallbackSelected.profile.motif});
saved.push({case: 'natural-fallback-is-recorded', seed: 30089, saved: clone(fallbackState).scenarios[0]});

const good = actualRestored.scenarios[2][0];
const invalid = [null, {}, {recipe: 'unknown', motif: good.motif},
  {recipe: 'stock', motif: {stage: 'bad', structure: '123'}},
  {recipe: 'stock', motif: {stage: 'first-add', structure: '000'}},
  {recipe: 'stock', motif: {stage: 'first-add', structure: 'x123'}},
  {recipe: 'stock', motif: {stage: 'first-add', structure: '1'.repeat(46)}}];
for (const [index, malformed] of invalid.entries()) {
  const input = {...actualRestored, scenarios: {2: [malformed, good], 3: 'bad'}};
  const restored = clone(input);
  assert.deepEqual(restored.scenarios, {2: [good]});
  for (const key of ['seed', 'difficulty', 'recent', 'current']) assert.deepEqual(restored[key], actualRestored[key]);
  saved.push({case: `malformed-optional-entry-${index}`, currentPreserved: true});
}
const longHistory = {...actualRestored, scenarios: {2: Array(7).fill(good)}};
assert.equal(clone(longHistory).scenarios[2].length, 4);
const independentCopy = clone(actualRestored);
independentCopy.scenarios[2][0].motif.structure = '9';
assert.notEqual(actualRestored.scenarios[2][0].motif.structure, '9');
saved.push({case: 'bounded-history-and-deep-copy', maxHistory: 4});

const legacyBoard = [1,6,1,5,1,5,6,1,4,1,8,1,9,8,7,1,7,1,2,1,4,3,1,3,1,9,2];
const legacy = {...generator.newClassicRun(3384638011), difficulty: 2,
  recent: [legacyBoard.join('')], current: {attempt: 'legacy-high', board: legacyBoard}, rotation: {2: ['stock','gaps']}};
const migrated = clone(legacy);
assert.deepEqual(migrated.current, legacy.current);
assert.equal(generator.takeGeneratedClassic(migrated, 'next-high', 2).current.board.length, 45);
assert.ok(clone(migrated).scenarios[2].length === 1);
saved.push({case: 'legacy-high27-keeps-current-next45', seed: 3384638011});

for (const path of ['src/core.ts', 'src/classic-dense.ts'])
  assert.equal(manifest.files.find(f => f.path === path).gitBlob, previous.manifest.files.find(f => f.path === path).gitBlob);
const summary = {source: manifest.ref, baseline: previous.manifest.ref, runtime: process.version,
  proofChecks, freshPairs: fresh.length, freshExactMatches: fresh.length,
  serialGames: series.reduce((n, s) => n + s.rows.length, 0), forcedFallback: fallback.length,
  savedScenarios: saved.length, unchangedSource: ['src/core.ts', 'src/classic-dense.ts'],
  series: series.map(({label, initialSeed, rows}) => ({label, initialSeed, games: rows.length,
    exactPrevious4: rows.filter(r => r.exactInPrevious4).length,
    exactAdjacent: rows.filter(r => r.exactInPrevious1).length,
    sameRecipeAdjacent: rows.filter(r => r.recipeInPrevious1).length,
    fallback: rows.filter(r => r.fallback).length,
    requestedActualMismatch: rows.filter(r => r.level >= 2 && r.style !== r.recipe).length})),
  limits: ['Bounded targeted sample, not exhaustive proof over all seeds.',
    'ClassicRun serialization only; no UI, Android, physical phone or live users.',
    'A central motif is measured on the generated certificate only.']};
writeResult('generator-bounded-results.json', {summary, fresh, series, fallback, saved});
console.log(JSON.stringify(summary, null, 2));
