// home.js — главная: живые цифры каталога, рекомендуемые курсы, направления,
// подбор маршрута «С чего начать», мини-тест в демо урока, блок автора, отзывы.
(function () {
  'use strict';
  const { $, $$, escapeHtml, icon, cfg } = UI;

  const TRACKS = [
    ['Вёрстка', 'Структура и внешний вид страниц: HTML, CSS, сетки и адаптивность. С этого начинают почти все.'],
    ['JavaScript', 'Язык, который делает страницы интерактивными: от первых переменных до асинхронности и типов.'],
    ['Фреймворки', 'React и Next.js — инструменты, на которых строят современные интерфейсы и сайты.'],
    ['Бэкенд и данные', 'Свой сервер, API, базы данных, авторизация и безопасность.'],
    ['Дизайн', 'Как сделать интерфейс понятным и аккуратно передать макет в разработку.'],
    ['Инструменты', 'Git, GitHub и AI-ассистенты — то, чем разработчик пользуется каждый день.'],
    ['Качество и запуск', 'Тестирование, скорость, SEO и публикация проекта в интернете.'],
    ['Практика', 'Практикумы, в которых собираются законченные проекты для портфолио.'],
    ['Карьера', 'Как показать свои работы так, чтобы их поняли и оценили.']
  ];

  // Маршруты «опыт × цель» → id курсов по порядку прохождения
  const ROUTES = {
    site: { zero: ['html-basics', 'css-layout', 'project-landing-blog', 'deploy'], html: ['css-layout', 'project-landing-blog', 'deploy'], js: ['project-landing-blog', 'performance-seo', 'deploy'], fw: ['nextjs', 'performance-seo', 'deploy'] },
    frontend: { zero: ['html-basics', 'css-layout', 'js-start', 'git-github'], html: ['css-layout', 'js-start', 'git-github', 'project-landing-blog'], js: ['js-advanced', 'web-api', 'react', 'typescript'], fw: ['nextjs', 'typescript', 'testing-debugging', 'performance-seo'] },
    fullstack: { zero: ['html-basics', 'js-start', 'git-github', 'web-api'], html: ['js-start', 'web-api', 'node-backend'], js: ['web-api', 'node-backend', 'sql-databases', 'auth-security'], fw: ['node-backend', 'sql-databases', 'auth-security', 'project-webapp'] },
    design: { zero: ['uiux-basics', 'figma-handoff', 'html-basics', 'css-layout'], html: ['uiux-basics', 'figma-handoff', 'css-layout'], js: ['uiux-basics', 'figma-handoff', 'performance-seo'], fw: ['uiux-basics', 'figma-handoff', 'testing-debugging'] }
  };
  const ROUTE_TITLES = {
    site: 'Свой сайт — шаг за шагом', frontend: 'Путь во фронтенд', fullstack: 'Фронтенд и сервер', design: 'Интерфейсы, которые понятны'
  };

  let courses = [];
  let currentTrack = '';
  let showTrack = () => {};
  const byId = id => courses.find(c => c.id === id);

  function renderStats(sheetLessons) {
    const s = window.STROKA_STATS || { courses: 0, lessons: 0, demo: 0 };
    const sheetCourses = courses.filter(c => c.source === 'sheet').length;
    const values = { courses: s.courses + sheetCourses, lessons: s.lessons + sheetLessons, demo: s.demo + sheetLessons };
    $$('[data-stat]').forEach(el => { el.textContent = values[el.dataset.stat]; });
  }

  function renderFeatured() {
    const list = courses.filter(c => c.featured).sort((a, b) => a.order - b.order).slice(0, 3);
    const box = $('#featured-grid');
    if (!list.length) { box.innerHTML = UI.stateBox('empty', 'Курсы скоро появятся', ''); return; }
    box.innerHTML = list.map((c, i) => {
      const tone = (c.cover && c.cover.tone) || 'indigo';
      return '<a class="feature tone-' + tone + ' ' + (i === 0 ? 'feature-big' : 'feature-side') + '" href="' + Courses.url(c) + '">' +
        '<span class="glyph" aria-hidden="true">' + escapeHtml(c.cover.glyph) + '</span>' +
        '<div class="feature-top"><span class="pill">' + escapeHtml(c.level) + '</span><span class="pill">' + escapeHtml(Courses.STATUS[c.status].label) + '</span>' + (i === 0 ? '<span class="pill">' + escapeHtml(c.track) + '</span>' : '') + '</div>' +
        '<div><h3>' + escapeHtml(c.title) + '</h3><p>' + escapeHtml(i === 0 ? c.description : c.subtitle) + '</p></div>' +
        '<div class="feature-foot"><span>' + escapeHtml(Courses.lessonsText(c) + ' · ' + Courses.durationText(c)) + '</span><span class="go">' + icon('arrow') + '</span></div></a>';
    }).join('');
  }

  function renderTracks() {
    const tracks = TRACKS.map(([name, text]) => ({ name, text, list: courses.filter(c => c.track === name).sort((a, b) => a.order - b.order) }))
      .filter(t => t.list.length);
    // Направления из таблицы (например «Программирование»), которых нет в списке выше
    courses.filter(c => c.source === 'sheet' && !TRACKS.some(t => t[0] === c.track)).forEach(c => {
      let t = tracks.find(x => x.name === c.track);
      if (!t) { t = { name: c.track, text: 'Курсы автора из этого направления.', list: [] }; tracks.push(t); }
      t.list.push(c);
    });
    const tabs = $('#track-tabs'), panel = $('#track-panel');
    tabs.innerHTML = tracks.map((t, i) =>
      '<button class="track-tab" role="tab" id="tab-' + i + '" aria-controls="track-panel" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-i="' + i + '">' +
      '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + escapeHtml(t.name) + '</span><small>' + t.list.length + '</small></button>').join('');
    const show = i => {
      const t = tracks[i];
      currentTrack = t.name;
      $$('.track-tab', tabs).forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      panel.setAttribute('aria-labelledby', 'tab-' + i);
      panel.innerHTML = '<span class="eyebrow on-dark"><b>' + t.list.length + '</b> ' + UI.plural(t.list.length, 'курс', 'курса', 'курсов') + '</span>' +
        '<h3>' + escapeHtml(t.name) + '</h3><p>' + escapeHtml(t.text) + '</p>' +
        '<ol class="path">' + t.list.map(c => '<li><a href="' + Courses.url(c) + '">' + escapeHtml(c.title) + '</a><span>' + escapeHtml(c.level + ' · ' + Courses.lessonsText(c) + ' · ' + Courses.STATUS[c.status].label) + '</span></li>').join('') + '</ol>' +
        '<a class="btn btn-lime btn-sm" href="catalog.html?track=' + encodeURIComponent(t.name) + '">Все курсы направления ' + icon('arrow') + '</a>';
    };
    if (!tabs.dataset.bound) {
      tabs.dataset.bound = '1';
      tabs.addEventListener('click', e => { const b = e.target.closest('.track-tab'); if (b) showTrack(Number(b.dataset.i)); });
      tabs.addEventListener('keydown', e => {
        const btns = $$('.track-tab', tabs);
        const cur = btns.findIndex(b => b.getAttribute('aria-selected') === 'true');
        let next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (cur + 1) % btns.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (cur - 1 + btns.length) % btns.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = btns.length - 1;
        if (next !== null) { e.preventDefault(); showTrack(next); btns[next].focus(); }
      });
    }
    showTrack = show;
    show(Math.max(0, tracks.findIndex(t => t.name === currentTrack)));
  }

  function renderRoute() {
    const form = $('#starter-form');
    const exp = form.querySelector('input[name="exp"]:checked').value;
    const goal = form.querySelector('input[name="goal"]:checked').value;
    const list = ROUTES[goal][exp].map(byId).filter(Boolean);
    const hours = list.reduce((s, c) => s + (c.hours || 0), 0);
    $('#starter-result').innerHTML =
      '<span class="eyebrow"><b>→</b> Ваш маршрут</span>' +
      '<h3>' + escapeHtml(ROUTE_TITLES[goal]) + '</h3>' +
      '<p>' + list.length + ' ' + UI.plural(list.length, 'курс', 'курса', 'курсов') + (hours ? ', примерно ' + hours + ' ч занятий' : '') + '. Проходите по порядку — каждый следующий опирается на предыдущий.</p>' +
      '<ol class="route">' + list.map(c => '<li><a href="' + Courses.url(c) + '"><span><strong>' + escapeHtml(c.title) + '</strong><small>' + escapeHtml(c.level + ' · ' + Courses.durationText(c) + ' · ' + Courses.STATUS[c.status].label) + '</small></span>' + icon('arrow') + '</a></li>').join('') + '</ol>' +
      (list[0] ? '<a class="btn btn-dark" href="' + Courses.url(list[0]) + '">Начать с первого курса ' + icon('arrow') + '</a>' : '');
  }

  function bindDemoQuiz() {
    const box = $('#demo-q');
    if (!box) return;
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-answer]');
      if (!b) return;
      $$('[data-answer]', box).forEach(x => x.classList.remove('right', 'wrong'));
      const ok = b.dataset.answer === '1';
      b.classList.add(ok ? 'right' : 'wrong');
      $('#demo-feedback').textContent = ok
        ? 'Верно! Без viewport мобильный браузер считает страницу широкой и уменьшает её.'
        : 'Не совсем. Подсказка: страница откроется, но будет выглядеть мелко.';
    });
  }

  function renderAuthor() {
    const a = cfg.author || {};
    if (!a.name) return;
    $('#author-title').textContent = a.name;
    $('#author-intro').textContent = a.intro || a.role || '';
    if (a.photo) {
      $('#author-portrait').innerHTML = '<img src="' + escapeHtml(a.photo) + '" alt="' + escapeHtml(a.name) + '" loading="lazy" decoding="async" width="600" height="600">';
    }
  }

  function renderReviews() {
    const list = (cfg.reviews || []).filter(r => r && r.name && r.text);
    if (!list.length) return;
    $('#reviews-list').innerHTML = list.map(r =>
      '<figure class="review"><blockquote>' + escapeHtml(r.text) + '</blockquote><figcaption><strong>' + escapeHtml(r.name) + '</strong>' +
      (r.course ? ' · ' + escapeHtml(r.course) : '') + (r.date ? ' · ' + escapeHtml(UI.formatDate(r.date)) : '') + '</figcaption></figure>').join('');
    $('#reviews').hidden = false;
  }

  async function init() {
    UI.showHeader('home');
    bindDemoQuiz();
    renderAuthor();
    renderReviews();
    UI.reveal();
    $('#starter-form').addEventListener('change', renderRoute);
    // Сначала встроенный каталог (мгновенно), затем добавляем курсы из таблицы
    courses = await Courses.builtin();
    renderStats(0);
    renderFeatured();
    renderTracks();
    renderRoute();
    try {
      const res = await Courses.all();
      if (res.courses.some(c => c.source === 'sheet')) {
        courses = res.courses;
        renderStats(courses.filter(c => c.source === 'sheet').reduce((s, c) => s + c.lessonsCount, 0));
        renderTracks();
      }
    } catch (e) { /* главная работает и без таблицы */ }
  }

  init();
})();
