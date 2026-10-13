// course.js — страница курса: описание, программа, практика, проекты,
// похожие курсы и карточка с записью/прогрессом.
(function () {
  'use strict';
  const { $, $$, escapeHtml, icon } = UI;
  const app = $('#app');
  let course = null;
  let my = null;

  function list(items) {
    return '<ul>' + items.map(x => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>';
  }

  function actionCard() {
    const user = DB.currentUser();
    const p = my ? Courses.progressFor(course, my) : null;
    const s = Courses.STATUS[course.status];
    let body = '';
    if (p && p.enrolled) {
      body += '<div><span class="eyebrow"><b>%</b> Ваш прогресс</span><div class="big-progress"><strong>' + p.percent + '%</strong><span class="muted">' + p.done + ' из ' + p.total + ' ' + (course.status === 'demo' ? 'открытых ' : '') + UI.plural(p.total, 'урока', 'уроков', 'уроков') + '</span></div>' +
        '<div class="progress-mini"><span class="bar"><i style="width:' + p.percent + '%"></i></span></div></div>';
      if (p.completed && course.source === 'sheet') {
        body += '<a class="btn btn-lg" href="certificate.html?course=' + encodeURIComponent(course.id) + '">Подтверждение прохождения ' + icon('arrow') + '</a>';
      } else if (p.nextLesson) {
        body += '<a class="btn btn-lg" href="' + Courses.lessonUrl(p.nextLesson) + '">' + (p.done ? 'Продолжить обучение' : 'Начать обучение') + ' ' + icon('arrow') + '</a>';
      }
    } else if (course.source === 'sheet') {
      body += '<p class="action-note">После записи уроки и прогресс будут доступны в личном кабинете.</p>';
      body += user
        ? '<button class="btn btn-lg" type="button" id="enroll">Записаться на курс ' + icon('arrow') + '</button>'
        : '<a class="btn btn-lg" href="login.html?next=' + encodeURIComponent('course.html?id=' + course.id) + '">Войти и записаться ' + icon('arrow') + '</a>';
    } else if (course.availableLessons.length) {
      body += '<p class="action-note">Открыто ' + course.availableLessons.length + ' ' + UI.plural(course.availableLessons.length, 'урок', 'урока', 'уроков') + ' из ' + course.lessons.length + '. Читать можно без регистрации, а чтобы сохранять прогресс — войдите.</p>';
      body += '<a class="btn btn-lg" href="' + Courses.lessonUrl(course.availableLessons[0]) + '">Начать с первого урока ' + icon('arrow') + '</a>';
      if (user) body += '<button class="btn btn-ghost" type="button" id="enroll">Добавить в мои курсы</button>';
    } else {
      body += '<p class="action-note">Программа опубликована, уроки готовятся. Добавьте курс в избранное, чтобы не потерять его, или задайте вопрос автору.</p>';
      body += '<a class="btn btn-ghost" href="help.html#contact">Задать вопрос автору</a>';
    }
    body += '<div class="action-row"><button class="btn btn-ghost btn-sm" type="button" data-fav="' + escapeHtml(course.id) + '" aria-pressed="false">' + icon('heart') + '<span data-fav-text>В избранное</span></button>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="share">' + icon('send') + 'Поделиться</button></div>';
    body += '<p class="action-note">' + icon('info') + ' ' + escapeHtml(s.label + ': ' + s.hint.toLowerCase()) + '.</p>';
    return '<aside class="action-card" aria-label="Обучение на курсе">' + Courses.cover(course) + '<div class="action-body" id="action-body">' + body + '</div></aside>';
  }

  function lessonRow(l, p) {
    const done = p && p.doneIds.has(l.id);
    const dot = '<span class="lesson-dot ' + (done ? 'done' : l.available ? 'open' : '') + '">' + icon(done ? 'check' : l.available ? 'play' : 'lock') + '</span>';
    const meta = l.available ? (l.minutes ? l.minutes + ' мин' : (l.type === 'video' ? 'видео' : 'текст')) + ((l.quiz && l.quiz.length) ? ' · тест' : '') : 'в разработке';
    const title = l.available
      ? '<a href="' + Courses.lessonUrl(l) + '">' + escapeHtml(l.title) + '</a>'
      : '<span class="soon">' + escapeHtml(l.title) + '</span>';
    return '<li class="lesson-item">' + dot + '<div>' + title + (l.summary ? '<small>' + escapeHtml(l.summary) + '</small>' : '') + '</div><span class="lesson-tag">' + meta + (done ? ' · пройден' : '') + '</span></li>';
  }

  function program(p) {
    if (!course.modules.length) return UI.stateBox('empty', 'В курсе пока нет уроков', 'Автор добавит их в ближайшее время.');
    return '<div class="program">' + course.modules.map((m, i) => {
      const open = m.lessons.filter(l => l.available).length;
      return '<details class="module"' + (i === 0 ? ' open' : '') + '><summary><span class="module-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="module-title">' + escapeHtml(m.title) + (m.summary ? '<small>' + escapeHtml(m.summary) + '</small>' : '') + '</span>' +
        '<span class="module-meta">' + m.lessons.length + ' ' + UI.plural(m.lessons.length, 'урок', 'урока', 'уроков') + (course.source === 'builtin' && open ? ' · открыто ' + open : '') + '</span></summary>' +
        '<ol class="lesson-list">' + m.lessons.map(l => lessonRow(l, p)).join('') + '</ol></details>';
    }).join('') + '</div>';
  }

  function practice() {
    const tasks = [];
    course.availableLessons.forEach(l => (l.tasks || []).forEach(t => tasks.push({ t, l })));
    if (!tasks.length) return '';
    return '<section class="section-tight" id="practice"><div class="container"><div class="section-head"><div><span class="eyebrow"><b>03</b> Практика</span><h2>Задания из открытых уроков</h2></div><p>Каждый урок заканчивается заданиями, которые нужно выполнить руками, и коротким тестом.</p></div>' +
      '<div class="tasks">' + tasks.slice(0, 6).map(x => '<div class="task"><h3>' + UI.escapeHtml(x.l.title) + '</h3><p>' + Content.inline(x.t) + '</p><a class="tag" href="' + Courses.lessonUrl(x.l) + '">к уроку →</a></div>').join('') + '</div></div></section>';
  }

  function render() {
    const p = my ? Courses.progressFor(course, my) : null;
    const facts = [
      ['Уровень', course.level],
      ['Длительность', Courses.durationText(course) || '—'],
      ['Уроков', course.lessons.length + (course.source === 'builtin' ? ' (открыто ' + course.availableLessons.length + ')' : '')],
      ['Формат', course.format]
    ];
    let html =
      '<div class="container"><section class="course-hero">' +
      '<div><ol class="crumbs" aria-label="Навигация"><li><a href="index.html">Главная</a></li><li><a href="catalog.html">Каталог</a></li><li><a href="catalog.html?track=' + encodeURIComponent(course.track) + '">' + escapeHtml(course.track) + '</a></li></ol>' +
      '<div class="chips">' + Courses.statusBadge(course) + course.tags.slice(0, 4).map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('') + '</div>' +
      '<h1>' + escapeHtml(course.title) + '</h1>' +
      (course.subtitle ? '<p class="subtitle">' + escapeHtml(course.subtitle) + '</p>' : '') +
      '<p class="lead">' + escapeHtml(course.description) + '</p>' +
      (course.instructor ? '<p class="muted">Автор курса: ' + escapeHtml(course.instructor) + '</p>' : '') +
      '<dl class="course-facts">' + facts.map(f => '<div><dt>' + f[0] + '</dt><dd>' + escapeHtml(f[1]) + '</dd></div>').join('') + '</dl>' +
      '</div>' + actionCard() + '</section></div>';

    html += '<nav class="subnav" aria-label="Разделы курса"><div class="container">' +
      (course.audience.length || course.outcomes.length ? '<a href="#about">О курсе</a>' : '') + '<a href="#program">Программа</a>' +
      (course.availableLessons.some(l => l.tasks && l.tasks.length) ? '<a href="#practice">Практика</a>' : '') +
      (course.projects && course.projects.length ? '<a href="#projects">Проекты</a>' : '') + '<a href="#related">Похожие</a></div></nav>';

    if (course.audience.length || course.requirements.length || course.outcomes.length) {
      html += '<section class="section-tight" id="about"><div class="container">' +
        '<div class="section-head"><div><span class="eyebrow"><b>01</b> О курсе</span><h2>Кому подойдёт и что вы получите</h2></div></div>' +
        '<div class="about-grid">' +
        (course.audience.length ? '<div class="info-card"><h3>' + icon('user') + 'Для кого</h3>' + list(course.audience) + '</div>' : '') +
        (course.requirements.length ? '<div class="info-card"><h3>' + icon('target') + 'Что нужно для старта</h3>' + list(course.requirements) + '</div>' : '') +
        (course.projects && course.projects.length ? '<div class="info-card"><h3>' + icon('code') + 'Итоговые проекты</h3>' + list(course.projects.map(x => x.title)) + '</div>' : '') +
        '</div>' +
        (course.outcomes.length ? '<h3 style="margin:40px 0 16px">Чему вы научитесь</h3><ul class="outcomes">' + course.outcomes.map(o => '<li>' + icon('check') + '<span>' + escapeHtml(o) + '</span></li>').join('') + '</ul>' : '') +
        '</div></section>';
    }

    html += '<section class="section-tight" id="program"><div class="container"><div class="section-head"><div><span class="eyebrow"><b>02</b> Программа</span><h2>' + course.modules.length + ' ' + UI.plural(course.modules.length, 'модуль', 'модуля', 'модулей') + ', ' + course.lessons.length + ' ' + UI.plural(course.lessons.length, 'урок', 'урока', 'уроков') + '</h2></div>' +
      '<p>' + (course.source === 'builtin' ? 'Уроки с отметкой ' + '«в разработке» ещё готовятся: их программа опубликована, чтобы вы видели весь путь заранее.' : 'Модули раскрываются по клику. Пройденные уроки отмечаются галочкой.') + '</p></div>' + program(p) + '</div></section>';

    html += practice();

    if (course.projects && course.projects.length) {
      html += '<section class="section-tight" id="projects"><div class="container"><div class="section-head"><div><span class="eyebrow"><b>04</b> Проекты</span><h2>Что получится в итоге</h2></div></div><div class="proj-list">' +
        course.projects.map(x => '<div class="proj"><h3>' + escapeHtml(x.title) + '</h3><p>' + escapeHtml(x.description) + '</p>' + (x.stack || []).map(s => '<span class="tag">' + escapeHtml(s) + '</span>').join('') + '</div>').join('') + '</div></div></section>';
    }

    html += '<section class="section-tight" id="related" style="padding-bottom:96px"><div class="container"><div class="section-head"><div><span class="eyebrow"><b>05</b> Дальше</span><h2>Похожие курсы</h2></div></div><div class="course-grid" id="related-list"><div class="course-card skeleton" style="height:180px"></div><div class="course-card skeleton" style="height:180px"></div></div></div></section>';

    app.innerHTML = html;
    UI.bindFavoriteButtons(app);
    bindActions();
    renderRelated();
  }

  async function renderRelated() {
    const box = $('#related-list');
    try {
      const res = await Promise.race([Courses.all(), new Promise(r => setTimeout(() => r(null), 2500))]);
      const pool = res ? res.courses : await Courses.builtin();
      const rel = Courses.related(course, pool, 4);
      box.innerHTML = rel.length ? rel.map(c => Courses.card(c, my ? Courses.progressFor(c, my) : null)).join('') : '<p class="muted">Похожих курсов пока нет. <a href="catalog.html">Весь каталог →</a></p>';
      UI.bindFavoriteButtons(box);
    } catch (e) {
      box.innerHTML = '<p class="muted">' + escapeHtml(UI.errorText(e)) + '</p>';
    }
  }

  function bindActions() {
    const enroll = $('#enroll');
    if (enroll) {
      enroll.addEventListener('click', () => UI.withBusy(enroll, async () => {
        try {
          await DB.enroll(course.id);
          my = await DB.my({ fresh: true });
          UI.toast('Курс добавлен в ваши курсы', 'success');
          render();
        } catch (e) { UI.toast(UI.errorText(e), 'error', 6000); }
      }));
    }
    $('#share').addEventListener('click', async () => {
      const url = location.href;
      if (navigator.share) {
        try { await navigator.share({ title: course.title, url }); } catch (e) { /* отмена */ }
        return;
      }
      try { await navigator.clipboard.writeText(url); UI.toast('Ссылка на курс скопирована', 'success'); }
      catch (e) { UI.toast('Скопируйте адрес из строки браузера', 'info'); }
    });
    // подсветка текущего раздела в навигации курса
    if ('IntersectionObserver' in window) {
      const links = $$('.subnav a');
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      }), { rootMargin: '-40% 0px -55% 0px' });
      links.forEach(a => { const t = document.querySelector(a.getAttribute('href')); if (t) io.observe(t); });
    }
  }

  async function init() {
    UI.showHeader('catalog');
    const id = UI.getParam('id');
    try {
      course = await Courses.get(id);
    } catch (e) {
      app.innerHTML = '<div class="container section">' + UI.stateBox('error', 'Не удалось загрузить курс', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button><a class="btn btn-ghost" href="catalog.html">В каталог</a>') + '</div>';
      return;
    }
    if (!course) {
      UI.setMeta({ title: 'Курс не найден', noindex: true });
      app.innerHTML = '<div class="container section">' + UI.stateBox('empty', 'Курс не найден', 'Возможно, ссылка устарела или курс снят с публикации.', '<a class="btn" href="catalog.html">Открыть каталог</a>') + '</div>';
      return;
    }
    UI.setMeta({ title: course.title, description: (course.subtitle ? course.subtitle + '. ' : '') + course.description, path: 'course.html?id=' + encodeURIComponent(course.id) });
    UI.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.title,
      description: course.description,
      inLanguage: 'ru',
      educationalLevel: course.level,
      provider: { '@type': 'Organization', name: UI.BRAND, url: UI.absoluteUrl('index.html') },
      isAccessibleForFree: true,
      url: UI.absoluteUrl('course.html?id=' + encodeURIComponent(course.id))
    });
    render();
    if (DB.currentUser()) {
      try { my = await DB.my(); render(); } catch (e) { UI.toast('Не удалось загрузить ваш прогресс: ' + UI.errorText(e), 'error', 6000); }
    }
  }

  init();
})();
