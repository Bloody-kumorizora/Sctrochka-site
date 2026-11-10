// courses.js — единая модель курса для двух источников:
//  1) курсы из Google Таблицы (листы courses / lessons / questions);
//  2) встроенный каталог сайта (data/catalog.js + data/courses/<id>.js).
// Когда встроенный каталог перенесён в таблицу (админ-панель → «Обзор»),
// сайт показывает только курсы из таблицы, а файлы data/ служат запасной
// копией на случай, если таблица недоступна.
// Страницы работают с одной структурой и не знают, откуда пришёл курс.
// Поведение курса задают его поля, а не источник:
//  access — 'open' (уроки читаются без входа) или 'enroll' (после записи);
//  status — 'full' | 'demo' | 'outline' (подтверждение — только у 'full').
(function () {
  'use strict';
  const { escapeHtml, loadScript } = window.UI;

  const LEVELS = ['Начальный', 'Средний', 'Продвинутый'];
  const TONES = ['indigo', 'lime', 'coral', 'sky', 'violet', 'sand', 'ink'];
  const STATUS = {
    full: { label: 'Полный курс', hint: 'Все уроки опубликованы' },
    demo: { label: 'Демо-версия', hint: 'Открыты вводные уроки, остальная программа в разработке' },
    outline: { label: 'Программа', hint: 'Опубликована программа, уроки в разработке' }
  };
  const SYNONYMS = {
    js: 'javascript', жс: 'javascript', ts: 'typescript', реакт: 'react', гит: 'git', гитхаб: 'github',
    бд: 'sql', база: 'sql', базы: 'sql', нода: 'node', верстка: 'html', дизайн: 'ui', ии: 'ai', нейросети: 'ai',
    сео: 'seo', апи: 'api', тесты: 'тестирование', фигма: 'figma', некст: 'next'
  };

  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const splitList = v => Array.isArray(v) ? v : String(v || '').split(/\r?\n|\|/).map(x => x.trim()).filter(Boolean);
  const splitTags = v => Array.isArray(v) ? v : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const isSheetId = id => /^\d+$/.test(String(id));
  const splitLines = v => Array.isArray(v) ? v : String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const hasText = v => String(v === undefined || v === null ? '' : v).trim() !== '';
  const lessonAvailable = l => hasText(l.content) || hasText(l.video_url);
  const isYes = v => /^(1|true|yes|да|y|\+)$/i.test(String(v === undefined || v === null ? '' : v).trim());
  function toneFor(id) {
    if (isSheetId(id)) return TONES[Number(id) % TONES.length];
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TONES[h % TONES.length];
  }
  // Проекты в ячейке: по одному в строке — «Название | Описание | HTML, CSS»
  function parseProjects(v) {
    if (Array.isArray(v)) return v;
    return splitLines(v).map(line => {
      const [title, description = '', stack = ''] = line.split('|').map(x => x.trim());
      return { title, description, stack: splitTags(stack) };
    }).filter(x => x.title);
  }

  /* ---------------- загрузка встроенного каталога ---------------- */
  function loadBuiltin() {
    if (window.STROKA_CATALOG) return Promise.resolve(window.STROKA_CATALOG);
    return loadScript('data/catalog.js').then(() => window.STROKA_CATALOG || []);
  }
  function loadBuiltinCourse(id) {
    window.STROKA_COURSES = window.STROKA_COURSES || {};
    if (window.STROKA_COURSES[id]) return Promise.resolve(window.STROKA_COURSES[id]);
    if (!/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null);
    return loadScript('data/courses/' + id + '.js').then(() => window.STROKA_COURSES[id] || null).catch(() => null);
  }

  function glyphFor(title) {
    const t = norm(title);
    if (/javascript|js/.test(t)) return 'JS';
    if (/html/.test(t)) return '</>';
    if (/css/.test(t)) return '{ }';
    if (/sql|баз/.test(t)) return 'SQL';
    if (/react/.test(t)) return '⚛';
    return String(title || '?').trim().slice(0, 2);
  }

  function fromSheet(row, lessons) {
    const id = String(row.id);
    const own = lessons.filter(l => String(l.course_id) === id);
    const stage = String(row.stage || '').trim();
    const order = Number(row.order);
    return {
      id,
      source: 'sheet',
      access: String(row.access || '').trim() === 'open' ? 'open' : 'enroll',
      title: row.title || 'Без названия',
      subtitle: row.subtitle || '',
      description: row.description || '',
      track: row.category || 'Другое',
      level: LEVELS.includes(row.level) ? row.level : (row.level || 'Начальный'),
      format: row.format || 'Курс',
      duration: row.duration || '',
      hours: Number(row.hours) || 0,
      status: STATUS[stage] ? stage : 'full',
      featured: isYes(row.featured),
      next: splitTags(row.next),
      tags: splitTags(row.tags),
      audience: splitList(row.audience),
      requirements: splitList(row.requirements),
      outcomes: splitList(row.outcomes),
      projects: parseProjects(row.projects),
      instructor: row.instructor || '',
      image: /^https:\/\//.test(row.image_url || '') ? row.image_url : '',
      cover: { glyph: String(row.glyph || '').trim() || glyphFor(row.title), tone: TONES.includes(String(row.tone || '').trim()) ? String(row.tone).trim() : toneFor(id) },
      lessonsCount: own.length,
      demoLessons: own.filter(lessonAvailable).length,
      modulesCount: new Set(own.map(l => l.module)).size,
      keywords: own.map(l => l.title).join(' '),
      order: hasText(row.order) && isFinite(order) ? order : 1000 + (Number(id) || 0)
    };
  }

  // Файлы встроенного каталога
  async function builtinFiles() {
    const list = await loadBuiltin().catch(() => []);
    return list.map(c => Object.assign({ source: 'builtin', access: 'open' }, c));
  }

  // Список для мгновенной отрисовки, без ожидания сети: последняя копия из
  // таблицы, если каталог перенесён в неё, иначе — встроенные файлы
  async function builtin() {
    if (DB.catalogInSheet()) {
      const rows = DB.peekPublic('courses'), lessons = DB.peekPublic('lessons');
      return rows && lessons ? rows.map(r => fromSheet(r, lessons)) : [];
    }
    return builtinFiles();
  }

  /* ---------------- список всех курсов ---------------- */
  let listPromise = null;
  // Возвращает { courses, sheetError } — встроенный каталог доступен всегда,
  // даже если Google Таблица временно не отвечает.
  function all() {
    if (listPromise) return listPromise;
    listPromise = (async () => {
      const builtinP = builtinFiles();
      const sheet = await (async () => {
        const [rows, lessons, meta] = await Promise.all([DB.getPublic('courses'), DB.getPublic('lessons'), DB.getPublic('meta')]);
        return { courses: rows.map(r => fromSheet(r, lessons)), catalog: !!meta.catalog };
      })().catch(err => ({ courses: [], error: err }));
      // Каталог перенесён в таблицу — она единственный источник
      if (!sheet.error && sheet.catalog) return { courses: sheet.courses, sheetError: null };
      const inSheet = new Set(sheet.courses.map(c => c.id));
      const courses = sheet.courses.concat((await builtinP).filter(c => !inSheet.has(c.id)));
      return { courses, sheetError: sheet.error || null };
    })();
    return listPromise;
  }

  /* ---------------- полный курс с программой ---------------- */
  function sheetCourse(row, lessons, questions) {
    const id = String(row.id);
    const course = fromSheet(row, lessons);
    const own = lessons.filter(l => String(l.course_id) === id)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    const modules = [];
    own.forEach(l => {
      const name = l.module || 'Уроки';
      let m = modules.find(x => x.title === name);
      if (!m) { m = { title: name, summary: '', lessons: [] }; modules.push(m); }
      if (!m.summary && hasText(l.module_summary)) m.summary = String(l.module_summary).trim();
      m.lessons.push({
        id: String(l.id),
        title: l.title,
        summary: l.summary || '',
        minutes: Number(l.minutes) || 0,
        type: l.type === 'video' ? 'video' : 'text',
        content: l.content || '',
        video: l.video_url || '',
        tasks: splitLines(l.tasks),
        available: lessonAvailable(l),
        quiz: questions.filter(q => String(q.lesson_id) === String(l.id)).map(q => ({
          q: q.question,
          options: String(q.options || '').split('|').map(x => x.trim()),
          answer: Number(q.correct_index),
          explain: q.explain || ''
        }))
      });
    });
    course.modules = modules;
    return finalize(course);
  }

  async function get(id) {
    id = String(id || '');
    if (!id) return null;
    try {
      const [rows, lessons, questions, meta] = await Promise.all([DB.getPublic('courses'), DB.getPublic('lessons'), DB.getPublic('questions'), DB.getPublic('meta')]);
      const row = rows.find(r => String(r.id) === id);
      if (row) return sheetCourse(row, lessons, questions);
      // в таблице курса нет: удалён или снят с публикации
      if (meta.catalog || isSheetId(id)) return null;
    } catch (err) {
      if (isSheetId(id)) throw err;
      // таблица недоступна — показываем запасную копию из файлов сайта
    }
    return getBuiltin(id);
  }

  async function getBuiltin(id) {
    const list = await loadBuiltin();
    const meta = list.find(c => c.id === id);
    if (!meta) return null;
    const detail = await loadBuiltinCourse(id);
    if (!detail) throw new Error('Не удалось загрузить программу курса. Проверьте соединение и обновите страницу.');
    const course = Object.assign({ source: 'builtin', access: 'open' }, meta, detail);
    course.modules = (detail.modules || []).map((m, mi) => ({
      title: m.title,
      summary: m.summary || '',
      lessons: (m.lessons || []).map((l, li) => ({
        id: id + '.' + (mi + 1) + '.' + (li + 1),
        title: l.title,
        summary: l.summary || '',
        minutes: l.minutes || 0,
        type: 'text',
        content: l.content || '',
        tasks: l.tasks || [],
        quiz: (l.quiz || []).map(q => ({ q: q.q, options: q.options, answer: q.answer, explain: q.explain || '' })),
        available: !!l.content
      }))
    }));
    return finalize(course);
  }

  function finalize(course) {
    const lessons = [];
    course.modules.forEach((m, mi) => m.lessons.forEach(l => { l.moduleIndex = mi; l.moduleTitle = m.title; lessons.push(l); }));
    course.lessons = lessons;
    course.availableLessons = lessons.filter(l => l.available);
    return course;
  }

  // id урока → { course, lesson }
  async function findLesson(lessonId) {
    lessonId = String(lessonId || '');
    let courseId;
    try {
      const lessons = await DB.getPublic('lessons');
      const row = lessons.find(l => String(l.id) === lessonId);
      if (row) courseId = String(row.course_id);
    } catch (err) {
      if (isSheetId(lessonId)) throw err;
    }
    if (!courseId) {
      if (isSheetId(lessonId)) return null;
      const m = lessonId.match(/^([a-z0-9-]+)\.\d+\.\d+$/);
      if (!m) return null;
      courseId = m[1];
    }
    const course = await get(courseId);
    if (!course) return null;
    const lesson = course.lessons.find(l => l.id === lessonId);
    return lesson ? { course, lesson } : null;
  }

  /* ---------------- поиск, сортировка, похожие ---------------- */
  function tokens(q) {
    return norm(q).split(/[^a-zа-я0-9+#.]+/i).filter(Boolean).map(t => SYNONYMS[t] || t);
  }
  function score(c, toks) {
    if (!toks.length) return 1;
    const fields = [
      [norm(c.title), 6], [norm(c.tags.join(' ')), 4], [norm(c.track), 3],
      [norm(c.subtitle + ' ' + c.description), 2], [norm(c.keywords), 1]
    ];
    let total = 0;
    for (const t of toks) {
      let best = 0;
      for (const [text, w] of fields) if (text.includes(t)) best = Math.max(best, w);
      if (!best) return 0; // каждое слово запроса должно найтись
      total += best;
    }
    return total;
  }
  function filter(courses, { q = '', level = '', track = '', format = '', status = '', ids = null } = {}) {
    const toks = tokens(q);
    return courses
      .map(c => ({ c, s: score(c, toks) }))
      .filter(({ c, s }) => s > 0 && (!level || c.level === level) && (!track || c.track === track) &&
        (!format || c.format === format) && (!status || c.status === status) && (!ids || ids.includes(c.id)))
      .map(x => Object.assign(x.c, { _score: x.s }));
  }
  function sort(list, mode) {
    const lv = c => { const i = LEVELS.indexOf(c.level); return i === -1 ? 9 : i; };
    const statusRank = { full: 0, demo: 1, outline: 2 };
    const by = {
      recommended: (a, b) => (b._score || 0) - (a._score || 0) || (statusRank[a.status] - statusRank[b.status]) || a.order - b.order,
      level: (a, b) => lv(a) - lv(b) || a.order - b.order,
      'level-desc': (a, b) => lv(b) - lv(a) || a.order - b.order,
      short: (a, b) => (a.hours || 999) - (b.hours || 999),
      title: (a, b) => a.title.localeCompare(b.title, 'ru')
    };
    return list.slice().sort(by[mode] || by.recommended);
  }
  async function search(q, limit = 8) {
    // Не ждём медленную таблицу дольше секунды — ищем по встроенному каталогу
    const loaded = await Promise.race([all(), new Promise(r => setTimeout(() => r(null), 1000))]);
    const courses = loaded ? loaded.courses : await builtin();
    const res = q ? sort(filter(courses, { q }), 'recommended') : courses.filter(c => c.featured).sort((a, b) => a.order - b.order);
    return res.slice(0, limit);
  }
  function related(course, courses, limit = 3) {
    return courses
      .filter(c => c.id !== course.id)
      .map(c => {
        let s = 0;
        if (c.track === course.track) s += 3;
        s += c.tags.filter(t => course.tags.includes(t)).length * 2;
        if ((course.next || []).includes(c.id)) s += 5;
        if (c.status === 'outline') s -= 1;
        return { c, s };
      })
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.c.order - b.c.order)
      .slice(0, limit)
      .map(x => x.c);
  }

  /* ---------------- прогресс ---------------- */
  // my = результат DB.my(); course — полный курс (с lessons)
  function progressFor(course, my) {
    const enrollment = (my.enrollments || []).find(e => String(e.course_id) === String(course.id)) || null;
    const doneIds = new Set((my.progress || []).filter(p => String(p.course_id) === String(course.id)).map(p => String(p.lesson_id)));
    const pool = course.lessons ? course.availableLessons : null;
    const total = pool ? pool.length : (course.demoLessons !== undefined ? course.demoLessons : course.lessonsCount);
    const done = pool ? pool.filter(l => doneIds.has(l.id)).length : doneIds.size;
    return {
      enrollment,
      enrolled: !!enrollment,
      completed: !!(enrollment && enrollment.completed_at),
      doneIds,
      done,
      total,
      percent: total ? Math.min(100, Math.round(done / total * 100)) : 0,
      nextLesson: pool ? (pool.find(l => !doneIds.has(l.id)) || pool[0] || null) : null
    };
  }

  /* ---------------- отображение ---------------- */
  const url = c => 'course.html?id=' + encodeURIComponent(c.id);
  const lessonUrl = l => 'lesson.html?id=' + encodeURIComponent(l.id);
  function cover(c, extra = '') {
    if (c.image) return '<div class="cover cover-img ' + extra + '"><img src="' + escapeHtml(c.image) + '" alt="" loading="lazy" decoding="async"></div>';
    const tone = (c.cover && c.cover.tone) || 'indigo';
    return '<div class="cover tone-' + tone + ' ' + extra + '" aria-hidden="true"><span class="cover-glyph">' + escapeHtml((c.cover && c.cover.glyph) || '?') + '</span><span class="cover-lines"><i></i><i></i><i></i></span></div>';
  }
  function coverMini(c) {
    const tone = (c.cover && c.cover.tone) || 'indigo';
    return '<span class="cover-mini tone-' + tone + '" aria-hidden="true">' + escapeHtml((c.cover && c.cover.glyph) || '?') + '</span>';
  }
  function statusBadge(c) {
    const s = STATUS[c.status] || STATUS.outline;
    return '<span class="badge badge-' + c.status + '" title="' + escapeHtml(s.hint) + '">' + s.label + '</span>';
  }
  function durationText(c) {
    if (c.hours) return '≈ ' + c.hours + ' ч';
    return c.duration || '';
  }
  function lessonsText(c) {
    const n = c.lessonsCount || 0;
    return n + ' ' + UI.plural(n, 'урок', 'урока', 'уроков');
  }

  // Карточка курса. progress — { percent, done, total } или null
  function card(c, progress) {
    const pr = progress && progress.enrolled
      ? '<div class="progress-mini"><span class="bar"><i style="width:' + progress.percent + '%"></i></span><span>' + (progress.completed ? 'Пройден' : progress.percent + '%') + '</span></div>'
      : '';
    return '<article class="course-card">' + cover(c) +
      '<div class="course-card-body">' +
      '<div class="card-top">' + statusBadge(c) + '<span class="tag">' + escapeHtml(c.level) + '</span><span class="tag">' + escapeHtml(c.format) + '</span></div>' +
      '<h3><a href="' + url(c) + '">' + escapeHtml(c.title) + '</a></h3>' +
      '<p>' + escapeHtml(c.subtitle || c.description) + '</p>' + pr +
      '<div class="meta"><span>' + UI.icon('layers') + escapeHtml(c.track) + '</span><span>' + UI.icon('book') + escapeHtml(lessonsText(c)) + '</span>' +
      (durationText(c) ? '<span>' + UI.icon('clock') + escapeHtml(durationText(c)) + '</span>' : '') + '</div>' +
      '</div>' +
      '<button type="button" class="fav-btn" data-fav="' + escapeHtml(c.id) + '" aria-pressed="false" aria-label="В избранное">' + UI.icon('heart') + '</button>' +
      '</article>';
  }

  /* ---------------- перенос встроенного каталога в таблицу ---------------- */
  // Строки листов courses / lessons / questions из файлов data/.
  // id курсов и уроков сохраняются (html-basics, html-basics.1.2), поэтому
  // ссылки, прогресс и избранное продолжают работать.
  async function builtinRows() {
    const list = await loadBuiltin();
    const details = await Promise.all(list.map(c => loadBuiltinCourse(c.id)));
    const courses = [], lessons = [], questions = [];
    list.forEach((c, i) => {
      const d = details[i];
      if (!d) throw new Error('Не удалось загрузить программу курса «' + c.title + '». Обновите страницу и повторите.');
      courses.push({
        id: c.id, title: c.title, subtitle: c.subtitle || '', description: c.description || '',
        category: c.track || '', level: c.level || '', format: c.format || '', duration: '', hours: c.hours || '',
        instructor: '', image_url: '', status: 'published', stage: c.status || 'demo', access: 'open',
        featured: c.featured ? 'да' : '', order: c.order, tags: (c.tags || []).join(', '), next: (c.next || []).join(', '),
        glyph: (c.cover && c.cover.glyph) || '', tone: (c.cover && c.cover.tone) || '',
        audience: (d.audience || []).join('\n'), requirements: (d.requirements || []).join('\n'), outcomes: (d.outcomes || []).join('\n'),
        projects: (d.projects || []).map(x => [x.title, x.description || '', (x.stack || []).join(', ')].join(' | ')).join('\n')
      });
      let n = 0;
      (d.modules || []).forEach((m, mi) => (m.lessons || []).forEach((l, li) => {
        const lid = c.id + '.' + (mi + 1) + '.' + (li + 1);
        lessons.push({
          id: lid, course_id: c.id, module: m.title, module_summary: li === 0 ? (m.summary || '') : '', order: ++n,
          title: l.title, summary: l.summary || '', minutes: l.minutes || '', type: 'text', content: l.content || '',
          tasks: (l.tasks || []).join('\n'), video_url: ''
        });
        (l.quiz || []).forEach(q => questions.push({ lesson_id: lid, question: q.q, options: q.options.join('|'), correct_index: q.answer, explain: q.explain || '' }));
      }));
    });
    return { courses, lessons, questions };
  }

  window.Courses = {
    card,
    LEVELS, STATUS, TONES, builtin, all, get, findLesson, filter, sort, search, related, progressFor,
    url, lessonUrl, cover, coverMini, statusBadge, durationText, lessonsText, isSheetId, loadBuiltin, builtinRows
  };
})();
