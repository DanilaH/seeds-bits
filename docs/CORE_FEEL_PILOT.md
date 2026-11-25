# Отклик поля и звук Семечек

[PR №38](https://github.com/DanilaH/seeds-bits/pull/38) продолжает [пилот №36](https://github.com/DanilaH/seeds-bits/issues/36). В обычной сборке действуют быстрые ходы, анимация очистки и отклик вибрации из Feel. Настройки содержат обычные переключатели звука и вибрации. Для нового игрока звук включён. Сохранённое отключение звука учитывается при обновлении.

## Источники записей

Все четыре источника опубликованы авторами на Freesound с лицензией CC0 1.0. В банк включены обработанные фрагменты публичных MP3-превью. Имена ниже используются командой сборки. В самой игре лежит один локальный монофонический банк Opus.

| Файл для сборки | Запись и автор | Применение |
| --- | --- | --- |
| `wood.mp3` | [Board Game Pieces — taure](https://freesound.org/people/taure/sounds/555190/) · [MP3](https://cdn.freesound.org/previews/555/555190_2940947-hq.mp3) | Выбор, пары, добавление |
| `knock.mp3` | [knocking_small-box — sadlyshoe](https://freesound.org/people/sadlyshoe/sounds/544265/) · [MP3](https://cdn.freesound.org/previews/544/544265_6073184-hq.mp3) | Тихий сигнал при несовпадении и препятствии |
| `paper.mp3` | [Box Up Paper Movement — martinimeniscus](https://freesound.org/people/martinimeniscus/sounds/164421/) · [MP3](https://cdn.freesound.org/previews/164/164421_2320755-hq.mp3) | Сдвиг строк, отмена и завершение страницы |
| `seeds.mp3` | [seeds (cristal jar)5 — Godowan](https://freesound.org/people/Godowan/sounds/235279/) · [MP3](https://cdn.freesound.org/previews/235/235279_1662097-hq.mp3) | Семечки в банке и завершение партии |

Фрагменты подрезаны, обработаны фильтром и сведены с короткими огибающими. Для самых частых действий предусмотрены разные дубли. Собранный банк считывается один раз, число одновременных голосов ограничено тремя. Эффекты останавливаются при паузе приложения и отключении звука.

## Проверки и воспроизведение

```sh
python3 scripts/mix-foley.py /path/to/source-mp3s --audition /tmp/seeds-foley-moves.mp3
VITE_SEEDS_FIRST_SESSION=1 VITE_SEEDS_QA_PROFILE=baseline npx playwright test --config playwright.core-feel.config.ts
python3 scripts/feedback-native-harness.py
```

Скрипт сборки использует NumPy, SciPy и FFmpeg. Для записи запущенной игры открыть Vite на порту 5191 и выполнить `node scripts/record-core-feel.mjs`. Дорожка берётся из WebAudio и сохраняет громкость игры. Ощущение от динамика и мотора физического телефона проверяется живым плейтестом.

**KIT IMPACT — REUSE.** Использованы действующие контракты OwnedDomMotion, переноса значений и нативной вибрации.
