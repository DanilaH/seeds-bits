# Независимый аудит Menu & Reward Feel — 27.11.2026

Рабочая версия PR40 / 125606e4a90e06b844fe6eb8f83249032cb7057f, APK 12106 (1.1.2, com.seedsbits.game.preview), independently verified SHA256 a1674179bfeca05f629dd55cc2956ea0b4b369b854c4ef942242ad3cd988d9fc. Kit main e8fafcd5932f8cf5c6ad4359bcc7ea58cbdb9820. Main игры не является текущим runtime. #45 exact preview CI success; прежние контракты, включая native banner, сохранены.

## Evidence
- [Exact preview CI 45880657226](https://github.com/DanilaH/seeds-bits/actions/runs/45880657226), [visual 15145614673](https://github.com/DanilaH/seeds-bits/actions/runs/45880657226/artifacts/15145614673), [native offline 15147468096](https://github.com/DanilaH/seeds-bits/actions/runs/45880657226/artifacts/15147468096), [demo 15148230518](https://github.com/DanilaH/seeds-bits/actions/runs/45880657226/artifacts/15148230518). Визуальный baseline: 145 статических состояний, дополнительный пакет закладок, 320/390, light/dark, RU/PT-BR. Нативное видео первой победы sampled at 8fps: ~1.69s поле пустое, CTA уже есть, карточка ещё почти прозрачна.
- [Independent dynamic CI 45885868198](https://github.com/DanilaH/seeds-bits/actions/runs/45885868198), [artifact 15149286635](https://github.com/DanilaH/seeds-bits/actions/runs/45885868198/artifacts/15149286635), QA-only source 45c0edf800930258a54c263f1272ecc1eff54098. 11 scenarios (10 result cases, 1 navigation journey with 22 transitions), errors=[]; metrics.json and actual Playwright videos; synthetic saves, muted, real runtime. Code unchanged from baseline. Browser measurement not physical-device feel or live audience.
## Findings
| ID | Verified baseline / scope | Next |
|---|---|---|
| MF-01 | task-jar-threshold meter22→26, result labels22/24→0/60→2/60, never24/24 in samples; classic22→24 shows next empty jar. main.ts animateSeeds/renderJar/updateResultJar, jar-spill.ts | One visible full jar transaction, lid/receipt, accurate remainder, no duplicate header celebration. |
| MF-02 | page-replay / book-replay unchanged done6/24 and meter20, book still24 burst. resultKind / recordCompletion. No duplicate reward established. | Separate newly achieved milestone from saved status and ordinary replay. |
| MF-03 | book-new sample ms1916 transform ~-5°, ms1983 none; result-presentation.ts 780ms end angle vs upright CSS. | End pose continuous, safe ribbon. |
| MF-04 | 320 RU broken word quick Continue; Progress collection CTA at y696; language sheet tall mostly blank. 390 Home remaining whitespace acceptable. Static screenshots not comprehensive device matrix. | Targeted layout fixes only; no redesign. |
| MF-05 | ui-motion.ts generic140ms across route changes; 10 WAAPI nav effects recorded in 22 steps, no equivalent on same-screen range/theme/month/tab. | Local tactile objects and short context-linked transitions. |
| MF-06 | task simultaneous win opacity .26 and paper .49; native empty beat; all five results exist. | Single entrance; differentiated new task/page/book/Classic/daily medal choreography. |
| MF-07 | daily-bronze combined peak86 running animations (24 burst/24 spill/32 medal particles present), no claim of FPS drop; existing foley/haptics. | One hierarchy, limited particles, no celebration on reopen; coordinated existing sound/haptic. |
| MF-08 | reduced-motion book 0 running animations; immediate-next case ends without particles and preserves meter24/done24. | Preserve these behaviors and expand exact CI/device acceptance. |

[Developer issue #46](https://github.com/DanilaH/seeds-bits/issues/46) includes precise scenarios, implementation anchors, design proposals, acceptance and ordering. Proposed motion timings/particle counts and compact language sheet are researcher recommendations; not established product improvements, not an Easybrain/NADO source feature. No original reference claim. Phone/audio/audience UNKNOWN; no new runtime implementation here. KIT IMPACT REUSE (UI motion, owned motion, stable progress UI, tier progress); no kit runtime update.

