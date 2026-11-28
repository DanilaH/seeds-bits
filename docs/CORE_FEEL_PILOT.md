# Отклик поля и звук Семечек

[PR №38](https://github.com/DanilaH/seeds-bits/pull/38) продолжает [пилот №36](https://github.com/DanilaH/seeds-bits/issues/36). В обычной сборке действуют быстрые ходы, анимация очистки и отклик вибрации из Feel. Настройки содержат обычные переключатели звука и вибрации. Для нового игрока звук включён. Сохранённое отключение звука учитывается при обновлении.

## Источники записей

В preview 12101 банк заменён на Kenney Casino Audio. Используются шесть изолированных OGG-файлов фишек из набора с CC0 1.0. [Страница автора](https://kenney.nl/assets/casino-audio). Файлы получены из [зеркала на зафиксированной ревизии](https://github.com/Mcamento8/open-game-sfx-index/tree/34bbe8b525b5ceff3804915ea745532af11f6055/audio/casino-audio). Точные SHA-256 перечислены в `src/audio/sources.json`.

Частые действия используют одиночные щелчки с тремя вариантами. Сжатие и победа получают короткую последовательность фишек. При сведении удалены паузы вокруг транзиентов, ограничены низкие и резкие верхние частоты, оставлены короткие затухания. Банк сохраняется в Vorbis при 44,1 кГц, quality 6. Мастер-громкость игры остаётся 0,43. Телефонный динамик и субъективное качество проверяются владельцем.

Для повторной сборки загрузить `chip-lay-1.ogg`, `chip-lay-2.ogg`, `chip-lay-3.ogg`, `chips-collide-1.ogg`, `chips-stack-1.ogg`, `chips-stack-2.ogg` из указанной ревизии в одну папку. Сверить SHA-256 с манифестом и передать папку скрипту.

## Проверки и воспроизведение

```sh
python3 scripts/mix-foley.py /path/to/kenney-ogg --audition /tmp/seeds-foley-moves.wav
VITE_SEEDS_FIRST_SESSION=1 VITE_SEEDS_QA_PROFILE=baseline npx playwright test --config playwright.core-feel.config.ts
python3 scripts/feedback-native-harness.py
```

Скрипт сборки использует NumPy, SciPy и FFmpeg. Для записи запущенной игры открыть Vite на порту 5191 и выполнить `node scripts/record-core-feel.mjs`. Дорожка берётся из WebAudio и сохраняет громкость игры. Ощущение от динамика и мотора физического телефона проверяется живым плейтестом.

**KIT IMPACT — REUSE.** Использованы действующие контракты OwnedDomMotion, переноса значений и нативной вибрации.
