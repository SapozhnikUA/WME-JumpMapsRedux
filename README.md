# WME JumpMapsRedux

Швидкі переходи з **Waze Map Editor (WME)** на інші картографічні ресурси (закладки/обране) та навпаки — в окремому вікні.

## Огляд

WME JumpMapsRedux — це userscript для редактора карт Waze, який дозволяє миттєво відкривати поточну видиму область карти в інших картографічних сервісах. Скрипт працює в обидвох напрямках:

- **З WME → на зовнішні карти**: плаваюча панель з кнопками відкриває координати в інших сервісах
- **З зовнішніх карт → в WME**: фіксована кнопка-іконка відкриває поточну позицію в Waze

## Підтримувані сервіси

### Відкриваються з WME (плаваюча панель):
| Сервіс | Код | Статус |
|--------|-----|--------|
| OpenStreetMap | OSM | ✅ За замовчуванням |
| Bing Maps | Bing | ✅ За замовчуванням |
| HERE | Here | ✅ За замовчуванням |
| Apple Maps | AM | ✅ За замовчуванням |
| Mapillary | MRY | ✅ За замовчуванням |
| Wikimapia | WM | ✅ За замовчуванням |
| Visicom.ua | VCUA | ✅ За замовчуванням |
| satellites.pro | SPRO | ✅ За замовчуванням |
| Camera Ukraine (checker.waze.com.ua) | CamUA | ✅ За замовчуванням |

### Відключені за замовчуванням (можна ввімкнути в налаштуваннях):
- Google Maps (G)
- Yandex Maps (YM, NYM)
- 2GIS (2Gis)
- KartaView (KVIEW)
- Mapilio (MPLIO)
- mapcam.info (SC)
- SpeedCamOnLine (SCO)
- RosReestr (RE)
- benzin-price.ru (BP)
- Baltic Maps (BM)
- atlas.mos.ru (AMR)
- radarbase.info (RBASE)
- rreestrmap.ru (RREE)
- tools.wmflabs.org (WMF)
- Kadastr UA (KADUA)

### На зовнішніх картах доступна кнопка повернення в WME:
Yandex Narod, Yandex Maps, Google Maps, 2GIS, RosReestr, mapcam.info, SpeedCamOnLine, Wikimapia, Baltic Maps, OpenStreetMap, Mapillary, KartaView, Mapilio, Bing Maps, HERE, Apple Maps, Visicom.ua, satellites.pro, Kadastr UA, radarbase.info, rreestrmap.ru.

## Встановлення

1. Встановіть розширення для браузера:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)
   - [Greasemonkey](https://www.greasespot.net/)

2. <b>Натисніть кнопку «Install» в браузері GreaseMonkey/ViolentMonkey або додайте скрипт вручну за URL:
   ```
   https://raw.githubusercontent.com/SapozhnikUA/WME-JumpMapsRedux/main/wme-jumpmaps-redux.user.js
   ```
   ```
   https://raw.githubusercontent.com/SapozhnikUA/WME-JumpMapsRedux/main/wme-jumpmaps-redux.user.js
   ```

## Використання

### На Waze Map Editor
Після встановлення при займені на WME з'явиться плаваюча панель у верхній частині екрану з кодами карт (наприклад: `[OSM]`, `[Bing]`, `[Here]`). Натисність на код — і відкриється відповідна карта в новій вкладці.

Панель можна перетягувати — позиція зберігається в localStorage.

### На зовнішніх картах
У правому нижньому куті з'явиться іконка Waze — клік відкриє поточну позицію в Waze Map Editor.

## Налаштування

У бічній панелі WME з'явиться вкладка **JM** з опціями:
- Вмикати/Вимикати окремі карти для відображення в панелі
- Редагувати назви та шаблони посилань
- Сховати плаваючу панель
- Скинути налаштування до замовчуванням

### Кастомні шаблони

Шаблони підтримують наступні плейсхолдери:
- `{{lat}}` — широта
- `{{lon}}` — довгота  
- `{{zoom}}` — рівень масштабування
- `{{city}}` — місто (для 2GIS)

## Технічні деталі

- **WME SDK v2** — офіційна версія SDK без залежності від WazeWrap
- **proj4 v2.20.8** — бібліотека для перетворення координатних систем
- Автоматичне перетворення координат між WGS84 та локальними системами (Baltic Maps, Kadastr UA)
- Максимальний зум Waze: 22 рівні (Google Maps сумісність)

## Автори

- **skirda** — оригінальна ідея та реалізація
- **alexletov** — форк та розвиток
- **Kuzia (Чарівник Кузя)** — адаптація під WME SDK v2, поліпшення

## Ліцензія

MIT License