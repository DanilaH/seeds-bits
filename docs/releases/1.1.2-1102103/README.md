# RuStore 1.1.2 / 1102103 — 15 November 2026

Prepared from the current ordinary-game baseline, preserving all work through `7fee610c981eb5f9ac77cbccf4a9c7b5cb32877b`. Release source: `24c4be113b387859b89ceabc7ca4bed2830026db`, branch `release/rustore-1.1.2`. Runtime files under src/native, dependency manifests and Capacitor config match the accepted `322644f075122a7a16ea04aaa2cd6e5178a800ae`; this delivery changes release acceptance and evidence, not gameplay.

**Delivered APK:** seeds-1.1.2-1102103-rustore.apk; 5,538,002 bytes; package `com.seedsbits.game`; versionName 1.1.2; versionCode 1102103. SHA256: `29851bb5e4900524bf60ee3cec6a4445ab34c6d4f74025a41397a45b5955cf2f`.

The existing private backup seeds-rustore-signing-private.json (outside git) was recovered privately and matched against both the public pinned certificate and the actual delivered 1102101 APK. Certificate SHA256: `ca2f9ae57a84bba5cc5b844aee65515a88bfde83fe3b5a85ae4d189b6cf8bfe1`. Verified v2/v3, one signer, monotonic version, 16KB zipalign check, all 664 original ZIP entries unchanged, all 11 built web assets equal and no stale assets/test hooks. Manifest flags, icons, R8 bridges/annotations, engagement, feedback, reminder and review SDK checks passed. [APK inspection](apk.json), [exact payload and baseline comparison](payload.json), [CI build pin](store-build.json).

This is the public baseline: ordinary Undo/Hint/Add, no QA profile, six experiments visibility/magnet/plan/result/trials/shuffle false. Stock and earned rights remain saved and dormant. Store build has analytics channel release, ADS_MODE=live, a nonempty AppMetrica key and three distinct live units. All four client settings match 1102101. No ad cadence, reward economy, save schema, runtime dependency or SDK change; guidance and per-module kit pins remain unchanged.

## Acceptance

[Release build and Android acceptance run 43691966244](https://github.com/DanilaH/seeds-bits/actions/runs/43691966244) passed on the release source above. [Exact acceptance](acceptance.json).

- 107 unit tests and optimized release build passed. Local production build also passed.
- 43 native monetization/storage/SDK-double cases and 24 native feedback-double cases passed: [native harness](native-harness.json), [feedback harness](feedback-native.json).
- Four real Chromium contracts use the actual built production bundle at 320×568 and 568×320, in both themes. They verify ignored ?qa=all override, public non-QA assignment, hidden assistants/labs, preserved owned rights and 2/3 stock, normal hint/pair/Undo, legal Add/Undo and reload; no page errors. [Report](public-baseline.json). CI has screenshots in seeds-112-store-public-baseline.
- The gameplay source's earlier 298 + 15 browser, 68 help/browser and 18 UI/motion contracts remain relevant because those runtime files are byte-identical. They are historical source acceptance, not a claim that every suite was rerun in this release job: [shared integration record](../../owned-dom-motion-2026-11-14.md).

The first preparation run [43691726307](https://github.com/DanilaH/seeds-bits/actions/runs/43691726307) failed because the newly added test tried Add while pairs remained. The production rule correctly disabled it. The fixture now leaves [1,2,3] after removing [5,5], exercises legally enabled Add, then undoes both actions. No game rule or assertion was relaxed. No APK from that failed run was delivered; 1102102 is skipped.

Offline Android 35 passed upgrade from the exact 1102101 payload, retaining classic board/Undo, hints, notebook board and dark theme, plus all 14 fresh/lifecycle checks (including Back/Home/process restart, rotation, offline reward without grant and font150 portrait/landscape). [Upgrade](android-upgrade.json), [fresh/lifecycle](android-smoke.json), [font150 bounds](font150.json), [network guard](offline-guard.json). Raw screenshots and lifecycle.mp4 are in the seeds-112-store-android-acceptance CI artifact. Android evidence and its signing boundary are also recorded in acceptance.json. Emulator APKs use the same temporary CI-only certificate for before/after; the delivered APK separately uses the verified original production signer. Temporary CI signing does not establish a phone update using production credentials.

## Remaining real-world verification

[Phone check](PHONE_CHECK.md): physical install/update, sound/vibration feel, live banner/interstitial/rewarded behavior and actual AppMetrica event/revenue arrival. No physical phone, live fill, payouts or retention were measured. The QA key limitation concerns assistqa only; it did not block the separately recovered production signing key. Separate QA saves are not automatically migrated into the production app.

Store media remains in DanilaH/design/seeds-bits/rustore. No store submission or dashboard change was performed. **KIT IMPACT: REUSE** — existing pinned Android release/ads acceptance guidance and consumer release process; no additional kit change.
