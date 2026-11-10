# Sctrochka-site

Сайт школы веб-разработки Stroka (GitHub Pages, без сборки).

* **Данные** — Google Таблица (листы `courses`, `lessons`, `questions`, `users`,
  `enrollments`, `progress`, `favorites`, `notes`, `feedback`, `sessions`),
  доступ через Google Apps Script.
  Серверный скрипт и инструкция по установке: [`apps-script/`](apps-script/README.md).
  Изменения на сайте сразу пишутся в таблицу, правки в таблице появляются на
  сайте при следующем открытии страницы (кеш браузера — до 30 секунд).
* **Встроенный каталог** — 22 курса в `data/catalog.js` и `data/courses/*.js`.
  Переносится в таблицу кнопкой в админ-панели («Обзор»); после этого сайт берёт
  курсы только из таблицы, а файлы служат запасной копией.
* **Настройки** — `js/config.js`: адрес Apps Script (`apiUrl`), данные автора, отзывы.
