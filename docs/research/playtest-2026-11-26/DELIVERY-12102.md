# Приёмка preview 12102

Source: `f69dce32a7c0a491c02a1ad7fbb4abf0a4a1bd5c`, PR40.

158 unit PASS; 62 целевых browser PASS; после последней правки основной кнопки — 31 сценарий playtest-followup PASS. Production TypeScript/Vite build PASS. Ни одного изменения правил пар, наград и паузы шести экспериментов.

| № | Изменение | Свидетельство |
| --- | --- | --- |
| 1 | Запуск и первое продолжение без interstitial | e2e/menu-package.spec.ts: app entry protects both a fresh Classic and a parked continuation |
| 2 | Финалы без прокрутки | e2e/playtest-followup.spec.ts: 18 геометрий и 9 пороговых медалей |
| 3 | Новый банк звуков фишек | src/audio/sources.json; видео реального WebAudio; физическое качество не принято |
| 4 | Галочка/done на завершении | quiet-table.css: paper-result/result-stamp; исходный код и геометрия результата |
| 5 | Праздник тетради | result-presentation.ts; result-feedback.spec.ts: save/retry и отмена при переходе |
| 6 | Заметное восстановление подсказки | task-rollback.spec.ts; hint-repair.spec.ts; no-moves-card |
| 7 | Явное отсутствие пар | playtest-followup: dead notebook; Классика сохраняет Add |
| 8 | Центрированные действия результата | result-next flex column; геометрия 320/390 |
| 9 | Праздник Классики | result-presentation.ts; home-and-classic.mp4 |
| 10 | Дальше → сложность → одна реклама | menu-package.spec.ts: Classic Next chooses a difficulty before the single ad request |
| 11 | Ненавязчивое привлечение к непройденному дню | playtest-followup: daily nudge, вход без хода и reload |
| 12 | Тетрадь без активной партии | playtest-followup: empty notebook starts the difficulty choice |
| 13 | Календарь без зелёного фона | playtest-followup: computed background rgba(0,0,0,0), animation-name none |
| 14 | Нажимаемая левитирующая тетрадка и тень | playtest-followup: fixed touch target, Enter/Space/cancel, reduced motion; home-and-classic.mp4 |
| 15 | Дейлик: медаль, праздник, основная В меню | playtest-followup: primary action + medal thresholds; seeds-daily-result-12102.mp4 |

Ограничения: физический телефон не подключён; предпочтение звука и сила мотора требуют плейтеста владельца. Видео — настоящий DOM/WebAudio в браузере с явными сохранениями для воспроизведения результата; не запись живого игрока и не измерение реальных наград аудитории. Android APK собран и подписан; полная регрессия эмулятора в CI ещё выполняется.

## Подписанный APK

[CI и артефакты](https://github.com/DanilaH/seeds-bits/actions/runs/45806974057). Пакет `com.seedsbits.game.preview`, versionCode `12102`, 6079467 байт. SHA256 `cc42589e6c05aedfd0f1c9d23a1eb8b8bbd67c4a47f1743ae5c9d8eab812d7e4`.

APK Signature Scheme v2 проверена. Сертификат совпадает с preview12101 (`ee910b7ef7ed79fe27f15c26f8b70324133ac77c87d137a09c492e7b2bb7de30`). Все файлы unsigned payload сохранены при подписании; 21 локально собранный игровой файл побайтно совпал с APK. Это статическая проверка; не утверждение об установке на физический телефон.
