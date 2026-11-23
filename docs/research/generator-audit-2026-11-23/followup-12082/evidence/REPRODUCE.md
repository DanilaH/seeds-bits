# Воспроизведение независимой проверки preview 12082

Пакет сохраняет результат уже выполненной проверки **18 408** строк из CI-архива собственной Классики «Семечек». Все маршруты дошли до пустого поля, проверены **484 269** действий, заново пересчитаны **40** сводок. Во всех **8 000** парах свежих сравнений исходные поля и пути до/после совпали.

## Состав

| Файл | Содержание |
|---|---|
| `verify-archive.mjs` | Переносимая проверка архива через точные Git-объекты ядра и измерителя |
| `archive-validation.json` | Неизменённый результат выполненной независимой проверки |
| `artifact-manifest.json` | Неизменённый `manifest.json` из CI: ревизии, параметры, исходные blobs, SHA256 результатов |
| `apk-manifest.json` | Метаданные, прочитанные из фактического подписанного APK12082 |
| `provenance-index.json` | Происхождение, ссылки Actions, контрольные суммы, метод и границы проверки |
| `REPRODUCE.md` | Эти команды |

Архивы, APK, CI-логи и полные18 408 строк остаются внешними входами. В пакете их нет.

## Требования и входы

Нужны **Node24** (CI использовал24.22.3), **Git** и репозиторий, содержащий commit:

`eae2bcbeaaa1a5c76872dddc7a7f79844988b60e`.

Скрипт читает `src/core.ts` и `src/classic-profile.ts` через `git show` именно из этой ревизии, проверяя SHA256 и Git blob. Текущие файлы checkout для replay не используются.

Скачай [classic-series-comparison, artifact14849741823](https://github.com/DanilaH/seeds-bits/actions/runs/45235845420/artifacts/14849741823) из [run45235845420](https://github.com/DanilaH/seeds-bits/actions/runs/45235845420). SHA256 ZIP:

```text
dc5fdc6306463b3246a53f6d62651c20c6a7ff480cb64edea9e52458af15d17c
```

Параметр `--artifact` принимает ZIP или уже распакованную папку, непосредственно содержащую `manifest.json`, `deals.jsonl.gz`, `summary.json`, `audit-29-30.json`. Для ZIP дополнительно нужна команда `unzip`; сначала проверяется SHA256 всего ZIP. В обоих вариантах manifest сравнивается с закреплённой копией из пакета, затем проверяются SHA256 трёх файлов данных.

## Команда проверки

Укажи свои абсолютные пути:

```bash
SEEDS_REPO=/absolute/path/to/seeds-bits
SEEDS_EVIDENCE=/absolute/path/to/followup-12082/evidence
SEEDS_ARCHIVE=/absolute/path/to/classic-series-comparison.zip
SEEDS_RESULT=/tmp/seeds-12082-archive-validation.json

git -C "$SEEDS_REPO" cat-file -e "eae2bcbeaaa1a5c76872dddc7a7f79844988b60e^{commit}"

node "$SEEDS_EVIDENCE/verify-archive.mjs" \
  --artifact "$SEEDS_ARCHIVE" \
  --checkout "$SEEDS_REPO" \
  --out "$SEEDS_RESULT"

cmp "$SEEDS_RESULT" "$SEEDS_EVIDENCE/archive-validation.json"
```

Если архив распакован, в `SEEDS_ARCHIVE` укажи путь к папке с четырьмя файлами.

Скрипт печатает JSON; `--out` дополнительно записывает его в указанный файл. Временные модули и распакованные файлы создаются в системной временной папке и удаляются после проверки. Ошибка контрольной суммы, незаконный ход или несовпадение сводки завершают команду с ненулевым кодом.

Ожидаемые ключевые значения:

```json
{
  "rows": 18408,
  "proofsPassed": 18408,
  "proofsFailed": 0,
  "actions": 484269,
  "summariesVerified": 40,
  "freshComparisonsIdentical": 8000
}
```

SHA256 сохранённого `archive-validation.json`:

```text
6e633b4743c3108b519aaf3b3e5a878f0cc2bdcff979437b18bb5eea740c32ec
```

## Что именно воспроизводится

Replay использует точное игровое ядро и измеритель из закреплённой ревизии. Для каждого Add проверяется отсутствие пар; для каждой пары — законность. Удаление пустых строк дополнительно сравнивается с отдельной реализацией. Профили сверяются с данными архива, гистограммы и частоты повторов собираются из исходных строк заново.

Исходный отбор кандидатов по всем18 408 входам эта команда не перезапускает. Его команда и параметры сохранены в `artifact-manifest.json`. Два заявленных разработчиком одинаковых локальных прогона отдельно не наблюдались.

`apk-manifest.json` относится к [подписанному artifact14849428081](https://github.com/DanilaH/seeds-bits/actions/runs/45235845420/artifacts/14849428081): пакет `com.seedsbits.game.preview`, версия1.1.2/12082, APK SHA256:

```text
b254fda5b36bccec4eb0c90f0cd7b7a5adda51098993f3dcf0914747fbab8d4a
```

Свидетельство проверки подписи v2/v3 находится в [signing job137915608437](https://github.com/DanilaH/seeds-bits/actions/runs/45235845420/job/137915608437). Архивный verifier не проверяет APK; JSON manifest — сохранённое наблюдение предыдущего аудита.

При упаковке сохранены исходный результат и неизменённое вычислительное тело verifier. Проверены синтаксис нового CLI, `--help` и тождественность тела прежнему выполненному скрипту. Полный корпус повторно при упаковке не прогонялся. Физический телефон, живая аудитория, человеческая сложность/интерес и end-to-end latency остаются вне этого результата.

**KIT IMPACT — REUSE.**

