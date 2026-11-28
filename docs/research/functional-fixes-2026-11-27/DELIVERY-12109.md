# Preview 12109 — automated acceptance of functional audit №47

27 November 2026. Executable source: `96f5ae19588c151c0dd884e80a7f4e56c1d1f71d`. Base:12108 / e592866145b0c2f537f01d21fb62a0e9e471d5e4. This is the evidence record for that immutable build; any later documentation commit is not a new executable build.

- Android preview1.1.2 /12109, `com.seedsbits.game.preview`, 6087659 bytes.
- [Signed APK artifact](https://github.com/DanilaH/seeds-bits/actions/runs/45976677220/artifacts/15187682120); SHA256 `224d3e16fb84bace07e564f336b24cd572bdaa07810404ffa9cfeda9ef7b756c`.
- Certificate SHA256 `ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30`; v2/v3 and zipalign16K PASS, same permanent preview identity.
- All 675 unsigned payload entries match; all 23 web assets match the debuggable Android acceptance build. Source manifest matches the executable source above.
- Preview configuration: firstSession=true, baseline, analytics=false. Production firstSession=false; production configuration/release compilation PASS, production signing/live delivery not performed.

## Checks on the executable source

| Run | Result |
| --- | --- |
| [Check and build (pull_request)](https://github.com/DanilaH/seeds-bits/actions/runs/45976686110) | SUCCESS |
| [Functional audit fixes 47 (push)](https://github.com/DanilaH/seeds-bits/actions/runs/45976677271) | SUCCESS |
| [First session preview (push)](https://github.com/DanilaH/seeds-bits/actions/runs/45976677220) | SUCCESS |
| [Check and build (push)](https://github.com/DanilaH/seeds-bits/actions/runs/45976677107) | SUCCESS |
| [Issue 45 stability evidence (push)](https://github.com/DanilaH/seeds-bits/actions/runs/45976677053) | SUCCESS |

193 unit,2 independent regression model tests,15 regression browser and616 e2e passed. Focused functional workflow:16 tests and74 browser scenarios, overlapping coverage not added together. Native harnesses:93 SDK/feedback controls and the actual Capacitor MessageHandler race harness.

[Full offline evidence](https://github.com/DanilaH/seeds-bits/actions/runs/45976677220/artifacts/15188539062):3 recovery→durable acknowledgement→immediate force-stop trials;1/3/5-year archives with exact histories/rights; actual12108 upgrade and atomic backup recovery; permission deny/grant/revoke;26-hour timezone/date crossing and background notification; actual emulator reboot/reminder rescheduling;10 WebView reload/native roundtrips;20 Classic force-stop trials plus the complete prior Android regression. Native sample timings and memory scope remain emulator measurements.

[Demo evidence](https://github.com/DanilaH/seeds-bits/actions/runs/45976677220/artifacts/15187398836):257.625s,73 observations,7150 expected banner frames,0 unexpected hidden/moved. Actual interstitial/rewarded close, reward saved exactly once, WebView reload completed. Old failing recordings remain linked in the [implementation protocol](README.md).

FA01–04 fixes and the automated FA05–08 scope are accepted on this source. Physical low/mid devices/full disk/TalkBack/audio/vibration, live commercial delivery and production signing remain external gates. The broad ledger entry therefore remains IMPLEMENTED_UNVERIFIED with explicit automated PASS evidence. Issue47 remains open for these external gates. Visual issue48 is separate.

Rules, content pins, progression authority, accepted presentation and all six paused experiments retain their prior contracts. No store publication or merge is part of this acceptance.

KIT IMPACT: REUSE of durable receipt/shared-writer/SDK lifecycle contracts; CANDIDATE independent persistence/bridge probes, no extraction. Final kit-main recheck:a994dc7910fd50f198f892e64a8203b764a921c1; runtime pins unchanged.
