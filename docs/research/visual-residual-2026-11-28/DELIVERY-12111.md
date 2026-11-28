# «Семечки» · №48 · остаточные исправления12111 · 28 ноября2026

**Автоматическая приёмка PASS: все6 workflows проекта, оба полных Android jobs. Физический плейтест остаётся открытым.**

Исправлены VA-06R, VA-02R и VA-04R поверх актуального PR40. Основание — [независимая приёмка12110](https://github.com/DanilaH/seeds-bits/issues/48#issuecomment-7237368017), только три остаточных дефекта из этого комментария. Это собственный интерфейс «Семечек», не исследование оригинальных Number Match.

Исходник выдачи: `f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f`. База PR40 до пакета — `ae8162ced66f9706d70c275d71b44a5a5845845e`; исполняемая12110 — `6daea5abd6609008e2338476d81e24171714c50a`. Обе базы12109/12110 остаются предками. Новых механик нет. PR40 и №48 остаются открытыми; публикации/merge нет.

## Подписанный APK

`seeds-preview-12111-portrait.apk` — пакет `com.seedsbits.game.preview`, версия `1.1.2 (12111)`, 6 091 755байт.

SHA256: `4b3f9a7437f27262c1772620c3398a341f2e7abf914a32c3a6c0949dc1610e01`.

Сертификат SHA256: `ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30`, тот же, что в подписанной12110. Штатный apksigner проекта подтвердил v2/v3; 16K zipalign PASS. Бинарный manifest прочитан отдельно; все675 ZIP-entries совпали с unsigned APK, все23 web assets — с debug APK. Analytics выключена, helpProfile baseline, firstSession true. [Сборка/подпись](https://github.com/DanilaH/seeds-bits/actions/runs/46134792302), signed artifact15258943676; его ZIP SHA256 `2d1808703154ca8269cae17d6e6543f913e88922dbc511dc1ef7f4e2d2783369`.

## Три требования

| ID | Подтверждённый дефект12110 | Изменение и приёмка12111 |
|---|---|---|
| VA-06R | Foreground был заменён без background: lightRU1.84:1, darkPT-BR1.32:1. Это подпись дальней подсказки, не выбранный язык | Локальная пара `table-action-ink/table-action`, [код](https://github.com/DanilaH/seeds-bits/blob/f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f/src/visual-acceptance.css#L157). Normal/focus:light7.665:1,dark7.302:1. С учётом существующего pressed `brightness(.94)` расчёт даёт минимум6.729:1; ≥4.5 во всех8 сочетаниях темы/сценария. Проверены видимые glyphs, 5raw hitpoints, focus/pressed и настоящий переход к цифре171. Viewports390×844 RU/PT-BR,568×320 RU,844×390 PT-BR |
| VA-02R | На320×520 нижний ряд EN/ES/TR/PT-BR×2темы выходил до473.6875 при dialog.bottom458. Кнопки были доступны прокруткой; это не тупик | Внешние отступы уменьшены, specificity активного `:has` layout учтена; размеры/внутренние отступы тетрадки и hit areas сохранены. [Код](https://github.com/DanilaH/seeds-bits/blob/f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f/src/visual-acceptance.css#L131). Та же independent `large` fixture с resume, parkedbook9 и длинными счётчиками. Все10/10 кадров: четыре кнопки/glyphs/5hitpoints целиком без автопрокрутки; bottom450, граница458, запас8px |
| VA-04R |568×320 lightRU Home: «Продолжить» выходило на4.33px справа за own control.844×390 darkPT-BR Classic: «Desfazer» на2.05px с каждой стороны | [Код](https://github.com/DanilaH/seeds-bits/blob/f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f/src/visual-acceptance.css#L118): book-quick занимает всю ячейку; колонки footer имеют intrinsic minimum по слову. Own overrun0px в обоих точных случаях. Проверены clipping ancestors и raw переход в книгу/pair→Undo. Dead-field primary568×320 остаётся целым и достижимым на5языках |

27 новых целевых сценариев. Geometry проверяет собственные Range bounds и все clipping ancestors до любого scrollIntoView, а также5точек hit-test. Видимость поля измеряется после реального закрытия Home и завершения layout; пороги не ослаблялись. Предварительный пакет сократил карточку и вызвал переполнение мини-поля; полная регрессия это обнаружила. Размеры карточки12110 восстановлены. Дополнительно исправлены только переносимые имена JSON-артефактов и готовность нового теста к переходу из меню.

Independent probe не менялся:442кадра12110 +442кадра12111, pageErrors0/0. Отдельный `check-visual48-residual.mjs` воспроизводит известные дефекты неизменённой12110 и утверждает пороги кандидата. Сбор метрик сам по себе не объявляется PASS. [Independent artifact](https://github.com/DanilaH/seeds-bits/actions/runs/46134792384/artifacts/15259725911), [целевые данные и кадры](https://github.com/DanilaH/seeds-bits/actions/runs/46134792384/artifacts/15259676997).

## Полная регрессия

PASS:193 unit (40files),2 model,15 regression browser и752 e2e. Дополнительно231 focused VA48 (27 новых),16+74 FA47,220 повторных проверок кандидата №45; visual180+8, menu32, first-session/markets/default-feedback38+19+19. Java SDK/feedback harness и Capacitor race oracle PASS. Полный Android итог указан отдельно ниже.

| CI проекта | Результат |
|---|---|
| [Check/build push46134792291](https://github.com/DanilaH/seeds-bits/actions/runs/46134792291) | PASS:193unit/2model/15regression/752e2e, web/Yandex builds, native harness/Android build |
| [Check/build PR46134796946](https://github.com/DanilaH/seeds-bits/actions/runs/46134796946) | PASS:тот же полный набор193/2/15/752 и сборки |
| [Functional47 46134792264](https://github.com/DanilaH/seeds-bits/actions/runs/46134792264) | PASS:16 focused unit +74 browser, production configuration/release compile |
| [Visual48 46134792384](https://github.com/DanilaH/seeds-bits/actions/runs/46134792384) | PASS:231 focused, independent442+442 и известные пороги |
| [Stability45 46134792309](https://github.com/DanilaH/seeds-bits/actions/runs/46134792309) | PASS:220 повторных candidate checks; исходный baseline отдельно |
| [Preview46134792302](https://github.com/DanilaH/seeds-bits/actions/runs/46134792302) | Browser38+19+19, visual180+8, menu32, recordings/signing PASS; offline/demo Android API35 PASS |

Первый offline attempt прошёл functional/upgrade/absence/durable проверки, затем остановился в старом verifyPairWaves: после Undo ожидалось5цифр. В trace — pointerdown/up по нужной кнопке, интервал доставки pointerdown→pointerup704ms и отсутствие click в сохранённом trace; изменение поля не подтверждено. Весь failed job повторён на том же исходнике и APK, без изменения порогов: повторный полный прогон PASS. Первый сбой/trace сохранены отдельно в доказательствах; это ограничение доставки жеста в первом прогоне, а не подтверждение сбоя игры на физическом телефоне.

Выборки пересекаются и не суммируются. CI mini-games-kit не запускался.

Android API35 offline: **PASS, полный повторный job**.3 recovery/force-stop, архивы1/3/5лет, фактические обновления12108/12109/12110→12111, histories/wallet999/2048receipts/pins/legacy opt-out,3permission/3timezone cases, реальная перезагрузка и10WebView/native reload,16absence cases,20durable Classic force-stop, старые opening/catalogue108/book78/hint/pair-waves/Undo/board-motion/Classic pilot проверки. [Artifact15261287022](https://github.com/DanilaH/seeds-bits/actions/runs/46134792302/artifacts/15261287022), ZIP SHA256 `328c9b8dbc26229c39e7187350d92db390097a72d301108ab2c5a531deda417d`. Для фактического upgrade harness пере-подписывает старый и новый debug APK общим временным CI-сертификатом; постоянные сертификаты выдаваемых12110/12111 отдельно совпали. Физическая установка постоянных подписанных APK остаётся отдельной проверкой.

Android API35 demo SDK: **PASS**.250.261с,91наблюдение,6879expected frames, unexpected hidden=0/moved=0. Настоящий системный notification prompt с Deny, обе обычные Settings round-trip с темой/сохранённым banner view/request/геометрией; fullscreen/rewarded закрываются, earned receipt сохраняется ровно один раз. Browser-mock доказывает геометрию, этот прогон — реальный native SDK. [Artifact15259686655](https://github.com/DanilaH/seeds-bits/actions/runs/46134792302/artifacts/15259686655), ZIP SHA256 `0256e2f79065e23a443b037d762cf87511224e81395802243c70a44eb11bcf46`. Системные/реальные modal/fullscreen/background исключения учитываются отдельно от expected banner frames.

## Сохранение12110

Продуктовый diff относительно12110 ограничен `src/visual-acceptance.css`. Другие `src/**`, `native/**`, package/lock неизменны. Сохранены анимации/очередь победы→медали→банки, пропорциональность наполнения и durable old→full→next; уведомления12:30/19:00 для не заходивших сегодня с Android permission/channel и legacy opt-out; настоящий постоянный баннер обычных Settings. Правила, контент, экономика, сохранённые права и пауза шести экспериментов прежние. Автоматическая проверка не означает физический плейтест.

## Сравнительные записи

`seeds-12106-12109-12111-comparison.mp4`: три панели слева направо12106/12109/12111, обычная скорость1×;48.149с,1170×844, H.264/60fps encoding +AAC. Это реальные CDP-кадры браузера, не утверждение о60fps телефона. В сводном ролике — реальный WebAudio mix кандидата. Индивидуальные записи всех трёх версий сохраняют собственный исходный звук, без заменяющей дорожки. [CI-видео](https://github.com/DanilaH/seeds-bits/actions/runs/46134792302/artifacts/15259257936).

| Таймкод сводного ролика | Действие/сцена |
|---|---|
| ~00:00.6 | Последняя пара задачи, победа и заполнение/рассыпание банки390×844 light |
| ~00:06.6 | Пара на незавершённом поле и банка390×844 light |
| ~00:12.6 | Завершение тетради390×844 light |
| ~00:18.6 | Последняя пара дейлика, медаль и банка390×844 light |
| ~00:24.4–00:28.4 | Каталог, тема, возврат, язык, банки/медали |
| ~00:30.6 | Пара/банка320×520 dark |
| ~00:36.6 | Дейлик/медаль/банка320×520 dark |
| ~00:42.6 | Завершение тетради320×520 dark |

Точные действия и milliseconds в `recording.json`; исходники12106 `125606e4a90e06b844fe6eb8f83249032cb7057f`,12109 `0f7c6a60a672e12c5b346fdd3175692fa8fb2c4c`, кандидат `f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f`. Ролики показывают прежнюю последовательность эффектов; три остаточных дефекта приняты отдельными точными fixture/Range/contrast/hit проверками, а не этим монтажом.

## Физический плейтест и пределы

Код — реализован. Browser/Android-emulator — PASS на указанном исходнике. Физический телефон и живая аудитория — UNKNOWN. Конкретная следующая проверка: установить12111 поверх12110 без очистки данных на low/mid Android, проверить compact Home на5языках/двух темах, дальнюю подсказку и реальный jump; затем результаты/банки/сохранения и быструю Undo после пары, звук/вибрацию/TalkBack и Settings banner. Отдельно проверить следующий локальный день без входа до обеда/вечера, проверить системный запрет и вход между слотами под реальной battery policy. До этой проверки №48 остаётся открытым. Ни store publication, ни merge не выполнены.

**KIT IMPACT: NONE runtime / CANDIDATE QA** — разделять успешный сбор метрик и явные пороги известных дефектов. Kit source inventory/runtime pins не менялись, новых sourceFeatureId нет.
