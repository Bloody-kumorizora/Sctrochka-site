// notfound.js — страница 404. На GitHub Pages она отдаётся для любых несуществующих адресов,
// поэтому пути к файлам в 404.html должны работать из любой папки сайта.
(function () {
  'use strict';
  UI.showHeader('');
  const btn = document.querySelector('[data-search-open-404]');
  if (btn) btn.addEventListener('click', UI.openSearch);
})();
