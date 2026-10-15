# Prototype status — 2026-10-15

Implemented: classic rules 0.1, independent core, pair explanations, path hints, append, full undo snapshots, versioned save validation, queued persistence with error/retry, six interactive lessons, themes, optional sound/haptics, native lifecycle, browser/Yandex build targets, Capacitor Android/iOS project shells.

Verified locally: TypeScript/build; nine core tests including 3,000 random differential boards and 100 seeded simulations (up to 300 operations each). These are correctness checks, not human difficulty/retention measurements. Web payload is approximately 36 KB uncompressed including lazy native bridges; The CI Android debug artifact ZIP is approximately 3.8 MB (compressed archive, not installed size).

Verified in [GitHub Actions run 38740636569](https://github.com/DanilaH/seeds-bits/actions/runs/38740636569), source commit `795b11f`: all nine core tests and four Chromium browser scenarios passed; regular web, Yandex draft, and Android debug APK built successfully. Browser scenarios cover all six lessons, matching/reload/undo, settings persistence, hints, blocked add explanation, append/undo, rejected pairs, victory/repeated input and narrow-screen overflow. Light 320px and dark 390px screenshots were visually inspected. These checks do not replace real-device testing. iOS generated project is unbuilt and untested.

Build downloads (GitHub login may be required; CI artifacts expire after 90 days):

- [Android debug APK archive](https://github.com/DanilaH/seeds-bits/actions/runs/38740636569/artifacts/11975682531)
- [Yandex draft archive](https://github.com/DanilaH/seeds-bits/actions/runs/38740636569/artifacts/11976042175)
- [Web archive](https://github.com/DanilaH/seeds-bits/actions/runs/38740636569/artifacts/11976241958)
- [Browser screenshots](https://github.com/DanilaH/seeds-bits/actions/runs/38740636569/artifacts/11975722248)

Before release: real-phone touch size and long-field scrolling, exact row-collapse motion refinement, suspend/restore stress test, store icons/splash/signing, Yandex draft SDK verification, ad adapter, analytics/privacy choices, accessibility review and actual player sessions. The 1,800-cell guard is provisional, not a measured safe-device limit. No ads or production deployment are enabled.

