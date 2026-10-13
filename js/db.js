// db.js — работа с данными (Google Таблица через Apps Script).
//
// Поддерживает два варианта серверного скрипта:
//  - v2  (apps-script/Code.gs из этого репозитория): сессии, проверка прав на сервере;
//  - legacy (прежний скрипт: list/add/update/delete) — чтобы сайт продолжал
//    работать, пока новый скрипт не развёрнут. Режим определяется автоматически.
// Плюс режим 'local' (демо-данные в localStorage) для разработки без сети.
//
// Листы и столбцы таблицы не меняются: courses, lessons, questions, users,
// enrollments, progress (+ feedback и sessions, которые создаёт скрипт v2).

(function () {
  'use strict';
  const cfg = window.STROKA_CONFIG || {};
  const API_URL = cfg.apiUrl;
  const TIMEOUT_MS = 12000;
  const PUBLIC_TTL_MS = 5 * 60 * 1000;
  const CACHE_PREFIX = 'stroka:cache:';
  const TOKEN_KEY = 'stroka_token';
  const USER_KEY = 'current_user'; // тот же ключ, что и раньше
  const PUBLIC_SHEETS = ['courses', 'lessons', 'questions'];

  class ApiError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const MESSAGES = {
    offline: 'Нет соединения с интернетом. Проверьте сеть и попробуйте ещё раз.',
    timeout: 'Сервер долго не отвечает. Попробуйте ещё раз через минуту.',
    network: 'Не удалось связаться с сервером данных. Попробуйте позже.',
    bad_response: 'Сервер вернул неожиданный ответ. Попробуйте позже.'
  };

  /* ---------------- безопасный доступ к хранилищам ---------------- */
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) { /* приватный режим / переполнение */ } },
    del(k, s = localStorage) { try { s.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const sess = typeof sessionStorage !== 'undefined' ? sessionStorage : null;

  // Курсы и уроки из таблицы имеют числовые id — пишем их числами, как раньше
  const idValue = v => (/^\d+$/.test(String(v)) ? Number(v) : v);

  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  /* ---------------- сеть: таймаут, повтор, разбор ответа ---------------- */
  async function http(method, { params, body, retries = 0 } = {}) {
    if (!API_URL) throw new ApiError('config', 'Не указан адрес API в js/config.js.');
    let url = API_URL;
    if (params) url += '?' + new URLSearchParams(params).toString();
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('offline', MESSAGES.offline);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method,
          signal: ctrl.signal,
          redirect: 'follow',
          // text/plain — «простой» запрос без preflight; Apps Script его принимает
          headers: body ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
          body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) throw new ApiError(res.status >= 500 ? 'network' : 'bad_response', MESSAGES.network);
        let json;
        try { json = await res.json(); } catch (e) { throw new ApiError('bad_response', MESSAGES.bad_response); }
        if (!json || typeof json !== 'object') throw new ApiError('bad_response', MESSAGES.bad_response);
        if (json.ok === false) throw new ApiError(json.code || 'api', json.error || 'Ошибка сервера.');
        return json.data;
      } catch (err) {
        if (err.name === 'AbortError') lastError = new ApiError('timeout', MESSAGES.timeout);
        else if (err instanceof ApiError) lastError = err;
        else lastError = new ApiError('network', MESSAGES.network);
        // повторяем только сетевые сбои, а не ответы сервера с ошибкой
        const retriable = ['timeout', 'network'].includes(lastError.code);
        if (!retriable || attempt === retries) throw lastError;
        await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  /* ---------------- кеш публичных данных ---------------- */
  const memory = new Map();
  const inflight = new Map();

  function cacheRead(key) {
    if (memory.has(key)) return memory.get(key);
    if (!sess) return null;
    const raw = store.get(CACHE_PREFIX + key, sess);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw);
      memory.set(key, entry);
      return entry;
    } catch (e) { return null; }
  }
  function cacheWrite(key, data) {
    const entry = { t: Date.now(), data };
    memory.set(key, entry);
    if (sess) store.set(CACHE_PREFIX + key, JSON.stringify(entry), sess);
  }
  function cacheClear(prefix = '') {
    for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
    if (!sess) return;
    try {
      for (let i = sess.length - 1; i >= 0; i--) {
        const k = sess.key(i);
        if (k && k.startsWith(CACHE_PREFIX + prefix)) sess.removeItem(k);
      }
    } catch (e) { /* ignore */ }
  }
  // Один запрос на ключ, даже если данные просят несколько частей страницы
  function once(key, fn) {
    if (inflight.has(key)) return inflight.get(key);
    const p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  /* ---------------- локальный режим (бывший db_local.js) ---------------- */
  const LOCAL_KEY = 'online_courses_db';
  const localSeed = {
    courses: [
      { id: 1, title: 'Основы JavaScript', description: 'Базовый курс по JavaScript с нуля: переменные, функции, работа со страницей.', category: 'Программирование', level: 'Начальный', duration: '4 недели', instructor: '', status: 'published' },
      { id: 2, title: 'HTML и CSS', description: 'Верстка адаптивных страниц с нуля.', category: 'Веб', level: 'Начальный', duration: '3 недели', instructor: '', status: 'published' }
    ],
    lessons: [
      { id: 1, course_id: 1, module: 'Модуль 1. Введение', order: 1, title: 'Что такое JavaScript', type: 'text', content: 'JavaScript — это язык программирования для веба.\nОн выполняется прямо в браузере.', video_url: '' },
      { id: 2, course_id: 1, module: 'Модуль 1. Введение', order: 2, title: 'Переменные', type: 'text', content: 'Переменные объявляют через let и const.', video_url: '' },
      { id: 3, course_id: 2, module: 'Модуль 1. HTML', order: 1, title: 'Структура страницы', type: 'text', content: 'Страница состоит из тегов html, head и body.', video_url: '' }
    ],
    questions: [
      { id: 1, lesson_id: 1, question: 'Где выполняется JavaScript на сайте?', options: 'В браузере|Только в Word', correct_index: 0 },
      { id: 2, lesson_id: 2, question: 'Каким словом объявляют константу?', options: 'let|var|const', correct_index: 2 }
    ],
    users: [], enrollments: [], progress: [], feedback: []
  };
  const local = {
    load() {
      const raw = store.get(LOCAL_KEY);
      if (raw) { try { const d = JSON.parse(raw); return Object.assign(JSON.parse(JSON.stringify(localSeed)), d); } catch (e) { /* испорчено — пересоздадим */ } }
      const d = JSON.parse(JSON.stringify(localSeed));
      store.set(LOCAL_KEY, JSON.stringify(d));
      return d;
    },
    save(d) { store.set(LOCAL_KEY, JSON.stringify(d)); },
    async getAll(sheet) { return (local.load()[sheet] || []).slice(); },
    async addRow(sheet, row) {
      const d = local.load();
      d[sheet] = d[sheet] || [];
      const id = d[sheet].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
      const rec = Object.assign({}, row, { id });
      d[sheet].push(rec);
      local.save(d);
      return rec;
    },
    async updateRow(sheet, id, values) {
      const d = local.load();
      (d[sheet] || []).forEach(r => { if (String(r.id) === String(id)) Object.assign(r, values); });
      local.save(d);
    },
    async deleteRow(sheet, id) {
      const d = local.load();
      d[sheet] = (d[sheet] || []).filter(r => String(r.id) !== String(id));
      local.save(d);
    }
  };

  /* ---------------- прежний протокол (legacy) ---------------- */
  const legacy = {
    async getAll(sheet) { return http('GET', { params: { action: 'list', sheet }, retries: 2 }); },
    async addRow(sheet, row) { return http('POST', { body: { action: 'add', sheet, row } }); },
    async updateRow(sheet, id, values) { return http('POST', { body: { action: 'update', sheet, id, values } }); },
    async deleteRow(sheet, id) { return http('POST', { body: { action: 'delete', sheet, id } }); }
  };

  /* ---------------- определение версии сервера ---------------- */
  let modePromise = null;
  function detectMode() {
    if (cfg.dataMode === 'local') return Promise.resolve('local');
    if (modePromise) return modePromise;
    const cached = sess && store.get(CACHE_PREFIX + 'mode', sess);
    if (cached === 'v2' || cached === 'legacy') return (modePromise = Promise.resolve(cached));
    modePromise = http('GET', { params: { action: 'info' }, retries: 1 })
      .then(data => (data && Number(data.version) >= 2 ? 'v2' : 'legacy'))
      .catch(err => {
        if (['offline', 'timeout', 'network'].includes(err.code)) { modePromise = null; throw err; }
        return 'legacy'; // прежний скрипт не знает action=info
      })
      .then(mode => { if (sess) store.set(CACHE_PREFIX + 'mode', mode, sess); return mode; });
    return modePromise;
  }
  async function rawAdapter() {
    const mode = await detectMode();
    return mode === 'local' ? local : legacy;
  }

  /* ---------------- сессия пользователя ---------------- */
  function currentUser() {
    const raw = store.get(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function token() { return store.get(TOKEN_KEY) || ''; }
  function saveSession(user, tok) {
    store.set(USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
    if (tok) store.set(TOKEN_KEY, tok); else store.del(TOKEN_KEY);
    myCache = null;
  }
  function clearSession() {
    store.del(USER_KEY);
    store.del(TOKEN_KEY);
    myCache = null;
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  async function v2(action, body = {}, opts = {}) {
    const data = Object.assign({ action }, body);
    if (opts.auth) data.token = token();
    try {
      return await http('POST', { body: data, retries: opts.retries || 0 });
    } catch (err) {
      if (err.code === 'unauthorized' && opts.auth) {
        clearSession();
        window.dispatchEvent(new CustomEvent('stroka:session-expired'));
      }
      throw err;
    }
  }

  /* ---------------- публичное API ---------------- */
  async function getPublic(sheet, { fresh = false } = {}) {
    if (!PUBLIC_SHEETS.includes(sheet)) throw new ApiError('forbidden', 'Недоступно.');
    const key = 'public:' + sheet;
    const hit = cacheRead(key);
    if (!fresh && hit && Date.now() - hit.t < PUBLIC_TTL_MS) return hit.data;
    return once(key, async () => {
      try {
        const mode = await detectMode();
        let rows = mode === 'local' ? await local.getAll(sheet) : await http('GET', { params: { action: 'list', sheet }, retries: 1 });
        if (!Array.isArray(rows)) throw new ApiError('bad_response', MESSAGES.bad_response);
        if (sheet === 'courses' && mode !== 'v2') rows = rows.filter(r => String(r.status || '').trim() === 'published');
        cacheWrite(key, rows);
        return rows;
      } catch (err) {
        // Сеть недоступна, но есть старая копия — лучше показать её, чем пустую страницу
        if (hit) { hit.stale = true; return hit.data; }
        throw err;
      }
    });
  }

  async function register(name, email, password) {
    const mode = await detectMode();
    email = email.trim().toLowerCase();
    if (mode === 'v2') {
      // v2: пароль хэшируется на сервере (с солью); соединение с Apps Script — HTTPS
      const res = await v2('register', { name, email, password, request_id: requestId() });
      saveSession(res.user, res.token);
      return res.user;
    }
    const hash = await sha256(password); // прежний формат хранения
    const a = await rawAdapter();
    const users = await a.getAll('users');
    if (users.some(u => String(u.email).trim().toLowerCase() === email)) throw new ApiError('email_taken', 'Этот email уже зарегистрирован. Войдите в аккаунт.');
    // Прежнее поведение: первый пользователь становится администратором
    const user = await a.addRow('users', { name, email, password_hash: hash, role: users.length ? 'student' : 'admin', created_at: new Date().toISOString() });
    saveSession(user, '');
    return user;
  }

  async function login(email, password) {
    const mode = await detectMode();
    email = email.trim().toLowerCase();
    if (mode === 'v2') {
      const res = await v2('login', { email, password });
      saveSession(res.user, res.token);
      return res.user;
    }
    const hash = await sha256(password);
    const a = await rawAdapter();
    const users = await a.getAll('users');
    const user = users.find(u => String(u.email).trim().toLowerCase() === email && String(u.password_hash) === hash);
    if (!user) throw new ApiError('bad_credentials', 'Неверный email или пароль.');
    saveSession(user, '');
    return user;
  }

  async function logout() {
    const tok = token();
    clearSession();
    if (tok) { try { await v2('logout', { token: tok }); } catch (e) { /* сессия всё равно удалена локально */ } }
  }

  // Записи и прогресс текущего пользователя (кешируются на время жизни страницы)
  let myCache = null;
  async function my({ fresh = false } = {}) {
    const user = currentUser();
    if (!user) return { enrollments: [], progress: [] };
    if (myCache && !fresh) return myCache;
    return once('my', async () => {
      const mode = await detectMode();
      let result;
      if (mode === 'v2') {
        if (!token()) { clearSession(); throw new ApiError('unauthorized', 'Войдите в аккаунт снова — мы обновили систему входа.'); }
        const res = await v2('me', {}, { auth: true, retries: 1 });
        if (res.user) saveSession(res.user, token());
        result = { enrollments: res.enrollments || [], progress: res.progress || [] };
      } else {
        const a = await rawAdapter();
        const [en, pr] = await Promise.all([a.getAll('enrollments'), a.getAll('progress')]);
        result = {
          enrollments: en.filter(r => String(r.user_id) === String(user.id)),
          progress: pr.filter(r => String(r.user_id) === String(user.id))
        };
      }
      myCache = result;
      return result;
    });
  }

  async function enroll(courseId) {
    courseId = idValue(courseId);
    const user = currentUser();
    if (!user) throw new ApiError('unauthorized', 'Войдите, чтобы записаться на курс.');
    const mode = await detectMode();
    if (mode === 'v2') {
      const res = await v2('enroll', { course_id: courseId }, { auth: true });
      myCache = null;
      return res.enrollment;
    }
    const mine = await my({ fresh: true });
    const existing = mine.enrollments.find(e => String(e.course_id) === String(courseId));
    if (existing) return existing;
    const a = await rawAdapter();
    const row = await a.addRow('enrollments', { user_id: user.id, course_id: courseId, enrolled_at: new Date().toISOString(), completed_at: '', certificate_id: '' });
    myCache = null;
    return row;
  }

  // lessonIdsOfCourse — все id уроков курса (нужно в legacy-режиме, чтобы
  // понять, завершён ли курс; в v2 это проверяет сервер)
  async function completeLesson(courseId, lessonId, score, lessonIdsOfCourse) {
    courseId = idValue(courseId);
    lessonId = idValue(lessonId);
    const user = currentUser();
    if (!user) throw new ApiError('unauthorized', 'Войдите, чтобы сохранять прогресс.');
    const mode = await detectMode();
    if (mode === 'v2') {
      const res = await v2('complete_lesson', { course_id: courseId, lesson_id: lessonId, quiz_score: score === undefined ? '' : score }, { auth: true });
      myCache = null;
      return res.enrollment;
    }
    const a = await rawAdapter();
    let mine = await my({ fresh: true });
    let enrollment = mine.enrollments.find(e => String(e.course_id) === String(courseId));
    if (!enrollment) enrollment = await a.addRow('enrollments', { user_id: user.id, course_id: courseId, enrolled_at: new Date().toISOString(), completed_at: '', certificate_id: '' });
    const done = mine.progress.some(p => String(p.lesson_id) === String(lessonId) && String(p.course_id) === String(courseId));
    if (!done) await a.addRow('progress', { user_id: user.id, course_id: courseId, lesson_id: lessonId, completed_at: new Date().toISOString(), quiz_score: score === undefined ? '' : score });
    mine = await my({ fresh: true });
    const doneIds = new Set(mine.progress.filter(p => String(p.course_id) === String(courseId)).map(p => String(p.lesson_id)));
    const isSheetCourse = /^\d+$/.test(String(courseId));
    if (isSheetCourse && lessonIdsOfCourse && lessonIdsOfCourse.length && lessonIdsOfCourse.every(id => doneIds.has(String(id))) && !enrollment.completed_at) {
      const values = { completed_at: new Date().toISOString(), certificate_id: 'CERT-' + courseId + '-' + user.id + '-' + Date.now() };
      await a.updateRow('enrollments', enrollment.id, values);
      Object.assign(enrollment, values);
    }
    myCache = null;
    return enrollment;
  }

  async function updateProfile(name) {
    const mode = await detectMode();
    const user = currentUser();
    if (mode === 'v2') {
      const res = await v2('update_profile', { name }, { auth: true });
      saveSession(res.user, token());
      return res.user;
    }
    const a = await rawAdapter();
    await a.updateRow('users', user.id, { name });
    user.name = name;
    saveSession(user, '');
    return user;
  }

  async function changePassword(current, next) {
    const mode = await detectMode();
    if (mode !== 'v2') throw new ApiError('unsupported', 'Смена пароля заработает после обновления серверного скрипта (apps-script/Code.gs).');
    return v2('change_password', { current_password: current, new_password: next }, { auth: true });
  }

  async function sendFeedback(data) {
    const mode = await detectMode();
    if (mode === 'v2') return v2('feedback', data);
    if (mode === 'local') return local.addRow('feedback', Object.assign({}, data, { created_at: new Date().toISOString(), status: 'new' }));
    throw new ApiError('unsupported', 'Форма заработает после обновления серверного скрипта (apps-script/Code.gs).');
  }

  /* ---------------- администрирование ---------------- */
  const admin = {
    async list(sheet) {
      const mode = await detectMode();
      if (mode === 'v2') return v2('admin_list', { sheet }, { auth: true, retries: 1 });
      if (sheet === 'feedback' && mode === 'legacy') return [];
      const a = await rawAdapter();
      return a.getAll(sheet);
    },
    async add(sheet, row, reqId) {
      const mode = await detectMode();
      cacheClear('public:');
      if (mode === 'v2') return v2('add', { sheet, row, request_id: reqId || requestId() }, { auth: true });
      return (await rawAdapter()).addRow(sheet, row);
    },
    async update(sheet, id, values) {
      const mode = await detectMode();
      cacheClear('public:');
      if (mode === 'v2') return v2('update', { sheet, id, values }, { auth: true });
      return (await rawAdapter()).updateRow(sheet, id, values);
    },
    async remove(sheet, id) {
      const mode = await detectMode();
      cacheClear('public:');
      if (mode === 'v2') return v2('delete', { sheet, id }, { auth: true });
      return (await rawAdapter()).deleteRow(sheet, id);
    },
    async status() {
      const started = performance.now();
      const mode = await detectMode();
      if (mode === 'v2') {
        const data = await v2('admin_status', {}, { auth: true });
        return Object.assign({ mode, latency: Math.round(performance.now() - started) }, data);
      }
      return { mode, latency: Math.round(performance.now() - started) };
    }
  };

  window.DB = {
    ApiError,
    mode: detectMode,
    getPublic,
    currentUser,
    hasToken: () => !!token(),
    register,
    login,
    logout,
    clearSession,
    my,
    enroll,
    completeLesson,
    updateProfile,
    changePassword,
    sendFeedback,
    admin,
    requestId,
    clearCache: cacheClear
  };
})();
