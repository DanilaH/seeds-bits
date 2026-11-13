# Источники и границы выводов

Проверено 13 ноября 2026. ТЗ — продуктовые решения и требования к будущей реализации. Оно не утверждает, что Магнит или стратегический план уже есть в игре или доказанно увеличивают доход.

## 1. Репозиторий и воспроизводимая база

- Репозиторий: https://github.com/DanilaH/seeds-bits
- Проверенный release commit: https://github.com/DanilaH/seeds-bits/tree/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9
- Ветка: `release/rustore-1.1.2`.
- На дату проверки remote `main` был `4f7a8f93e044cc5eb5f4dadceb8a0458b555cf08`; release ref оставался на указанном SHA. Это сверено через `git ls-remote`, не предположение по README.
- `README.md` и `docs/STATUS.md` говорят о подготовленном APK 1.1.2/1102101, а не о доказанной публикации/живой выручке.
- В release отсутствуют `AGENTS.md` и `docs/kit-guidance/TASK_ROUTER.md`. Агентский контракт найден в более старом main. Это различие намеренно отражено в START_HERE/TASK.

## 2. Карта кода

Ссылки закреплены на проверенном commit. Номера строк в исследовательских заметках не используются как вечные координаты: находить актуальные функции по именам.

| Факт / область | Источник |
|---|---|
| Текущее состояние и ограничения проверки релиза | [README](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/README.md), [STATUS](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/docs/STATUS.md) |
| Девять столбцов, pair rules, row compaction, Add, история | [src/core.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/core.ts): `checkPair`, `pairs`, `removePair`, `addNumbers`, `commit` |
| 3 hints/attempt, повторы, wallet +3 и дедуп receipt | [src/hint-budget.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/hint-budget.ts) |
| Intent-место, offer/reward UI, pause/cancelHint, переходы результата | [src/main.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/main.ts): `hint`, `receiveReward`, `syncPauseState`, `playNextClassic` |
| Контракт bridge, receipt без product на базе | [src/monetization.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/monetization.ts) |
| Solver fixed puzzles, unknown, worker/recovery | [src/solver.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/solver.ts), [src/advice-worker.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/advice-worker.ts), [src/advice-client.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/advice-client.ts) |
| Доказательства стартов, ограниченный поиск с Add | [src/classic-generator.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/classic-generator.ts) |
| Save wire5, validation, attempts, unassisted | [src/progress.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/progress.ts), [src/history-codec.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/history-codec.ts) |
| Банки и защита от Undo-фарма по high-water | [src/jars.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/jars.ts) |
| Durable event allowlist, 12 полей, local enqueue | [src/analytics.ts](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/src/analytics.ts) |
| Native preload, receipt commit/ack, 180sec interstitial, show/earned/report | [native/android/SeedsMonetizationPlugin.java](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/native/android/SeedsMonetizationPlugin.java) |
| Уже существующий денежный AppMetrica report | [native/android/SeedsAdRevenue.java](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/native/android/SeedsAdRevenue.java) |
| Build/test команды и runtime dependencies | [package.json](https://github.com/DanilaH/seeds-bits/blob/24ae94ffbe4a2652b8e3ce410c6e15d74ef251d9/package.json) |

`docs/MOBILE-MONETIZATION.md` содержит более старые детали UI/баннера. Для фактического текущего поведения приоритет имеют свежий STATUS и код native, а не историческая цифра размера баннера из документа.

## 3. Первичные внешние материалы

### Easybrain / Number Tiles

[Официальная справка о boosters](https://numbertilesios.easybrain.com/hc/en-us/articles/9358400076186-How-do-I-use-boosters), обновление 10 июня 2025; открыта при подготовке этого пакета 13 ноября 2026.

Подтверждает наличие разных действий помощи в игре с сопоставимым сопоставлением цифр: удаление одной плитки, превращение существующей плитки в wildcard, перестановка, дополнительный ряд и подсказка. [Справка о coins](https://numbertilesios.easybrain.com/hc/en-us/articles/9358387619610-How-do-I-get-more-coins) описывает получение монет за уровни и покупку в магазине для расходования на помощь.

**Вывод для Seeds:** разные виды помощи — реальная продуктовая конструкция, которую имеет смысл адаптировать. Магнит из двух совместимых цифр — наша гипотеза, а не установленная механика этого конкурента. Эти страницы не раскрывают uplift отдельных бустеров, прибыль, рекламную экономику, алгоритм оптимальной подсказки или частоту её использования. Не утверждать, что Number Tiles финансирует каждый такой бустер rewarded, на основании справки про coins.

### Yandex Ads: деньги отдельного impression

[Официальная документация ILRD](https://ads.yandex.com/helpcenter/en/dev/android/impression-level), открыта 13 ноября 2026.

Описывает `onImpression`, данные о выручке, валюте, точности и сети. Это основание хранить значение и его качество, а не подставлять средний eCPM в неизвестные показы. Документация по ссылке сейчас относится к SDK8; при реализации сверить фактически установленный SDK и его API, не обновлять dependency только из-за версии страницы.

### AppMetrica: автоматическая синхронизация

[Официальная документация интеграции Ads SDK](https://yandex.ru/support/appmetrica-io/en/common/ads-sdk-integration), открыта 13 ноября 2026.

Описывает включаемую в кабинете синхронизацию и автоматические ad events, включая денежные поля impression. В сочетании с уже существующим ручным AdRevenue в Seeds это требует выбрать канонический денежный dataset для отчёта. Факт включения синхронизации в конкретном кабинете этим исследованием не проверен; двойной учёт не объявлен установленным багом.

## 4. Что проверено в этом пакете

- Прочитаны указанные исходники release и сверены remote refs.
- Независимо проверены три направления: текущий rewarded/measurement, глубокие механики, порядок измерения/rollout.
- Воспроизведён маленький синтетический пример Магнита на реальном `src/core.ts`. Все обычные ходы до/после эффекта проверены настоящим core. Сам специальный переход — предлагаемое правило.
- Подготовлена спецификация; production-код игры в рамках этой работы не менялся.

## 5. Что этим не доказано

Нет подтверждённого uplift, реальной частоты коммерчески полезных состояний, полномасштабного competitor teardown, статистически достаточного A/B, факта публикации APK или доставки нынешней сборки в рекламный кабинет. Видеозаписи игрока не подменяются синтетическими fixtures. Исторические малые/неидентифицированные и QA-когорты не используются как доказательство спроса.

Числа «1 Магнит на попытку», «1 video = 1 charge», «до 3 ходов плана», «2 Add в Испытании» — выбранные стартовые параметры этого ТЗ. Их нужно проверять, не ссылаться на них как на отраслевой стандарт.
