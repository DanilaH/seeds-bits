# Owned DOM motion extraction — 14 November 2026

KIT IMPACT: **EXTRACTED**, explicitly authorized by the owner after the UI pass. The shared mechanism is merged into kit and deliberately consumed, unchanged and pinned, by Seeds. Seeds is one demonstrated real consumer; the generic browser fixture is not a second shipped game.

## Source and boundary

- Kit: [PR #33](https://github.com/DanilaH/mini-games-kit/pull/33), merged into main as `e04a3fe87ca93d506e01df4acc5afe690408cefa`.
- Exact consumed kit source: `0d5638e8d2146d3d8906e4936ccfa6ec1eeab7d7`, `src/feel/owned-dom-motion.ts`; [API and ownership contract](https://github.com/DanilaH/mini-games-kit/blob/0d5638e8d2146d3d8906e4936ccfa6ec1eeab7d7/docs/feel/OWNED_DOM_MOTION.md).
- Seeds runtime source: `322644f075122a7a16ea04aaa2cd6e5178a800ae`, branch `feat/monetization-assists-20261113`, based on `e703204424928ddf61befe9552ebc44c48548f82`. This report is a subsequent documentation-only record.
- Vendored source SHA256: `b6802555790032dec22416c88b3453b0a6887e225be8a1819b805f6f6a18e234`; byte-for-byte comparison with upstream passed.
- Guidance stays at `aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0`; value-transfer stays at `a9325265e87583a4872cf6a158e1e881a0d7508e`. No package, dependency or native SDK upgrade.

OwnedDomMotion owns conflicting WAAPI properties, samples actual visible values before replacement, cancels on host request and prevents stale completion callbacks. It handles shorthand/longhand overlap through CSSOM expansion, uses the target document's constructors and rejects additive composition and persistent forwards fill. Static final state belongs to CSS/model.

Seeds retains selected/hinted reconciliation, colors, easing, duration, reduced-motion/activity policy and all lifecycle wiring. settlePresentation() cancels the shared owner. The choose() deletion/index-remapping busy guard is unchanged. No shared callback authorizes a reward, save or input. Rules, difficulty, durable progress, stock/rights, ad frequency and reward economy are unchanged. The six flags visibility, magnet, plan, result, trials and shuffle remain false in baseline.

Existing browser test observers now capture both Element.animate() and Animation.play(), without double-counting, because the helper uses explicit Animation construction. The row-collapse test also asserts that it actually observed an animation; no assertions were relaxed.

## Verification

| Area | Observed result | Evidence |
| --- | --- | --- |
| Kit unit/build | 219 unit tests, typecheck, build, pack dry-run and bootstrap checks passed | [Final feature CI](https://github.com/DanilaH/mini-games-kit/actions/runs/43605367788) |
| Shared browser contract | 8 contracts passed: visible handoff, CSS var shorthand overlap, native property support, independent ownership, cancellation/reuse/detach, host reduced motion, invalid replacement/offset and iframe realm | Same CI, owned-dom-motion-evidence artifact |
| Kit merged main | CI passed on merge commit e04a3fe | [Main CI](https://github.com/DanilaH/mini-games-kit/actions/runs/43605689659) |
| Seeds model and browser | 107 + 2 unit, 298 main browser and 15 regression browser scenarios passed; web and Android builds passed | [Check and build](https://github.com/DanilaH/seeds-bits/actions/runs/43605619642) |
| Seeds UI/motion | 18 comparable capture scenarios and 18 contract checks passed | [UI motion evidence](https://github.com/DanilaH/seeds-bits/actions/runs/43605619583) |
| Seeds help/native | 68 targeted help/browser scenarios, native harness and optimized baseline Android build passed | [QA preview](https://github.com/DanilaH/seeds-bits/actions/runs/43605619665) |
| Real Android WebView | Offline Android 35: exact QA 11815 payload upgraded to the new payload, preserving classic board/Undo, hints, notebook board and dark theme; fresh installation, Android Back/Home, resume/process stop, rotation, font150 portrait/landscape and offline privacy checks passed | Same QA run, baseline-android-acceptance artifact with screenshots/recording/reports |
| Local provenance | Exact vendor comparison and strict guidance:doctor passed, zero warnings/errors; protected gameplay/native/config/dependency files unchanged from e703204 | Local checks against the pinned checkout |

Browser execution was in CI Chromium; the local managed environment could not launch Chromium because socket creation was restricted. Android acceptance used an offline emulator. Both APKs were temporarily signed with the same CI-only key, so this establishes payload migration behavior, not an update on the owner's physical phone using the original QA signing key. The existing signing-key delivery limitation remains separate; no new installable APK is claimed by this extraction.

No physical-device feel, live advertising, real revenue or retention was measured. No store publication, dashboard changes or edits to other games were made.
