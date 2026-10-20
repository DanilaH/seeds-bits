# Independent 0.5.1 audit

Run from repository root. Requires installed dependencies, Python 3 and Chromium at `/tmp/seeds-audit-chromium`.

```sh
python3 scripts/audit-0.5.1/prepare-apk.py /path/to/seeds-0.5.1-test.apk
python3 scripts/audit-0.5.1/content.py
npx vitest run --config scripts/audit-0.5.1/vitest.config.ts
npx playwright test --config scripts/audit-0.5.1/playwright.config.ts
node scripts/audit-0.5.1/storage-perf.mjs
node scripts/audit-0.5.1/hint-layout.mjs
REPEAT=1 node scripts/audit-0.5.1/storage-perf.mjs
SEEDS_CHROMIUM=/tmp/seeds-audit-chromium node scripts/audit-0.5.1/yandex.mjs
```

Nine browser assertions intentionally remain red on the audited 0.5.1 runtime and reproduce the report's findings. They are kept outside the normal CI test directory. Do not weaken them to get a green audit; evaluate desired UX for F03 and scope priority for the 2125 portion of F04. The 5MB reproducible save fixture is generated under `/tmp`, not committed. Performance numbers are observations from a shared headless environment, not device guarantees.
