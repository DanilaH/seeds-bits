# Hardening pass — 2026-10-18

Reproduced and repaired:

- Accepted pair removal was committed only after a 100 ms animation delay. The move and completion now enter the save queue before the visual wait. Regression test stretches that wait to 10 seconds and reloads from the saved move; this does not claim atomic persistence against OS termination during native asynchronous storage.
- Escape from collections/settings skipped the parent menu. It now goes back one screen, including consecutive presses. Android Back uses the same routing and minimizes at home; native behavior still requires device validation.
- One malformed session caused the whole progress bundle to fail decoding. Valid sessions and completion marks are retained, with a recovery notice.
- An invalid legacy v1 save could block a valid v2 bundle. V2 is now read first; legacy migration is used only when no current bundle exists.
- Successful retry after a storage error now clears the stale failure message.

Checks: 14 unit/content tests; 17 browser scenarios including first launch, notebook completion/replay, classic restore, calendar/trophies, long hints, rapid input, dead-end restart cancellation/undo, storage quota failure/retry and reduced-motion layouts. A 1,800-cell board endured 30 pair removals, scrolling, mode changes, reload and undo. Web and Yandex builds compile.

No puzzle replacement, advertising or release publication in this pass. Existing puzzle IDs and progress remain compatible. Content difficulty and 20-minute comfort still require human playtesting. Native APK/device and hosted Yandex checks are not covered by desktop Chromium results. Prior GitHub push remains unapproved; changes are local.
