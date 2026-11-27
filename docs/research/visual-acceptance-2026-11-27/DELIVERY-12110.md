# Семечки · №48, VA-01–VA-13 · preview 12110

27 ноября 2026. Статус: **PASS — полный автоматический пакет на указанном исполняемом исходнике**.

Исполняемый исходник: `6daea5abd6609008e2338476d81e24171714c50a`, ветка `feat/quiet-table-20261126`, [PR40](https://github.com/DanilaH/seeds-bits/pull/40). Основание: [№48](https://github.com/DanilaH/seeds-bits/issues/48) и [дополнение владельца VA-12/13](https://github.com/DanilaH/seeds-bits/issues/48#issuecomment-7218627968). Сборка продолжает принятые функциональные исправления 12109 / `96f5ae19588c151c0dd884e80a7f4e56c1d1f71d`; документационный baseline — `0f7c6a60a672e12c5b346fdd3175692fa8fb2c4c`.

Это проверка собственной игры «Семечки», обычный профиль помощи baseline. Референс рассыпания — собственная сборка 12106 / `125606e4a90e06b844fe6eb8f83249032cb7057f`. Выводов о Number Match Easybrain/NADO или Number Tiles здесь нет. Игру не публиковали, PR не объединяли.

## Подписанный APK

- `seeds-preview-12110-portrait.apk`: Android preview **1.1.2 / 12110**, `com.seedsbits.game.preview`, 6 091 755 байт.
- SHA256: `eb851f94d7362be26e53e7f972a63d6e914142a767ede172f0faaa658fcc633f`.
- SHA256 сертификата: `ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30`, тот же постоянный preview-сертификат, что у 12109. Подписи v2/v3 и zipalign 16K независимо проверены после скачивания.
- Все 675 файлов unsigned payload и все 23 web assets debug-APK сверены с выданным APK. Native regression использует временную общую QA-подпись для install-r старых сборок; это не сертификат выдачи.
- `firstSession=true`, `helpProfile=baseline`, `analytics=false`, демонстрационная реклама. Production-конфигурация и release compile проверяются отдельно; production signing и публикация не выполняются.

Последние QA-коммиты изменяют только Android QA и его workflow. Входы сборки игры идентичны `e2dc06da3adc5eeb1c6d3580499e19b6ffdcad90`; provenance финальных артефактов указывает именно `6daea5ab…`.

## Покрытие требований

| ID | Сценарий и ожидаемый результат | Реализация и граница проверки |
| --- | --- | --- |
| VA-01 | Классика, задача/страница/тетрадь, daily bronze/silver/gold, повтор, архив, отсутствие награды, pending/error/retry. Видимый текст не обрезается; Continue доступна до автопрокрутки. | `visual-acceptance.css`, `visual48.spec.ts`, прежние gold-layout/update110/menu-reward тесты. Range glyph bounds проверяются относительно всех clipping ancestors. 320×520, 320×568, 360×640, 390×844, 568×320, 844×390 и tablet; пять языков, обе темы. |
| VA-02 | Четыре нижних действия Home располагаются 4 в ряд или 2×2; все четыре доступны начальным настоящим hit test. | Intrinsic grid и сокращение пустого места hero; 320×520, пять языков. |
| VA-03 | Меню языка сохраняет целые подписи и описание Auto при браузерном тексте 100/150/200%. | Intrinsic rows, нормальные границы слов, узкая композиция. Русская короткая подпись «Авто», описание текущего языка сохранено. Android textZoom остаётся 100%. |
| VA-04 | В коротком landscape пояснение тупика прокручивается, основное действие и Undo доступны; длинные Quick notebook/Undo не обрезаны. | Отдельная прокрутка описания и перенос подписей внутри прежних контролов. |
| VA-05 | Tablet Progress не растягивает внутренние строки и не создаёт случайных пустот. | Intrinsic rows/start alignment, ограничение ширины существующей группы. |
| VA-06 | Выбранный язык и hint-jump читаются в обеих темах; focus сохранён. | Изменены действительные scoped selectors, а не общий цвет всех кнопок. |
| VA-07 | Банка Progress явно ведёт в коллекцию; значок получения меньше перекрывает медаль. | Текст/chevron и меньший receipt. Геометрия проверяема автоматически; художественная оценка остаётся за владельцем. |
| VA-08 | Ввод/Back/новая игра, фон, resize и reduced motion отменяют старые эффекты без replay и дополнительных наград. | Прежние owned motion/input/lifecycle/banner проверки сохранены. Нового animation input gate нет. |
| VA-09 | Наполнение 0–100% линейно внутри стекла; у собранной банки 100%, у следующей реальный остаток. | Одна внутренняя маска: top14%, sides13%, bottom7%. Геометрия driven exact filled/capacity, текстовый floor-percent прежний. Ёмкости 24/60/100/480, в том числе 79/80/90/99%; Home, header, result, Progress, коллекция/полка. |
| VA-10 | Выразительный finite fan/fall и пружина банки/крышки; на финале победа → новая медаль → полёт → полная банка → рассыпание → следующая. | 24 собственных семечка/блика, подъём/гравитация/вращение, конец выше реального banner reserve, bounded duration/resources. Обычный темп и оригинальное WebAudio в сравнительных видео. Субъективный feel не объявлен принятым по числу частиц. |
| VA-11 | При блокировке сохранения на 22/24 прежняя банка остаётся до durable acknowledgement. Release даёт full→spill→next; error/retry, отмена и поздняя запись не дают new→old. | `main.ts: save, presentFullJar, settlePresentation, storedJarView, refreshStaticJarViews`. Реальный Web Lock держит запись, кадры и disk проверяются раздельно. Девять исходов, включая Home/Progress/collection и удержанный pointerdown на Back во время commit. Навигационные кнопки не пересоздаются. |
| VA-12 | В игре нет notification switch/time/status/CTA. Два приблизительных local inexact слота 12:30/19:00 только без входа сегодня в любом режиме. | `SeedsDailyReminder.java`, `SeedsEngagementPlugin.java`, safe engagement gate. Android permission/channel и старое false сохраняются; custom time хранится исторически. Один durable request marker после успешного результата и reward sequence; новый Android denial отдельно от legacy opt-out. Пять языков privacy/store copy обновлены. Native case evidence приведено ниже. |
| VA-13 | Home→Settings→Back→Game и обратный вход сохраняют настоящий SDK banner, view/request/creative/geometry; privacy/confirm/модальные/системные окна/fullscreen/фон остаются исключениями. | Из guardedScreen удалён только settings. Demo записывает фактические pixels и native draw trace. Web/offline не подменяются фальшивой рекламой. |



Код на неизменяемом исходнике:

| Участок | Источник |
| --- | --- |
| VA-01–09, интерфейс/маска | [src/visual-acceptance.css:1](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/visual-acceptance.css#L1) |
| Durable snapshot | [src/main.ts:1100](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L1100) |
| Old/full/next и отмена | [src/main.ts:1389](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L1389) |
| Наградная последовательность | [src/main.ts:1463](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L1463) |
| Banner policy | [src/main.ts:1922](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L1922) |
| Static jar views | [src/main.ts:4652](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L4652) |
| Permission safe gate | [src/main.ts:4889](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/main.ts#L4889) |
| Ballistic spill | [src/jar-spill.ts:1](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/src/jar-spill.ts#L1) |
| Native visit/slots/dedup | [native/android/SeedsDailyReminder.java:71](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/native/android/SeedsDailyReminder.java#L71) |
| Actual Android scheduler acceptance | [scripts/markets/reminder-acceptance.mjs:1](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/scripts/markets/reminder-acceptance.mjs#L1) |
| Actual system permission proof | [scripts/markets/reminder-permission-proof.mjs:1](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/scripts/markets/reminder-permission-proof.mjs#L1) |
| Browser clipping/durable oracle | [e2e/visual48.spec.ts:1](https://github.com/DanilaH/seeds-bits/blob/6daea5abd6609008e2338476d81e24171714c50a/e2e/visual48.spec.ts#L1) |

## Полная регрессия проекта

CI используется только из `DanilaH/seeds-bits`.

| Workflow на исполняемом исходнике | Итог |
| --- | --- |
| [Check and build — push](https://github.com/DanilaH/seeds-bits/actions/runs/46023909474) | SUCCESS |
| [Check and build — PR](https://github.com/DanilaH/seeds-bits/actions/runs/46023919944) | SUCCESS |
| [Visual acceptance 48](https://github.com/DanilaH/seeds-bits/actions/runs/46023909446) | SUCCESS |
| [Functional audit fixes 47](https://github.com/DanilaH/seeds-bits/actions/runs/46023909359) | SUCCESS |
| [Issue 45 stability evidence](https://github.com/DanilaH/seeds-bits/actions/runs/46023909493) | SUCCESS |
| [First session preview, включая offline/demo](https://github.com/DanilaH/seeds-bits/actions/runs/46023909431) | SUCCESS |

193 unit, 2 independent model и 15 regression browser; 725 e2e PASS на исполняемом исходнике в обоих общих прогонах (push и PR). Focused №48: 204 PASS; functional №47: 16 model/fault и 74 browser PASS; stability №45: 140 + 40 + 40 = 220 проверок кандидата PASS; visual audit: 180 + 8 PASS; menu/reward: 32 PASS; first session/markets/default-feedback: 38 + 19 + 19 PASS. 93 Java-проверки со стабами SDK/feedback и отдельный Capacitor MessageHandler race oracle — PASS. Пересекающиеся выборки не суммируются как уникальные тесты.

В stability workflow неизменённая 12104 специально воспроизводит исходную потерю 26→28 в 2 из 20 попыток и ожидаемо падает на отдельном held-write oracle из-за отсутствия pending-контракта. Это контроль воспроизведения исходного дефекта; перечисленные повторные проверки кандидата проходят.

Сохранены recovery → durable ack → immediate force-stop, защищённые ресурсы при повреждении статистики, CAS/shared-writer/Web Locks без RAM fallback, сохранения Wire10, content pins, reward receipts, review/ads lifecycle и исправление Capacitor 8.5.3 replyProxy. Пауза всех шести экспериментов сохраняется, обычные инструменты — «Отмена», «Подсказка», «Добавить». Правила, состав полей, экономика и раздачи не менялись этим пакетом.

### Android offline

[Полный offline acceptance](https://github.com/DanilaH/seeds-bits/actions/runs/46023909431/artifacts/15213490637) — PASS на Android API35, с guest firewall до запуска игры. Пройдены 3 recovery → durable acknowledgement → немедленный force-stop; реальные архивы на 1/3/5 лет с точными историями и правами; обновление с 12108/atomic backup и **реальное 12109 → 12110** с wallet999, 2048 receipts, content pins, старым false и историческим custom time.

Также PASS: permission deny/grant/revoke; timezone/date crossing на 26 часов; native notification-entry Intent из фона; настоящий reboot эмулятора и оба напоминания после него; 10 новых WebView documents с первым native roundtrip и точным сохранением данных; **16 native absence cases**; **20 immediate force-stop/Undo циклов**; прежний полный Android набор.

Старые игровые проверки включают оба порядка первой пары/явный переход в задачу2, Spanish/Portuguese архив при большом системном шрифте, сохранение Android textZoom100% при font scale1/1.5/2, оба порядка native controls, Book78 с шестиходовым shipped witness, 108 цифр/54 пары в v5 с Undo и восстановлением, ремонт подсказки/кошелька, pair waves, collapse/Add motion, 12 Classic starts/Expert scroll/resume и Core Feel/default audio/mute persistence. Игровые input/layout cases явно имеют granted permission; настоящий системный запрос и Deny проверены отдельно в demo. Необязательная запись первого сеанса тоже получена. Native timings/RAM/frame gaps в JSON — наблюдения software-GPU эмулятора, не результаты low/mid телефона.

`absence-reminders.json` отдельно фиксирует настоящий Android scheduler/receiver: оба ID701/702 без входа, duplicate, вход до обеда/между слотами/после вечера, очистку уведомлений после входа, legacy false/custom time, permission denied/revoked, реальный переключатель notification channel, late/stale alarm, новый день, legacy dedup, foreground и оба следующих расписания. Broadcast receiver вызывается явно для управляемого теста решения; это не наблюдение автономной доставки ОС ровно в 12:30/19:00.

### Android demo SDK

[Demo SDK acceptance](https://github.com/DanilaH/seeds-bits/actions/runs/46023909431/artifacts/15211092584) — PASS: 252,435 с, 91 наблюдение, 5546 кадров с expected visibility, 0 неожиданных hidden/moved. На обычном маршруте Settings native view100648360/request1 и геометрия сохранены, actual creative pixels подтверждены (90 цветовых buckets при первом paint). WebView reload и настоящие fullscreen/interstitial/rewarded прошли; earned reward сохранён ровно один раз. Resize в другую ширину слота — отдельное ожидаемое изменение view/request. Системное окно Android действительно показано после первого сохранённого notebook result; настоящий Deny завершился, новый game opt-out не создан.

Первый содержательный результат действительно вызывает системное Android-разрешение после сохранения и эффектов. Native QA фиксирует XML/кадр, нажимает настоящий «Не разрешать», проверяет durable marker/denial, отсутствие нового legacy false и возврат прежнего баннера. Системный диалог — действительное исключение; его кадры отмечены отдельно от непрерывных обычных маршрутов. В дальнейшем действуют прежние проверки fullscreen/rewarded/dedup.

## Сравнительные видеозаписи

`seeds-12106-12109-12110-comparison.mp4`: слева 12106, в центре 12109, справа 12110. Нормальная скорость **1×**, 1170×844; звуковая дорожка — настоящий WebAudio кандидата. Отдельные дорожки в видеоархиве сохраняют собственный звук каждой сборки. Это запущенные браузерные сборки из указанных исходников, не съёмка телефона и не Android APK-запись.

| Таймкод | Действие и состояние |
| --- | --- |
| 00:00–00:06 | Решение последней пары задачи, получение семечек и переход полной банки. |
| 00:06–00:12 | Финал Классики и наградная последовательность. |
| 00:12–00:18 | Финал полной тетради. |
| 00:18–00:24 | Daily result, новая бронзовая медаль и заполнение банки. |
| 00:24–00:30 | Каталог/секции/язык/банки/медали. |
| 00:30–00:36 | Компактная Классика, 320×520, тёмная тема. |
| 00:36–00:42 | Компактный daily/медаль, 320×520, тёмная тема. |
| 00:42–00:48 | Компактный финал тетради, 320×520, тёмная тема. |

`seeds-12110-settings-demo.mp4` — один непрерывный отрезок исходного Android demo capture с 00:48,0 до 01:03,9 (15,917 с, 320×640, 24 fps, 1×): Home → Settings → смена темы → privacy/возврат → Home → Game → Home → Settings → Home. Внутренних склеек и ускорения нет; privacy — настоящее исключение. Emulator-console capture не записывает звук. [Полная исходная запись 252,435 с](https://chatgpt.com/library?file_id=libfile_fde3_f-3ede6f44e35c8191963a7dff5acbe88e_2841ca9da26c8191b7a266fa9b41a810&account_id=personal) сохранена отдельно; её SHA256 `da162f56be3036d179f71f9ddb3a17469aca6d9b7c6d65c59015b1d490b5ac80`, JSON trace и ссылка включены в архив доказательств; сравнения браузерных сборок сохраняют настоящий звук игры. Полная запись реального demo SDK и JSON trace сохраняются отдельно от браузерного сравнения.

## Источники, ограничения и незакрытые проверки

Уровни: фактический код; автоматическое наблюдение запущенной браузерной сборки; данные APK/подписи; наблюдение Android API35 emulator и настоящего demo SDK. Данные издателей и гипотезы о ретеншне этим отчётом не подтверждаются. Независимый read-only probe выполняется одинаково на неизменённой 12109 и кандидате: по 442 состояния, ошибки страницы учитываются отдельно от геометрии.

Неуспешные промежуточные прогоны не скрываются: ранние проверки выявили исправленные ошибки компактной геометрии/подписей; старые ожидания 12 локальных частиц заменены контрактом VA-10 с 24 ballistic частицами и проверками границ/отмены. [Два B302 Android-прогона](https://github.com/DanilaH/seeds-bits/actions/runs/46010821814) потеряли ADB transport; [source7 первый запуск](https://github.com/DanilaH/seeds-bits/actions/runs/46016988680) остановился на 403 служебного apt-репозитория до запуска игры, повтор demo остановился на необработанном QA настоящем системном permission dialog. Последний дефект исправлен в сценарии проверки, runtime не изменялся. На runtime-эквивалентном [c059 demo](https://github.com/DanilaH/seeds-bits/actions/runs/46019638304) также потерял ADB до первого проверенного creative. Source7 offline подтвердил 16 absence cases, upgrade12109 и 20 force-stop, затем встретил тот же системный диалог в старом input-case. Для трёх несвязанных с permissions input/layout cases теперь явно предоставлено Android-разрешение; реальный запрос/denial остаётся отдельной обязательной demo-проверкой. В [source9/57bb](https://github.com/DanilaH/seeds-bits/actions/runs/46021961524) ошибочный oracle прочитал native prefs в начале inert-подготовки, до появления системного окна; теперь actual Android dialog наблюдается первым, затем проверяются сохранение и эффекты. Selector учитывает фактический Google permission controller, подтверждённый window trace. Финальный исходник успешно прошёл все шесть workflows и оба полных native jobs; промежуточные неуспешные попытки не считаются приёмкой.

Физический телефон, low/mid performance, battery policy/автономная доставка, TalkBack, субъективный звук/вибрация/анимация, live commercial inventory и живая аудитория: **UNKNOWN**. Следующая проверка: установка поверх 12109 на low/mid Android с сохранениями; просмотр всех финалов/рассыпания и прослушивание/вибрация; день без входа с разрешённым каналом и проверкой обед/вечер, затем вход между слотами; TalkBack; отдельные реальные рекламные и audience-наблюдения. Эти границы не заменяют автоматическую регрессию и не требуют публикации игры.

KIT IMPACT: REUSE существующих viewport/owned-motion/durable контрактов; CANDIDATE линейная шкала, clipping ancestors и durable visual oracles после приёмки потребителя. Main кита повторно сверён: `a994dc7910fd50f198f892e64a8203b764a921c1`. Runtime pins/kit CI не менялись. Main игры: `4f7a8f93e044cc5eb5f4dadceb8a0458b555cf08`; работа остаётся в draft PR40.
