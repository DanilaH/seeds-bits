# Menu & Reward Feel · №46

База: PR40, runtime125606e4a90e06b844fe6eb8f83249032cb7057f / подписанный12106. [ТЗ №46](https://github.com/DanilaH/seeds-bits/issues/46), [независимый аудит](https://github.com/DanilaH/seeds-bits/blob/2eb82e36556e45ab230cf37b6f5ab3977e7aada8/docs/research/menu-reward-feel-2026-11-27/README.md). Это собственный UX «Семечек», без утверждений о Number Match.

## Причины и реализация

| MF | Причина / изменение | Проверка |
| --- | --- | --- |
|01|renderJar удерживал полную банку только в header; result считал следующий jarState, spill имел жёсткий header target. Теперь один визуальный итог для обеих банок, flight и закрытие направлены в фактическую result-jar. Старая банка показывается полной до закрытия крышки, затем новая с точным остатком. При объединённых порогах виден диапазон номеров. | Frame trace полная24/24, actual target, итог2/60; Classic24→0/60; отмена и durable state. |
|02|resultKind читал только done и последний уникальный id. complete теперь захватывает новизну до recordCompletion и сохраняет значимость только для этой Session. Replay/restore — обычная задача; экономика прежняя. | Точный последний член страницы/тома, произвольный порядок, reload, repeat. |
|03|WAAPI завершал тетрадь на rotate(-5deg) поверх upright CSS. Все внешние keyframes теперь используют статическую позу конкретного результата. | Промежуточные матрицы, итоговая поза/закладка. |
|04|Трёхколоночный Home ломал слово; language принудительно занимал100dvh; коллекция была ниже статистики. Слова цельные, число колонок учитывает размер текста; jar-hero Прогресса — настоящий button со смысловым label, старый текстовый путь сохранён; язык — content-height modal с внутренней прокруткой и доступным закрытием. |5 языков ×2 темы ×3 viewport ×100/150/200% browser text; raw taps. Android по решению владельца сохраняет WebView textZoom100 при native font100/150/200. |
|05|Роуты имели один общий fade; локальные переключения обходили его. Визуальные дети предметов прижимаются без изменения hit target; OwnedDomMotion управляет раскрытием/возвратом/локальной сменой страницы и модалями. | Быстрые изменения/Back/cancel/reduced/background; focus и scroll остаются семантическими. |
|06–07|Одновременно затухали win и paper; три независимых праздника давали до86 эффектов. Убран внешний fade; читаемый результат → новая медаль → прилёт/банка. Task/page/book/Classic/daily используют разные существующие иллюстрации и короткие акценты. Только новая медаль/банка получают свой согласованный foley/haptic; ограничено12 частиц одного этапа,8 у Classic; коллизии и stale callbacks отменяются. | Все5 видов результата,3 металла, delayed/failed commit, Next/background/resize/reduced, peak particles. |

## Контракт

RecordCompletion/collectPair, экономика, wire, история, ревизии раскладок, Core Feel поля, рекламные gates и шесть paused flags не менялись. Последний Classic pair переносит свои прежние+2 в result presentation после commit; дополнительного начисления нет. Анимация/таймер/звук не подтверждают запись и не блокируют управление. При навигации/фоне/resize/reduced motion отображается точный durable итог, устаревшая последовательность не возобновляется. Коллекция при открытии даёт только settle, не «заработано».

Применены UI Motion Recipes, Owned DOM Motion, Stable Progress UI и Tier Progress из kit; установленный owned-dom-motion/value-transfer pin неизменён. Повторно применяются существующие API, не новый общий runtime. KIT IMPACT — REUSE. Общий kit не менялся.

## Приёмка и медиа

`e2e/menu-reward-feel.spec.ts` проверяет реальные компоненты и кадры, включая сохранение под настоящим Web Lock и ошибку записи; `tests/result-presentation.test.ts` — новизну milestones. Исходный11-сценарный `scripts/independent-menu-feel.mjs` сохраняется отдельно и запускается на12106 и новом runtime. Его таймеры — выборка движения, не save barrier.

`record-menu-reward.mjs` повторяет рецепт Core Feel recorder: реальные CDP frames с timestamp и живой application WebAudio mix через MediaStreamDestination; звук не подменяется дорожкой. Четыре сцены: jar/task, новый том, новая медаль+банка, навигация. Для каждого before/after записываются MP4, actual tap times/audio offset и source. Это desktop Chromium с синтетическими сохранениями, не Android audio capture и не физический телефон. Контейнер60fps не является доказательством60fps рендера; фактическое число кадров сохранено в recording.json.

Локально TypeScript/web build и173 unit PASS. Перед выдачей требуются полный project CI, новый focused gate, исходный динамический аудит before/after, звуковые записи, native demo/offline на точном итоговом SHA и подписанный preview12107. Точные final runs, source и APK SHA закрепляются в PR40/выдаваемом протоколе. Физический телефон, оценка ощущений/вибрации в руках, TalkBack и аудитория UNKNOWN.
