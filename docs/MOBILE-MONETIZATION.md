# Android monetization

The native bridge lives in `native/android/`; `scripts/configure-android.mjs` installs it into the generated Capacitor project. Android is generated on CI, so native customizations must remain in these sources, not the ignored Android directory.

Dependencies pinned from current official integration guides: Yandex Mobile Ads 8.5.0 and AppMetrica 8.6.0. AppMetrica is activated in Application, with activity auto-tracking and location tracking disabled. Yandex is initialized manually before requesting ads. SDK calls, view updates and full-screen display run on the Android main thread.

## Configuration

GitHub Actions accepts repository secrets or variables with these names:

- `APPMETRICA_API_KEY`
- `YANDEX_BANNER_AD_UNIT_ID`
- `YANDEX_INTERSTITIAL_AD_UNIT_ID`
- `YANDEX_REWARDED_AD_UNIT_ID`

Push builds use test advertisements. The Actions workflow can also be manually dispatched with `ads_mode: live` for production ad IDs. Required configuration is checked by name and shape; values are not printed. Client identifiers are compiled into Android resources. Pull requests can compile demo ads without access to credentials.

## Placement and policy

The banner uses the SDK adaptive sticky format with its built-in refresh. A 72px native slot plus separation is reserved before the game opens, so network callbacks never resize the board. SDK height is checked against the slot. No banner appears below 600px portrait height, in landscape, tutorials, dialogs, background or full-screen ads. It is positioned from the safe-area-aware DOM slot, using the WebView's actual pixel/CSS scale. Configuration changes destroy obsolete geometry; native safe-area style updates also reposition the banner. Failed load retries require a later user action and at least a minute; callbacks never create immediate retry loops.

Interstitials are attempted only after the result action, once the completed game has saved. The native bridge enforces a 180-second interval, including the first session's grace period, and extends it after rewarded ads. This interval persists across restarts. There is no daily cap. Missing ads do not delay the next party and late load callbacks never open ads by themselves.

Android starts each attempt with three free hint reveals. A repeat of the same unordered pair on the same board is free, including after undo and reload. Each reward grants three extra reveals. The player sees an explicit video offer before showing an ad; no hint ad opens automatically. Web and iOS remain outside the Android ad integration and retain their existing hint access.

A native reward receipt is synchronously persisted when the SDK reports a reward, delivered to JS, deduplicated and written with game progress, then acknowledged to native storage. An interrupted process can recover the pending receipt at startup. Failed progress writes keep the native receipt. If a restored backup no longer contains the rewarded attempt, the earned hints go to the current attempt. Cancelled or failed ads grant nothing.

Game input and sound are blocked during full-screen display. Visibility and app lifecycle cannot unpause the game while an ad is active. The application continues on ad load or show errors. Native destruction releases views/listeners.

## Analytics

AppMetrica receives game start/completion by mode (start is emitted on the first gameplay action once per persisted attempt; home opening and switching are separate game-open events), hint reveals/offers/grants, save errors and native ad request/load/show/impression/close/error/reward events. Events include a test-mode flag. Boards, individual digit taps, raw save contents, keys and ad IDs are not sent as custom event data. Automatic sessions and devices belong to AppMetrica SDK reporting. Test events use the configured key and should be segmented by the `test` flag; this does not separate automatic test-device audience counts.

## Device acceptance

1. Install the signed test APK over 0.5.2 and check that progress survives.
2. In portrait, check the demo banner beneath controls; open menus/tutorial and rotate to landscape to check it hides. Verify gesture navigation and three-button navigation, cutouts and enlarged fonts.
3. Use three distinct hints; accept the fourth offer. Fully watch a demo video and check +3 hints, close early and check no grant. Return from background and check input and sound.
4. After at least three minutes, finish a party and press the next-party action. Check the demo interstitial and return to the next game. A recently viewed rewarded ad postpones this placement.
5. Turn off networking. Play, undo, save/restart, and request ads; the game must remain usable. No load callback should unexpectedly open an ad.
6. In AppMetrica, verify a device/session and the custom events. Native requests, fills and impressions are confirmed on a device; browser simulations and build success do not establish live fill or delivery to the dashboard.

Before a store release, build with `ads_mode: live`, update the store privacy/data disclosures for the included SDKs, and verify live IDs and dashboard delivery on a real device. The preview package and signing identity are unchanged.

## Sources

- https://ads.yandex.com/helpcenter/en/dev/android/quick-start
- https://ads.yandex.com/helpcenter/en/dev/android/adaptive-sticky-banner
- https://ads.yandex.com/helpcenter/en/dev/android/interstitial
- https://ads.yandex.com/helpcenter/en/dev/android/rewarded
- https://appmetrica.yandex.com/docs/en/sdk/android/analytics/quick-start
