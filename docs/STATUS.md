# Prototype status — 2026-10-15

Implemented: classic rules 0.1, independent core, pair explanations, path hints, append, full undo snapshots, versioned save validation, queued persistence with error/retry, six interactive lessons, themes, optional sound/haptics, native lifecycle, browser/Yandex build targets, Capacitor Android/iOS project shells.

Verified locally: TypeScript/build; nine core tests including 3,000 random differential boards and 100 seeded simulations (up to 300 operations each). These are correctness checks, not human difficulty/retention measurements. Web payload is approximately 36 KB uncompressed including lazy native bridges; APK size is unknown until native build.

Browser scenarios are configured in Playwright and CI. Local browser download initially returned an invalid/truncated archive; browser QA is pending until execution succeeds. Android SDK is not installed locally; debug APK build is delegated to the repository CI. iOS generated project is unbuilt and untested.

Before release: real-phone touch size and long-field scrolling, exact row-collapse motion refinement, suspend/restore stress test, store icons/splash/signing, Yandex draft SDK verification, ad adapter, analytics/privacy choices, accessibility review and actual player sessions. The 1,800-cell guard is provisional, not a measured safe-device limit. No ads or production deployment are enabled.

