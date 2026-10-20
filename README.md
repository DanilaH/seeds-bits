# Семечки / seeds-bits

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

See `docs/SPEC.md` and `docs/STATUS.md`. Rule version 0.1. Classic deterministic 1–19 start (zero omitted). Adding is free but only allowed when there are no pairs. No loss on repeated state/no pairs. Classic hints identify legal pairs. Notebook and daily hints use verified solution paths and bounded search, with explicit recovery when a path cannot be verified. Version 0.5.0 includes 100 notebooks / 2400 verified tasks, the daily archive and monthly trophies from January 2025, and persistent classic seed jars. The first 24 puzzles keep their original IDs and layouts. Large late notebooks scroll vertically without shrinking digits. Expanded content loads separately. Save format 3 migrates format 2 and protects the new data from older app versions. No advertisements, coins or leaderboards.

Provisional field guard: 1,800 logical cells. This is a protective implementation limit, **not** a measured mobile performance claim. At the limit, undo/new game remain available; no defeat is declared. Undo history has no artificial gameplay cap, but device storage is finite; failed saves are explicitly surfaced with a retry action.
