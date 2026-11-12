// Реальные курсы на других сайтах. Карточка такого курса ведёт сразу по ссылке
// (status: 'external', адрес — в поле external). Через админ-панель
// («Обзор» → «Добавить в таблицу») они попадают в лист courses вместе с
// остальным каталогом, а дальше их можно править прямо в таблице
// (столбцы external_url и provider).
// Ссылки проверены 12.11.2026. Цены и программы задают сами площадки.
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
    id: 'ext-mdn-learn', order: 103, status: 'external', provider: 'MDN Web Docs',
    external: 'https://developer.mozilla.org/ru/docs/Learn',
    title: 'Изучение веб-разработки (MDN)',
    subtitle: 'Учебный раздел MDN — справочника, которым пользуются все веб-разработчики',
    description: 'Обучающий раздел MDN от Mozilla: базовые навыки фронтенд-разработчика — HTML, CSS и JavaScript — по шагам, с примерами и заданиями. Русский перевод сделан сообществом.',
    track: 'Вёрстка', level: 'Начальный', format: 'Учебник', hours: 0, duration: '',
    tags: ['html', 'css', 'javascript', 'бесплатно', 'mdn'], cover: { glyph: 'MDN', tone: 'ink' }, next: []
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
    id: 'ext-react-docs', order: 106, status: 'external', provider: 'react.dev',
    external: 'https://ru.react.dev/learn',
    title: 'React: официальное руководство',
    subtitle: 'Документация React на русском — с интерактивными примерами',
    description: 'Официальный раздел «Изучение React»: компоненты, разметка JSX, состояние, обработка событий и хуки. Примеры можно запускать и менять прямо на странице.',
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
    id: 'ext-freecad-part', order: 110, status: 'external', provider: 'FreeCAD Wiki',
    external: 'https://wiki.freecad.org/Creating_a_simple_part_with_Draft_and_Part_WB/ru',
    title: 'FreeCAD: первая деталь',
    subtitle: 'Официальный урок: простая деталь в верстаках Draft и Part',
    description: 'FreeCAD — бесплатная программа для параметрического 3D-моделирования. В этом уроке из официальной документации вы построите простую деталь с помощью инструментов верстаков Draft и Part.',
    track: '3D-моделирование', level: 'Начальный', format: 'Урок', hours: 0, duration: '',
    tags: ['freecad', 'фрикад', '3d', 'cad', 'бесплатно'], cover: { glyph: '3D', tone: 'lime' }, next: ['ext-freecad-draft']
  },
  {
    id: 'ext-freecad-draft', order: 111, status: 'external', provider: 'FreeCAD Wiki',
    external: 'https://wiki.freecad.org/Draft_tutorial/ru',
    title: 'FreeCAD: черчение в верстаке Draft',
    subtitle: 'Официальный урок по черчению для начинающих, около 30 минут',
    description: 'Урок из документации FreeCAD: создаём новый документ, переключаемся на верстак Draft и шаг за шагом строим 2D-чертёж.',
    track: '3D-моделирование', level: 'Начальный', format: 'Урок', hours: 0, duration: '≈ 30 мин',
    tags: ['freecad', 'фрикад', 'чертёж', 'cad', 'бесплатно'], cover: { glyph: '2D', tone: 'sand' }, next: ['ext-freecad-part']
  }
].map(c => Object.assign({ featured: false, lessonsCount: 0, modulesCount: 0, demoLessons: 0, keywords: '' }, c));
