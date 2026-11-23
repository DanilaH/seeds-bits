// Reproduce the two consecutive High45 deals in the exact audited product sources.
// Run: node docs/research/generator-audit-2026-11-23/scripts/rotation-check.mjs (Node 24).
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {core, profile, generator, manifest} from './source.mjs';

const clone = state => {
  const parsed = generator.readClassicRun(JSON.parse(JSON.stringify(state)));
  assert.ok(parsed);
  return parsed;
};
const initialSeed = 12081, level = 2, fixtures = [];
let state = generator.newClassicRun(initialSeed);
for (let index = 0; index <= 29; index++) {
  const input = clone(state);
  const selected = generator.generateClassic(clone(input), level);
  const game = generator.takeGeneratedClassic(state, `audit-${index}`, level);
  assert.deepEqual(game.current.board, selected.board);
  assert.ok(!input.recent.includes(selected.board.join('')));
  if (index >= 28) {
    let board = selected.board, preAdd;
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
    assert.ok(preAdd);
    fixtures.push({index, input, board: selected.board, proof: selected.proof,
      style: selected.style, recipe: selected.recipe, profile: selected.profile,
      diagnostics: selected.diagnostics, preAdd,
      preAddShape: profile.classicStructure(preAdd),
      savedRotation: [...state.rotation[level]]});
  }
  state = clone(state);
}
assert.deepEqual(fixtures.map(f => f.style), ['stock', 'gaps']);
assert.deepEqual(fixtures.map(f => f.recipe), ['stock', 'stock']);
assert.equal(fixtures[0].preAddShape, fixtures[1].preAddShape);
assert.notEqual(profile.classicStructure(fixtures[0].board), profile.classicStructure(fixtures[1].board));
assert.deepEqual(fixtures[1].savedRotation, ['stock', 'gaps']);
const result = {source: manifest.ref, initialSeed, level, fixtures,
  limits: ['Repetition applies to the certified pre-Add state, not all player routes.',
    'Initial boards are structurally distinct.',
    'The documented rotation concerns preferences; a hard recipe rotation requirement is not established.']};
const output=path.resolve(process.env.SEEDS_AUDIT_OUTPUT??'test-results/seeds-generator-audit');
mkdirSync(output,{recursive:true});
writeFileSync(path.join(output,'generator-rotation-fixture.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({source: manifest.ref, fixtures: fixtures.map(({index, style, recipe, savedRotation, preAddShape}) =>
  ({index, style, recipe, savedRotation, preAddShape}))}, null, 2));
