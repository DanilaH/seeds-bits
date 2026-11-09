# 1.1.0 — рабочая запись, 8 ноября 2026

Хронология реализации согласованного UPDATE_PLAN_2026-11-08.md. Промежуточные состояния ниже сохранены как запись работы; окончательный результат и ограничения находятся в [REPORT.md](REPORT.md), параметры выдачи — в [apk.json](apk.json).

Внесены: wire v5 / meta v2 / jars v2; миграция остатка бонусных подсказок в общий запас; повтор подсказки на прежнем поле; вклад первого уникального прохождения задачи в банку; предел поздней банки 480 вместо 2000 с сохранением индекса, доли и lifetime seeds; схематичная градиентная насыпь; серия дней с +1 на 3 и +3 на кратных 7; календарный UI; локальный Android reminder; RuStore review SDK; безопасные коды сохранения; восстановление насыщенного звука; roving Tab; минимальные события обучения и новых функций.

Локальная исходная база: 45 unit tests. После модельных изменений: 52 unit tests и production web build прошли. Первый браузерный прогон: 99/104. Четыре регрессии межвкладочного CAS из-за записи счётчика сеансов при boot исправлены; пятая проверка ожидала прежнюю wire v4. Все пять целевых повторов прошли. Полный финальный прогон, новые e2e, нативная компиляция и Android/SDK-проверка ещё не завершены.

Для локального Playwright работает SEEDS_CHROMIUM=/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell. Полный Chromium завершается на запрещённом Unix socket; это ограничение окружения не относится к работающему headless_shell. В среде есть JRE, нет javac/Android SDK; Android проверяется GitHub Actions.

Осталось: проверить/исправить новые e2e и regression-061, Android compile и harness; независимо пройти миграцию/ошибки/залипание внешних окон; обновить реальные магазинные кадры и крупные подписи, описание/политику; подготовить VK checklist по текущей AppMetrica; собрать и подписать стабильным RuStore ключом; проверить upgrade, размер и запуск; выдать APK без ZIP и материалы с отчётом. Результат живой рекламы, RuStore review и доставки уведомлений на физическом телефоне не установлен одним наличием кода.

Баланс задач: первая уникальная победа даёт min(24, max(4, ceil(число_пар/4)*2)) семечек. Старые done не доначисляются. Серия учитывает только сегодняшнюю задачу, завершённую в её местную дату; допуск после полуночи не вводится. Архив и повтор не повышают серию. Данные о реальном времени прошлых побед отсутствуют — историческая серия не изобретается.

Причина трёх реальных save_error (conflict=false) из пользовательского отчёта пока неизвестна. Добавленные коды и воспроизведённые отказы/retry не доказывают устранение этой неизвестной причины.


Промежуточное подтверждение: GitHub Actions Check and build, run 42473680603, source 778360ad4f3c9ea6b9b0a60489a3687966f0bef8 — web и Android success. Прошли основные 114 браузерных сценариев (104 прежних + 10 новых), regression-061 и native harness, debug Android с RuStore Reviews 10.5.2. После этого внесены отдельные уточнения: координация pending rewarded со сменой режима, безопасный cold/warm entry, компактнее календарная серия, маршрут к системным настройкам после отказа, денежный Ad Revenue и выпускные проверки/материалы. Для этого состояния требуется повторный CI и релизный прогон.

Восстановлены и локально проверены исходный опубликованный APK 1.0.0 (5 455 824 bytes, SHA256 8771007d50242d2a7dde91a8f33a2ccf66f79d0c41ec01ab8ba7f1928e2b136a) и постоянный сертификат подписи ca2f9ae57a84bba5cc5b844aee65515a88bfde83fe3b5a85ae4d189b6cf8bfe1. Приватные материалы находятся вне репозитория и не публикуются. Новый подписанный APK ещё не готов.

Форма оценки готовится отдельным неблокирующим запросом; если игрок продолжил партию, подготовленное окно не открывается поверх неё. Уведомления после отказа имеют явный переход к системным настройкам. Релизный workflow собирает старую 1.0.0 из опубликованного исходника и проверяет UI-сохранения при install -r новым payload под единым временным сертификатом; постоянная подпись выдаваемого APK проверяется отдельно.

Дополнительная нативная проверка: напоминание подавляется и поверх нашей полноэкранной рекламы/формы оценки, когда game Activity временно paused. Нативные флаги освобождаются после закрытия/уничтожения; harness расширен N20–N21. Требуется повторная сборка точного исходника после этой правки.

Проверка измерений: фоновый локальный receiver не активирует AppMetrica и не отправляет reminder_posted. Аналитика активируется при создании MainActivity до загрузки плагинов. Учитывается открытие из уведомления, а не фоновая доставка как возвращение игрока. Магазинный fixture согласован: шесть дней серии отмечены в календаре, рекорд соответствует этим дням, highWater соответствует реально достигнутой глубине демонстрационной партии.

Повтор уведомления при переводе даты назад: доставка подавляется и для даты раньше последней показанной, а не только при равенстве. Это сохраняет ограничение одного напоминания на дату при возврате часов.

Новый сценарий отказа сохранения дейлика подтвердил атомарность результата/серии/wallet и нашёл застывшую надпись «Награда ожидает сохранения» после успешного retry. Исправлено обновление итогов и после отказа, и после подтверждения записи. Добавлен постоянный браузерный сценарий с reload и проверкой однократного начисления. Таймаут загрузки Gradle при сборке старой базы увеличен с 10 до 60 секунд; изменение относится только к CI.

Итог: source 96fa9f024e4aeb3a35377af64cd212bc0769c471, Check and build 42476783425 и release 42476785180 — все job success. 52+2 model, 117+15 browser, 21 native; upgrade и fresh offline Android 35 прошли. APK подписан постоянным сертификатом, 5 492 856 bytes; подпись/payload/ресурсы/manifest проверены. Полный итог и честные ограничения вынесены в REPORT.md.

## Уточнение напоминаний — 9 ноября

По прямому решению владельца изменён default с false на true в интерфейсе, загрузке старых настроек и Android-планировщике/receiver. Сохранённое false не перезаписывается. На Android с ещё не выданным разрешением однократный запрос следует после сохранённого результата сегодняшнего дейлика; архив, обучение и старт приложения его не вызывают. В настройках показано ожидающее разрешение и доступна отдельная кнопка. Отказ выключает настройку, явное отключение сохраняется. Попытка запроса сохраняется до системного окна; после ошибки сохранения запрос не открывается, после успешного повтора результата можно запросить разрешение. Ближайшая межстраничка пропускается, окно оценки рядом не показывается.

Прежние `apk.json` / `deliverables.json` описывают 1100015 со старым default. Доказательства пересборки этой правки фиксируются отдельно.

Пересборка уточнения завершена: runtime 9e77388, APK 1100016 с прежним сертификатом; проверена точность assets и live-конфигурации. CI 42594977634 и все четыре задания release 42594980301 прошли, включая обновление и чистую установку Android 35. См. `default-reminders/REPORT.md`, `apk.json`, `checks.json`, `deliverables.json` в том каталоге.

## 9 November 2026 — feel build 1100017

Native haptics adapted from Road Lines, pointer feedback with stable hit areas, shared saved-reward flights and full-jar presentation, once-only victory after persistence, precise undo and bounded large-field animation. Runtime `192cf9dcf0772d8d7342c974c73a17d15ae9d233`; both check jobs and all four release jobs passed. Signed APK 5 501 048 bytes; three GIF/MP4 examples delivered. See [feel report](feel/REPORT.md). Physical motor intensity remains unmeasured.

## 9 November 2026 — stable layout and metal medals, build 1100019

Separated hint/add counters, fixed jar-caption geometry through 100%, notebook landscape columns and classic labels, enlarged-text home/progress, result reward rows and primary-action visibility. Three independently filling monthly medals share presentation across results/calendar/collection; a new saved tier gets a bounded local pop/confetti, without replay on restore. Runtime fcad2f0 passed 52+2 model, 144+15 browser and 21+16 native harness checks; 184 extra layout states passed. APK signed with the existing production certificate, 5 501 048 bytes. Native acceptance selectors updated to recognize exact old/new hint labels and verify the already-built payload hash, without another app build. Final native evidence and deliverables: [gold report](gold/REPORT.md).

## 9 November 2026 — one large medal, build 1100020

One filling medal replaces the triplet in results, calendar and each collection month. Boundaries retain the earned tier, next completion shows the following target, captions preserve previous tiers. The daily result drops its redundant green success circle to keep the primary action visible. Runtime 05d642c: 52+2 model, 145+15 browser, 21+16 native harness; all four release-20 jobs including fresh/upgrade Android acceptance passed. Signed APK remains 5 501 048 bytes. One actual-UI GIF/MP4 delivered. See [single medal report](single-medal/REPORT.md).


## 9 November 2026 — colourful celebration and explicit next medal, build 1100023

A stronger local pop/sheen with 32 white, gold, coral, blue and lilac rectangular/diamond/strip pieces replaces the quiet monochrome burst. An external navy receipt keeps the check readable; a small next-goal card shows the following metal and remaining tasks, with a stacked layout on narrow screens. Final gold declares the monthly collection complete. The badge entrance has no pre-animation flash; small light-theme captions meet 4.64:1 contrast. Runtime cb95493: 52+2 model, 145+15 browser, 21+16 native harness; all four release-23 jobs and fresh/upgrade Android acceptance passed. Signed APK remains 5 501 048 bytes with the existing certificate. One new actual-UI GIF/MP4 delivered. See [celebration report](medal-celebration/REPORT.md).
