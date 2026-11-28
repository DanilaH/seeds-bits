# №48 · остаточная приёмка12110 →12111 · 28 ноября2026

Основание: [независимая приёмка12110, точная граница VA-06R/VA-02R/VA-04R](https://github.com/DanilaH/seeds-bits/issues/48#issuecomment-7237368017). База PR40 `ae8162ced66f9706d70c275d71b44a5a5845845e`, исполняемая12110 `6daea5abd6609008e2338476d81e24171714c50a`. Это собственные дефекты интерфейса «Семечек», не наблюдения оригинального Number Match.

| Требование | Исходное состояние и действие | Изменение и критерий |
|---|---|---|
| VA-06R | Дальняя подсказка на портретном телефоне/landscape, light/dark, RU/PT-BR. Нажать подсказку и переход ко второй цифре | Локальная пара `table-action-ink/table-action` в `src/visual-acceptance.css`. Реальные видимые glyphs/5raw hits; ≥4.5:1 в обычном/focus/pressed; видимый focus; настоящий переход к цифре171 |
| VA-02R | Точная independent `large` fixture:320×520, resume + parkedbook9, большие счётчики, резерв баннера, 5языков×2темы | Сокращены внешние отступы menu; specificity активной home-layout согласована с исходным :has-правилом; размеры и внутренние отступы hero сохранены; hit areas и 2×2 navigation сохранены. Все4нижние кнопки/glyphs/5hitpoints целиком в исходной видимой области, без scrollIntoView |
| VA-04R |568×320 lightRU Home «Продолжить»;844×390 darkPT-BR Classic «Desfazer» | Быстрое продолжение занимает всю ячейку; landscape footer даёт колонкам минимум по неразрывному слову. Range glyphs внутри own control и clipping ancestors; raw переход в книгу и pair/Undo. Dead-field primary568×320 остаётся целым/достижимым на5языках |

Продуктовый diff ограничен `src/visual-acceptance.css`; TypeScript/Android runtime, jars/motion/save authority, notifications, постоянный Settings banner, rules/content/economy/pins/paused experiments не меняются. QA: `e2e/visual48-residual.spec.ts`, отдельные пороги `scripts/check-visual48-residual.mjs` поверх неизменённого independent probe. Сбор и сохранение метрик сами по себе не означают PASS. Сравнение берёт неизменённую12110; тесты обязаны воспроизвести её дефекты и принять кандидата по порогам.

CI только DanilaH/seeds-bits: штатные6 workflows, полный offline/demo Android API35. Добавлена фактическая установка12110 →кандидат с сохранением histories/wallet999/2048receipts/pins/legacy opt-out; предыдущие12109/12108/12088 upgrade checks сохранены. Выдача preview12111 прежним сертификатом; публикации/merge нет.

Локальная предварительная проверка: production build PASS,193unit PASS,27 целевых browser PASS +23 проверок ui-audit12103 PASS (cached Chromium headless-shell; локальный отдельный recording ограничен отсутствием ожидаемого Playwright FFmpeg, штатная CI-проверка отдельно). Финальные exact-source CI, APK manifest/SHA256 и результаты будут закреплены в DELIVERY-12111.md. Телефон/live UNKNOWN: конкретная проверка — установить12111 поверх12110 без очистки, сверить меню/дальнюю подсказку обеих тем, затем финалы/банки/уведомления/Settings banner на low/mid Android. Субъективный feel/звук/вибрация отдельно от browser/emulator.

KIT IMPACT: NONE runtime; CANDIDATE QA-практика «метрики собраны» отдельно от утверждений известных порогов. Kitmain `a994dc7910fd50f198f892e64a8203b764a921c1`, game main `4f7a8f93e044cc5eb5f4dadceb8a0458b555cf08`, PR/ветки/AGENTS/decisions/status сверены; источник, inventory и pins без изменения. Route NONE для малого исправления; новых механик и sourceFeatureId нет.

Предварительный кандидат `d4565b4` прошёл27 целевых и известные independent-пороги, но полная регрессия выявила выход цифр мини-поля за карточку в10сценах320×568. В итоговом исправлении размеры/внутренние отступы карточки12110 восстановлены; место освобождается только внешними отступами. Существующие проверки не ослаблены, exact Home-тест дополнен own-bounds проверкой мини-поля.
