# Sctrochka-site

Сайт школы веб-разработки Stroka (GitHub Pages, без сборки).

* **Данные** — Google Таблица (листы `courses`, `lessons`, `questions`, `users`,
  `enrollments`, `progress`, `feedback`, `sessions`), доступ через Google Apps Script.
  Серверный скрипт и инструкция по установке: [`apps-script/`](apps-script/README.md).
  Изменения на сайте сразу пишутся в таблицу, правки в таблице появляются на
  сайте при следующем открытии страницы (кеш браузера — до 30 секунд).
* **Встроенный каталог** — 22 курса в `data/catalog.js` и `data/courses/*.js`
  (файлы сайта, в таблицу не входят).
* **Настройки** — `js/config.js`: адрес Apps Script (`apiUrl`), данные автора, отзывы.
