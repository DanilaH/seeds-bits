import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { core, generator, catalog, catalogProofs, recordedMetrics, digest, manifest } from './load-product.mjs';

const names = ['easy18', 'normal28', 'hard27'];
const width = core.WIDTH;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const write = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n');
const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const edgeSet = (legal, ids) => new Set(legal.map(p => key(ids[p.a], ids[p.b])));
const added = (before, after) => [...after].filter(x => !before.has(x));
const digits = board => board.filter(Boolean).sort((a, b) => a - b).join('');

function direction(board, move) {
  const [a, b] = move;
  const result = core.checkPair(board, a, b);
  assert(result.ok, `Illegal removal ${move}`);
  if (result.path.kind === 'reading') return 'reading';
  const dr = Math.abs(Math.floor(a / width) - Math.floor(b / width));
  const dc = Math.abs(a % width - b % width);
  return dr === 0 ? 'horizontal' : dc === 0 ? 'vertical' : 'diagonal';
}

function replay(initial, proof, withTrace = false, mustClear = true) {
  let board = [...initial];
  let ids = board.map((_, i) => i);
  let nextId = ids.length;
  let singleRun = 0;
  let maxSingleRun = 0;
  const m = {
    proofSteps: proof.length, pairMoves: 0, additions: 0,
    directions: { horizontal: 0, vertical: 0, diagonal: 0, reading: 0 },
    gapMoves: 0, throughEmptyCellsMoves: 0, emptyCellsTraversed: 0,
    readingBoundaryAdjacentMoves: 0, crossingRowMoves: 0, equalValueMoves: 0,
    rowCompressionEvents: 0, rowsRemoved: 0, logicalCellsRemovedByCompression: 0,
    newlyEnabledPairsAfterRemoval: 0, newlyEnabledPairsBeforeCompression: 0,
    newlyEnabledPairsByCompression: 0, pairsLostByCompression: 0,
    newlyEnabledPairsAfterAdd: 0, removalsEnablingNoNewPairs: 0,
    singleLegalRemovalStates: 0, longestSingleLegalRemovalRun: 0, singleLegalRemovalTail: 0,
    minLegalPairsBeforeRemoval: Infinity, maxLegalPairsBeforeRemoval: 0,
    peakLogicalCells: board.length, peakOccupied: core.occupied(board),
    legalPairCountsBeforeRemoval: [], addAtPairMoves: [],
  };
  const trace = [];
  for (let step = 0; step < proof.length; step++) {
    const move = proof[step];
    const legal = core.pairs(board);
    const beforeEdges = edgeSet(legal, ids);
    const event = {
      step, action: move === null ? 'add' : 'remove',
      board: withTrace ? [...board] : undefined,
      stableCellIds: withTrace ? [...ids] : undefined,
      logicalCellsBefore: board.length, occupiedBefore: core.occupied(board),
      legalPairsBefore: legal.length,
    };
    if (move === null) {
      assert(legal.length === 0, `Add with pairs at proof step ${step}`);
      assert(core.occupied(board) > 0, `Add on empty board ${step}`);
      const appended = board.filter(Boolean);
      const after = core.addNumbers(board);
      assert(equal(after, [...board, ...appended]), 'Unexpected actual Add result');
      const appendedIds = appended.map(() => nextId++);
      ids = [...ids, ...appendedIds];
      const afterLegal = core.pairs(after);
      event.appendedValues = appended;
      event.legalPairsAfter = afterLegal.length;
      event.newlyEnabledPairs = added(beforeEdges, edgeSet(afterLegal, ids)).length;
      m.newlyEnabledPairsAfterAdd += event.newlyEnabledPairs;
      m.additions++;
      m.addAtPairMoves.push(m.pairMoves);
      singleRun = 0;
      board = after;
    } else {
      const [a, b] = move;
      assert(legal.some(p => key(p.a, p.b) === key(a, b)), `Proof pair absent at ${step}`);
      const checked = core.checkPair(board, a, b);
      assert(checked.ok, `Invalid actual pair at ${step}`);
      const moveDirection = direction(board, move);
      const dr = Math.abs(Math.floor(a / width) - Math.floor(b / width));
      const dc = Math.abs(a % width - b % width);
      const gap = Math.max(dr, dc) > 1 || (checked.path.kind === 'reading' && Math.abs(b - a) > 1);
      const pathEmptyCells = checked.path.kind === 'reading'
        ? Math.abs(b - a) - 1 : Math.max(dr, dc) - 1;
      assert(pathEmptyCells >= 0, 'Negative legal path distance');
      const holes = [...board];
      holes[a] = 0; holes[b] = 0;
      const holesEdges = edgeSet(core.pairs(holes), ids);
      const after = core.removePair(board, a, b);
      const remapped = [];
      const remappedIds = [];
      const removedRows = [];
      for (let start = 0; start < holes.length; start += width) {
        const row = holes.slice(start, start + width);
        if (row.some(Boolean)) {
          remapped.push(...row);
          remappedIds.push(...ids.slice(start, start + width));
        } else removedRows.push(Math.floor(start / width));
      }
      assert(equal(after, remapped), `Cell-ID remap disagrees with actual removePair at ${step}`);
      assert(remappedIds.length === after.length, 'Cell-ID length mismatch');
      const afterLegal = core.pairs(after);
      const afterEdges = edgeSet(afterLegal, remappedIds);
      const newlyEnabled = added(beforeEdges, afterEdges);
      const byHoles = added(beforeEdges, holesEdges);
      const byCompression = added(holesEdges, afterEdges);
      const lostByCompression = added(afterEdges, holesEdges);
      event.move = [a, b];
      event.values = [board[a], board[b]];
      event.endpointIds = [ids[a], ids[b]];
      event.direction = moveDirection;
      event.gap = gap;
      event.pathEmptyCells = pathEmptyCells;
      event.throughEmptyCells = pathEmptyCells > 0;
      event.removedRows = removedRows;
      event.legalPairsAfter = afterLegal.length;
      event.newlyEnabledPairs = newlyEnabled.length;
      event.newPairIds = withTrace ? newlyEnabled : undefined;
      event.newlyEnabledPairsBeforeCompression = byHoles.length;
      event.newlyEnabledPairsByCompression = byCompression.length;
      event.pairsLostByCompression = lostByCompression.length;
      m.pairMoves++;
      m.directions[moveDirection]++;
      m.gapMoves += Number(gap);
      m.throughEmptyCellsMoves += Number(pathEmptyCells > 0);
      m.emptyCellsTraversed += pathEmptyCells;
      m.readingBoundaryAdjacentMoves += Number(checked.path.kind === 'reading' && Math.abs(b - a) === 1);
      m.crossingRowMoves += Number(dr > 0);
      m.equalValueMoves += Number(board[a] === board[b]);
      m.rowsRemoved += removedRows.length;
      m.rowCompressionEvents += Number(removedRows.length > 0);
      m.logicalCellsRemovedByCompression += board.length - after.length;
      m.newlyEnabledPairsAfterRemoval += newlyEnabled.length;
      m.newlyEnabledPairsBeforeCompression += byHoles.length;
      m.newlyEnabledPairsByCompression += byCompression.length;
      m.pairsLostByCompression += lostByCompression.length;
      m.removalsEnablingNoNewPairs += Number(newlyEnabled.length === 0);
      m.singleLegalRemovalStates += Number(legal.length === 1);
      singleRun = legal.length === 1 ? singleRun + 1 : 0;
      maxSingleRun = Math.max(maxSingleRun, singleRun);
      m.minLegalPairsBeforeRemoval = Math.min(m.minLegalPairsBeforeRemoval, legal.length);
      m.maxLegalPairsBeforeRemoval = Math.max(m.maxLegalPairsBeforeRemoval, legal.length);
      m.legalPairCountsBeforeRemoval.push(legal.length);
      board = after;
      ids = remappedIds;
    }
    m.peakLogicalCells = Math.max(m.peakLogicalCells, board.length);
    m.peakOccupied = Math.max(m.peakOccupied, core.occupied(board));
    if (withTrace) trace.push(event);
  }
  m.longestSingleLegalRemovalRun = maxSingleRun;
  m.singleLegalRemovalTail = singleRun;
  m.equalValueRatio = m.pairMoves ? m.equalValueMoves / m.pairMoves : null;
  m.gapMoveRatio = m.pairMoves ? m.gapMoves / m.pairMoves : null;
  m.throughEmptyCellsMoveRatio = m.pairMoves ? m.throughEmptyCellsMoves / m.pairMoves : null;
  assert(m.gapMoves === m.throughEmptyCellsMoves + m.readingBoundaryAdjacentMoves, 'Legacy gap metric discrepancy not explained by adjacent reading boundary');
  m.newPairsPerRemoval = m.pairMoves ? m.newlyEnabledPairsAfterRemoval / m.pairMoves : null;
  m.noNewPairRemovalRatio = m.pairMoves ? m.removalsEnablingNoNewPairs / m.pairMoves : null;
  m.directionKinds = Object.values(m.directions).filter(n => n > 0).length;
  m.cleared = core.occupied(board) === 0;
  m.finalLogicalCells = board.length;
  m.finalOccupied = core.occupied(board);
  if (mustClear) assert(m.cleared && board.length === 0, 'Proof did not clear');
  return { metrics: m, ...(withTrace ? {trace, finalBoard: board} : {}) };
}

function greedy(initial, maxAdds = 2, withTrace = false) {
  let board = [...initial], additions = 0, pairMoves = 0;
  const route = [];
  while (core.occupied(board)) {
    assert(route.length < 1000, 'Unexpected unbounded greedy route');
    const legal = core.pairs(board);
    if (legal.length) {
      const {a, b} = legal[0];
      route.push([a, b]);
      board = core.removePair(board, a, b);
      pairMoves++;
    } else if (additions < maxAdds) {
      route.push(null);
      board = core.addNumbers(board);
      additions++;
    } else break;
  }
  const result = {
    outcome: board.some(Boolean) ? 'blocked_after_two_adds' : 'cleared',
    additions, pairMoves, remainingDigits: core.occupied(board),
    finalLogicalCells: board.length,
  };
  if (withTrace) {
    result.route = route;
    result.replay = replay(initial, route, true, false);
  }
  return result;
}

function stats(values) {
  const a = [...values].sort((x, y) => x - y);
  const quantile = p => {
    const index = (a.length - 1) * p;
    const low = Math.floor(index), high = Math.ceil(index);
    return a[low] + (a[high] - a[low]) * (index - low);
  };
  return {min: a[0], p10: quantile(.1), median: quantile(.5), mean: a.reduce((x, y) => x + y, 0) / a.length, p90: quantile(.9), max: a.at(-1)};
}
const histogram = values => values.reduce((a, value) => { a[value] = (a[value] ?? 0) + 1; return a; }, {});

function summarize(rows) {
  const metricNames = ['proofSteps', 'pairMoves', 'gapMoves', 'gapMoveRatio', 'throughEmptyCellsMoves',
    'throughEmptyCellsMoveRatio', 'emptyCellsTraversed', 'readingBoundaryAdjacentMoves', 'rowCompressionEvents', 'rowsRemoved',
    'newlyEnabledPairsAfterRemoval', 'newlyEnabledPairsBeforeCompression', 'newlyEnabledPairsByCompression',
    'pairsLostByCompression', 'newlyEnabledPairsAfterAdd', 'newPairsPerRemoval', 'noNewPairRemovalRatio',
    'singleLegalRemovalStates', 'longestSingleLegalRemovalRun', 'singleLegalRemovalTail', 'directionKinds',
    'peakLogicalCells', 'peakOccupied'];
  return {
    count: rows.length, verifiedProofs: rows.filter(r => r.metrics.cleared).length,
    uniqueBoards: new Set(rows.map(r => r.board.join(''))).size,
    cells: histogram(rows.map(r => r.board.length)),
    fallback: rows.filter(r => r.fallback).length,
    openingPairs: stats(rows.map(r => r.openingPairs)),
    openingPairsHistogram: histogram(rows.map(r => r.openingPairs)),
    openingPairsPerOccupied: stats(rows.map(r => r.openingPairsPerOccupied)),
    openingPairsAmongAllUnorderedDigits: stats(rows.map(r => r.openingPairsAmongAllUnorderedDigits)),
    proofAdditionsHistogram: histogram(rows.map(r => r.metrics.additions)),
    fieldsWithCompressionTopologyChange: rows.filter(r => r.metrics.newlyEnabledPairsByCompression > 0 || r.metrics.pairsLostByCompression > 0).length,
    fractionWithCompressionTopologyChange: rows.filter(r => r.metrics.newlyEnabledPairsByCompression > 0 || r.metrics.pairsLostByCompression > 0).length / rows.length,
    fieldsWithCompressionEnablingPairs: rows.filter(r => r.metrics.newlyEnabledPairsByCompression > 0).length,
    fieldsWithCompressionLosingPairs: rows.filter(r => r.metrics.pairsLostByCompression > 0).length,
    greedy: {policy: 'pairs(board)[0], Add only at zero legal pairs, maximum two Adds',
      outcomes: histogram(rows.map(r => r.greedy.outcome)),
      addsHistogram: histogram(rows.map(r => r.greedy.additions))},
    metrics: Object.fromEntries(metricNames.map(name => [name, stats(rows.map(r => r.metrics[name]))])),
    directionTotals: Object.fromEntries(['horizontal','vertical','diagonal','reading'].map(dir => [dir, rows.reduce((a,r) => a + r.metrics.directions[dir], 0)])),
  };
}

const started = performance.now();
const rows = [];
for (let level = 0; level < 3; level++) {
  for (let seed = 0; seed < 1000; seed++) {
    const run = generator.newClassicRun(seed);
    const generated = generator.generateClassic(run, level);
    const {board, proof, fallback} = generated;
    const openingPairs = core.pairs(board).length;
    const occupied = core.occupied(board);
    rows.push({
      id: `${names[level]}-seed-${seed}`, level, seed, seedAfterGeneration: run.seed,
      board, boardSha256: digest(board), digitMultiset: digits(board), proof, fallback,
      openingPairs, openingPairsPerOccupied: openingPairs / occupied,
      openingPairsAmongAllUnorderedDigits: openingPairs / (occupied * (occupied - 1) / 2),
      metrics: replay(board, proof).metrics, greedy: greedy(board),
    });
    if ((seed + 1) % 250 === 0) console.log(`verified ${names[level]} ${seed + 1}/1000`);
  }
}

assert(catalog.length === 128 && catalogProofs.length === 128, 'Expected 128 legacy entries');
const legacy = catalog.map((entry, id) => {
  const board = entry.board.split('').map(Number);
  const proof = catalogProofs[id];
  const openingPairs = core.pairs(board).length;
  const occupied = core.occupied(board);
  const metrics = replay(board, proof).metrics;
  const old = recordedMetrics.fieldsMeasured[id];
  const mismatches = [];
  const check = (name, actual, expected) => { if (!equal(actual, expected)) mismatches.push({name, actual, expected}); };
  check('cells', board.length, old.cells);
  check('digits', occupied, old.digits);
  check('openings', openingPairs, old.openings);
  check('directions', Object.entries(metrics.directions).filter(([,n]) => n).map(([d]) => d).sort(), [...old.directions].sort());
  check('gapMoves', metrics.gapMoves, old.gapMoves);
  check('crossing', metrics.crossingRowMoves, old.crossing);
  check('sameRatio', metrics.equalValueRatio, old.sameRatio);
  check('additions', metrics.additions, old.additions);
  return {id, family: entry.family, board, proof, boardSha256: digest(board),
    openingPairs, openingPairsPerOccupied: openingPairs / occupied,
    openingPairsAmongAllUnorderedDigits: openingPairs / (occupied * (occupied - 1) / 2),
    metrics, recordedMetricMismatches: mismatches, greedy: greedy(board)};
});

const normals = rows.filter(r => r.level === 1);
const groups = Object.fromEntries([...new Set(normals.map(r => r.openingPairs))].sort((a,b) => a-b).map(openings => {
  const group = normals.filter(r => r.openingPairs === openings);
  return [openings, {
    count: group.length, distinctMultisets: new Set(group.map(r => r.digitMultiset)).size,
    greedyOutcomes: histogram(group.map(r => r.greedy.outcome)),
    proofAdditions: histogram(group.map(r => r.metrics.additions)),
    proofPairMoves: stats(group.map(r => r.metrics.pairMoves)),
    newlyEnabledPairsAfterRemoval: stats(group.map(r => r.metrics.newlyEnabledPairsAfterRemoval)),
  }];
}));
const normal22 = normals.filter(r => r.openingPairs === 22);
const strictGroupMap = new Map();
for (const row of normal22) {
  const groupKey = `${row.board.length}:${row.digitMultiset}:${row.openingPairs}:${row.metrics.additions}:${row.metrics.pairMoves}`;
  if (!strictGroupMap.has(groupKey)) strictGroupMap.set(groupKey, []);
  strictGroupMap.get(groupKey).push(row);
}
const strictGroups = [...strictGroupMap.values()].map(group => {
  const wins = group.filter(r => r.greedy.outcome === 'cleared').length;
  const blocked = group.length - wins;
  return {cells:group[0].board.length, digitMultiset:group[0].digitMultiset, openingPairs:22,
    witnessAdds:group[0].metrics.additions, witnessPairMoves:group[0].metrics.pairMoves,
    count:group.length, cleared:wins, blockedAfterTwoAdds:blocked,
    hasDifferentGreedyOutcomes:wins > 0 && blocked > 0,
    oppositeOutcomeFieldPairs:wins * blocked, seeds:group.map(r => r.seed)};
}).sort((a,b) => a.witnessAdds-b.witnessAdds || a.witnessPairMoves-b.witnessPairMoves);

function pickPair(predicate, score) {
  let best;
  for (let i = 0; i < normals.length; i++) for (let j = i + 1; j < normals.length; j++) {
    const a = normals[i], b = normals[j];
    if (a.board.length !== b.board.length || a.digitMultiset !== b.digitMultiset || a.openingPairs !== b.openingPairs) continue;
    if (!predicate(a, b)) continue;
    const value = score(a, b);
    if (!best || value > best.score) best = {a, b, score: value};
  }
  assert(best, 'No matched fixture found');
  return best;
}
const greedyMatch = pickPair((a,b) => a.openingPairs === 22 && a.greedy.outcome !== b.greedy.outcome && a.metrics.additions === b.metrics.additions && a.metrics.pairMoves === b.metrics.pairMoves,
  (a,b) => Math.abs(a.metrics.newlyEnabledPairsAfterRemoval - b.metrics.newlyEnabledPairsAfterRemoval));
const lengthMatch = pickPair((a,b) => a.openingPairs === 22,
  (a,b) => Math.abs(a.metrics.pairMoves - b.metrics.pairMoves));
const revealMatch = pickPair((a,b) => a.openingPairs === 22 && a.greedy.outcome === b.greedy.outcome && a.metrics.additions === b.metrics.additions && a.metrics.pairMoves === b.metrics.pairMoves,
  (a,b) => Math.abs(a.metrics.newlyEnabledPairsAfterRemoval - b.metrics.newlyEnabledPairsAfterRemoval));
const gapMatch = pickPair((a,b) => a.openingPairs === 22 && a.greedy.outcome === b.greedy.outcome && a.metrics.additions === b.metrics.additions && a.metrics.pairMoves === b.metrics.pairMoves,
  (a,b) => Math.abs(a.metrics.throughEmptyCellsMoves - b.metrics.throughEmptyCellsMoves));
const fixture = row => ({...row, proofReplay: replay(row.board, row.proof, true), greedyReplay: greedy(row.board, 2, true)});
const matchRecord = (name, selection, matched) => ({name, selection, score: matched.score,
  controls: {level: 1, cells: 28, digitMultiset: matched.a.digitMultiset, openingPairs: matched.a.openingPairs},
  fields: [fixture(matched.a), fixture(matched.b)]});
const matches = [
  matchRecord('same_start_and_witness_length_different_greedy_outcome', 'Among opening-22 Normal fields with equal witness Add count and pair-removal count but opposite greedy outcome, maximum difference in newly enabled pairs after removals; first seed pair breaks ties.', greedyMatch),
  matchRecord('same_start_different_witness_length', 'Among opening-22 Normal fields, maximum difference in witness pair-removal count; first seed pair breaks ties.', lengthMatch),
  matchRecord('same_start_and_witness_length_different_reveal', 'Among opening-22 Normal fields with equal witness Add count, pair-removal count and greedy outcome, maximum difference in newly enabled pairs after removals; first seed pair breaks ties.', revealMatch),
  matchRecord('same_start_and_witness_length_different_empty_cell_paths', 'Among opening-22 Normal fields with equal witness Add count, pair-removal count and greedy outcome, maximum difference in moves whose selected legal path has at least one intermediate empty cell; first seed pair breaks ties.', gapMatch),
];

const summary = {
  schemaVersion: 1, kind: 'ACTUAL_PRODUCT_TS_EXECUTION', source: manifest,
  runtime: process.version, width, seeds: {from: 0, through: 999, freshRunPerSeedAndLevel: true},
  definitions: {
    openingPairs: 'core.pairs(initialBoard).length; excludes no pair known to actual enumerator',
    openingPairsPerOccupied: 'Number of legal pairs divided by occupied digit count; a descriptive normalization, not probability or human difficulty.',
    openingPairsAmongAllUnorderedDigits: 'Number of legal pairs divided by n*(n-1)/2; a descriptive edge density.',
    witness: 'The actual generator-returned winning proof, not a shortest route and not proof of minimum required Adds.',
    newlyEnabledPairsAfterRemoval: 'After actual removal and row compression, stable endpoint-ID pair edges absent before the removal. Counts event occurrences, so an edge can count again if lost and re-enabled later.',
    newlyEnabledPairsBeforeCompression: 'Edges newly legal after zeroing the two digits, before compression; these may disappear again during compression.',
    newlyEnabledPairsByCompression: 'Edges after compression absent in the zeroed but uncompressed intermediate state.',
    pairIdentity: 'Persistent ID per logical cell; whole removed rows delete IDs; appended clones receive fresh IDs. Reconstructed row filtering is asserted equal to actual removePair output at every action.',
    gapMoves: 'Exact legacy content.json metric retained for comparison: max(abs(dr),abs(dc)) > 1 OR reading-order index distance > 1. It also counts reading-order adjacent row-boundary pairs with no intervening logical cells.',
    throughEmptyCellsMoves: 'Number of removals with at least one intermediate empty logical cell on the legal path selected by actual checkPair; for reading path, abs(b-a)-1; for straight path, max(abs(dr),abs(dc))-1.',
    readingBoundaryAdjacentMoves: 'Reading-order pairs with abs(b-a) == 1. These explain every extra legacy gapMoves count over throughEmptyCellsMoves in this audit.',
    singleLegalRemovalRun: 'Consecutive witness removals whose actual pre-state has exactly one legal pair; interrupted by Add or a state with more than one legal pair. No claim of human obviousness.',
    greedyFailure: 'This deterministic first-pair policy is blocked after at most two Adds; it is not a proof of board unsolvability.',
    fixtureSelection: 'Extremal controlled examples selected from the sample; not population-effect estimates or independently randomized A/B tests.',
    compressionCounts: 'Include final board clear and removal of a partial final row.',
    compressionTopologyChange: 'At least one surviving endpoint-ID legal pair appears or disappears when empty rows are removed, compared with the same zeroed digits before compression; deleting the selected pair alone does not count.',
  },
  byLevel: Object.fromEntries(names.map((name, level) => [name, summarize(rows.filter(r => r.level === level))])),
  replayValidation: {
    generatedProofs: rows.length, legacyProofs: legacy.length,
    generatedRemovalsVerifiedAgainstActualCore: rows.reduce((n,r) => n+r.metrics.pairMoves, 0),
    legacyRemovalsVerifiedAgainstActualCore: legacy.reduce((n,r) => n+r.metrics.pairMoves, 0),
    generatedAddPreconditionsVerifiedAgainstActualCore: rows.reduce((n,r) => n+r.metrics.additions, 0),
    legacyAddPreconditionsVerifiedAgainstActualCore: legacy.reduce((n,r) => n+r.metrics.additions, 0),
    legacyFieldsWithGapMetricBoundaryOvercount: legacy.filter(r => r.metrics.readingBoundaryAdjacentMoves > 0).length,
    legacyGapMetricBoundaryOvercount: legacy.reduce((n,r) => n+r.metrics.readingBoundaryAdjacentMoves, 0),
  },
  normalMatchedOpeningGroups: groups,
  normal22StrictControlledGroups: {
    controls: 'Exact cell count, digit multiset, opening count 22, witness Add count and witness pair-removal count.',
    fields:normal22.length, totalGroups:strictGroups.length,
    groupsWithAtLeastTwoFields:strictGroups.filter(g => g.count >= 2).length,
    groupsWithDifferentGreedyOutcomes:strictGroups.filter(g => g.hasDifferentGreedyOutcomes).length,
    fieldsInGroupsWithDifferentGreedyOutcomes:strictGroups.filter(g => g.hasDifferentGreedyOutcomes).reduce((n,g) => n+g.count, 0),
    oppositeOutcomeFieldPairs:strictGroups.reduce((n,g) => n+g.oppositeOutcomeFieldPairs, 0),
    groups:strictGroups,
  },
  legacy: {verifiedProofs: legacy.filter(r => r.metrics.cleared).length,
    recordedMetricMismatches: legacy.flatMap(r => r.recordedMetricMismatches.map(m => ({id:r.id,...m}))),
    byFamily: Object.fromEntries([...new Set(legacy.map(r => r.family))].map(f => [f, summarize(legacy.filter(r => r.family === f))]))},
  priorAudit14Comparison: {},
  limits: [
    'Node execution of exact source, not a measured phone or production-user result.',
    'Each seed starts with an empty recent-history list; this does not validate long persisted sessions.',
    'A single chosen witness and one fixed greedy policy describe continuation behavior, not universal difficulty.',
    'No human playtest, completion-time estimate, minimum-Adds proof or exhaustive solution-tree census is claimed.',
    'Zero fallbacks in 1000 starts per level does not prove zero fallback probability.',
    'Legacy catalog is audited as reference content; this does not assert it is the current runtime source of starts.',
  ],
};
const expected = [
  {median:13, adds:[1000,0,0], greedyWins:1000, fallback:0},
  {median:22, adds:[175,339,486], greedyWins:714, fallback:0},
  {median:16, adds:[0,439,561], greedyWins:584, fallback:0},
];
for (let level = 0; level < 3; level++) {
  const actual = summary.byLevel[names[level]];
  const measured = {median:actual.openingPairs.median, adds:[0,1,2].map(n => actual.proofAdditionsHistogram[n] ?? 0), greedyWins:actual.greedy.outcomes.cleared ?? 0, fallback:actual.fallback};
  summary.priorAudit14Comparison[names[level]] = {expected:expected[level], actual:measured, matches:equal(expected[level], measured)};
}
summary.elapsedSeconds = (performance.now() - started) / 1000;
write('baseline-fields.json', {sourceRef:manifest.ref, rows});
write('baseline-legacy.json', {sourceRef:manifest.ref, rows:legacy});
write('baseline-matched.json', {sourceRef:manifest.ref, definitions:summary.definitions, matches});
write('baseline-summary.json', summary);
console.log(JSON.stringify({elapsedSeconds:summary.elapsedSeconds, comparison:summary.priorAudit14Comparison,
  legacyProofs:summary.legacy.verifiedProofs, legacyMismatches:summary.legacy.recordedMetricMismatches,
  matched:matches.map(m => ({name:m.name, fields:m.fields.map(r => ({seed:r.seed, opening:r.openingPairs, witnessAdds:r.metrics.additions, witnessPairs:r.metrics.pairMoves, newlyEnabled:r.metrics.newlyEnabledPairsAfterRemoval, throughEmptyCells:r.metrics.throughEmptyCellsMoves, legacyGaps:r.metrics.gapMoves, greedy:r.greedy.outcome}))}))},null,2));
