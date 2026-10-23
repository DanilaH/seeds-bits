# Independent audit, 2026-10-23

Production code is unchanged. Baseline: main `47c36d9e58e84743cbb60cd5d2747a4939268bfa`; APK payload `6e0c176cf12d3ca691073c4748c605730bc89300`, version 1000007. These opt-in probes deliberately fail on the defects recorded in `docs/audit-2026-10-23/REPORT.md`. They are excluded from the normal test directory.

Run from the repository root with Node 24, installed npm dependencies and Chrome/Chromium. Set `SEEDS_CHROMIUM` when using a system browser. The native regression harness needs a JDK with `javac`, not only a JRE.

```sh
npm test
npx vitest run --config scripts/regression-061/vitest.config.ts
npx vitest run --config scripts/audit-2026-10-23/vitest.config.ts
python3 scripts/regression-061/native-harness.py
npx playwright test --config scripts/regression-061/playwright.config.ts
npm run test:e2e
npm run build
npm run build:yandex
npx playwright test --config scripts/audit-2026-10-23/playwright.config.ts
node scripts/audit-2026-10-23/followup.mjs
```

The production browser config serves `dist/`, not the Vite development server. The follow-up starts separate previews of `dist/` and `dist-yandex/`; it intercepts Yandex's SDK script, never requests real advertisements, and measures a real Chromium AudioContext with actual UI moves. Visibility events are simulated; this is not a physical-device audio assessment.

The concurrent-move probe uses two documents with simulated visible state and simultaneous real click handlers, representing two visible game windows. It verifies one accepted write and an explicit conflict notice for the other branch.

The geometric oracle walks grid coordinates independently of the implementation. The catalog check replays all 2400 supplied paths, while the random rule and state checks cover different fields and undo/add/save sequences. These checks do not exhaust all possible branches of every puzzle.

Calendar controls inside closed details and controls outside a scroll container are excluded from hit testing. The final notebook path is read directly from the source JSON because Node's JSON module import rules differ from Vite's bundler; that harness correction does not change the app.

Diagnostic workflow steps use `continue-on-error` to collect all findings. Read the assertions, JSON evidence and report; a successful workflow conclusion does not mean the intentionally failing probes passed. The normal 99-case suite does not suppress its settings-race failure.

Preference race traces contain only public settings, random test tab IDs and timestamps. APK verification reports presence of client configuration, never its values. The emulator acceptance stays offline and uses a temporary CI signature on the original release payload; the delivered APK's permanent signature is verified independently.
