// profile.js — личный кабинет: прогресс, мои курсы, избранное, история,
// заметки, подтверждения прохождения и настройки профиля.
(function () {
  'use strict';
  const { $, $$, escapeHtml, icon } = UI;
  const app = $('#app');
  let user, my, catalog = [], full = {};
  let tab = (location.hash || '#courses').slice(1);

  function notes() {
    const list = [];
    const prefix = 'stroka:note:' + user.id + ':';
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) { const v = UI.store.get(k, null); if (v && v.text) list.push(v); }
      }
    } catch (e) { /* хранилище недоступно */ }
    return list.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  }

  function enrolledCourses() {
    return my.enrollments.map(e => {
      const c = full[String(e.course_id)] || catalog.find(x => x.id === String(e.course_id));
      if (!c) return null;
      const p = Courses.progressFor(c, my);
      const last = my.progress.filter(x => String(x.course_id) === c.id).map(x => x.completed_at).sort().pop() || e.enrolled_at;
      return { c, p, e, last };
    }).filter(Boolean).sort((a, b) => String(b.last).localeCompare(String(a.last)));
  }

  function row(c, p, action) {
    return '<div class="row-item">' + Courses.coverMini(c) +
      '<div><h3><a href="' + Courses.url(c) + '">' + escapeHtml(c.title) + '</a></h3><p>' + escapeHtml(c.level + ' · ' + c.track + ' · ' + Courses.STATUS[c.status].label) + '</p></div>' +
      (p ? '<div class="progress-mini"><span class="bar"><i style="width:' + p.percent + '%"></i></span><span>' + (p.completed ? 'Пройден' : p.done + '/' + p.total) + '</span></div>' : '<span></span>') +
      action + '</div>';
  }

  function tabContent() {
    const items = enrolledCourses();
    if (tab === 'favorites') {
      const fav = UI.favorites.list().map(id => catalog.find(c => c.id === id)).filter(Boolean);
      if (!fav.length) return UI.stateBox('empty', 'В избранном пусто', 'Отмечайте курсы сердечком в каталоге, чтобы вернуться к ним позже. Избранное хранится в этом браузере.', '<a class="btn" href="catalog.html">Открыть каталог</a>');
      return '<div class="course-grid">' + fav.map(c => Courses.card(c, Courses.progressFor(c, my))).join('') + '</div>';
    }
    if (tab === 'history') {
      const rows = my.progress.slice().sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))).slice(0, 50);
      if (!rows.length) return UI.stateBox('empty', 'История пока пуста', 'Здесь появятся пройденные уроки и результаты тестов.');
      return '<ol class="history">' + rows.map(r => {
        const c = full[String(r.course_id)];
        const l = c && c.lessons.find(x => x.id === String(r.lesson_id));
        return '<li><time datetime="' + escapeHtml(r.completed_at) + '">' + escapeHtml(UI.formatDate(r.completed_at)) + '</time>' +
          '<strong>' + (l ? '<a href="' + Courses.lessonUrl(l) + '">' + escapeHtml(l.title) + '</a>' : 'Урок ' + escapeHtml(r.lesson_id)) + '</strong>' +
          '<div class="muted" style="font-size:14px">' + escapeHtml(c ? c.title : 'Курс ' + r.course_id) + (r.quiz_score !== '' && r.quiz_score !== undefined && r.quiz_score !== null ? ' · тест: ' + escapeHtml(r.quiz_score) + '%' : '') + '</div></li>';
      }).join('') + '</ol>';
    }
    if (tab === 'notes') {
      const list = notes();
      if (!list.length) return UI.stateBox('empty', 'Заметок пока нет', 'Пишите заметки прямо в уроках — они появятся здесь. Заметки хранятся только в этом браузере.');
      return '<div class="course-grid">' + list.map(n => '<div class="note-card"><span class="tag">' + escapeHtml(n.course) + '</span><h3 style="font-size:1rem;margin:10px 0 0"><a href="lesson.html?id=' + encodeURIComponent(n.lessonId) + '">' + escapeHtml(n.lesson) + '</a></h3><p>' + escapeHtml(n.text.length > 400 ? n.text.slice(0, 400) + '…' : n.text) + '</p></div>').join('') + '</div>';
    }
    if (tab === 'certs') {
      const done = items.filter(x => x.p.completed && x.c.source === 'sheet');
      const note = '<p class="muted" style="font-size:14px">Подтверждение формируется для полных курсов после прохождения всех уроков. Это не документ об образовании.</p>';
      if (!done.length) return UI.stateBox('empty', 'Пока нет завершённых курсов', 'Пройдите все уроки полного курса — здесь появится подтверждение, которое можно распечатать.') + note;
      return '<div class="rows">' + done.map(x => row(x.c, x.p, '<a class="btn btn-sm btn-ghost" href="certificate.html?course=' + encodeURIComponent(x.c.id) + '">Открыть</a>')).join('') + '</div>' + note;
    }
    if (tab === 'settings') {
      return '<div class="split"><form class="form-card" id="profile-form" novalidate><h2 style="font-size:1.3rem">Профиль</h2>' +
        '<div class="field"><label for="p-name">Имя</label><input id="p-name" value="' + escapeHtml(user.name) + '" maxlength="80" required></div>' +
        '<div class="field"><label for="p-email">Email</label><input id="p-email" value="' + escapeHtml(user.email) + '" disabled aria-describedby="p-email-hint"><span class="hint" id="p-email-hint">Чтобы сменить email, напишите автору через форму обратной связи.</span></div>' +
        '<button class="btn" type="submit" id="p-save">Сохранить</button></form>' +
        '<form class="form-card" id="pass-form" novalidate><h2 style="font-size:1.3rem">Смена пароля</h2>' +
        '<div class="field"><label for="pw-cur">Текущий пароль</label><input id="pw-cur" type="password" autocomplete="current-password" required></div>' +
        '<div class="field"><label for="pw-new">Новый пароль</label><input id="pw-new" type="password" autocomplete="new-password" minlength="8" required aria-describedby="pw-hint"><span class="hint" id="pw-hint">Минимум 8 символов. После смены другие устройства выйдут из аккаунта.</span></div>' +
        '<button class="btn" type="submit" id="pw-save">Сменить пароль</button></form>' +
        '<div class="form-card"><h2 style="font-size:1.3rem">Данные и устройство</h2><p class="muted">Прогресс хранится в аккаунте. Заметки, избранное и тема оформления — только в этом браузере.</p>' +
        '<p><a href="privacy.html">Как мы обрабатываем данные</a></p><button class="btn btn-ghost" type="button" id="logout">' + icon('logout') + 'Выйти из аккаунта</button></div></div>';
    }
    // мои курсы
    if (!items.length) return UI.stateBox('empty', 'Вы ещё не начали ни одного курса', 'Откройте любой урок или запишитесь на курс — он появится здесь вместе с прогрессом.', '<a class="btn" href="catalog.html">Выбрать курс</a><a class="btn btn-ghost" href="index.html#start">Подобрать маршрут</a>');
    return '<div class="rows">' + items.map(x => row(x.c, x.p,
      x.p.nextLesson && !x.p.completed ? '<a class="btn btn-sm" href="' + Courses.lessonUrl(x.p.nextLesson) + '">Продолжить</a>' : '<a class="btn btn-sm btn-ghost" href="' + Courses.url(x.c) + '">Открыть</a>')).join('') + '</div>';
  }

  function recommendations(items) {
    const taken = new Set(items.map(x => x.c.id));
    const ids = [];
    items.forEach(x => (x.c.next || []).forEach(n => { if (!taken.has(n) && !ids.includes(n)) ids.push(n); }));
    let list = ids.map(id => catalog.find(c => c.id === id)).filter(Boolean);
    if (!list.length) list = catalog.filter(c => c.featured && !taken.has(c.id));
    return list.slice(0, 4);
  }

  function render() {
    const items = enrolledCourses();
    const done = items.filter(x => x.p.completed || (x.p.total && x.p.percent === 100)).length;
    const current = items.find(x => !x.p.completed && x.p.percent < 100 && x.p.nextLesson);
    const recs = recommendations(items);
    const tabs = [['courses', 'Мои курсы', items.length], ['favorites', 'Избранное', UI.favorites.list().length], ['history', 'История', my.progress.length], ['notes', 'Заметки', notes().length], ['certs', 'Подтверждения', null], ['settings', 'Профиль', null]];
    if (!tabs.some(t => t[0] === tab)) tab = 'courses';
    const hour = new Date().getHours();
    const hello = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

    app.innerHTML =
      '<section class="dash-head"><div class="dash-user"><span class="avatar" aria-hidden="true">' + escapeHtml(UI.initials(user.name)) + '</span><div><span class="eyebrow" style="margin:0 0 6px"><b>~</b> Личный кабинет</span><h1>' + hello + ', ' + escapeHtml(user.name) + '</h1></div></div>' +
      '<div class="muted" style="font-size:14px;text-align:right">' + escapeHtml(user.email) + '<br>' + (user.role === 'admin' ? '<a href="admin.html">Администратор</a>' : 'Ученик') + '</div></section>' +
      '<div class="stats">' +
      '<div class="stat"><strong>' + items.length + '</strong><span>' + UI.plural(items.length, 'курс начат', 'курса начато', 'курсов начато') + '</span></div>' +
      '<div class="stat"><strong>' + done + '</strong><span>' + UI.plural(done, 'курс пройден', 'курса пройдено', 'курсов пройдено') + '</span></div>' +
      '<div class="stat"><strong>' + my.progress.length + '</strong><span>' + UI.plural(my.progress.length, 'урок пройден', 'урока пройдено', 'уроков пройдено') + '</span></div>' +
      '<div class="stat"><strong>' + notes().length + '</strong><span>заметок</span></div></div>' +
      (current ? '<section class="continue"><div><span class="eyebrow on-dark" style="color:inherit"><b>▶</b> Продолжить обучение</span><h2>' + escapeHtml(current.c.title) + '</h2><p>Следующий урок: ' + escapeHtml(current.p.nextLesson.title) + '</p>' +
        '<a class="btn btn-lime" href="' + Courses.lessonUrl(current.p.nextLesson) + '">Продолжить ' + icon('arrow') + '</a></div>' +
        '<div><div class="big-progress"><strong>' + current.p.percent + '%</strong></div><div class="progress-mini"><span class="bar"><i style="width:' + current.p.percent + '%"></i></span></div><p style="margin-top:10px">' + current.p.done + ' из ' + current.p.total + ' ' + UI.plural(current.p.total, 'урока', 'уроков', 'уроков') + '</p></div></section>' : '') +
      '<div class="tabs" role="tablist" aria-label="Разделы кабинета">' + tabs.map(t => '<button class="tab" role="tab" type="button" id="tab-' + t[0] + '" aria-controls="tab-panel" aria-selected="' + (t[0] === tab) + '" data-tab="' + t[0] + '">' + t[1] + (t[2] !== null ? '<span class="count">' + t[2] + '</span>' : '') + '</button>').join('') + '</div>' +
      '<div id="tab-panel" role="tabpanel" aria-labelledby="tab-' + tab + '">' + tabContent() + '</div>' +
      (recs.length ? '<section class="section-tight"><div class="section-head"><div><span class="eyebrow"><b>→</b> Рекомендуем дальше</span><h2>Следующие шаги</h2></div><p>Подобраны по курсам, которые вы уже начали.</p></div><div class="course-grid">' + recs.map(c => Courses.card(c, null)).join('') + '</div></section>' : '');
    bind();
  }

  function bind() {
    UI.bindFavoriteButtons(app);
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      history.replaceState(null, '', '#' + tab);
      render();
      const t = $('#tab-' + tab); if (t) t.focus();
    }));
    const form = $('#profile-form');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#p-name').value.trim();
      if (name.length < 2) { UI.toast('Имя должно содержать минимум 2 символа', 'error'); return; }
      UI.withBusy($('#p-save'), async () => {
        try { user = await DB.updateProfile(name); UI.showHeader('profile'); render(); UI.toast('Профиль сохранён', 'success'); }
        catch (err) { UI.toast(UI.errorText(err), 'error', 6000); }
      });
    });
    const pass = $('#pass-form');
    if (pass) pass.addEventListener('submit', e => {
      e.preventDefault();
      const cur = $('#pw-cur').value, next = $('#pw-new').value;
      if (!cur || next.length < 8) { UI.toast('Введите текущий пароль и новый — не короче 8 символов', 'error'); return; }
      UI.withBusy($('#pw-save'), async () => {
        try { await DB.changePassword(cur, next); pass.reset(); UI.toast('Пароль изменён', 'success'); }
        catch (err) { UI.toast(UI.errorText(err), 'error', 6000); }
      });
    });
    const out = $('#logout');
    if (out) out.addEventListener('click', async () => { await DB.logout(); location.href = 'index.html'; });
  }

  async function init() {
    UI.showHeader('profile');
    user = UI.checkLogin();
    if (!user) return;
    try {
      my = await DB.my();
    } catch (e) {
      if (e.code === 'unauthorized') { location.href = 'login.html?next=profile.html'; return; }
      app.innerHTML = UI.stateBox('error', 'Не удалось загрузить данные кабинета', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>');
      return;
    }
    user = DB.currentUser() || user;
    const res = await Courses.all();
    catalog = res.courses;
    // Полные программы курсов, которые человек проходит (для точного прогресса и истории)
    const ids = [...new Set(my.enrollments.map(e => String(e.course_id)).concat(my.progress.map(p => String(p.course_id))))].slice(0, 30);
    await Promise.all(ids.map(id => Courses.get(id).then(c => { if (c) full[id] = c; }).catch(() => {})));
    // Записи без явной записи на курс (например, урок пройден без записи) — учитываем как начатые
    ids.forEach(id => { if (!my.enrollments.some(e => String(e.course_id) === id) && full[id]) my.enrollments.push({ course_id: id, enrolled_at: '' }); });
    render();
    if (res.sheetError) UI.toast('Курсы из базы автора временно недоступны: ' + UI.errorText(res.sheetError), 'error', 6000);
  }

  init();
})();
