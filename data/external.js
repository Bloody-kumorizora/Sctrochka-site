// Реальные курсы на других сайтах. Карточка такого курса ведёт сразу по ссылке
// (status: 'external', адрес — в поле external). Через админ-панель
// («Обзор» → «Добавить в таблицу») они попадают в лист courses вместе с
// остальным каталогом, а дальше их можно править прямо в таблице
// (столбцы external_url и provider).
// Все курсы — на русском языке. Ссылки проверены 12.11.2026.
// Цены и программы задают сами площадки.
window.STROKA_EXTERNAL = [
  {
    id: 'ext-stepik-html-css', order: 101, status: 'external', provider: 'Stepik',
    external: 'https://stepik.org/course/38218/promo',
    title: 'Веб-разработка для начинающих: HTML и CSS',
    subtitle: 'Бесплатный курс на Stepik для тех, кто никогда не писал код',
    description: 'Как устроен интернет, как сделать сайт на HTML и CSS и опубликовать его. Онлайн-версия ежегодного очного курса ITC в РЭУ им. Плеханова.',
    track: 'Вёрстка', level: 'Начальный', format: 'Онлайн-курс', hours: 0, duration: '',
    tags: ['html', 'css', 'бесплатно', 'stepik'], cover: { glyph: '</>', tone: 'coral' }, next: []
  },
  {
    id: 'ext-stepik-indie-html', order: 102, status: 'external', provider: 'Stepik',
    external: 'https://stepik.org/course/120494/promo',
    title: 'Инди-курс по HTML и CSS',
    subtitle: 'Сначала HTML, потом CSS — с практикой после каждой темы',
    description: 'Бесплатный курс на Stepik: в первой части разбирается разметка HTML, во второй — оформление страниц на CSS.',
    track: 'Вёрстка', level: 'Начальный', format: 'Онлайн-курс', hours: 0, duration: '',
    tags: ['html', 'css', 'бесплатно', 'stepik'], cover: { glyph: '{ }', tone: 'sky' }, next: []
  },
  {
    id: 'ext-doka', order: 103, status: 'external', provider: 'Дока',
    external: 'https://doka.guide/',
    title: 'Дока: справочник веб-разработчика',
    subtitle: 'Документация по HTML, CSS и JavaScript, написанная по-русски и понятным языком',
    description: 'Открытый справочник, который веб-разработчики пишут для веб-разработчиков: теги, свойства, приёмы вёрстки и доступности — с примерами, которые удобно держать под рукой во время учёбы.',
    track: 'Вёрстка', level: 'Начальный', format: 'Справочник', hours: 0, duration: '',
    tags: ['html', 'css', 'javascript', 'бесплатно', 'справочник'], cover: { glyph: 'Д', tone: 'ink' }, next: []
  },
  {
    id: 'ext-stepik-js', order: 104, status: 'external', provider: 'Stepik',
    external: 'https://stepik.org/course/2223/promo',
    title: 'JavaScript для начинающих',
    subtitle: 'Основы языка, задания и тесты — по 1–2 часа в неделю',
    description: 'Бесплатный курс на Stepik: основы программирования на JavaScript и инструменты, нужные для практики. После прохождения выдаётся сертификат Stepik.',
    track: 'JavaScript', level: 'Начальный', format: 'Онлайн-курс', hours: 0, duration: '',
    tags: ['javascript', 'js', 'бесплатно', 'stepik'], cover: { glyph: 'JS', tone: 'lime' }, next: []
  },
  {
    id: 'ext-learn-javascript', order: 105, status: 'external', provider: 'learn.javascript.ru',
    external: 'https://learn.javascript.ru/',
    title: 'Современный учебник JavaScript',
    subtitle: 'Самый подробный открытый учебник по JavaScript на русском',
    description: 'От первых переменных до продвинутых тем: функции, объекты, асинхронность, работа со страницей. После каждой главы — задачи с решениями.',
    track: 'JavaScript', level: 'Средний', format: 'Учебник', hours: 0, duration: '',
    tags: ['javascript', 'js', 'бесплатно', 'учебник'], cover: { glyph: 'JS', tone: 'sand' }, next: []
  },
  {
    id: 'ext-react-docs', order: 106, status: 'external', provider: 'ru.react.dev',
    external: 'https://ru.react.dev/learn/your-first-component',
    title: 'React: официальное руководство',
    subtitle: 'Русский перевод документации React — начиная с первого компонента',
    description: 'Официальное руководство React на русском: компоненты, разметка JSX, состояние и обработка событий. Примеры можно запускать и менять прямо на странице.',
    track: 'Фреймворки', level: 'Средний', format: 'Учебник', hours: 0, duration: '',
    tags: ['react', 'бесплатно', 'документация'], cover: { glyph: '⚛', tone: 'sky' }, next: []
  },
  {
    id: 'ext-stepik-git', order: 107, status: 'external', provider: 'Stepik · ВШЭ',
    external: 'https://stepik.org/course/215784/promo',
    title: 'Введение в Git',
    subtitle: 'Бесплатный курс Центра непрерывного образования ФКН ВШЭ',
    description: 'Система контроля версий с нуля: установка Git, создание и настройка репозиториев. Курс рассчитан примерно на две недели.',
    track: 'Инструменты', level: 'Начальный', format: 'Онлайн-курс', hours: 0, duration: '≈ 2 недели',
    tags: ['git', 'бесплатно', 'stepik'], cover: { glyph: 'git', tone: 'coral' }, next: []
  },
  {
    id: 'ext-stepik-sql', order: 108, status: 'external', provider: 'Stepik',
    external: 'https://stepik.org/course/63054/promo',
    title: 'Интерактивный тренажёр по SQL',
    subtitle: '173 задачи, которые решаются прямо в браузере',
    description: 'Один из самых популярных бесплатных курсов Stepik: 22 урока, 10 тестов и 173 интерактивные задачи по SQL. Запросы выполняются в браузере — ничего устанавливать не нужно.',
    track: 'Бэкенд и данные', level: 'Начальный', format: 'Онлайн-курс', hours: 24, duration: '',
    tags: ['sql', 'базы данных', 'бесплатно', 'stepik'], cover: { glyph: 'SQL', tone: 'violet' }, next: []
  },
  {
    id: 'ext-stepik-python', order: 109, status: 'external', provider: 'Stepik',
    external: 'https://stepik.org/course/58852/promo',
    title: '«Поколение Python»: курс для начинающих',
    subtitle: 'Больше 500 задач с автоматической проверкой',
    description: 'Бесплатный курс для школьников, студентов и взрослых: типы данных, условия, циклы, строки, списки и функции. Победитель Stepik Awards 2020 как лучший бесплатный курс.',
    track: 'Программирование', level: 'Начальный', format: 'Онлайн-курс', hours: 0, duration: '',
    tags: ['python', 'бесплатно', 'stepik'], cover: { glyph: 'Py', tone: 'indigo' }, next: []
  },
  {
    id: 'ext-freecad-course', order: 110, status: 'external', provider: 'YouTube',
    external: 'https://www.youtube.com/playlist?list=PLrwLdIBuPZQYLgEido7oWpHCu6io0WywY',
    title: 'FreeCAD для начинающих и продвинутых',
    subtitle: 'Бесплатный видеокурс на русском языке — плейлист на YouTube',
    description: 'FreeCAD — бесплатная программа для 3D-моделирования и черчения деталей. Курс собран для тех, кому трудно начать: от первых шагов в программе до более сложных приёмов моделирования.',
    track: '3D-моделирование', level: 'Начальный', format: 'Видеокурс', hours: 0, duration: '',
    tags: ['freecad', 'фрикад', '3d', 'cad', 'видео', 'бесплатно'], cover: { glyph: '3D', tone: 'lime' }, next: ['ext-freecad-2026']
  },
  {
    id: 'ext-freecad-2026', order: 111, status: 'external', provider: 'YouTube',
    external: 'https://www.youtube.com/watch?v=eUUh4dT5aGA',
    title: 'FreeCAD 1.1: новый курс для начинающих (2026)',
    subtitle: 'Видеоуроки на русском по свежей версии программы — начните с первого урока',
    description: 'Курс по FreeCAD 1.1 для тех, кто открывает программу впервые. Первый урок — настройка программы, в том числе выбор русского языка интерфейса.',
    track: '3D-моделирование', level: 'Начальный', format: 'Видеокурс', hours: 0, duration: '',
    tags: ['freecad', 'фрикад', '3d', 'cad', 'видео', 'бесплатно'], cover: { glyph: '1.1', tone: 'sand' }, next: ['ext-freecad-course']
  }
].map(c => Object.assign({ featured: false, lessonsCount: 0, modulesCount: 0, demoLessons: 0, keywords: '' }, c));
