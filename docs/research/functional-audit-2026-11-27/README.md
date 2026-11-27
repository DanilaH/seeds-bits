# Независимый функциональный аудит 12108 — 27.11.2026

## Provenance / verdict
Runtime PR40 / feat/quiet-table-20261126 / e592866145b0c2f537f01d21fb62a0e9e471d5e4; game main 4f7a8f93e044cc5eb5f4dadceb8a0458b555cf08 is not latest runtime. Kit main 7f289212cb0eb752d75127a3182478b005436533. Read researcher bootstrap, reference/porting, project AGENTS/decisions/status/pause, durable receipt and native lifecycle guidance. No new original-game source claim. APK1.1.2/12108 com.seedsbits.game.preview, independently verified SHA256 2b1158329439af47630538c4498715da1305dbbd6412d36162ce5c4986e27e4f. [Signed source](https://github.com/DanilaH/seeds-bits/actions/runs/45954682191/artifacts/15178965001). Preview firstSession=true, helpProfile=baseline, analytics=false. Existing store branch revisions older. No publication or release signing performed.

**Core rules and sampled normal operations PASS; not unconditional release acceptance.** Four confirmed conditional data/persistence defects: FA-01/02 shared, FA-03/04 web. FA-05–08 open gates, not demonstrated failures. No core redesign/economy/flag changes authorized.

## Evidence register
| ID | Source | Scope |
|---|---|---|
| E1 | [General](https://github.com/DanilaH/seeds-bits/actions/runs/45954682161), [PR](https://github.com/DanilaH/seeds-bits/actions/runs/45954689421), [Storage](https://github.com/DanilaH/seeds-bits/actions/runs/45954682178), [Preview](https://github.com/DanilaH/seeds-bits/actions/runs/45954682191) | 4 exact-runtime CI successful;177 unit,592 e2e,220 focused storage/fault/focus cases. Other subgates overlap, not added into a fictional total. |
| E2 | [Independent model](https://github.com/DanilaH/seeds-bits/actions/runs/45957745452/artifacts/15179023325), [browser probes](https://github.com/DanilaH/seeds-bits/actions/runs/45957745452/artifacts/15179766472) | QA-only bcb011557a56597eb4e8ed383c6784a0af3fd388; separate pair/row oracle and actual product modules. |
| E3 | [Solver/full catalogue](https://github.com/DanilaH/seeds-bits/actions/runs/45958071345/artifacts/15179039349) | QA-only 525b4ff5b7813fb7018f26774959b15fe310f9ed. Models pass, browser full profile write pass; recovery UI driver raced navigation (workflow failure). Not product failure. |
| E4 | [Corrected recovery](https://github.com/DanilaH/seeds-bits/actions/runs/45958387154/artifacts/15179910980) | QA-only b4376e9ad4173e29a225485afb760699574f180c. Both probes successful and actual defects recorded. |
| E5 | [Android offline](https://github.com/DanilaH/seeds-bits/actions/runs/45954682191/artifacts/15178957403) | API35 emulator/WebView124, source exact; not own physical-device observation. |
| E6 | [Native doubles](https://github.com/DanilaH/seeds-bits/actions/runs/45954682161/artifacts/15178725184), [demo banner/fullscreen](https://github.com/DanilaH/seeds-bits/actions/runs/45954682191/artifacts/15179110697) | 65 +28 doubles; real demo SDK on emulator, 262.688 seconds and 73 observations, unexpected hidden/moved frames0;4 fullscreen show calls, not commercial impressions/revenue. |
| E7 | [Menu and reward evidence](https://github.com/DanilaH/seeds-bits/actions/runs/45954682191/artifacts/15178790677) | 11 before and after scenarios; source exact after; replay task/no burst, correct filled jar and upright book. No physical perception claim. |

## Independent quantitative evidence
- 60,549 fields: 59,049 exhaustive ternary length10 +1,500 mixed random;8,141,044 ordered legality checks;419,475 removals/row compression checks. Separate oracle agrees.
- 7,304 witnessed notebook boards:2,400 v1;2,399 v4;2,399 v5;10 v6 overlays;96 themes.311,549 moves. 1,532 daily boards:730 v1;24 v3;389 v4;389 v5, including24 sampled continuation days for each v4/v5;17,299 witness moves. All clear, not proof of human difficulty or future dates without bound.
- 48 Classic starts (4 per each of12 difficulty/size pairs),1,192 proof steps incl31 Add; no fallback in sample. 2,961 state changes:2,179 pair,218 Add,564 Undo,751 save read/write roundtrips. Original solver sample 1,000 dead/0 wins had biased random generator; corrected E3 1,200 (614 solvable/586 dead/0 unknown),12 near-limit fields with2,608 legal pairs. No disagreement with independent oracle.
- Model completion ledger 2,496 unique wins/23,902 seeds, no duplicate replay payout; Classic highwater protection, hint wallet and28-day streak13 hints. Full real proof histories separate run:2,496 tasks,44,276 moves,2,390,511 bytes ASCII JSON. Deserialize194ms / serialize30ms in CI runner, real Chromium saveState accepted; current quota issue not reproduced. Additional archive/backup/large-profile Android performance unknown. Do not use minimal-history fixture725,847 bytes as full profile estimate.

## Surface sweep
| Area | Evidence / status |
|---|---|
| Matching, empty cells, horizontal/vertical/diagonal/edge, row collapse, invalid pairs | E2 independent PASS |
| Classic generation & difficulty bands, Add after no pairs, technical size cap, Undo | E1/E2/E3 model/CI PASS sampled; no universal player-solvability promise for arbitrary moves |
| Notebook catalog, themes, old assignments v1/v4/v5/v6 | E2 full witnesses; E5 upgrade12088→12108, pins3/9, new4, wire10, old Classic27 |
| Daily, dated archive, medal boundaries, streak and replay | E1/E2/E5; date/calendar logic sampled, actual device time/reboot notification open |
| Hint eligibility/legal continuation/budget/recovery | E2/E3 solver/wallet; E5 alternate field and large108; FA-01 durability bug |
| Earned seeds, jars, first/repeat milestones, medals | E2 model and E7 motion; peak daily-bronze active animations87→17, particles81→12 measured samples; replay-book 32→1 active, burst0; not device frame-rate claim |
| Storage valid, upgrade, process death, slow/failure/atomic write | E1/E2/E5,20/20 force-stop after durable26 restores26 then Undo28; FA-02 damaged metadata, FA-03/04 web |
| Home, new/resume, first session, navigation/back/menus, layout/language/theme | E1/E5/E7; first task both orders, explicit next2; 320×568 language switch preserves selection; es/pt-BR archive; all five UI languages/two themes existing checks. Preview-only first-session flag. Actual accessibility/phone open. |
| Banner, interstitial, rewarded and receipt | E6; durable commit before ack/dedup/fault in doubles; actual demo shown/closed; no claim paid fill/revenue. Prior looping SDK response no close UNKNOWN. |
| Sound/vibration/settings | E1/E5/E6/E7; audio state/mute/native feedback doubles verified, subjective and physical motor UNKNOWN |
| Reminders, app review, notification entry, lifecycle | Source + existing doubles/CI; FA-06 device permission/tap/timezone/reboot, SDK callback matrix open |
| Analytics/distribution, web/iOS/store | Source + E1 market/analytics tests; actual production package, store config/consent, delivery, live telemetry/revenue not validated by preview |
| Paused help / extra products, purchase/event/tournament | No missing feature verdict. Six intentional pauses and existing entitlement stock preserved by requirement; no new product authorization. |

## Confirmed defects and next actions
[Issue #47](https://github.com/DanilaH/seeds-bits/issues/47) is executable specification with exact fixture, action, expected result, code links and acceptance.

- **FA-01 P1 shared**: legacy notebook5, pairs (3,4),(5,13),(6,15),(2,11). Hold actual seeds-save Web Lock; click Hint rollback2. UI8, status restored, data-persistence=saved, aria-busy null while disk moves4/remaining4; release ->disk moves2. main.ts hint recovery direct void save bypasses persistMove. Need honest pending/durable/retry plus native force-stop. No physical loss claim.
- **FA-02 P1 shared**: deliberately invalid statistical invariant completed0/unassisted1, otherwise valid wallet9, stock2/3, one receipt. readProgress returns wallet0, stock0/0, no receipt. Actual boot backup retains original; UI restore-backup still zeros after verified reload (E4). Validate independent sections, preserve valid earned rights & dedup; critical unreadable rights protected recovery not fabricated. Test wire6/9/10. No spontaneous corruption observed.
- **FA-03 P2 web**: actual platform.saveState concurrent A/B, same expected base, forced no navigator.locks, both fulfilled, final B. Need genuinely cross-context atomicity or explicit unsupported-mode restriction. Real two-tab acceptance; not Android finding.
- **FA-04 P2 web**: localStorage SecurityError at boot, saveState test key succeeds and readback sample, notice not visible, reload null. Explicit volatile state, no durable acknowledgement. Need actual user moves and reload/fault regression; this probe directly uses platform module, not full user gameplay.

## Open gates (UNKNOWN unless specified)
FA-05 large archive/full history on low/mid Android with long-run p50/p95/memory, backup duplication, low storage, quota, preserve pins/undo. Current 2.39MB fixture succeeded. FA-06 real notification permission/disabled/timezone/midnight/reboot/tap during pending transition; real review SDK cancel/no callback; prior looping demo creative compare official SDK sample+phone, no generic timer dismiss; current demo logs2 startup safe-area injection TypeErrors, visual/geometry PASS, impact unproven. FA-07 exact production store artifact/profile/version/signing/actual upgrade, consent/privacy/production ads and telemetry. Owner confirms first-session build policy before store. Web/iOS not released/accepted by this audit. FA-08 actual phone touch/scroll/back/lifecycle, TalkBack, haptic/audio and both themes; no live-audience evidence.

## Decision and handoff
FA-01/02 before Android store candidate; FA-03/04 before web publishing. Preserve accepted 12108 behavior, #45/46, all content pins, economy, six pauses, approved style. No runtime changes or release in this research. New tests only on QA branches. KIT IMPACT REUSE: durable receipt, lifecycle and persistence gates. Candidate improve shared persistence tests only after fix verified. 
