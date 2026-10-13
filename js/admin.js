// admin.js — администрирование курсов из Google Таблицы.
// Права проверяются на сервере (Apps Script v2). Проверка роли здесь —
// только чтобы не показывать интерфейс тем, кому он не нужен.
(function () {
  'use strict';
  const { $, $$, escapeHtml, icon } = UI;
  const app = $('#app');

  const SHEETS = {
    courses: {
      title: 'Курсы',
      fields: ['title', 'description', 'category', 'level', 'duration', 'instructor', 'status', 'image_url', 'subtitle', 'format', 'tags', 'audience', 'requirements', 'outcomes'],
      columns: ['title', 'category', 'level', 'status']
    },
    lessons: {
      title: 'Уроки',
      fields: ['course_id', 'module', 'order', 'title', 'type', 'content', 'video_url'],
      columns: ['order', 'module', 'title', 'type']
    },
    questions: {
      title: 'Вопросы тестов',
      fields: ['lesson_id', 'question', 'options', 'correct_index'],
      columns: ['lesson_id', 'question', 'correct_index']
    }
  };
  const LABELS = {
    title: 'Название', description: 'Описание', category: 'Направление (категория)', level: 'Уровень', duration: 'Длительность',
    instructor: 'Автор курса', status: 'Статус', image_url: 'Обложка (https-ссылка, необязательно)', subtitle: 'Подзаголовок',
    format: 'Формат', tags: 'Теги через запятую', audience: 'Для кого (каждый пункт с новой строки)', requirements: 'Требования (с новой строки)',
    outcomes: 'Результаты (с новой строки)', course_id: 'Курс', module: 'Модуль', order: 'Порядковый номер', type: 'Тип',
    content: 'Текст урока (поддерживается Markdown: ## заголовки, списки, ```код```)', video_url: 'Видео (ссылка для встраивания)',
    lesson_id: 'Урок', question: 'Вопрос', options: 'Варианты ответа (каждый с новой строки)', correct_index: 'Верный вариант'
  };
  const NUMBER_FIELDS = ['course_id', 'order', 'lesson_id', 'correct_index'];
  const LONG = ['description', 'content', 'audience', 'requirements', 'outcomes', 'options'];
  const REQUIRED = { courses: ['title', 'description', 'category', 'level', 'status'], lessons: ['course_id', 'title', 'order'], questions: ['lesson_id', 'question', 'options'] };

  let mode = 'legacy';
  let tab = (location.hash || '#overview').slice(1);
  let data = { courses: [], lessons: [], questions: [] };
  let editing = null;       // { sheet, id|null }
  let requestId = null;     // защита от двойной отправки новой записи
  let filterCourse = '';
  let filterLesson = '';

  /* ---------------- загрузка ---------------- */
  async function load(sheet) {
    data[sheet] = await DB.admin.list(sheet);
    return data[sheet];
  }

  /* ---------------- форма записи ---------------- */
  function fieldHtml(sheet, f, row) {
    let v = row[f] === undefined || row[f] === null ? '' : row[f];
    if (f === 'options') v = String(v).split('|').join('\n');
    const id = 'f-' + f;
    const label = '<label for="' + id + '">' + LABELS[f] + (REQUIRED[sheet].includes(f) ? ' *' : '') + '</label>';
    if (f === 'status') return '<div class="field">' + label + '<select id="' + id + '"><option value="draft"' + (v === 'draft' || !v ? ' selected' : '') + '>Черновик (не виден на сайте)</option><option value="published"' + (v === 'published' ? ' selected' : '') + '>Опубликован</option></select></div>';
    if (f === 'level') return '<div class="field">' + label + '<select id="' + id + '">' + Courses.LEVELS.map(l => '<option' + (l === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
    if (f === 'type') return '<div class="field">' + label + '<select id="' + id + '"><option value="text"' + (v !== 'video' ? ' selected' : '') + '>Текст</option><option value="video"' + (v === 'video' ? ' selected' : '') + '>Видео</option></select></div>';
    if (f === 'course_id') return '<div class="field">' + label + '<select id="' + id + '">' + data.courses.map(c => '<option value="' + c.id + '"' + (String(c.id) === String(v || filterCourse) ? ' selected' : '') + '>' + escapeHtml(c.id + ' · ' + c.title) + '</option>').join('') + '</select></div>';
    if (f === 'lesson_id') return '<div class="field">' + label + '<select id="' + id + '">' + data.lessons.map(l => '<option value="' + l.id + '"' + (String(l.id) === String(v || filterLesson) ? ' selected' : '') + '>' + escapeHtml(l.id + ' · ' + l.title) + '</option>').join('') + '</select></div>';
    if (f === 'category') return '<div class="field">' + label + '<input id="' + id + '" list="cat-list" value="' + escapeHtml(v) + '" maxlength="120"><datalist id="cat-list">' + categories().map(c => '<option value="' + escapeHtml(c.name) + '">').join('') + '</datalist></div>';
    if (f === 'correct_index') {
      const opts = String(row.options || '').split('|');
      return '<div class="field">' + label + '<input id="' + id + '" type="number" min="1" value="' + (v === '' ? 1 : Number(v) + 1) + '"><span class="hint">Номер верного варианта, начиная с 1' + (opts.length > 1 ? ' (сейчас вариантов: ' + opts.length + ')' : '') + '</span></div>';
    }
    if (LONG.includes(f)) return '<div class="field">' + label + '<textarea id="' + id + '" rows="' + (f === 'content' ? 14 : 4) + '">' + escapeHtml(v) + '</textarea></div>';
    return '<div class="field">' + label + '<input id="' + id + '" value="' + escapeHtml(v) + '"' + (NUMBER_FIELDS.includes(f) ? ' type="number"' : '') + '></div>';
  }

  function formHtml(sheet) {
    const cfg = SHEETS[sheet];
    const row = editing && editing.id ? (data[sheet].find(r => String(r.id) === String(editing.id)) || {}) : {};
    // Прежний скрипт может не уметь добавлять столбцы — в этом режиме только исходные поля таблицы
    const extra = ['subtitle', 'format', 'tags', 'audience', 'requirements', 'outcomes'];
    const fields = cfg.fields.filter(f => mode !== 'legacy' || sheet !== 'courses' || !extra.includes(f));
    return '<form class="panel" id="row-form" novalidate><span class="eyebrow"><b>' + (editing && editing.id ? '#' + escapeHtml(editing.id) : '+') + '</b> ' + (editing && editing.id ? 'Редактирование' : 'Новая запись') + '</span>' +
      '<h2>' + cfg.title + '</h2>' + fields.map(f => fieldHtml(sheet, f, row)).join('') +
      '<div class="hero-actions"><button class="btn" type="submit" id="save">Сохранить</button>' + (editing && editing.id ? '<button class="btn btn-ghost" type="button" id="cancel">Отмена</button>' : '') + '</div></form>';
  }

  function collect(sheet) {
    const out = {};
    for (const f of SHEETS[sheet].fields) {
      const el = $('#f-' + f);
      if (!el) continue;
      let v = el.value.trim();
      if (f === 'options') v = v.split('\n').map(x => x.trim()).filter(Boolean).join('|');
      if (f === 'correct_index') v = String(Number(v) - 1);
      if (NUMBER_FIELDS.includes(f)) {
        if (v === '' || !isFinite(Number(v))) throw new Error('Поле «' + LABELS[f] + '» должно быть числом.');
        out[f] = Number(v);
      } else out[f] = v;
    }
    for (const f of REQUIRED[sheet]) if (out[f] === '' || out[f] === undefined) throw new Error('Заполните поле «' + LABELS[f] + '».');
    if (sheet === 'questions') {
      const n = out.options.split('|').length;
      if (n < 2) throw new Error('Нужно минимум два варианта ответа.');
      if (out.correct_index < 0 || out.correct_index >= n) throw new Error('Номер верного варианта должен быть от 1 до ' + n + '.');
    }
    if (out.video_url && !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|rutube\.ru|vk\.com|vkvideo\.ru)\//.test(out.video_url)) {
      throw new Error('Видео: используйте ссылку для встраивания YouTube, Vimeo, Rutube или VK Видео.');
    }
    if (out.image_url && !/^https:\/\//.test(out.image_url)) throw new Error('Обложка: нужна ссылка, начинающаяся с https://');
    return out;
  }

  /* ---------------- таблица ---------------- */
  function rowsFor(sheet) {
    let rows = data[sheet].slice();
    if (sheet === 'lessons') {
      if (filterCourse) rows = rows.filter(r => String(r.course_id) === filterCourse);
      rows.sort((a, b) => String(a.course_id).localeCompare(String(b.course_id), undefined, { numeric: true }) || Number(a.order) - Number(b.order));
    }
    if (sheet === 'questions' && filterLesson) rows = rows.filter(r => String(r.lesson_id) === filterLesson);
    return rows;
  }
  function tableHtml(sheet) {
    const cols = SHEETS[sheet].columns;
    const rows = rowsFor(sheet);
    let filter = '';
    if (sheet === 'lessons') filter = '<div class="field" style="max-width:420px"><label for="filter-course">Курс</label><select id="filter-course"><option value="">Все курсы</option>' + data.courses.map(c => '<option value="' + c.id + '"' + (String(c.id) === filterCourse ? ' selected' : '') + '>' + escapeHtml(c.title) + '</option>').join('') + '</select></div>';
    if (sheet === 'questions') filter = '<div class="field" style="max-width:420px"><label for="filter-lesson">Урок</label><select id="filter-lesson"><option value="">Все уроки</option>' + data.lessons.map(l => '<option value="' + l.id + '"' + (String(l.id) === filterLesson ? ' selected' : '') + '>' + escapeHtml(l.title) + '</option>').join('') + '</select></div>';
    if (!rows.length) return filter + UI.stateBox('empty', 'Записей нет', 'Добавьте первую запись через форму.');
    return filter + '<div class="table-wrap"><table><thead><tr><th scope="col">id</th>' + cols.map(c => '<th scope="col">' + escapeHtml(LABELS[c] || c) + '</th>').join('') + '<th scope="col"><span class="sr-only">Действия</span></th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + escapeHtml(r.id) + '</td>' + cols.map(c => '<td>' + escapeHtml(String(r[c] === undefined ? '' : (c === 'correct_index' ? Number(r[c]) + 1 : r[c])).slice(0, 60)) + '</td>').join('') +
        '<td style="white-space:nowrap"><button class="btn btn-sm btn-ghost" type="button" data-edit="' + escapeHtml(r.id) + '">Изменить</button>' +
        (sheet === 'courses' ? '<a class="btn btn-sm btn-ghost" href="course.html?id=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">Открыть</a>' : '') +
        '<button class="btn btn-sm btn-danger" type="button" data-del="' + escapeHtml(r.id) + '">Удалить</button></td></tr>').join('') + '</tbody></table></div>';
  }

  /* ---------------- вкладки ---------------- */
  function categories() {
    const map = new Map();
    data.courses.forEach(c => { const k = String(c.category || '').trim() || 'Без категории'; map.set(k, (map.get(k) || 0) + 1); });
    return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  async function overview() {
    let st;
    try { st = await DB.admin.status(); } catch (e) { return UI.stateBox('error', 'Не удалось получить состояние', UI.errorText(e)); }
    const modeText = { v2: ['dot-ok', 'Apps Script v2', 'Права проверяются на сервере'], legacy: ['dot-bad', 'Прежний скрипт', 'Нет серверной проверки прав — обновите скрипт'], local: ['dot-warn', 'Локальный режим', 'Данные только в этом браузере'] }[st.mode];
    let html = '<div class="status-grid">' +
      '<div class="status-item"><strong><span class="' + modeText[0] + '"></span>' + modeText[1] + '</strong><span>' + modeText[2] + '</span></div>' +
      '<div class="status-item"><strong>' + st.latency + ' мс</strong><span>время ответа API</span></div>' +
      '<div class="status-item"><strong>' + (window.STROKA_STATS ? window.STROKA_STATS.courses : '—') + '</strong><span>курсов во встроенном каталоге (файлы сайта)</span></div>' +
      '</div>';
    if (st.sheets) {
      html += '<h2 style="font-size:1.3rem;margin:32px 0 14px">Листы таблицы «' + escapeHtml(st.spreadsheet) + '»</h2><div class="table-wrap"><table><thead><tr><th>Лист</th><th>Строк</th><th>Состояние</th></tr></thead><tbody>' +
        Object.entries(st.sheets).map(([name, s]) => '<tr><td>' + name + '</td><td>' + (s.exists ? s.rows : '—') + '</td><td>' +
          (!s.exists ? '<span class="dot-warn"></span>будет создан при первой записи' : s.missingColumns.length ? '<span class="dot-warn"></span>нет столбцов: ' + escapeHtml(s.missingColumns.join(', ')) : '<span class="dot-ok"></span>в порядке') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    return html;
  }

  function feedbackHtml(rows) {
    if (mode !== 'v2') return UI.stateBox('info', 'Обращения доступны со скриптом v2', 'Прежний серверный скрипт не умеет сохранять форму обратной связи. Разверните apps-script/Code.gs.');
    if (!rows.length) return UI.stateBox('empty', 'Обращений пока нет', 'Сообщения из формы обратной связи появятся здесь.');
    const st = { new: 'Новое', in_progress: 'В работе', done: 'Закрыто' };
    return '<div class="table-wrap"><table><thead><tr><th>Дата</th><th>От кого</th><th>Тема и сообщение</th><th>Статус</th></tr></thead><tbody>' +
      rows.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(r =>
        '<tr><td style="white-space:nowrap">' + escapeHtml(UI.formatDate(r.created_at)) + '</td><td>' + escapeHtml(r.name) + '<br><a href="mailto:' + escapeHtml(r.email) + '">' + escapeHtml(r.email) + '</a></td>' +
        '<td><strong>' + escapeHtml(r.topic || 'Без темы') + '</strong><div style="white-space:pre-wrap;max-width:60ch">' + escapeHtml(r.message) + '</div>' + (r.page ? '<small class="muted">' + escapeHtml(r.page) + '</small>' : '') + '</td>' +
        '<td><label class="sr-only" for="fb-' + r.id + '">Статус</label><select id="fb-' + r.id + '" data-fb="' + escapeHtml(r.id) + '" style="min-width:140px">' + Object.entries(st).map(([k, v]) => '<option value="' + k + '"' + ((r.status || 'new') === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table></div>';
  }

  function usersHtml(rows) {
    if (!rows.length) return UI.stateBox('empty', 'Пользователей пока нет', '');
    return '<p class="muted">Роль администратора назначается вручную в таблице (столбец role) или через свойство скрипта ADMIN_EMAILS. Хэши паролей здесь не показываются.</p><div class="table-wrap"><table><thead><tr><th>id</th><th>Имя</th><th>Email</th><th>Роль</th><th>Регистрация</th></tr></thead><tbody>' +
      rows.map(u => '<tr><td>' + escapeHtml(u.id) + '</td><td>' + escapeHtml(u.name) + '</td><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.role) + '</td><td>' + escapeHtml(UI.formatDate(u.created_at)) + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function categoriesHtml() {
    const cats = categories();
    if (!cats.length) return UI.stateBox('empty', 'Категорий пока нет', 'Категория задаётся полем «Направление» у курса.');
    return '<p class="muted">Категории — это значения поля category у курсов таблицы. Переименование меняет его у всех курсов категории.</p><div class="table-wrap"><table><thead><tr><th>Категория</th><th>Курсов</th><th></th></tr></thead><tbody>' +
      cats.map(c => '<tr><td>' + escapeHtml(c.name) + '</td><td>' + c.count + '</td><td><button class="btn btn-sm btn-ghost" type="button" data-rename="' + escapeHtml(c.name) + '">Переименовать</button></td></tr>').join('') + '</tbody></table></div>';
  }

  async function render() {
    const tabs = [['overview', 'Обзор'], ['courses', 'Курсы'], ['lessons', 'Уроки'], ['questions', 'Вопросы'], ['feedback', 'Обращения'], ['users', 'Пользователи'], ['categories', 'Категории']];
    if (!tabs.some(t => t[0] === tab)) tab = 'overview';
    let banner = '';
    if (mode === 'legacy') banner = '<div class="msg msg-err">' + icon('alert') + '<p><strong>Небезопасный режим.</strong> Сайт подключён к прежнему Apps Script: любой посетитель может читать лист users и изменять таблицу запросами в обход интерфейса. Разверните <code>apps-script/Code.gs</code> по инструкции в <code>apps-script/README.md</code> — сайт переключится на защищённый режим автоматически.</p></div>';
    if (mode === 'local') banner = '<div class="msg msg-warn">' + icon('info') + '<p>Локальный режим (dataMode: \'local\'): изменения сохраняются только в этом браузере.</p></div>';
    app.innerHTML = '<div class="dash-head" style="padding-top:8px"><div><span class="eyebrow"><b>#</b> Администрирование</span><h1>Управление платформой</h1></div>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="reload">Обновить данные</button></div>' + banner +
      '<div class="tabs" role="tablist" aria-label="Разделы администрирования">' + tabs.map(t => '<button class="tab" role="tab" type="button" aria-selected="' + (t[0] === tab) + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="admin-body" role="tabpanel">' + '<div class="skeleton" style="height:200px"></div></div>';
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; editing = null; requestId = null; history.replaceState(null, '', '#' + tab); render(); }));
    $('#reload').addEventListener('click', async () => { DB.clearCache('public:'); await render(); UI.toast('Данные обновлены', 'success'); });
    const body = $('#admin-body');
    try {
      if (tab === 'overview') body.innerHTML = await overview();
      else if (SHEETS[tab]) {
        await Promise.all(['courses', 'lessons'].concat(tab === 'questions' ? ['questions'] : []).map(load));
        if (!editing) { editing = { sheet: tab, id: null }; requestId = DB.requestId(); }
        body.innerHTML = '<div class="admin-grid">' + formHtml(tab) + '<div>' + tableHtml(tab) + '</div></div>';
        bindContent(tab);
      } else if (tab === 'feedback') { body.innerHTML = feedbackHtml(mode === 'v2' ? await load('feedback') : []); bindFeedback(); }
      else if (tab === 'users') { body.innerHTML = usersHtml((await load('users')).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at }))); }
      else if (tab === 'categories') { await load('courses'); body.innerHTML = categoriesHtml(); bindCategories(); }
    } catch (e) {
      body.innerHTML = UI.stateBox('error', e.code === 'forbidden' || e.code === 'unauthorized' ? 'Нет доступа' : 'Ошибка загрузки', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>');
    }
  }

  function bindContent(sheet) {
    $('#row-form').addEventListener('submit', e => {
      e.preventDefault();
      let values;
      try { values = collect(sheet); } catch (err) { UI.toast(err.message, 'error', 6000); return; }
      UI.withBusy($('#save'), async () => {
        try {
          if (editing.id) await DB.admin.update(sheet, editing.id, values);
          else await DB.admin.add(sheet, values, requestId);
          UI.toast('Сохранено', 'success');
          editing = null; requestId = null;
          await render();
        } catch (err) { UI.toast('Не сохранено: ' + UI.errorText(err), 'error', 7000); }
      });
    });
    const cancel = $('#cancel');
    if (cancel) cancel.addEventListener('click', () => { editing = null; render(); });
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => { editing = { sheet, id: b.dataset.edit }; render().then(() => { const f = $('#row-form input, #row-form select'); if (f) f.focus(); }); }));
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.del;
      const extra = sheet === 'courses' ? ' Уроки курса останутся в таблице — удалите их отдельно.' : '';
      if (!confirm('Удалить запись #' + id + '?' + extra + ' Действие нельзя отменить.')) return;
      await UI.withBusy(b, async () => {
        try { await DB.admin.remove(sheet, id); UI.toast('Запись удалена', 'success'); editing = null; await render(); }
        catch (err) { UI.toast(UI.errorText(err), 'error', 6000); }
      });
    }));
    const fc = $('#filter-course');
    if (fc) fc.addEventListener('change', () => { filterCourse = fc.value; render(); });
    const fl = $('#filter-lesson');
    if (fl) fl.addEventListener('change', () => { filterLesson = fl.value; render(); });
  }

  function bindFeedback() {
    $$('[data-fb]').forEach(sel => sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { await DB.admin.update('feedback', sel.dataset.fb, { status: sel.value }); UI.toast('Статус обновлён', 'success'); }
      catch (e) { UI.toast(UI.errorText(e), 'error'); }
      sel.disabled = false;
    }));
  }

  function bindCategories() {
    $$('[data-rename]').forEach(b => b.addEventListener('click', async () => {
      const from = b.dataset.rename;
      const to = (prompt('Новое название категории «' + from + '»:', from) || '').trim();
      if (!to || to === from) return;
      const list = data.courses.filter(c => String(c.category || '').trim() === from || (from === 'Без категории' && !c.category));
      await UI.withBusy(b, async () => {
        try {
          for (const c of list) await DB.admin.update('courses', c.id, { category: to });
          UI.toast('Категория переименована у ' + list.length + ' ' + UI.plural(list.length, 'курса', 'курсов', 'курсов'), 'success');
          await render();
        } catch (e) { UI.toast(UI.errorText(e), 'error', 6000); await render(); }
      });
    }));
  }

  async function init() {
    UI.showHeader('admin');
    const user = DB.currentUser();
    if (!user || user.role !== 'admin') {
      app.innerHTML = UI.stateBox('lock', 'Доступ только для администратора', user ? 'У вашего аккаунта нет прав администратора.' : 'Войдите под аккаунтом администратора.', user ? '<a class="btn" href="profile.html">В кабинет</a>' : '<a class="btn" href="login.html?next=admin.html">Войти</a>');
      return;
    }
    try { mode = await DB.mode(); } catch (e) {
      app.innerHTML = UI.stateBox('error', 'Сервер данных недоступен', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>');
      return;
    }
    if (mode === 'v2' && !DB.hasToken()) {
      DB.clearSession();
      app.innerHTML = UI.stateBox('lock', 'Войдите снова', 'Система входа обновлена — войдите ещё раз, чтобы получить защищённую сессию.', '<a class="btn" href="login.html?next=admin.html">Войти</a>');
      return;
    }
    render();
  }

  init();
})();
