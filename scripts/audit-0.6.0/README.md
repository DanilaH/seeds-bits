# Independent 0.6.0 audit

Runtime is unchanged. These are destructive probes, some intentionally failing on 0.6.0; they are excluded from the normal test directories. No production ad requests are made. Browser tests replace the Android bridge and lifecycle adapter, then exercise actual UI handlers. Native tests compile unmodified production bridge and installed Capacitor Preferences sources against deterministic doubles; they do not run a real Android framework or Yandex SDK.

Requirements: npm dependencies, Playwright Chromium and JDK 17+ (`javac` and `java`). Run from repository root:

```
npm test
npx playwright test
python3 scripts/audit-0.6.0/native-harness.py
npx vitest run --config scripts/audit-0.6.0/vitest.config.ts
npx playwright test --config scripts/audit-0.6.0/playwright.config.ts
python3 scripts/audit-0.6.0/content.py
```

Generate the heavy-hint fixture with the model run before the quota browser check. `SEEDS_CHROMIUM` is optional when using a custom executable; unset it to use Playwright's browser. The audit server uses port 5186 and normal regression uses 5173. Do not edit application sources during a run, because Vite reloads invalidate in-flight tests.

Focused follow-up:

```
npx playwright test --config scripts/audit-0.6.0/playwright.config.ts --grep 'R07|R13' --repeat-each 3
```

Read the report for discarded hypotheses and native/hardware limits. Model M01's 2.5M-character budget is an audit target, not a measured Android quota. Chrome accepted the generated profile. N11 injects a failed game-file write while the native receipt-file commit succeeds; the real Preferences source's apply call still returns successfully. It demonstrates the missing persistence acknowledgment boundary, not measured device failure frequency.
