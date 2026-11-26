# Independent Quiet Table review — 26 November 2026

Scope: own game, not reference parity; preserve owner-approved Quiet Table Variant A and current product decisions (#39/#41). Audited PR40 HEAD `634583a9a08d8e1a1941c4611a1e0f2d0b77d159` (game main 4f7a8f93e044cc5eb5f4dadceb8a0458b555cf08; kit main 116a2702b36af36db91ee299d45c2ab5ba2e3a5c).
APK: signed preview 1.1.2 / 12103, package com.seedsbits.game.preview, source 203d76532c64a1d61b9a6451bf5df11c41459e88; independently verified SHA256 17cf469305791f700a89b0015d84a683a3d4fd38689c5b8c655eb7e87c0570d1. Diff to audited HEAD documentation only. Signed artifact [15114944333](https://github.com/DanilaH/seeds-bits/actions/runs/45816796157/artifacts/15114944333). Native evidence [offline](https://github.com/DanilaH/seeds-bits/actions/runs/45816796157/artifacts/15116024067) / [demo](https://github.com/DanilaH/seeds-bits/actions/runs/45816796157/artifacts/15116342797).
Independent browser capture: [CI 45821185877](https://github.com/DanilaH/seeds-bits/actions/runs/45821185877) SUCCESS; [artifact 15116683905](https://github.com/DanilaH/seeds-bits/actions/runs/45821185877/artifacts/15116683905), metrics.json and 141 screenshots. [Exact audit script](https://github.com/DanilaH/seeds-bits/blob/33cd054da7b297088d535f68173e9785eb67041b/scripts/independent-quiet-audit.mjs), QA commit contains only capture script/workflow relative to runtime. Matrix 390×844 RU light/dark, 320×568 RU light and PT-BR dark, additional fresh/empty/lesson/ordinary hint. Test save, reduced motion, no-fill stub + 50px banner reserve; not production audience. No execution/route errors or measured button text bounds failures. Calendar extras: two scrolled captures flag controls beneath sticky clipping; not demonstrated clickable obstruction of visible controls.
 
## Findings and developer tasks
Full actionable specifications and acceptance fixtures in [#43](https://github.com/DanilaH/seeds-bits/issues/43) and [#44](https://github.com/DanilaH/seeds-bits/issues/44). Local product adaptations only.

| ID | Evidence | Status on 12103 |
|---|---|---|
| QT-UI-01 | Browser top 14px rectangle, legacy .dialog-head shadow ui-polish.css:194–207; separately white native system bar (webY=48) | defect verified; native theme fix to verify |
| QT-UI-02 | collection scrollHeight/clientHeight 1184/695 (390),1154/419 (320); empty collection also scrolls | improvement authorized; horizontal jar summary and tighter shelf proposed |
| QT-UI-03 | daily result #play-again transparent text-only, y456,h44 at320 | verified; colored secondary CTA |
| QT-UI-04 | narrow archive daily title intersects SVG bookmark | verified screenshot; correct safe area without shrinking type |
| QT-UI-05 | Home 390 gap 142px between modes and footer; PT-BR breaks Configurações | optional local balancing; preserve accepted composition |
| QT-UI-06 | notebook page separated from header on tall screens; compact catalogue range wrapping; calendar scrolled controls | local spacing improvements, no new navigation |
| QT-UI-07 | confirm panel huge empty space/edge-bound controls; settings spacing | improve padding and geometry, verify label-row switch hit targets |
| QT-REACH-01 | reachableNumbers / checkPair / board-view.ts / quiet-table.css currently uniformly green | owner requests valid green, incompatible reachable red; no new rule/solver or paid feature |

Core field, themes, notebook grid, language and difficulty sheets and current result routes generally preserved. All five result types inspected with reproducible synthetic fixtures. Browser ordinary hint and lesson inspected; rewarded offer and SDK lifecycle not comprehensively repeated. Keep six paused experiments, generator, score/rewards, accepted ad and navigation routes, permanent banner.

## Gates
CI 45816796157: browser/preview/sign/offline job success; demo failed waiting first notebook task→2 after ADB tap, no inference of production cause. Offline optional video failure ADB device offline. Latest overall CI 45818583096 failed assembleDebug, web cancelled; 45818592417 cancelled. Independent visual CI succeeded but does not replace full regression. Physical phone and audience UNKNOWN. Next: developer implements #43 and #44; repeat exact screenshot matrix, real native bars/geometry, all five languages, full regression, demo transition and physical phone. KIT IMPACT: REUSE. No source inventory changes (not a feature found in an original).
