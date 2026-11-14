# Семечки — project decisions

Recorded 13 November 2026. This is the working project baseline, not proof of publication or approval of every research idea. Inspect actual HEAD and later owner instructions before implementation.

## Source, platform and release baseline

- Repository: `DanilaH/seeds-bits`; current working branch: `feat/monetization-assists-20261113`. Verified ordinary-game base before the 14 November UI pass: `a6aa3f4c80a2642ff8c4696a94f7677a5810872e`; UI runtime change: `15c9464fdc939098fbefbfc07eb12a9153701999`, acceptance source: `dda69c667bc39257de5ff986e7c8863ac963a274`. Historical prepared-store branch: `release/rustore-1.1.2`, documentation baseline `24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9`.
- Runtime accepted at `c6c99ce192c6e0c1ae992a65e8c26b446199e19d`; release build source `ecc3c399a6062d59d71da83179c4ae09cb33ac9c`. The subsequent baseline commit records signed APK evidence, not a new runtime.
- TypeScript + Vite + DOM/CSS/SVG, Capacitor native bridges; no React or Phaser. Android/RuStore is the current production target. Web/Yandex prototype and iOS scaffold are separate, not evidence of completed platform releases.
- Prepared APK: 1.1.2 / 1102101, package `com.seedsbits.game`, production ads/analytics configuration. Exact artifact and verification limits: [release evidence](releases/1.1.2/README.md). Preview package `com.seedsbits.game.preview` and quarantined QA versions must remain separate.
- Last explicit owner correction: not published/submitted to RuStore. A prepared APK or store media does not establish submission. Recheck if a task depends on current store status.
- Store assets belong in [`DanilaH/design/seeds-bits/rustore`](https://github.com/DanilaH/design/tree/main/seeds-bits/rustore); other stores get sibling folders inside the project. Do not recreate the old flat layout.

## Accepted behavior to preserve

**Latest owner decision:** pause the newly tested monetization products and lab modes after QA 11814. Current delivery is baseline, with earned stock retained but assistant UI/guidance dormant; common correctness/layout fixes remain. See [current pause policy](help-pause-2026-11-13.md). This supersedes the earlier all-features QA delivery.

- Classic uses random deals and three saved difficulty steps. The ordinary/default step retains the previous 28-digit composition; legacy games and the first traditional deal remain supported. The result has one row: easier / another game / harder, with distinct colors and disabled limits. See [difficulty decisions](classic-difficulty-2026-11-12/README.md).
- Native banner requests a compact creative up to 50 dp. Use actual SDK/WebView geometry, apply the system inset once, and preserve playable space and visible actions. Never crop a taller creative to pretend it is compact. See [banner acceptance](banner-layout-2026-11-12/README.md).
- Result statistics use three aligned columns. The classic finish has a short cleared-board/seed composition; next actions are available immediately and adapt to small screens and enlarged text. See [result acceptance](classic-result-2026-11-13/README.md) and [UI acceptance](ui-fixes-2026-11-12/README.md).
- Saved hints, game/Undo history, notebook/daily progress, jars, medals and existing migrations are authoritative project state. Preserve existing saved opt-outs. Do not infer permission for a new economy or difficulty director from kit research.
- Rewards and one-time feedback follow successful durable commits. SDK reward eligibility, saved reward, presentation and analytics are different facts. No-fill, close, repeat callbacks, resume and save failure need their own behavior; an animation is not the source of truth.

## Separate kit revisions

Guidance snapshot SHA: `aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0` (exact checkout, reviewed 14 November 2026; previously `1f286e6e98cafee6679a1a0a13519c7bcded97a5`).

The four local [kit guides](kit-guidance/TASK_ROUTER.md) were reviewed against a temporary guidance-only generation from that exact checkout and copied after diff review. Existing project instructions were preserved; guidance:adopt was not rerun. All external kit links in them use the same SHA. They replace the obsolete `e2382670fbd5c2aa76462fea688c60de2b067392` guidance from the separate historical `chore/adopt-kit-agent-guidance-2026-11-12` branch; that branch was not merged wholesale.

Runtime source pin: `a9325265e87583a4872cf6a158e1e881a0d7508e`. The only vendored kit module is [value-transfer.ts](../src/vendor/mini-games-kit/value-transfer.ts), with [source record](../src/vendor/mini-games-kit/README.md). Its SHA-256 is `601cb5c0cae59b0f02d9f065b940faed5743c4477498dd48bf167f647456fed6`; No runtime replacement is included in this UI guidance update. There is no direct npm kit dependency. This documentation adoption does not change the runtime pin, lockfile or native SDKs.

Optional commercial research SHA: `6bff183070f6feecad3f561d268145a8500fbb1b`, [draft PR #30](https://github.com/DanilaH/mini-games-kit/pull/30), still open/draft when checked on 13 November. It is routed separately through [COMMERCIAL_RESEARCH.md](COMMERCIAL_RESEARCH.md), without mixing draft links into the four generated stable guides. Accepting its methodology does not mean its hypotheses have been implemented or measured in this game.

Adoption matrix:

| Area | Decision | Boundary |
| --- | --- | --- |
| Task/reference/feedback guides | REUSE | Stable guidance SHA, project rules preserved |
| Commercial research | REUSE methodology | Separate draft SHA; one concrete question/experiment per task |
| Value transfer | Existing REUSE | Existing vendored runtime retained |
| Native banner, durable rewards, hints, balance | LOCAL POLICY | Reuse compatible contracts only after source/API review |
| Android/Phaser or Yandex bootstrap | NOT APPLICABLE | Existing DOM/Capacitor game; no runtime migration |

## Monetization and evidence boundaries

The current native code already reports impression revenue through [SeedsAdRevenue.java](../native/android/SeedsAdRevenue.java), called for banner/interstitial/rewarded impressions by [SeedsMonetizationPlugin.java](../native/android/SeedsMonetizationPlugin.java). Invalid/missing ILRD is not replaced with invented zero revenue. Test mode and empty analytics key skip reporting. Presence of this code does not prove live dashboard arrival.

Yandex Ads SDK synchronization and AppMetrica revenue-source selection are dashboard configuration. Before changing them, check the actual app/account and existing manual reporting to avoid counting the same impression twice. No dashboard settings were changed or verified by this adoption.

Technical checks, offline emulators, recorded fixtures and SDK doubles do not prove human feel, commercial uplift, live fill, actual payout or store status. Existing signed APK remains the delivered artifact; no new APK is needed for these documentation-only changes.

## UI profile — 14 November 2026

- Ordinary baseline: field → three tools (Отмена / Подсказка / Добавить); jar and mode in the header; secondary navigation in the existing sheet. Six product flags stay false; progress, stock and entitlements remain authoritative.
- Existing DOM/CSS/SVG tokens in style.css and ui-polish.css define the soft paper/grid style, light/dark roles, selected/hinted/error states, line icons and typography. No new theme or UI runtime.
- Press changes the visual child/color, never the actual hit target; activation remains on click, and cancel/scroll clears contact. Cell nodes and separate digit slots persist.
- Selection uses the current state and short color transitions; decorative effects must have an owner and release stale effects on new input/navigation/background. The short choose() busy gate protects erase/index remapping and remains.
- Existing local timings: press 80–90 ms, color 120 ms, selection 120 ms, error 160 ms, row collapse 170 ms, result ≤500 ms. Reduced motion retains the static state and available actions. No count-up gates statistics or Continue.
- Reward grant → durable save → acknowledgement → separately saved hint reveal remain distinct. No reward/economy/ad-cadence change. QA uses test ads and empty analytics keys.
- Applied routes: UI Motion Recipes and Stable Progress UI, with UX & Art System as the component/style contract. Exact rules and observed acceptance are recorded in the UI pass report; browser evidence is not phone feel or commercial evidence.

UI pass details and delivery limit: [14 November acceptance](ui-motion-2026-11-14.md). The QA private key used by 11815 is unavailable in the current workspace and found archives; an unsigned payload is not an installable update. Do not silently substitute another certificate or ask the owner to erase app data.
