# Audit repair regressions, 0.6.1

Derived from the independent 0.6.0 audit. Original evidence and failing probes remain in `scripts/audit-0.6.0` and `docs/audit-0.6.0`; these checks run against the repaired production source and write new evidence under `test-results/regression-061`.

```sh
npm test
npx vitest run --config scripts/regression-061/vitest.config.ts
python3 scripts/regression-061/native-harness.py
npx playwright test --config scripts/regression-061/playwright.config.ts
npm run test:e2e
npm run build
npm run build:yandex
```

The native harness needs a JDK (`javac`, `java`). It compiles the actual plugin with deterministic Android/Yandex doubles, controls SDK callback order and fails writes separately for game and receipt preference files. It tests callback identity, durable commit rejection, acknowledgement failure, initialization/rotation, retry intervals and fullscreen cleanup. It does not emulate Android, display actual ads, measure hardware frame rates or verify analytics delivery.

Browser probes mock the native bridge and lifecycle delivery while exercising the real UI and handlers. R02 repeats the same receipt: the real native duplicate-token boundary is covered by N01/N15. R14 fails progress writing after an earned reward, verifies that acknowledgement is withheld, then retries and verifies one persisted bonus before acknowledgement.

The model creates the same 100 unfinished volumes and 6,830 legitimate hint reveals used in the original audit. Full undo histories are kept. A separate corruption check preserves completion statistics when an optional hint field is invalid. SHA-256 and old-key migration are also checked by the standard unit suite.
