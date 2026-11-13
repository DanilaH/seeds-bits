# RuStore 1.1.2 release candidate — 13 November 2026

Runtime игры совпадает с `c6c99ce192c6e0c1ae992a65e8c26b446199e19d`, проверенным в [UI/UX приёмке](../../classic-result-2026-11-13/README.md): 212 e2e, 72 + 2 unit, 15 integration/browser, 30 сцен финала и общий обход. Релизный исходник `ecc3c399a6062d59d71da83179c4ae09cb33ac9c` добавляет только workflow сборки; код игры, native bridges и lockfile не изменены.

Сборка использует `SEEDS_BUILD_FLAVOR=release`, пакет `com.seedsbits.game`, имя «Семечки», строгую проверку четырёх боевых клиентских полей, `ADS_MODE=live` и канал аналитики `release`. Номер 1102101 выделен для магазина отдельно от QA 1102004–1102015 и preview-пакета. Боевые клиентские идентификаторы и закрытый ключ не публикуются в документации.

[Сборка и Android-приёмка 43379345999](https://github.com/DanilaH/seeds-bits/actions/runs/43379345999). Эмулятор проверяется под IPv4/IPv6 host firewall до boot и до установки APK. Upgrade-baseline — точный прежний unsigned 1.1.2 / 1102015 из run 43032671115, SHA256 `2fed06a41c7b2a3d120fc587c5a7e7985c023b9feadbd608684a0e108abac51a`. Оба payload для эмулятора подписываются одним временным CI-сертификатом; идентичность production-сертификата выдаваемого файла проверяется отдельно.

Подписывание выполняется локально прежним релизным ключом. Проверяются v2/v3, package/version, боевой режим SDK, ресурсы и иконки, R8-мосты/аннотации, отсутствие test hooks/stale assets, точное совпадение web assets и неизменность ZIP entries исходного CI payload. Итоги фиксируются в `acceptance.json`, `apk.json` и `payload.json`.

В первой native-проверке обновление и десять smoke-проверок прошли. Финальный переход к конфиденциальности остановился из-за драйвера: UiAutomator вернул кнопку «Настройки» с инвертированными границами `[506,1656][732,1640]` ниже viewport, а старый тест нажал эти координаты без прокрутки. Первый повтор с touch-прокруткой также не прошёл: координаты WebView привели в другой пункт меню. Оба неудачных прогона сохранены в [acceptance.json](acceptance.json).

Закрытая приёмка точного payload — [43382117809](https://github.com/DanilaH/seeds-bits/actions/runs/43382117809), test source `cb63733eecfd2d7bfcd95d61bc88692a91a8fd08`: все **11 Android smoke checks** прошли. Драйвер переводит фокус на нужный элемент аппаратным TAB, дважды получает одинаковые видимые bounds, затем нажимает его touch-вводом и проверяет уникальный заголовок «О данных». Две ошибки получения UiAutomator XML потребовали повторного чтения; игровые assertions не пропускались. [Smoke](android-smoke.json), [pin исходного APK](android-input.json), [host firewall до boot](offline-guard-final.json), [upgrade с 1102015](android-upgrade.json). Игра и APK не пересобирались для исправления теста.

Выдан **seeds-1.1.2-1102101-rustore.apk**, 5 517 432 байта; SHA256 `fc0cc444f33a4b1024ed12b748b9cb01c51cd344196a00c528d45e6c2b522868`. Все **663** исходные ZIP entries неизменны после alignment/signing, 10 web assets совпадают с локальным production build, production-сертификат совпадает с прежним 1102015. [APK](apk.json), [payload](payload.json), [общая приёмка](acceptance.json).


Это подготовка установочного файла. Физическая установка, live fill рекламы, получение событий в кабинете AppMetrica, карточка магазина и отправка на модерацию не подменяются offline-проверками.
