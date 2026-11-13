# Agent contract — Семечки

Read [project decisions](docs/PROJECT_DECISIONS.md), [current status](docs/STATUS.md) and [README](README.md). Establish the actual branch/HEAD and requested scope before editing. The working 1.1.2 baseline is `release/rustore-1.1.2`; older `main` and stacked QA branches are not interchangeable. Historical publication claims are not evidence of a store release.

This is an offline-first TypeScript/Vite/DOM game with Capacitor, targeting Android/RuStore. The separate Yandex Games web build is a prototype; its web SDK is not Yandex Mobile Ads Android. Do not install a Phaser/bootstrap runtime into this existing game.

Preserve accepted game rules, feel, saved progression, reward authority and offline/lifecycle behavior unless the task deliberately changes them. Presentation follows successful durable state changes. Ad close, animation completion and analytics delivery do not authorize rewards. Research alone does not authorize new directors, currencies, content or ad cadence.

## Task-routed mini-games-kit guidance

For substantial tasks open [TASK_ROUTER.md](docs/kit-guidance/TASK_ROUTER.md); select only 1–2 applicable routes (NONE for a small fix). For a reference game, screenshot, video, GIF or UX/feel comparison, follow [REFERENCE_PROTOCOL.md](docs/kit-guidance/REFERENCE_PROTOCOL.md). Separate what was inspected, inferred and inaccessible.

Guidance snapshot: 1f286e6e98cafee6679a1a0a13519c7bcded97a5.

The runtime is separately pinned: only `src/vendor/mini-games-kit/value-transfer.ts`, copied from `a9325265e87583a4872cf6a158e1e881a0d7508e`; see its [provenance](src/vendor/mini-games-kit/README.md). Inspect API availability at that runtime pin before importing. Newer guidance does not install newer exports or upgrade dependencies.

For monetization, rewarded help, commercial teardowns, experiments or revenue attribution, also read [commercial research guidance](docs/COMMERCIAL_RESEARCH.md). Its separate research SHA is an explicitly labelled draft, not the stable guidance/runtime pin or an approved gameplay change. Check existing native Ad Revenue reporting before enabling another revenue source.

Use [NEW_PROJECT_SETUP.md](docs/kit-guidance/NEW_PROJECT_SETUP.md) only for setup/adoption questions. Existing project decisions take precedence over generic scaffolds. After guidance edits, run the pinned kit's `guidance:doctor -- <project> --expected-kit-ref <guidance-sha> --strict`; verify vendored runtime separately. File checks do not prove a fresh agent session loaded instructions.

## Verification and upstream feedback

Choose checks for the actual change. Browser CI, synthetic gestures, SDK doubles and demo ads do not establish physical phone feel, live revenue, player retention or publisher payout. Never claim an unread source was inspected. Do not publish to a store, change other games or alter dashboard settings as a side effect of documentation work.

At the end of a material task report **KIT IMPACT**: NONE / REUSE / IMPROVE / CANDIDATE / EXTRACTED, with evidence and any targeted proposal, following [KIT_FEEDBACK_LOOP.md](docs/kit-guidance/KIT_FEEDBACK_LOOP.md). Do not turn a project-specific mechanic into a generic API without a demonstrated shared contract.
