# Monetization implementation checkpoint

Actual base: `4d8943187567e20e178a86719d782c9ad3c06bc9`, preserving the guidance adoption after the research base `24ae94f`. Work branch: `feat/monetization-assists-20261113`. Normative package is retained in `spec/`; no game-specific material is being sent upstream.

Foundation C / A1–A3: versioned product receipt, frozen hint intent, separate durable grant and reveal, native readiness, off-by-default A3 QA profile, product inventories/assignment storage and new event allowlists. Save wire is 6, ordinary rules remain 1, receipt is 1; exact legacy receipts remain hint packs. Invalid/new help authority is protected from destructive recovery.

Native receipt keeps an independent in-process copy across failed SharedPreferences commits/acknowledgements. A failed earned commit must not notify JS; pending recovery retries the same token. This cannot manufacture a disk write when storage is permanently unavailable.

Revenue continues through the existing manual AdRevenue dataset. Added impression-instance IDs, assignment payload and separate coverage diagnostics, not a second sum of revenue. SDK enqueue/receipt crash gaps require downstream dedup by impression ID. Automatic/manual selection and real export join remain unverified until actual cabinet access and paid traffic; QA is excluded.

Local verification so far: 81 unit tests, build; 16 browser scenarios across the original monetization suite and new foundation suite. Browser uses Chromium headless shell, not a physical phone. Native additions need Java/Android CI. No rollout, no store publishing, no money/retention conclusion.

Next: finish native CI and separate B1 transition/search/entitlement/UI, then deliver the first isolated QA configurations before B2/A4/labs.

## B1 candidate checkpoint

Magnet is implemented separately: strict special transition, worker-wide 128-candidate/4000-node/120ms budget, independently replayed proof, preview, one install demo, per-attempt entitlement/limit, persistent charges, Undo/replay, separate assist counters and assisted completion. Legacy unfinished attempts are not retroactively enabled. QA fixture button starts a new explicitly marked attempt. Public flags remain off.

Local: 91 unit tests; 15 targeted foundation/Magnet browser scenarios including failure injection, stale intent, no ads, reload/replay and 320×568 / 568×320 enlarged offers. Independent replay: 39 synthetic positions, 13 verified offers; these are not estimates of player demand. Prior broader CI found three test expectations needing the new wire version and waiting for durable hint completion; their targeted rerun passes. Native/Android foundation CI job 131916392982 is green (38 cases). Full CI reruns at the candidate commit before delivery.

The separate QA APK package is `com.seedsbits.game.assistqa`, with test ads and no analytics key. A3 and Magnet builds each enable exactly one product difference; A1/A2 are their common baseline. Signing/review package and real-device validation are separate from the unsigned CI build.

Offline measurement command: `python3 scripts/report-help-experiment.py --events events.csv --revenue ad_revenue.csv --as-of <ISO-time> --output report.json`. Accepts AppMetrica event/ad-revenue export field names (JSON row arrays or CSV). Manual SDK payload `dataset=manual-ilrd-v1` is the canonical filter; other sources are counted but never summed. It preserves original assignments, separate new/existing cohorts, 168-hour revenue and 192-hour D7 maturity, decimal/currency/precision and unknown ILRD. Its synthetic test is not player data; it deliberately cannot declare a commercial winner or attest complete observation.

## First verified delivery and B2

First delivered source `a86609c`: QA version 1.1.2 / 11802, isolated test-ads package; 93 unit, 227 main browser, 14 regression browser (one unchanged opt-in skip), 40 native doubles. Both GitHub workflows green. Physical Android/real SDK callbacks to cabinet and actual money remain unverified. `d3232d2` subsequently passed both workflows with explicit assignment context and detailed result reason corrections.

B2 adds the isolated `plan` QA profile. A current-board worker proof of a 2–3 ordinary move goal is required before an offer. First disclosure durably buys the whole path; no automatic removals, no second charge/video. Current session state (including pre-save Undo render) selects the next verified step; deviation removes highlighting, exact return/reload resumes. One install demo and one new plan per attempt. Earned and application remain separate writes. The common reward contract handles stale plan rewards as stored plan charges.

Local B2: 97 unit tests, 5 dedicated browser scenarios with recording; preview refusal, earned duplicate listeners, stale recovery, row compaction, Undo, deviation/reload, and failed disclosure write. `node scripts/build-help-fixtures.mjs && node scripts/compare-help-plans.mjs` compares 40 explicitly synthetic current positions: 4 found, 3 unknown, 33 not found, 3 with a better demonstrated goal than up to three repeated first-available pairs. This is not demand frequency, monetary value or retention evidence; the ordinary baseline reaches the chosen three-step demo goal too. No audience configuration enabled. Full CI/Android rerun follows this commit.

## A4 isolated result route

The `result` QA profile enables only the short-task route addition. All four explicit result actions use `prepareResultTransition`: save first, preserve external/background suppression, then call the existing non-waiting native interstitial policy. Native wall-clock interval remains 180000ms and rewarded updates its shared guard. No loading wait/late ad is scheduled on destination. Durable choice and diagnostic result events carry route, first short-task marker, phase/reason and ad_session_id; native allowlist accepts that event. Ordinary navigation/Add/Undo/restart/tutorial/resume gain no ad call.

Local: 6 result-route browser scenarios plus all 11 existing monetization scenarios pass; build passes. Tests exercise default-off control, native cooldown/not_loaded reasons, saved-result-before-call, late loaded, first entry marker and save failure. Native cadence behavior remains covered by N07–N12; new N41 checks result event dispatch in CI. These mocks do not measure abandonment on first short-task entry or actual ad earnings.

## B3 laboratory trials

`trials` is a separate QA-only entry and exact storage key `seeds-bits.lab.trials.v1`. Three handpicked tasks of 4/6/8 starting digits have independently core-replayed complete witnesses within 2 Add. Stop requires nonempty board, zero pairs and exhausted Add budget. Add remains forbidden while pairs exist. Free Undo/restart, per-attempt extra-Add entitlement, exact replay, sticky reward limit, durable versioned explicitly mock receipt and stale bonus carry are implemented. Bonus offer requires a real next ordinary pair after Add and does not promise full solution. No production inventory or Classic/Notebook/Daily session is used.

Android lab writes have an exact key allowlist and synchronous disk commit, separate from game progress/settings; failure retains prior in-memory authority. N42/N43 verify this path with native doubles. Local: 4 targeted unit tests and 3 browser scenarios pass, build passes; browser includes a durable mock earned→grant failure/reload gap. Mock earning is prominently labelled and produces no real ad/monetary events. Gameplay value versus Notebook and paid audience value remain unconfirmed.
