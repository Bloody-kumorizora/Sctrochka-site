// about.js — страница «Об авторе». Всё личное берётся из js/config.js (author).
// Пустые поля не показываются: на сайте нет выдуманных данных.
(function () {
  'use strict';
  const { $, escapeHtml, icon, cfg } = UI;
  const a = cfg.author || {};
  const has = v => Array.isArray(v) ? v.length > 0 : !!v;

  const PRINCIPLES = [
    ['Сначала — зачем', 'Каждая тема начинается с задачи, которую она решает, а не с определения.'],
    ['Маленькие шаги', 'Урок занимает 10–20 минут: одна идея, примеры и сразу практика.'],
    ['Руками, а не глазами', 'Задания нужно выполнить в редакторе. Тест проверяет понимание, а не память.'],
    ['Честно о статусе', 'Если урок ещё в разработке, это видно в программе. Никаких «скоро» без отметки.']
  ];

  function devHint() {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
    if (!local || has(a.name)) return '';
    return '<div class="msg msg-warn">' + icon('info') + '<p><strong>Подсказка для владельца сайта</strong> (видна только при локальном запуске): заполните раздел <code>author</code> в <code>js/config.js</code> — имя, фото, рассказ о себе, навыки, проекты и контакты. Пустые поля на сайте не показываются.</p></div>';
  }

  function render() {
    const name = a.name || 'Автор Stroka';
    const contacts = UI.contactLinks('contact-link');
    let html = '<div class="container">' + devHint() +
      '<section class="author-hero"><div>' +
      '<span class="eyebrow"><b>@</b> Об авторе</span>' +
      '<h1>' + escapeHtml(a.name ? a.name : 'Авторский проект о веб-разработке') + '</h1>' +
      (a.role ? '<p class="subtitle" style="font-size:1.3rem">' + escapeHtml(a.role) + '</p>' : '') +
      '<p class="lead">' + escapeHtml(a.intro || 'Stroka создаётся одним автором: программы курсов, уроки, задания и сама платформа. Цель — сделать понятный путь в веб-разработку без лишнего шума.') + '</p>' +
      '<div class="hero-actions"><a class="btn" href="#contact">Написать ' + icon('send') + '</a><a class="btn btn-ghost" href="catalog.html">Смотреть курсы</a></div>' +
      (contacts ? '<div class="contact-list" style="margin-top:24px">' + contacts + '</div>' : '') +
      '</div><div class="portrait">' +
      (a.photo ? '<img src="' + escapeHtml(a.photo) + '" alt="' + escapeHtml(name) + '" width="800" height="800" decoding="async">' : '<span class="portrait-mono" aria-hidden="true">' + escapeHtml(a.name ? UI.initials(a.name) : 's') + '<span class="type-caret"></span></span>') +
      '</div></section>';

    if (has(a.about)) {
      html += '<section class="section-tight"><div class="split"><div><span class="eyebrow"><b>01</b> Чем занимаюсь</span><h2>Обо мне</h2></div><div class="prose">' + a.about.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + '</div></div></section>';
    }
    if (has(a.skills)) {
      html += '<section class="section-tight"><div class="split"><div><span class="eyebrow"><b>02</b> Навыки</span><h2>С чем работаю</h2></div><div class="skills">' + a.skills.map(s => '<span class="tag">' + escapeHtml(s) + '</span>').join('') + '</div></div></section>';
    }
    if (has(a.projects)) {
      html += '<section class="section-tight"><span class="eyebrow"><b>03</b> Портфолио</span><h2>Проекты</h2><div class="proj-list" style="margin-top:28px">' +
        a.projects.filter(p => p && p.title).map(p => '<div class="proj"><h3>' + escapeHtml(p.title) + '</h3>' + (p.description ? '<p>' + escapeHtml(p.description) + '</p>' : '') +
          (p.stack ? '<span class="tag">' + escapeHtml(p.stack) + '</span>' : '') +
          (p.url && /^https?:\/\//.test(p.url) ? '<p style="margin-top:16px"><a class="btn btn-lime btn-sm" href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener noreferrer">Открыть проект ' + icon('arrow') + '</a></p>' : '') + '</div>').join('') +
        '</div></section>';
    }
    const approach = has(a.approach) ? a.approach.map((t, i) => [String(i + 1).padStart(2, '0'), t]) : null;
    html += '<section class="section-tight"><span class="eyebrow"><b>04</b> Подход</span><h2>Как устроено обучение</h2><div class="tasks" style="margin-top:28px">' +
      (approach ? approach.map(x => '<div class="task"><p style="color:var(--ink)">' + escapeHtml(x[1]) + '</p></div>').join('')
        : PRINCIPLES.map(p => '<div class="task"><h3>' + escapeHtml(p[0]) + '</h3><p>' + escapeHtml(p[1]) + '</p></div>').join('')) +
      '</div></section>';

    html += '<section class="section" id="contact"><div class="split"><div><span class="eyebrow"><b>05</b> Связь</span><h2>Напишите автору</h2>' +
      '<p class="lead">Вопрос по курсу, идея для урока, найденная ошибка или предложение о сотрудничестве — всё сюда.</p>' +
      (contacts ? '<div class="contact-list">' + contacts + '</div>' : '') + '</div><div id="about-form"></div></div></section></div>';

    $('#app').innerHTML = html;
    Feedback.mount($('#about-form'), { id: 'about-feedback' });
    if (location.hash === '#contact') $('#contact').scrollIntoView();
  }

  UI.showHeader('about');
  if (a.name) UI.setMeta({ title: 'Об авторе — ' + a.name, description: a.intro || undefined, path: 'about.html' });
  render();
})();
