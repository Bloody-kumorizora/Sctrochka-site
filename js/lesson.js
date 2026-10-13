// lesson.js — учебный интерфейс: программа курса, материал урока,
// задания, тест с проверкой, заметки и сохранение прогресса.
(function () {
  'use strict';
  const { $, $$, escapeHtml, icon } = UI;
  const app = $('#app');
  const PASS_PERCENT = 50; // как и раньше: тест засчитывается от 50%
  let course, lesson, my = null, progress = null;
  const user = DB.currentUser();

  const VIDEO_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|rutube\.ru|vk\.com|vkvideo\.ru)\//;

  function navHtml() {
    const p = progress;
    return '<nav class="lesson-nav" aria-label="Программа курса">' +
      '<div class="lesson-nav-head"><a href="' + Courses.url(course) + '">' + escapeHtml(course.title) + '</a>' +
      (p && p.enrolled ? '<div class="progress-mini"><span class="bar"><i style="width:' + p.percent + '%"></i></span><span>' + p.done + '/' + p.total + '</span></div>' : '<span class="muted" style="font-size:13px">' + course.availableLessons.length + ' ' + UI.plural(course.availableLessons.length, 'открытый урок', 'открытых урока', 'открытых уроков') + '</span>') + '</div>' +
      course.modules.map((m, mi) => '<h4>' + (mi + 1) + '. ' + escapeHtml(m.title) + '</h4><ol>' + m.lessons.map(l => {
        const done = p && p.doneIds.has(l.id);
        const dot = '<span class="lesson-dot ' + (done ? 'done' : l.available ? 'open' : '') + '">' + icon(done ? 'check' : l.available ? 'play' : 'lock') + '</span>';
        if (!l.available) return '<li><span title="Урок в разработке">' + dot + escapeHtml(l.title) + '</span></li>';
        return '<li><a href="' + Courses.lessonUrl(l) + '"' + (l.id === lesson.id ? ' aria-current="page"' : '') + '>' + dot + '<span>' + escapeHtml(l.title) + '</span></a></li>';
      }).join('') + '</ol>').join('') + '</nav>';
  }

  function quizHtml() {
    if (!lesson.quiz || !lesson.quiz.length) return '';
    return '<section class="lesson-block" id="quiz" aria-labelledby="quiz-title"><h2 id="quiz-title">' + icon('target') + 'Проверьте себя</h2>' +
      '<form id="quiz-form" novalidate>' + lesson.quiz.map((q, i) =>
        '<fieldset class="quiz-q" id="q' + i + '"><legend>' + (i + 1) + '. ' + Content.inline(q.q) + '</legend>' +
        q.options.map((o, j) => '<label class="quiz-opt"><input type="radio" name="q' + i + '" value="' + j + '"><span>' + Content.inline(o) + '</span></label>').join('') +
        '<div class="quiz-feedback" id="qf' + i + '" aria-live="polite"></div></fieldset>').join('') +
      '<div class="quiz-actions"><button class="btn" type="submit" id="quiz-check">Проверить ответы ' + icon('check') + '</button><span id="quiz-score" class="muted" aria-live="polite"></span></div></form></section>';
  }

  function completeHtml() {
    const done = progress && progress.doneIds.has(lesson.id);
    if (done) return '<div class="msg msg-ok" id="complete-box">' + icon('check') + '<p>Урок пройден. ' + nextLink() + '</p></div>';
    if (!user) {
      return '<section class="lesson-block"><div class="complete-box"><p>Чтобы отмечать уроки и видеть прогресс, войдите в аккаунт. Читать уроки можно и без него.</p>' +
        '<a class="btn" href="login.html?next=' + encodeURIComponent('lesson.html?id=' + lesson.id) + '">Войти</a></div></section>';
    }
    if (lesson.quiz && lesson.quiz.length) {
      return '<div class="msg" id="complete-box">' + icon('info') + '<p>Урок будет отмечен пройденным, когда вы ответите верно хотя бы на половину вопросов теста.</p></div>';
    }
    return '<section class="lesson-block" id="complete-box"><div class="complete-box"><p>Разобрались с материалом и выполнили задания?</p><button class="btn" type="button" id="finish">Отметить урок пройденным ' + icon('check') + '</button></div></section>';
  }

  function nextLink() {
    const list = course.availableLessons;
    const i = list.findIndex(l => l.id === lesson.id);
    const next = list[i + 1];
    if (next) return '<a href="' + Courses.lessonUrl(next) + '">Следующий урок: ' + escapeHtml(next.title) + ' →</a>';
    if (progress && progress.completed && course.source === 'sheet') return '<a href="certificate.html?course=' + encodeURIComponent(course.id) + '">Курс пройден — открыть подтверждение →</a>';
    return '<a href="' + Courses.url(course) + '">Вернуться к программе курса →</a>';
  }

  function render() {
    const list = course.availableLessons;
    const i = list.findIndex(l => l.id === lesson.id);
    const prev = list[i - 1], next = list[i + 1];
    const mIndex = lesson.moduleIndex;
    let html = '<div class="container"><div class="lesson-layout">' + navHtml() +
      '<article class="lesson-main">' +
      '<ol class="crumbs" aria-label="Навигация"><li><a href="catalog.html">Каталог</a></li><li><a href="' + Courses.url(course) + '">' + escapeHtml(course.title) + '</a></li></ol>' +
      '<span class="eyebrow"><b>' + (mIndex + 1) + '.' + (course.modules[mIndex].lessons.indexOf(lesson) + 1) + '</b> ' + escapeHtml(lesson.moduleTitle) + (lesson.minutes ? ' · ' + lesson.minutes + ' мин' : '') + '</span>' +
      '<h1>' + escapeHtml(lesson.title) + '</h1>' +
      (lesson.summary ? '<p class="lead">' + escapeHtml(lesson.summary) + '</p>' : '');
    if (course.source === 'builtin' && course.status !== 'full') {
      html += '<p class="muted" style="font-size:14px">' + icon('info') + ' Открытый урок демо-версии курса. Остальные уроки программы в разработке.</p>';
    }
    if (lesson.type === 'video' && lesson.video) {
      html += VIDEO_HOSTS.test(lesson.video)
        ? '<iframe class="video" src="' + escapeHtml(lesson.video) + '" title="Видео: ' + escapeHtml(lesson.title) + '" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>'
        : '<div class="msg msg-warn">' + icon('alert') + '<p>Видео не может быть показано: адрес не относится к поддерживаемым сервисам.</p></div>';
    }
    html += '<div class="prose">' + Content.render(lesson.content) + '</div>';
    if (lesson.tasks && lesson.tasks.length) {
      html += '<section class="lesson-block" aria-labelledby="tasks-title"><h2 id="tasks-title">' + icon('code') + 'Практические задания</h2><ol class="task-list">' +
        lesson.tasks.map(t => '<li><span>' + Content.inline(t) + '</span></li>').join('') + '</ol></section>';
    }
    html += quizHtml();
    html += '<section class="lesson-block notes" aria-labelledby="notes-title"><h2 id="notes-title">' + icon('note') + 'Заметки к уроку</h2>' +
      '<label class="sr-only" for="note">Текст заметки</label><textarea id="note" placeholder="Что важно запомнить, вопросы, ссылки…" maxlength="5000"></textarea>' +
      '<p class="notes-status" id="note-status">Заметки сохраняются автоматически в этом браузере.</p></section>';
    html += '<div style="margin-top:28px">' + completeHtml() + '</div>';
    html += '<nav class="pager" aria-label="Соседние уроки">' +
      (prev ? '<a class="prev" href="' + Courses.lessonUrl(prev) + '" rel="prev"><small>' + icon('back') + 'Предыдущий</small><strong>' + escapeHtml(prev.title) + '</strong></a>' : '<span></span>') +
      (next ? '<a class="next" href="' + Courses.lessonUrl(next) + '" rel="next"><small>Следующий' + icon('arrow') + '</small><strong>' + escapeHtml(next.title) + '</strong></a>'
        : '<a class="next" href="' + Courses.url(course) + '"><small>Дальше' + icon('arrow') + '</small><strong>К программе курса</strong></a>') +
      '</nav></article></div></div>';
    app.innerHTML = html;
    bind(prev, next);
  }

  /* ---------------- заметки ---------------- */
  function noteKey() { return 'stroka:note:' + (user ? user.id : 'guest') + ':' + lesson.id; }
  function bindNotes() {
    const ta = $('#note'), status = $('#note-status');
    const saved = UI.store.get(noteKey(), null);
    if (saved && saved.text) ta.value = saved.text;
    ta.addEventListener('input', UI.debounce(() => {
      const text = ta.value;
      if (text.trim()) UI.store.set(noteKey(), { text, lesson: lesson.title, course: course.title, courseId: course.id, lessonId: lesson.id, updated: new Date().toISOString() });
      else { try { localStorage.removeItem(noteKey()); } catch (e) { /* ignore */ } }
      status.textContent = 'Сохранено в этом браузере · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }, 500));
  }

  /* ---------------- прохождение ---------------- */
  async function complete(score) {
    if (!user) return;
    const box = $('#complete-box');
    try {
      const enrollment = await DB.completeLesson(course.id, lesson.id, score, course.lessons.map(l => l.id));
      my = await DB.my({ fresh: true }).catch(() => my);
      progress = Courses.progressFor(course, my || { enrollments: [enrollment], progress: [] });
      progress.doneIds.add(lesson.id);
      if (enrollment && enrollment.completed_at) progress.completed = true;
      box.outerHTML = completeHtml();
      $('.lesson-nav').outerHTML = navHtml();
      UI.toast(progress.completed && course.source === 'sheet' ? 'Поздравляем! Курс пройден полностью.' : 'Урок отмечен пройденным', 'success');
    } catch (e) {
      UI.toast('Прогресс не сохранён: ' + UI.errorText(e), 'error', 7000);
      throw e;
    }
  }

  function checkQuiz(e) {
    e.preventDefault();
    const btn = $('#quiz-check');
    let correct = 0, answered = 0;
    lesson.quiz.forEach((q, i) => {
      const fs = $('#q' + i);
      const chosen = fs.querySelector('input:checked');
      $$('.quiz-opt', fs).forEach(l => l.classList.remove('right', 'wrong'));
      const fb = $('#qf' + i);
      if (!chosen) { fb.className = 'quiz-feedback no'; fb.textContent = 'Выберите вариант ответа.'; return; }
      answered++;
      const ok = Number(chosen.value) === Number(q.answer);
      if (ok) correct++;
      chosen.closest('.quiz-opt').classList.add(ok ? 'right' : 'wrong');
      fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'no');
      fb.innerHTML = (ok ? 'Верно. ' : 'Неверно — попробуйте ещё раз. ') + (ok && q.explain ? Content.inline(q.explain) : '');
    });
    const total = lesson.quiz.length;
    const percent = Math.round(correct / total * 100);
    const score = $('#quiz-score');
    if (answered < total) { score.textContent = 'Ответьте на все вопросы: ' + answered + ' из ' + total + '.'; return; }
    score.textContent = 'Результат: ' + correct + ' из ' + total + (percent >= PASS_PERCENT ? ' — тест пройден.' : ' — нужно хотя бы ' + Math.ceil(total * PASS_PERCENT / 100) + '.');
    const already = progress && progress.doneIds.has(lesson.id);
    if (percent >= PASS_PERCENT && user && !already) UI.withBusy(btn, () => complete(percent).catch(() => {}));
    else if (percent >= PASS_PERCENT && !user) UI.toast('Тест пройден! Войдите, чтобы сохранить результат.', 'info', 5000);
  }

  function bind(prev, next) {
    bindNotes();
    const form = $('#quiz-form');
    if (form) form.addEventListener('submit', checkQuiz);
    const finish = $('#finish');
    if (finish) finish.addEventListener('click', () => UI.withBusy(finish, () => complete('').catch(() => {})));
    document.addEventListener('keydown', e => {
      if (!e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && prev) location.href = Courses.lessonUrl(prev);
      if (e.key === 'ArrowRight' && next) location.href = Courses.lessonUrl(next);
    });
    // прокрутить меню к текущему уроку
    const cur = $('.lesson-nav [aria-current="page"]');
    if (cur && window.innerWidth > 960) cur.scrollIntoView({ block: 'center' });
  }

  function stateScreen(type, title, text, actions) {
    app.innerHTML = '<div class="container section">' + UI.stateBox(type, title, text, actions) + '</div>';
  }

  async function init() {
    UI.showHeader('catalog');
    const id = UI.getParam('id');
    let found;
    try { found = await Courses.findLesson(id); } catch (e) {
      stateScreen('error', 'Не удалось загрузить урок', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>');
      return;
    }
    if (!found) {
      UI.setMeta({ title: 'Урок не найден', noindex: true });
      stateScreen('empty', 'Урок не найден', 'Возможно, ссылка устарела.', '<a class="btn" href="catalog.html">В каталог</a>');
      return;
    }
    course = found.course;
    lesson = found.lesson;
    UI.setMeta({
      title: lesson.title + ' · ' + course.title,
      description: lesson.summary || course.description,
      path: 'lesson.html?id=' + encodeURIComponent(lesson.id),
      type: 'article',
      noindex: course.source === 'sheet'
    });
    if (!lesson.available) {
      stateScreen('lock', 'Урок в разработке', 'Этот урок есть в программе курса, но ещё не опубликован. ' + (lesson.summary ? 'О чём он: ' + lesson.summary + '.' : ''), '<a class="btn" href="' + Courses.url(course) + '">К программе курса</a>');
      return;
    }
    if (user) {
      try { my = await DB.my(); progress = Courses.progressFor(course, my); }
      catch (e) { if (course.source === 'sheet') { stateScreen('error', 'Не удалось проверить доступ', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>'); return; } }
    }
    // Уроки курсов из таблицы, как и раньше, доступны после записи на курс
    if (course.source === 'sheet') {
      if (!user) {
        stateScreen('lock', 'Войдите, чтобы открыть урок', 'Уроки этого курса доступны после входа и записи на курс.', '<a class="btn" href="login.html?next=' + encodeURIComponent('lesson.html?id=' + lesson.id) + '">Войти</a><a class="btn btn-ghost" href="' + Courses.url(course) + '">О курсе</a>');
        return;
      }
      if (!progress || !progress.enrolled) {
        stateScreen('lock', 'Сначала запишитесь на курс', 'После записи откроются все уроки и сохранение прогресса.', '<a class="btn" href="' + Courses.url(course) + '">Перейти к курсу</a>');
        return;
      }
    }
    render();
  }

  init();
})();
