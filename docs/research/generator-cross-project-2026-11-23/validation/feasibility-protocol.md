# Research protocol: dense 45/81 fields

This is an offline feasibility experiment. It does not modify the product, does not implement issue 13, and does not calibrate human difficulty. The current 18/28 contracts are outside this experiment.

## Fixed bounds, declared before execution

- Source snapshot: `DanilaH/seeds-bits@0c8fbba9c8864f39a398c5a6517b7b493ae3b1fc`.
- Before the final reproduction, verify the copied FNV1a `hash` body against byte-verified `src/puzzles.ts` from this same commit. This provenance check was added after the preliminary run; budgets, seed schedules, selection rules, and constructor algorithms were not changed.
- Execute actual `src/core.ts` via `load-product.mjs`: width 9, values 1..9, Add only at zero legal pairs, maximum 1800 logical cells.
- Total experiment wall budget: 120 seconds from the start of the runner. If exhausted, retain completed observations; exhaustion means UNKNOWN.
- Recreate the first 64 source odd-five kernels with the original deterministic seed schedule, at most 99,999 source kernel attempts. Use the source 5,000-visit no-Add solver bound. A failure of bounded search is not a proof of impossibility.
- Three diagnostic variants, each with exactly 16 predetermined seeds per target size 45/81 unless the wall budget expires:
  1. Literal legacy construction: preserve the 35-cell kernel allocation and change the requested length/pair count only.
  2. Explicitly pad an unfiltered source kernel with zeros to the requested length; otherwise preserve the reverse insertion algorithm.
  3. Explicitly pad a source kernel after finding a fresh certificate that its surviving full-row representation clears after one legal Add. Check unchanged old certificates separately. The reason for this check is that padding changes the fourth row from 8 to 9 logical cells, so original certificate indices need not survive.
- A separate, bounded illustration search uses variant 3: at most 256 additional predetermined seeds per size, stopping after four unique dense certificates per size pass the screen below. Its attempts and yield are reported separately from the fixed samples.
- No backtracking constructor, solver-guided placement, runtime fallback, or new gameplay mechanic is introduced.

## Illustrative structural screen

A candidate must have the exact target length, contain only nonzero digits 1..9, and replay to empty using actual core. For illustration only, require at least seven distinct digits, maximum one-digit share at most `ceil(target*0.34)`, same-value pair share 0.2..0.8, at least three route direction types, and at least three proof moves with an actual empty cell inside the connection path. These are descriptive structural filters, not a difficulty or fun metric. Opening counts are measured rather than assigned an unvalidated size-dependent threshold.

The source script's `gapMoves` metric is retained separately. It can count a reading-order connection between adjacent row-edge cells as a gap because column distance is large. The stricter metric above requires an interior logical cell on the actual connection path.

## Evidence and reporting

For every attempt record target, seed, kernel, occupied cells, logical length, reverse insertions, candidate checks, elapsed time, and reason for rejection. Save exact illustrative boards, complete pair-index/Add certificates, SHA256 board/certificate digests, and per-step replay state digests. Compare route metrics with the legacy `dense`, `bridges`, and `addition` families by replaying their stored certificates with actual core. No phone, live-original, audience, success-probability-over-all-choices, or human difficulty claim follows from this experiment.

Canonicalization removes only complementary digit-group naming for a descriptive shape count. Row reflection is not treated as a gameplay equivalence. All generated examples remain members of one five-digit-tail / one-Add construction family unless evidence shows otherwise.
