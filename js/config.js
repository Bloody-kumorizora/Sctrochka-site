// config.js — всё, что владелец сайта настраивает сам.
// Пустые значения на сайте не показываются: никаких выдуманных контактов.
window.STROKA_CONFIG = {
  brand: {
    name: 'Stroka',
    tagline: 'Школа веб-разработки: от первой строки кода до своего сайта'
  },

  // Адрес веб-приложения Google Apps Script (Развернуть → Веб-приложение → URL).
  // Это публичный адрес, секретом он не является. Секреты сюда не кладите.
  apiUrl: 'https://script.google.com/macros/s/AKfycbyFNzuuV9trn3g98Viok0ccVJyjG8ayqUjytI1lssHmMEP79EBnF5TemmL4rmB2XAfO/exec',

  // 'sheets' — Google Таблица (основной режим);
  // 'local'  — демо-данные в localStorage браузера, для разработки без сети.
  dataMode: 'sheets',

  // Полный адрес сайта без слеша в конце, например https://example.github.io/Sctrochka-site
  // Нужен для canonical-ссылок и Open Graph. Пусто — ссылки строятся от текущего адреса.
  siteUrl: 'https://bloody-kumorizora.github.io/Sctrochka-site',

  // Раздел «Об авторе». ЗАПОЛНИТЕ САМИ — пустые поля скрываются.
  author: {
    name: '',            // Имя и фамилия
    role: '',            // Например: «Frontend-разработчик»
    photo: '',           // Путь к фото, например 'img/author.jpg' (квадрат 800×800, JPG/WebP)
    intro: '',           // 1–2 предложения о себе
    about: [],           // Абзацы подробного рассказа: ['...', '...']
    skills: [],          // ['HTML', 'CSS', 'JavaScript', ...]
    projects: [],        // [{ title: '', description: '', url: '', stack: 'HTML, CSS' }]
    approach: [],        // Как вы подходите к обучению: ['...', '...']
    contacts: {
      email: '',         // you@example.com
      telegram: '',      // https://t.me/username
      github: '',        // https://github.com/username
      vk: '',            // https://vk.com/username
      website: ''        // https://...
    }
  },

  // Отзывы: только реальные, с согласия автора отзыва.
  // [{ name: 'Имя', text: 'Текст', course: 'Название курса', date: '2026-10-01' }]
  reviews: []
};
