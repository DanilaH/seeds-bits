# Preview 12105: техническая приёмка №45

Основа — принятый Quiet Table 12104, PR40, `feat/quiet-table-20261126`. Работа от main не велась. Пакет `com.seedsbits.game.preview`, версия1.1.2, versionCode12105; постоянный сертификат preview `ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30`. Подписи v2/v3 и zipalign проверяет job sign-preview; временным ключом подписываются только отдельные эмуляторные acceptance APK.

## Причины и результат

| Условие №45 | Причина | Исправление и инвариант |
| --- | --- | --- |
| QT-ACCEPT-01,26→reload→28 | UI показывал оперативный ход раньше async commit; исходная fixture не перезаписывала сохранённый ход | Явные pending/failure, подтверждение только последней записи. Быстрый ввод остаётся синхронным. После durable acknowledgement точное поле26, moves1, Undo и награды переживают reload/process death. До commit прежнее durable28 допустимо только при явно pending UI. |
| QT-ACCEPT-02, пустая новая Классика | Helper читал completed старого attempt до завершения уже атомарного beginClassic | Ожидание нового durable attempt и окончания перехода. Exact board24/28/32, moves0/history0, completed6 и wallet/meter не изменяются. Повторный click, failed write и Retry проверены отдельно. |
| QT-ACCEPT-03, raw48px | Смешивались новая origin root и прежний layout host. RPC не соответствовал drawn frame | Отдельные layout-request/preDraw/draw с insets, pending layout и двумя часами. Physical continuity assertions усилены per-draw movedFrames; реальное позиционирование/рекламная политика не менялись. |

Полные исходные сценарии, затрагиваемый код и границы утверждений: [README](README.md). Наличие кода, эмулятор и телефон не смешиваются.

## Проверки

Реализация `aefeb1bcc5eeb1768255540855da56a606812c9f`; следующий QA-only `62ee0c2a7ce8cde1bd69d513802e90e58eda0546` исправляет ожидания Home resume. Исходник, versionCode и SHA256 **выдаваемого** APK указаны в `source.json` и `SHA256SUMS` его signed artifact. После коммита этого отчёта gates повторяются на точном HEAD; итоговые прямые ссылки и hash закреплены в [PR40](https://github.com/DanilaH/seeds-bits/pull/40). [Последние прогоны рабочей ветки](https://github.com/DanilaH/seeds-bits/actions?query=branch%3Afeat%2Fquiet-table-20261126).

| Проверка | Источник и фактическая граница |
| --- | --- |
| Общий CI игры | [45864388063](https://github.com/DanilaH/seeds-bits/actions/runs/45864388063), aefeb1b: 172 unit + 2 model, 15 browser regression, 551 e2e, web/Yandex и Android build — PASS. |
| Управляемые storage/atomic/resume | [45866037928](https://github.com/DanilaH/seeds-bits/actions/runs/45866037928), 62ee0c2: 140/140 управляемых сценариев,40/40 исходных reload/New Classic и40/40 focus/landscape — PASS. Отдельный отрицательный сценарий на старом runtime12104 намеренно FAIL: UI26 при durable28 и отсутствующем pending. В неизменённом natural baseline18/20 PASS и2/20 исходных FAIL26→28; это воспроизведение дефекта12104, а не failed release gate. |
| Повтор общего CI с исправленными helper | [45866037951](https://github.com/DanilaH/seeds-bits/actions/runs/45866037951), 62ee0c2: 552/552 browser e2e,172 unit,2 model,15 regression browser, web/Yandex и Android build — PASS. Runtime игры не менялся. |
| Browser/visual preview | [45864381070](https://github.com/DanilaH/seeds-bits/actions/runs/45864381070): 38 первого сеанса + 19 рынков + 19 Core Feel; 161 visual test и 145 кадров — PASS. |
| Android offline | [45864381070](https://github.com/DanilaH/seeds-bits/actions/runs/45864381070), aefeb1b: 20/20 process-death + Undo циклов — PASS; upgrade12088→12105, Wire10, поля/история,108 цифр, hint repair, reach и11 native appearance состояний — PASS. Старый Expert-пилот остановился на чтении XML сразу после визуального Undo90: получил ещё88. В итоговом драйвере добавлены durable barrier и classic-pilot-durable.jsonl, exact board assertion сохранён; полный повтор на итоговом HEAD обязателен перед выдачей. API35 / WebView124, не телефон. |
| Android native demo | [artifact15139982808](https://github.com/DanilaH/seeds-bits/actions/runs/45864381070/artifacts/15139982808), aefeb1b: PASS. 260.033с непрерывной записи; hiddenFrames0/movedFrames0, genuine interstitial, genuine rewarded, durable reward0→3, один receipt и подтверждённый ack. |
| Постоянная подпись | job sign-preview в том же CI: package/version, zipalign, сертификат и v2/v3 — PASS. Неподписанный/debuggable acceptance APK отдельно от телефонного signed release. |

Нативное видео `markets-android/banner-continuity.webm`, исходное, без монтажа; JSON рядом содержит host ms и native uptime отдельно. Таймкоды относятся **к artifact15139982808**, не к повторным запускам:

| Время | Действие / наблюдение |
| --- | --- |
| 00:19.390 | Первый подтверждённый painted banner, request1. |
| 00:26.633–00:39.910 | Поле→результат→поле→Home→тетрадь→каталог→тетрадь→Home; тот же view/request. |
| 00:40.059–00:43.108 | Языковая модалка поверх Home, баннер непрерывен. |
| 00:46.840–00:54.362 | Смена темы через настройки и background/foreground; ожидаемое скрытие настроек/фона учитывается отдельно. |
| 00:55.740–00:59.820 | Android uiMode и WebView reload. Raw1124/layoutPending → draw1076 в nativeMs90455; подтверждённого видимого сдвига нет. |
| 00:59.913–01:06.019 | Реальный resize: один новый view/request2; painted creative проверен по пикселям. |
| 03:06.192–03:07.966 | Защищённый первый вход: interstitial не запрашивается, баннер остаётся. |
| 03:11.742–03:38.646 | Настоящий interstitial скрывает banner; видимые Next и Close нажаты реальным ADB input; SDK возвращает управление, тот же banner request2. |
| 03:39.107–04:18.967 | Настоящий rewarded; SDK выдаёт receipt, wallet0→3 на04:18.624, token сохранён один раз и ack очищен; banner возвращается. |
| 04:20.016 | Возврат в Home, последний замер, hiddenFrames0/movedFrames0. |

Два дополнительных исходных flaky теста большого поля не скрыты: push [45864381099](https://github.com/DanilaH/seeds-bits/actions/runs/45864381099) дал549/551, PR run того же SHA —551/551. Причина и детерминированная проверка inert/commit изложены в README; после исправления helper исходные focus9 и cell539-in-viewport assertions повторяются20 раз каждый, без sleep или retry-until-green.


Итоговый подписанный APK выдаётся только после полного зелёного повтора **всех** перечисленных gates на одном HEAD. Версия из промежуточного artifact не является выданной сборкой. Прямые ссылки на итоговый CI и контрольная сумма публикуются в PR40 и сопровождающем отчёте сборки; source.json исключает смешивание ревизий.

## Телефонный плейтест

Физический телефон UNKNOWN; следующая проверка — установить подписанный12105 поверх12104, сохранив данные. Удалить пару, дождаться исчезновения «Сохраняем ход…», сразу закрыть процесс и открыть: точное поле и Undo должны сохраниться. Повторить с «Добавить» и «Отмена». Завершить Классику и начать новую: непустое поле, один учтённый финал, без повторной награды. Проверить баннер при поле→результат→меню→тетрадь/каталог→назад, языковой модалке, фоне/возврате и после доступного SDK fullscreen. Не удалять данные приложения для этого плейтеста. Звук/вибрация, TalkBack и живая аудитория также UNKNOWN.

Стиль №43, подсветка №44, права игроков, Wire10, ревизии назначенных полей, генератор, экономика и шесть выключенных экспериментов сохранены. KIT IMPACT — REUSE; draw-aligned diagnostics остаются CANDIDATE для общего QA контракта из «Стрелок».
