// courses.js — единая модель курса для двух источников:
//  1) встроенный каталог сайта (data/catalog.js + data/courses/<id>.js);
//  2) курсы из Google Таблицы (листы courses / lessons / questions).
// Страницы работают с одной структурой и не знают, откуда пришёл курс.
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
    const own = lessons.filter(l => String(l.course_id) === String(row.id));
    return {
      id: String(row.id),
      source: 'sheet',
      title: row.title || 'Без названия',
      subtitle: row.subtitle || '',
      description: row.description || '',
      track: row.category || 'Другое',
      level: LEVELS.includes(row.level) ? row.level : (row.level || 'Начальный'),
      format: row.format || 'Курс',
      duration: row.duration || '',
      hours: 0,
      status: 'full',
      tags: splitTags(row.tags),
      audience: splitList(row.audience),
      requirements: splitList(row.requirements),
      outcomes: splitList(row.outcomes),
      projects: [],
      instructor: row.instructor || '',
      image: /^https:\/\//.test(row.image_url || '') ? row.image_url : '',
      cover: { glyph: glyphFor(row.title), tone: TONES[Number(row.id) % TONES.length] },
      lessonsCount: own.length,
      modulesCount: new Set(own.map(l => l.module)).size,
      keywords: own.map(l => l.title).join(' '),
      order: 1000 + Number(row.id)
    };
  }

  // Только встроенный каталог — доступен сразу, без обращения к сети
  async function builtin() {
    const list = await loadBuiltin().catch(() => []);
    return list.map(c => Object.assign({ source: 'builtin' }, c));
  }

  /* ---------------- список всех курсов ---------------- */
  let listPromise = null;
  // Возвращает { courses, sheetError } — встроенный каталог доступен всегда,
  // даже если Google Таблица временно не отвечает.
  function all() {
    if (listPromise) return listPromise;
    listPromise = (async () => {
      const builtinP = builtin();
      const sheetP = (async () => {
        const [rows, lessons] = await Promise.all([DB.getPublic('courses'), DB.getPublic('lessons')]);
        return rows.map(r => fromSheet(r, lessons));
      })().then(c => ({ courses: c }), err => ({ courses: [], error: err }));
      const [builtinList, sheet] = await Promise.all([builtinP, sheetP]);
      const courses = sheet.courses.concat(builtinList);
      return { courses, sheetError: sheet.error || null };
    })();
    return listPromise;
  }

  /* ---------------- полный курс с программой ---------------- */
  async function get(id) {
    id = String(id || '');
    if (!id) return null;
    if (isSheetId(id)) {
      const [rows, lessons, questions] = await Promise.all([DB.getPublic('courses'), DB.getPublic('lessons'), DB.getPublic('questions')]);
      const row = rows.find(r => String(r.id) === id);
      if (!row) return null;
      const course = fromSheet(row, lessons);
      const own = lessons.filter(l => String(l.course_id) === id).sort((a, b) => Number(a.order) - Number(b.order));
      const modules = [];
      own.forEach(l => {
        const name = l.module || 'Уроки';
        let m = modules.find(x => x.title === name);
        if (!m) { m = { title: name, lessons: [] }; modules.push(m); }
        m.lessons.push({
          id: String(l.id),
          title: l.title,
          type: l.type === 'video' ? 'video' : 'text',
          content: l.content || '',
          video: l.video_url || '',
          available: true,
          quiz: questions.filter(q => String(q.lesson_id) === String(l.id)).map(q => ({
            q: q.question,
            options: String(q.options || '').split('|'),
            answer: Number(q.correct_index)
          }))
        });
      });
      course.modules = modules;
      return finalize(course);
    }
    const list = await loadBuiltin();
    const meta = list.find(c => c.id === id);
    if (!meta) return null;
    const detail = await loadBuiltinCourse(id);
    if (!detail) throw new Error('Не удалось загрузить программу курса. Проверьте соединение и обновите страницу.');
    const course = Object.assign({ source: 'builtin' }, meta, detail);
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
    if (isSheetId(lessonId)) {
      const lessons = await DB.getPublic('lessons');
      const row = lessons.find(l => String(l.id) === lessonId);
      if (!row) return null;
      courseId = String(row.course_id);
    } else {
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
    const total = pool ? pool.length : (course.source === 'builtin' ? course.demoLessons : course.lessonsCount);
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

  window.Courses = {
    card,
    LEVELS, STATUS, builtin, all, get, findLesson, filter, sort, search, related, progressFor,
    url, lessonUrl, cover, coverMini, statusBadge, durationText, lessonsText, isSheetId, loadBuiltin
  };
})();
