# Финальное обучение №50 — поставка 12113

28 ноября 2026. [Требования FT01–FT03](https://github.com/DanilaH/seeds-bits/issues/50), [реализация PR40](https://github.com/DanilaH/seeds-bits/pull/40). Исполняемый исходник **27905882b973028cda2e3b03de602838433f941d**, база **4ce4cd4bf56a6b9723af1f9f0bfcf76371aeb77e / 12112**. Последующий commit этого отчёта меняет только документацию и реестр; нового APK из него нет.

## Результат

Чистый профиль сразу открывает настоящую `book-v1-1` с контекстным обучением, в том числе в production bundle. Старый двухшаговый курс остаётся только историческим QA-маршрутом. Добровольные шесть упражнений доступны через «Как играть» и используют общий renderer, клетки, HUD, панель инструментов, подсветку и Core Feel. Пояснения и появление «Далее» не сдвигают поле. Существующие и неопределённые профили сохраняют защищённый вход; ручной курс сохраняет настоящую партию и не выдаёт игровых наград.

В продолжении после передачи проверены история веток, actual HEAD/PR, решения владельца, diff и результаты последнего CI. Найден незавершённый рекламный gate; выполнен отдельный повтор на прежнем APK. Продуктовый код после `2790588` не менялся. Последние исправления исходника сохраняют кнопку тетрадей, приоритет восстановления хранилища и отступ от баннера в landscape. Правила, банки заданий, экономика, native SDK/уведомления и шесть приостановленных экспериментов не изменены относительно 12112.

## Один APK для плейтеста

| Поле | Значение |
| --- | --- |
| Файл | `seeds-preview-12113-portrait.apk` |
| Package | `com.seedsbits.game.preview` |
| Version | `1.1.2` / **12113** |
| Размер | **6 091 755** байт |
| SHA256 | `51d21b8595191753b1e6405f1a71e100152b708e560a9dcad99c79f6e9a9e267` |
| Сертификат SHA256 | `ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30` — прежний preview |
| Подпись | v2/v3 проверены signing job проекта |
| Конфигурация | firstSession=true, helpProfile=baseline, analytics=false |
| Источник | `27905882b973028cda2e3b03de602838433f941d` |

[Подписанный CI-артефакт](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15270073677), [исходная неподписанная сборка](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15270761073). Повторно скачанные ZIP сверены с digest GitHub. Manifest прочитан из выдаваемого APK: package/version совпали. Все **630** файлов вне каталогов и `META-INF/`, включая **23** web assets, побайтно совпали с неподписанным release APK этого CI. Signing material не скачивался и не менялся.

## Регрессия самого seeds-bits

Все ссылки ниже относятся к одному исполняемому исходнику `2790588`. Пересекающиеся наборы не суммируются.

| Прогон | Проверено | Результат |
| --- | --- | --- |
| [Check and build](https://github.com/DanilaH/seeds-bits/actions/runs/46163194711) | 195 unit, 2 независимых model, 15 дополнительных browser, 844 общих E2E, web/Yandex build и Android/native harness | PASS |
| [Functional audit №47](https://github.com/DanilaH/seeds-bits/actions/runs/46163189850) | 16 целевых unit, 74 browser, production package/channel/live-config checks | PASS |
| [Stability №45](https://github.com/DanilaH/seeds-bits/actions/runs/46163189856) | 20 + 140 + 40 + 40 сценариев сохранений и fault paths | PASS |
| [Visual №48–49](https://github.com/DanilaH/seeds-bits/actions/runs/46163189887) | 323 целевых сценария и независимое сравнение неизменённых baseline | PASS |
| [First-session, markets, Core Feel](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911) | 38 + 19 + 19 browser, прежние visual/menu/reward проверки, записи и signing | PASS |
| Production tutorial в том же workflow | 71 сценарий настоящего оптимизированного bundle: 5 языков × 2 темы × 7 размеров и protected profiles | PASS |
| Android offline в том же workflow | API35 / WebView124, полная прежняя регрессия и новые FT01–03 | PASS |
| Android demo в том же workflow | Настоящий тестовый SDK: banner/fullscreen/rewarded, permissions/lifecycle | PASS, попытка 2 на том же APK |

Production matrix: 320×520, 320×568, 360×640, 390×844, 768×1024, 568×320, 844×390; ru/en/tr/es/pt-BR; light/dark. Повторный разбор **70** `shared-geometry.json` подтвердил source `2790588`, **420** сравнений каждого упражнения с обычной доской с теми же данными: максимальная разница cell x/y/pitch/height **0 px**, одинаковый font; начальное и завершённое состояние урока сохраняют позиции viewport/footer. Эти выводы относятся к проверенной матрице, а не к любым устройствам.

Android `final-tutorial50.json`: обе темы, первая реальная запись ACK → немедленный force-stop → cold resume; шесть упражнений настоящими ADB-нажатиями; повтор и пропуск; изоляция реальной партии; законные +4 семечка; самостоятельная кнопка задачи 2 и её cold resume. `functional-audit.json` отдельно подтвердил **12112 → 12113**, истории, wallet999, 2048 receipts, pins и legacy opt-out/time. Upgrade harness использует общий временный CI-сертификат; постоянная подпись выдаваемого APK проверена отдельно. [Offline JSON/кадры/видео](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15271138862), [production geometry и кадры](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15269619351).

### Первый рекламный сбой и повтор

Попытка 1, job `141036263845`: настоящий interstitial открыл SDK-window; после ожидания и реального Android Back SDK не вернул dismissal до таймаута. `uiautomator` не получил idle state, на сохранённом кадре нет доступного крестика. Это наблюдаемый сбой тестового creative/закрытия SDK, а не доказанный дефект обучения; точная причина внутри SDK UNKNOWN. Проверка не ослаблялась, callback не подделывался, приложение принудительно не закрывало рекламу. [Первоначальный лог](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/job/141036263845), [сохранённые кадр/logcat/видео/diagnostics](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15271195670).

Попытка 2, job [141064918359](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/job/141064918359), завершилась **SUCCESS** без изменений кода, APK или проверок. [Диагностика и запись успешного demo](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15275016022): 259,876 с, 91 наблюдение, 6685 ожидаемых banner frames, hiddenFrames=0/movedFrames=0, настоящий системный prompt → Deny, оба Settings round-trip, реальные interstitial/rewarded и сохранённая один раз награда. SDK показал Next/Close, получили настоящие callbacks и возврат баннера. Изначальный сбой сохранён отдельно; успешный повтор подтверждает только проверенный тестовый SDK-сценарий, а не отсутствие возможных сбоев любых удалённых creative. Все шесть запусков CI на `2790588` завершились SUCCESS, включая push/PR варианты Check and build; пять разных workflow-файлов. Повторялся только упавший demo job.

## Сравнительные материалы

[Архив записей](https://github.com/DanilaH/seeds-bits/actions/runs/46163189911/artifacts/15271126227): `tutorial50-recordings/seeds-12112-12113-tutorial-comparison.mp4`, отдельные light/dark и исходные before/after, PNG, `provenance.json` с каждым действием и wall-clock. Исходники: before `4ce4cd4`, after `2790588`. Слева 12112, справа 12113; 390×844, русский, обе темы, реальная скорость, без звука. Общая длительность файла **60,67 с**. Существующие отдельные сравнения наград сохраняют настоящий WebAudio; немой UI-ролик не является проверкой звука или вибрации.

Проверенные фрагменты первого светлого сравнения: 00:00 — первый экран; 00:02 — ошибочная пара; 00:04–00:12 — завершение поля и настоящая награда; около 00:14 — переход в добровольный курс; 00:16 — принятая пара/«Далее»; 00:24–00:26 — Add/Undo и окончание курса; 00:27 — повтор/пропуск; конец — обычная Классика. Точные action timestamps находятся в provenance; второй блок повторяет сценарий в тёмной теме. Записи/синтетический ввод не доказывают субъективный phone feel.

## Оставшаяся приёмка владельцем

Код и автоматические browser/Android-emulator проверки отделены от физического телефона и живых игроков. FT01–03 в ledger остаются `IMPLEMENTED_UNVERIFIED`: пользовательская приёмка ещё не проведена. Нужен один короткий плейтест APK, без повторной разработки: обновить 12112 без очистки и проверить свою партию; на чистом профиле новичок без устных объяснений проходит первую задачу, сам открывает вторую и находит «Как играть». Проверить касания, Back/фон, обе темы, звук и вибрацию, баннер на своём телефоне. Понимание новичком, субъективное ощущение, live ads/revenue/retention — UNKNOWN.

PR40 остаётся draft; задачи не закрыты, merge и публикации игры нет. Новые механики/контент/SDK/дизайн не добавлялись. **KIT IMPACT: REUSE** — существующие FTUE diagnostic, UX & Art System, Stable Progress UI и общий renderer/motion; нет новых наблюдений оригиналов, SOURCE_FEATURES и runtime pins не менялись, CI кита не использовался.
