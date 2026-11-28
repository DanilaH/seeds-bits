# №49 · финальный UI/UX/Feel ·12111 →12112

Основание: [№49 UF01–06](https://github.com/DanilaH/seeds-bits/issues/49), [согласованный UF06](https://github.com/DanilaH/seeds-bits/issues/49#issuecomment-7237667847), [остатки №48](https://github.com/DanilaH/seeds-bits/issues/48#issuecomment-7237368017). Собственный интерфейс «Семечек», не новое наблюдение Number Match. База — актуальный PR40 `f7f30fe9fe1bcd7e8b3b1b6f0121c82b219a307f`; её полный CI и подписанный12111 закреплены в [предыдущей приёмке](../visual-residual-2026-11-28/DELIVERY-12111.md).

| Требование | Сценарий → ожидаемый результат | Код / доказательство |
|---|---|---|
| UF01 | Home Classic/book/today/archive/fresh/completed,320×520 и выше, полный5s sweep/press/resize → jar и её края доступны отдельно от Resume | final-ui.css резервирует верхний swept edge; landscape колонки сохраняют геометрию; final-ui49.spec.ts реальные hitpoints и9 фаз |
| UF02 | Три режима в одном ряду → общий слот иллюстраций и первая строка заголовков; настоящие вторичные CTA на одной линии, Classic без лишней кнопки; навигация рядом | final-ui.css; все5языков×2темы×6размеров, собственные кадры |
| UF03 | Progress/Help/Settings/Language → существующие16px SVG +12px читаемая подпись,44px hit target; header согласован по толщине штриха | final-ui.css; raw center/edge hitpoints, остаточные27проверок №48 |
| UF04 | Книги/каталог/календарь/месяцы/медали/jars/settings/language/results → сохранить выбранные/начатые/завершённые/earned состояния и переносы | существующие ui-audit12103/quiet-polish/visual48/gold-layout/markets, неизменённые независимые style/visual probes; усилена контрастность подписей Home |
| UF05 | Переходы/Back/focus/scroll/ranges/tabs/months/modals/fullscreen/background/resize/reduced motion → немедленная реакция, отмена чужих эффектов, durable наградная последовательность | существующие ui-motion/menu-reward-feel/feel/stability/native tests; исходные runtime pins, звуки и наградные реализации сохранены |
| UF06 | Сегодня unplayed → terracotta calendar +7px dot, только dot2×2s+6s pause,scale1.12; started → статично+Continue; durable done → статичный зелёный✓+Solved/replay | home-daily.ts снимок существующих done/sessions/accepted attempts; main.ts публикует на save ACK, повтор использует done; final-ui.css псевдоэлемент стабильного слота; final-ui49.spec.ts pending/fail/retry/replay/date/pause/reduced |

Дополнительный таймер не вводится: используется прежний refreshDate/visibility/focus/native lifecycle. Метаданные мерцания не сохраняются. Отдельно захвачена серия daily в том же durable snapshot, поэтому её подпись не опережает запись. Предзагруженный session без принятой попытки/игровых действий/активного выбора не считается начатым. Готовая галочка определяется существующими dailyDone aliases, даже после повторного запуска поля.

Банки, reward authority, Core Feel, экономика, уроки/контент, реклама/постоянный Settings banner, Android reminders и6приостановленных экспериментов не переделываются. JSON wire10 и prefs без новых полей. №48 visual-acceptance.css сохранён. Публикации/merge нет.

CI — только seeds-bits: шесть существующих workflows, полный Check/build, целевой visual/durable с UF49, unchanged independent12110 probe с порогами, functional47, repeated storage45, preview с offline/demo Android35 и прежним постоянным сертификатом. Добавлено фактическое обновление12111→12112 к сохранённым12088/12108/12109/12110. В upgrade harness APK подписываются общим временным CI-ключом; постоянный сертификат выдаваемых APK проверяется отдельно.

Видео: record-final-ui49.mjs записывает исходные кадры по реальному времени,12s для каждой темы — полный10s цикл и начало следующего, три состояния и реальную навигацию. Сравнение с неизменённым12111, плюс исходное12106/12109/12112 с настоящим WebAudio. Кодек fps не означает частоту физического телефона. PNG — реальные кадры приложения.

Локальная проверка:195unit и production build PASS; целевые проверки и полный CI фиксируются в DELIVERY-12112.md после завершения. Телефон/живая аудитория UNKNOWN: установить подписанный12112 поверх12111 без очистки, проверить обе темы/5языков на low/mid Android, трёхстатусный дейлик/смену дня/permissions, награды/банки/фон/Settings banner/звук/вибрацию. Эстетическая оценка владельца и feel на телефоне остаются отдельной финальной приёмкой.

KIT IMPACT: REUSE — UX & Art System и UI Motion Recipes, существующие компоненты/токены/lifecycle/owned motion. Нового generic API/изменения kit нет. Сверены kitmain a994dc7, game main4f7a8f9, рабочие/релизные ветки и открытыеPR; runtime pins неизменны. Source inventory/reference механики не менялись.
