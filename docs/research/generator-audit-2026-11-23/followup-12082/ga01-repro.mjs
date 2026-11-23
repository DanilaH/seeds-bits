// Node 24; exact source bytes are verified by generator-load.mjs.
// This changes research input states only, never the product implementation.
import assert from 'node:assert/strict';
import {generator, core, profile, manifest, digest, writeResult} from './generator-load.mjs';
const clone = x => { const y = generator.readClassicRun(JSON.parse(JSON.stringify(x))); assert.ok(y); return y; };
const replay = selected => {
  let board = [...selected.board], preAdd;
  for (const move of selected.proof) {
    if (move === null) {
      assert.equal(core.pairs(board).length, 0);
      preAdd ??= [...board];
      board = core.addNumbers(board);
    } else {
      assert.equal(core.checkPair(board, ...move).ok, true);
      board = core.removePair(board, ...move);
    }
  }
  assert.deepEqual(board, []);
  return preAdd;
};
let state = generator.newClassicRun(12081);
const fixtures = [], causal = [];
for (let index = 0; index < 30; index++) {
  const input = clone(state), actualState = clone(input);
  const selected = generator.generateClassic(actualState, 2);
  const preAdd = replay(selected);
  const game = generator.takeGeneratedClassic(state, `audit-${index}`, 2);
  assert.deepEqual(game.current.board, selected.board);
  assert.equal(state.seed, actualState.seed);
  assert.deepEqual(state.scenarios[2].at(-1), {recipe: selected.recipe, motif: selected.profile.motif});
  if (index >= 28) fixtures.push({index, input, selected, preAdd, savedScenarios: state.scenarios[2]});
  // Keep seed, recent boards and every recipe unchanged. Dense routes all use
  // first-add, so replacing only the saved stage with midpoint removes only
  // motifPenalty. Requested style, candidate pool and recipePenalty stay fixed.
  if (input.scenarios?.[2]?.length && causal.length < 2) {
    const counterfactualInput = clone(input);
    for (const entry of counterfactualInput.scenarios[2]) entry.motif.stage = 'midpoint';
    const counterfactualState = clone(counterfactualInput);
    const alternative = generator.generateClassic(counterfactualState, 2);
    assert.equal(selected.style, alternative.style);
    assert.equal(actualState.seed, counterfactualState.seed);
    assert.deepEqual(selected.diagnostics, alternative.diagnostics);
    replay(alternative);
    if (digest(selected.board) !== digest(alternative.board)) causal.push({index, input,
      counterfactualInput, selected, alternative, outputSeed: actualState.seed});
  }
  state = clone(state);
}
assert.notEqual(fixtures[0].selected.profile.motif.structure, fixtures[1].selected.profile.motif.structure);
assert.deepEqual(fixtures.map(f => f.selected.recipe), ['gaps', 'stock']);
assert.deepEqual(fixtures.map(f => f.selected.profile.motif.structure),
  ['123450000', '151592342327634151695000000']);
assert.ok(causal.length, 'Expected an observable influence of the motif penalty');
const result = {source: manifest.ref, runtime: process.version, initialSeed: 12081, level: 2,
  fixtures, causal,
  limits: ['A motif is one state on one certified route, not all possible player paths.',
    'Counterfactual inputs are a causal probe of ranking, not real saved sessions.',
    'No phone performance or human fun is inferred.']};
writeResult('generator-ga01-repro.json', result);
console.log(JSON.stringify({source: manifest.ref,
  fixtures: fixtures.map(f => ({index: f.index, style: f.selected.style, recipe: f.selected.recipe,
    motif: f.selected.profile.motif, firstAdd: f.selected.profile.firstAdd})),
  causal: causal.map(f => ({index: f.index, style: f.selected.style,
    actual: {recipe: f.selected.recipe, motif: f.selected.profile.motif},
    motifPenaltyRemoved: {recipe: f.alternative.recipe, motif: f.alternative.profile.motif},
    sameOutputSeed: f.outputSeed, diagnostics: f.selected.diagnostics}))}, null, 2));
