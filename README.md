# Семечки / seeds-bits

**Pre-release status (owner correction, 2026-11-11):** not published in RuStore and not submitted for moderation. Earlier publication claims were incorrect. Upgrade fixtures are previously built APKs, not store releases. Current audit: [product audit](docs/PRODUCT_AUDIT_2026-11-11.md).


Small, offline-first Number Match game. TypeScript + Vite + HTML/CSS/SVG. No React, game engine, remote fonts, backend or accounts.

## Run

Node 22+ (CI uses Node 24), npm:

```sh
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
npm run build:yandex
```

First browser-test setup: `npx playwright install chromium`.

`dist/` is the regular web/mobile asset bundle. `dist-yandex/` connects `/sdk.js` and reports ready/gameplay lifecycle to Yandex. Zip the **contents** of `dist-yandex`, with index.html at the archive root, for a Yandex draft. It is a prototype, not moderation-ready: advertising, full platform compliance review and device QA remain open.

## Native builds

Capacitor generates the Android and iOS projects on first setup; generated native folders are not checked in until native customization is needed. Bundled assets work offline; browser/native saved games are local to each installation, with no account sync.

```sh
npm run setup:android # first checkout only
npm run sync:android
cd android
./gradlew assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Java 21 and the Android SDK are required. GitHub Actions builds a debug APK and both web archives on push/manual dispatch. A debug build is not a signed store release.

On macOS with supported Xcode: `npm run setup:ios` once, then `npm run sync:ios` and `npx cap open ios`. iOS requires signing and device testing; the generated project has not been run on an iPhone.

## Architecture

- `src/core.ts`: immutable rules, pair enumeration, append, undo and validated save format.
- `src/main.ts`: small DOM controller, two-step first run and six-step optional tutorial, selected/hinted pair, settings, save queue.
- `src/platform.ts`: native Preferences, haptics and app lifecycle; Yandex lifecycle adapter.
- `src/style.css`: light/dark styles, responsive nine-column board, reduced motion.
- `tests/`: rule fixtures, independent differential validator, seeded play/undo/save simulations.
- `e2e/`: tutorial, restoration, actions, win and viewport tests.

## Product decisions / limits

See `docs/SPEC.md` and `docs/STATUS.md`. Rule version 0.1. The first classic game uses the traditional 1–19 start (zero omitted); subsequent games rotate through 128 certified layouts in four families. Restart repeats the current layout; “Другое поле” replaces it after confirmation when play has begun. See [classic variety](docs/classic-variety-2026-11-12/README.md). Adding is free but only allowed when there are no pairs. No loss on repeated state/no pairs. Classic hints identify legal pairs. Notebook and daily hints use verified solution paths and bounded search, with explicit recovery when a path cannot be verified. Version 0.5.0 includes 100 notebooks / 2400 verified tasks, the daily archive and monthly trophies from January 2025, and shared seed jars across all three modes. The first 24 puzzles keep their original IDs and layouts. Large late notebooks scroll vertically without shrinking digits. Expanded content loads separately. Save wire format 5 migrates formats 2–4 and protects the new data from older builds. Android uses Yandex banner/interstitial/rewarded ads and AppMetrica; no purchases, coins or leaderboards. Version 1.1.0 adds a shared hint wallet, daily streak bonuses, local reminders enabled by default (subject to Android notification permission; explicit opt-out is retained) and a rare native RuStore review request without incentives. The 9 November feel pass adds native event-specific haptics enabled by default for new settings, saved-result celebrations, shared reward flights in every mode, bounded visible-cell animation and touch contact feedback. See `docs/FEEL_2026-11-09.md`.

Provisional field guard: 1,800 logical cells. This is a protective implementation limit, **not** a measured mobile performance claim. At the limit, undo/new game remain available; no defeat is declared. Undo history has no artificial gameplay cap, but device storage is finite; failed saves are explicitly surfaced with a retry action.

## RuStore Android release

Production Android package: `com.seedsbits.game`, name «Семечки». The separate `Build RuStore release` workflow builds `assembleRelease` with checked live ad configuration and the final branding. Its unsigned CI artifact is an intermediate; store submission uses the locally signed APK and permanent release identity, not the preview/debug certificate.

Release verification and limits: [1.1.0](docs/releases/1.1.0/REPORT.md), [pre-release 1.0.0](docs/releases/1.0.0.md). Store listing, data disclosures, privacy policy, public signing certificate and upload instructions: [store/](store/). Private signing material is kept outside git. The existing-preview package remains `com.seedsbits.game.preview`.

The Android acceptance follow-up can test an existing release artifact by workflow run ID without rebuilding its payload. It stays offline, temporarily uses a CI-only smoke certificate and exercises native/WebView startup, moves, undo, process-stop persistence, rotation and privacy. Live ad fill and analytics dashboard delivery require a connected physical device. Yandex output remains a draft; iOS is not a signed store release.
