# Приёмка монетизации и помощи, 2026-11-13

Ветка `feat/monetization-assists-20261113`. Фактическая база `4d8943187567e20e178a86719d782c9ad3c06bc9`; изменения после исследовательской базы сохранены. Пакет относится только к Seeds. KIT IMPACT: NONE. Публикации и изменений mini-games-kit нет.

## Конфигурации

Общая основа C/A1/A2: закреплённый продукт/intent/receipt, durable grant до применения, автоматическая подсказка, готовность рекламы и измерение. Исходные шесть изолированных QA APK включают по одной дополнительной разнице. Позднее по явному поручению владельца добавлен общий `all` для ручного тестирования: [состав и границы](../help-combined-qa-2026-11-13.md). В исходных вариантах:

| Профиль | Единственный флаг | Назначение |
|---|---|---|
| a3 | visibility | Видео/+3 при исчерпанных обычных подсказках |
| magnet | magnet | Classic: проверенный Магнит |
| plan | plan | Classic: законченный план 2–3 обычных ходов |
| result | result | Общая рекламная проверка перехода в короткую задачу с результата |
| trials | trials | Отдельный лабораторный режим, mock earned |
| shuffle | shuffle | Отдельная лабораторная перестановка, mock earned |

Публичная сборка по умолчанию выключает все шесть. QA: `com.seedsbits.game.assistqa`, тестовая реклама, пустой ключ аналитики; исключение из коммерческой когорты. APK одного пакета устанавливаются по очереди и сохраняют заработанный запас. Это отдельный пакет от магазинной игры. Без remote config остановка уже установленного варианта требует совместимого обновления; мгновенного kill-switch нет.

Версии: обычные правила 1; save wire 6; meta 2; assistance/receipt 1; алгоритм bounded-help-v1. Лаборатории имеют свои version1 ключи и не дописывают shuffle-запас в production inventory. Старые wire2–5 читаются. Проверка старого клиента подтверждает его отказ на wire6, а не физическую установку старого Android APK.

## Проверенная автоматическая часть

Первый полный кандидат: `6a6b576`; финальный исходник APK фиксируется в manifest после добавления обычного хода в B4. Локальный финальный прогон: 105 unit-тестов, 35 целевых browser-сценариев, TypeScript/Vite build; полный отдельный regression15/15 после генерации heavy-save fixture. В CI все247 основных e2e и Android job прошли. Первое R10 ожидание до async-resume исправлено отдельным test-only изменением; эта правка не меняла код APK. Позднее в изолированный B4 добавлен обычный ход после перестановки. В CI дополнительно выполняются широкий browser/regression прогон, 43 проверки исходного native bridge с Android/SDK doubles и реальная Android/R8 сборка. Итоговые SHA, runs, результаты и контрольные суммы APK фиксируются в выдаваемом manifest; наличие этой таблицы не подменяет результат CI.

| Приёмка | Техническое доказательство | Статус автоматической части |
|---|---|---|
| A01–03 | `e2e/help-foundation.spec.ts`: +3 → точная подсветка/2 остаток, дубли/reload; native reward/pause guards | PASS |
| A04–08 | Browser recreation/failure injection + native N01/N11/N14/N15/N30–33/N37: durable receipt/grant/apply/ack границы | PASS |
| A09–14 | Старые/неизвестные продукты, stale attempt/board, legacy hints-only, бесплатный повтор; contract/progress/native tests | PASS |
| A15–20 | Обычное восстановление/без пар и unknown, readiness/deadline/late loaded, default-off A3, 320×568/568×320 с увеличенным текстом | PASS |
| M01–06 | Настоящий core и независимый replay; 39 подписанных synthetic fixtures, 13 проверенных офферов в первом прогоне; общий бюджет и unknown | PASS |
| M07–15 | Preview отказ, demo/заряд/reward, save failure, stale reward, точная отмена, entitlement/replay/лимит/reload | PASS |
| M16–20 | Отдельные assist/moves/highWater, sticky assisted, старые попытки, offline charge, flag-off сохранение прав | PASS |
| P01–04 | Текущая позиция, настоящий core, 2–3 шага/цель, отказ для тривиального ряда/unknown; отдельное сравнение available[0] | PASS |
| P05–11 | Один расход на весь путь, промежуточные состояния сохранены и повторно проверены, compaction, Undo/deviation/reload, stale charge, failed-save, прежние Notebook/Daily solver | PASS |
| D01–06 | Progress/history/analytics roundtrip, idempotency/application sequence, разные продукты и native allowlist (включая unknown=false) | PASS |
| D07–08 | Decimal/currency/precision, unknown ILRD, стабильный impression ID, один выбранный dataset; тесты offline export | PASS для кода/синтетики |
| D09 | Assignment без exposure, постоянный install/cohort/anchor, explicit context, тестовый join | PASS для кода/синтетики |
| D10–13 | QA исключение, окна168/192ч, нет победителя при неполных данных, выключение офферов сохраняет запас/права | PASS для кода/синтетики |
| A4 | Шесть новых + 11 прежних рекламных browser-сценариев; shared cooldown/reward suppression в native N07–12; result event N41 | PASS |
| B3 | Три полных core-witness в2 Add; 4 unit +3 browser, остановка/bonus/Undo/reload/stale; native lab commit N42–43 | PASS как лаборатория |
| B4 | Multiset/count/width9/обычная пара, bounded worker, fixed preview/отказ/Undo/replay/mock receipt;4 unit +4 browser | PASS как лаборатория |

Поиск Магнита:128 кандидатов /4000 узлов /120мс, worker1с hard stop; 1800 логических клеток — guard, не измеренный телефонный FPS. План использует тот же общий бюджет. Shuffle:128 перестановок /120мс, worker1с. `unknown` не означает отсутствие решения и не разрешает продажу.

Команды воспроизведения:

```
npm test
npm run build
npx playwright test
python3 scripts/regression-061/native-harness.py
node scripts/build-help-fixtures.mjs
node scripts/verify-help-fixtures.mjs
node scripts/compare-help-plans.mjs
node scripts/verify-help-labs.mjs
python3 scripts/test-help-report.py
```

Нативный harness требует javac; локально его нет, эта часть запускается в Android CI. Браузерные видео записаны в Chromium headless shell 390×844 и явно не являются записью физического Android. Синтетические позиции и SDK doubles не доказывают частоту потребности в помощи.

## Непроверенная физическая и коммерческая часть

| Проверка | Статус | Чего не хватает |
|---|---|---|
| Реальное rewarded earned/close, Android process kill и восстановление на телефоне (A01–13/M10/P08–09) | BLOCKED | Доступного физического Android/живой SDK-сессии в этой среде |
| Телефонный FPS/паузы/баннер/крупный системный шрифт и landscape | BLOCKED | Замеров на устройстве; browser geometry проверена отдельно |
| SDK → AppMetrica кабинет/экспорт, monetary join и выбор automatic/manual (D07–09) | BLOCKED | Физической платной трассы и доступа к фактическому кабинету/экспорту |
| Audience pilot | NOT RUN | Нет запущенной аудитории; все новые публичные флаги выключены |
| Выручка, R7, D1/D7, взаимозамещение форматов и продуктов, понятность/удержание B3/B4 | NOT RUN | Реальных зрелых когорт; коммерческий эффект неизвестен |

Offline report сохраняет исходный assigned-install denominator, разделяет new/existing, деньги по валютам/форматам, воронку продуктов, первый short-task переход и причины пропуска. R7 окно[0,168ч), D7[168,192ч); неполные деньги не заполняются нулём, automatic/manual не суммируются. Стабильный event_id/impression_id дедуплицируется. Пример отчёта — синтетика, не данные игроков.

Перед живым пилотом нужны один проверенный сквозной trace, фактическая базовая дисперсия/MDE/допустимый вред удержанию/срок и правило решения. Произвольного размера выборки и заявления о «росте денег» нет. Потеря/дублирование награды, повреждение save, late mutation чужого поля, блокировка Add/Undo или тяжёлая задержка — основания остановить вариант. Откат должен читать wire6 и сохранять уже earned права.
