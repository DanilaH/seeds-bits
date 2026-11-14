# Selected mini-games-kit sources

Upstream: https://github.com/DanilaH/mini-games-kit

| Local module | Exact upstream commit | Source path | SHA256 |
| --- | --- | --- | --- |
| value-transfer.ts | a9325265e87583a4872cf6a158e1e881a0d7508e | src/core/value-transfer.ts | 601cb5c0cae59b0f02d9f065b940faed5743c4477498dd48bf167f647456fed6 |
| owned-dom-motion.ts | 0d5638e8d2146d3d8906e4936ccfa6ec1eeab7d7 | src/feel/owned-dom-motion.ts | b6802555790032dec22416c88b3453b0a6887e225be8a1819b805f6f6a18e234 |

Both files are copied unchanged. Pins are per module; guidance remains separately pinned.

Value transfer: bounded token grouping and exact per-token amounts; paths, timing, preferences, sound/haptics and durable rewards remain Seeds policy. See docs/FEEL_2026-11-09.md.

Owned DOM motion: the owner explicitly requested extraction after the 14 November UI pass. Public API: https://github.com/DanilaH/mini-games-kit/blob/0d5638e8d2146d3d8906e4936ccfa6ec1eeab7d7/docs/feel/OWNED_DOM_MOTION.md . Seeds main.ts now imports this shared owner; it retains only selected/hinted reconciliation, color/opacity decisions, ease-out/durations, reduced-motion/activity checks and the choose() input/index-remapping gate. settlePresentation() calls cancelAll(). No callback authorizes a save, reward or input.

No Phaser, extra package dependency or floating Git reference. No other game or existing module pin is upgraded.
