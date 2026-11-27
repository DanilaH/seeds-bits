# Agent contract — Семечки

Read [project decisions](docs/PROJECT_DECISIONS.md), [current status](docs/STATUS.md) and [README](README.md). Establish the actual branch/HEAD and requested scope before editing. The current working branch is `feat/quiet-table-20261126` (stacked PR #40); `main` is substantially older in gameplay. Recheck the actual branch head and CI before editing. The historical ordinary-game base was `feat/monetization-assists-20261113` / `a6aa3f4c80a2642ff8c4696a94f7677a5810872e` before the 14 November UI pass. Preserve subsequent work. The technical save/banner contract for #45 is in [stability acceptance](docs/research/stability-2026-11-26/README.md). Fast field feedback can be explicitly pending; only the latest completed move write acknowledges durability. Preserve same-turn Core Feel and durable reward authority. All six assistance experiments stay off; ordinary controls are Undo, Hint and Add. Historical publication claims are not evidence of a store release.

This is an offline-first TypeScript/Vite/DOM game with Capacitor, targeting Android/RuStore. The separate Yandex Games web build is a prototype; its web SDK is not Yandex Mobile Ads Android. Do not install a Phaser/bootstrap runtime into this existing game.

Preserve accepted game rules, feel, saved progression, reward authority and offline/lifecycle behavior unless the task deliberately changes them. Presentation follows successful durable state changes. Ad close, animation completion and analytics delivery do not authorize rewards. Research alone does not authorize new directors, currencies, content or ad cadence.

## Task-routed mini-games-kit guidance

For substantial tasks open [TASK_ROUTER.md](docs/kit-guidance/TASK_ROUTER.md); select only 1–2 applicable routes (NONE for a small fix). For a reference game, screenshot, video, GIF or UX/feel comparison, follow [REFERENCE_PROTOCOL.md](docs/kit-guidance/REFERENCE_PROTOCOL.md). Separate what was inspected, inferred and inaccessible.

Before UI changes, select the matching UI route, inspect existing components and the project UI profile, and verify changed states with comparable frames/transitions. Preserve the accepted style, disabled products, input/index-remapping guards and durable reward authority.

Guidance snapshot: aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0.

Runtime modules are individually pinned: `value-transfer.ts` remains at `a9325265e87583a4872cf6a158e1e881a0d7508e`; the owner-approved `owned-dom-motion.ts` extraction is at `0d5638e8d2146d3d8906e4936ccfa6ec1eeab7d7`. See exact source paths/hashes and API links in [provenance](src/vendor/mini-games-kit/README.md). Inspect API availability at the relevant module pin before importing. Newer guidance does not install newer exports or upgrade dependencies.

For monetization, rewarded help, commercial teardowns, experiments or revenue attribution, also read [commercial research guidance](docs/COMMERCIAL_RESEARCH.md). Its separate research SHA is an explicitly labelled draft, not the stable guidance/runtime pin or an approved gameplay change. Check existing native Ad Revenue reporting before enabling another revenue source.

Use [NEW_PROJECT_SETUP.md](docs/kit-guidance/NEW_PROJECT_SETUP.md) only for setup/adoption questions. Existing project decisions take precedence over generic scaffolds. After guidance edits, run the pinned kit's `guidance:doctor -- <project> --expected-kit-ref <guidance-sha> --strict`; verify vendored runtime separately. File checks do not prove a fresh agent session loaded instructions.

## Verification and upstream feedback

Choose checks for the actual change. Browser CI, synthetic gestures, SDK doubles and demo ads do not establish physical phone feel, live revenue, player retention or publisher payout. Never claim an unread source was inspected. Do not publish to a store, change other games or alter dashboard settings as a side effect of documentation work.

At the end of a material task report **KIT IMPACT**: NONE / REUSE / IMPROVE / CANDIDATE / EXTRACTED, with evidence and any targeted proposal, following [KIT_FEEDBACK_LOOP.md](docs/kit-guidance/KIT_FEEDBACK_LOOP.md). Do not turn a project-specific mechanic into a generic API without a demonstrated shared contract.

## Active owner package48 (27 November)

Preserve the complete12109 functional source96f5ae1. Issue48 VA01–13 authorizes local layout repairs, proportional jar fill and the restored expressive12106 spill. Earned jar replacement follows the current durable acknowledgement; cancellation settles only to confirmed totals. Ordinary Settings keeps its native banner; confirm/privacy/actual modals/fullscreen/background remain exceptions.

In-game reminder switches/time/result CTA are removed by owner instruction. Inexact native lunch/evening slots12:30/19:00 target players with no entry/foreground today, not unfinished daily puzzles. Android permission/channel and legacy opt-out apply; one saved request after a successful result and completed reward sequence, no automatic repeat. Keep review/ads from overlapping this gate. Use seeds-bits CI, not kit CI; deliver signed preview plus normal-speed comparisons12106/12109/candidate. No publication.
