import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.argv[2];
if (!repo) throw new Error('Usage: node --experimental-strip-types fixtures/verify-magnet.mjs /absolute/path/to/seeds-bits');
const core = await import(pathToFileURL(resolve(repo, 'src/core.ts')).href);
const fixture = JSON.parse(readFileSync(new URL('./magnet-example.json', import.meta.url), 'utf8'));
assert.equal(core.WIDTH, fixture.width);
let board = [...fixture.start];
for (const [a, b] of fixture.normal_prefix) {
  assert.equal(core.checkPair(board, a, b).ok, true, `Illegal prefix ${a}:${b}`);
  board = core.removePair(board, a, b);
}
assert.deepEqual(board, fixture.before);
assert.deepEqual(core.pairs(board), fixture.legal_pairs_before);
assert.equal(core.pairs(board).length, 0);
const [a, b] = fixture.magnet_pair;
assert.notEqual(a, b);
assert.ok(board[a] && board[b]);
assert.ok(board[a] === board[b] || board[a] + board[b] === 10);
assert.deepEqual(core.checkPair(board, a, b), fixture.ordinary_rejection);
assert.equal(core.checkPair(board, a, b).ok, false);

// Proposed special transition only: the normal core rules remain strict.
const special = [...board];
special[a] = 0;
special[b] = 0;
board = [];
for (let i = 0; i < special.length; i += fixture.width) {
  const row = special.slice(i, i + fixture.width);
  if (row.some(Boolean)) board.push(...row);
}
assert.deepEqual(board, fixture.after_magnet);
for (const step of fixture.normal_continuation) {
  assert.deepEqual(board, step.before);
  assert.equal(core.checkPair(board, ...step.pair).ok, true);
  board = core.removePair(board, ...step.pair);
  assert.deepEqual(board, step.after);
}
assert.deepEqual(board, fixture.final);
assert.equal(core.occupied(board), 0);
console.log('PASS: ordinary prefix; zero legal pairs; forbidden normal magnet pair; proposed special removal; two legal moves; empty board.');
console.log('Synthetic QA fixture. This verifies rules, not demand or commercial uplift.');
