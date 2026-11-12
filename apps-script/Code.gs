/**
 * Stroka — серверный скрипт v2 для Google Таблицы.
 *
 * Таблица — единственный источник данных сайта:
 *  - всё, что меняется на сайте (регистрация, запись на курс, прогресс,
 *    правки в админ-панели, обращения), сразу записывается в таблицу;
 *  - всё, что вы меняете в таблице руками, сайт показывает при следующей
 *    загрузке страницы (браузер держит копию не дольше 30 секунд).
 *
 * Чем v2 отличается от прежнего скрипта (list/add/update/delete):
 *  - лист users больше не отдаётся наружу: email и хэши паролей не видны;
 *  - изменять таблицу может только администратор, права проверяет сервер;
 *  - пароли хранятся с солью; старые хэши принимаются и обновляются при входе;
 *  - вход по сессиям (токен на 30 дней), выход завершает сессию на сервере;
 *  - все записи идут под блокировкой: нет дублей при двойном клике
 *    и одновременных запросах.
 *
 * Установка — см. apps-script/README.md.
 */

const VERSION = 2;
const SESSION_DAYS = 30;
const HASH_ROUNDS = 300;
const MAX_CELL = 49000; // ограничение Google Таблиц — 50 000 символов в ячейке

// Столбцы листов. Порядок важен только для новых листов: в существующих
// сервер ищет столбцы по названию в первой строке, недостающие добавляет сам.
const SCHEMA = {
  courses: ['id', 'title', 'description', 'category', 'level', 'duration', 'image_url', 'instructor', 'status'],
  lessons: ['id', 'course_id', 'module', 'order', 'title', 'type', 'content', 'video_url'],
  questions: ['id', 'lesson_id', 'question', 'options', 'correct_index'],
  users: ['id', 'name', 'email', 'password_hash', 'role', 'created_at'],
  enrollments: ['id', 'user_id', 'course_id', 'enrolled_at', 'completed_at', 'certificate_id'],
  progress: ['id', 'user_id', 'course_id', 'lesson_id', 'completed_at', 'quiz_score'],
  feedback: ['id', 'name', 'email', 'topic', 'message', 'page', 'status', 'created_at', 'user_id'],
  favorites: ['id', 'user_id', 'course_id', 'created_at'],
  notes: ['id', 'user_id', 'course_id', 'lesson_id', 'course_title', 'lesson_title', 'text', 'updated_at'],
  sessions: ['token_hash', 'user_id', 'created_at', 'expires_at']
};
// Необязательные столбцы — создаются при первом сохранении из админ-панели или при переносе каталога
const OPTIONAL = {
  courses: ['subtitle', 'format', 'tags', 'audience', 'requirements', 'outcomes',
    'stage', 'access', 'hours', 'order', 'featured', 'next', 'projects', 'glyph', 'tone', 'external_url', 'provider'],
  lessons: ['module_summary', 'summary', 'minutes', 'tasks'],
  questions: ['explain']
};

const PUBLIC_SHEETS = ['courses', 'lessons', 'questions'];
const ADMIN_READABLE = ['courses', 'lessons', 'questions', 'users', 'enrollments', 'progress', 'feedback'];
const ADDABLE = ['courses', 'lessons', 'questions'];
const DELETABLE = ['courses', 'lessons', 'questions', 'feedback'];
const EDITABLE = {
  courses: SCHEMA.courses.slice(1).concat(OPTIONAL.courses),
  lessons: SCHEMA.lessons.slice(1).concat(OPTIONAL.lessons),
  questions: SCHEMA.questions.slice(1).concat(OPTIONAL.questions),
  feedback: ['status'],
  users: ['name', 'role']
};
// Ссылки на курс/урок: число (курсы, созданные в таблице) или текстовый id
// перенесённого каталога сайта, например html-basics и html-basics.1.2
const REF_FIELDS = ['course_id', 'lesson_id'];
const NUMBER_FIELDS = ['order', 'correct_index', 'hours', 'minutes'];
const REQUIRED_NUMBERS = { lessons: ['order'], questions: ['correct_index'] };
const COURSE_ID_RE = /^(\d+|[a-z0-9][a-z0-9-]{0,59})$/;
const LESSON_ID_RE = /^(\d+|[a-z0-9][a-z0-9.-]{0,79})$/;
const STAGES = ['full', 'demo', 'outline', 'external'];
const TONES = ['indigo', 'lime', 'coral', 'sky', 'violet', 'sand', 'ink'];
const VIDEO_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|rutube\.ru|vk\.com|vkvideo\.ru)\//;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/* ======================= вход запросов ======================= */

function doGet(e) {
  return respond(() => handle((e && e.parameter) || {}, 'GET'));
}

function doPost(e) {
  return respond(() => {
    let body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { throw new ApiError('bad_request', 'Некорректный запрос.'); }
    if (!body || typeof body !== 'object') throw new ApiError('bad_request', 'Некорректный запрос.');
    return handle(body, 'POST');
  });
}

function respond(fn) {
  let out;
  tablesCache = {}; // каждый запрос читает таблицу заново — правки вручную видны сразу
  try {
    out = { ok: true, data: fn() };
  } catch (err) {
    if (err instanceof ApiError) out = { ok: false, code: err.code, error: err.message };
    else {
      console.error(err && err.stack ? err.stack : err);
      out = { ok: false, code: 'server', error: 'Ошибка сервера. Попробуйте позже.' };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

const GET_ACTIONS = ['info', 'list', 'public'];

function handle(p, method) {
  const action = String(p.action || '');
  if (method === 'GET' && GET_ACTIONS.indexOf(action) === -1) throw new ApiError('bad_request', 'Это действие доступно только через POST.');
  const fn = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!fn) throw new ApiError('bad_request', 'Неизвестное действие: ' + action);
  return fn(p);
}

const ACTIONS = {
  info: () => ({ version: VERSION }),
  list: p => {
    const sheet = String(p.sheet || '');
    if (PUBLIC_SHEETS.indexOf(sheet) === -1) throw new ApiError('forbidden', 'Этот лист недоступен.');
    return publicData()[sheet];
  },
  public: () => publicData(),
  register: register,
  login: login,
  logout: logout,
  me: me,
  enroll: enroll,
  complete_lesson: completeLesson,
  update_profile: updateProfile,
  change_password: changePassword,
  feedback: feedback,
  favorite: setFavorite,
  save_note: saveNote,
  sync_local: syncLocal,
  admin_list: p => { requireAdmin(p); return adminList(p); },
  add: p => { requireAdmin(p); return adminAdd(p); },
  update: p => { const u = requireAdmin(p); return adminUpdate(p, u); },
  delete: p => { requireAdmin(p); return adminDelete(p); },
  admin_status: p => { requireAdmin(p); return adminStatus(); },
  import_catalog: p => { requireAdmin(p); return importCatalog(p); }
};

/* ======================= работа с листами ======================= */

let tablesCache = {};
let locked = false;

function spreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new ApiError('config', 'Скрипт не привязан к таблице. Укажите свойство SPREADSHEET_ID (см. README).');
  return ss;
}

function cellValue(v) {
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString();
  return v;
}

// Читает лист целиком. create=true — создать лист с нужными столбцами, если его нет.
function table(name, create) {
  if (tablesCache[name]) return tablesCache[name];
  const ss = spreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh && !create) return { name: name, sheet: null, headers: [], rows: [] };
  if (!sh) sh = ss.insertSheet(name);
  const values = sh.getDataRange().getValues();
  let headers = (values[0] || []).map(h => String(h).trim());
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  if (!headers.length && SCHEMA[name]) {
    headers = SCHEMA[name].slice();
    writeHeaders(sh, 1, headers);
    sh.setFrozenRows(1);
  }
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (r.every(v => v === '' || v === null)) continue;
    const o = {};
    headers.forEach((h, j) => { if (h) o[h] = cellValue(r[j]); });
    Object.defineProperty(o, '__row', { value: i + 1, enumerable: false, writable: true });
    rows.push(o);
  }
  const t = { name: name, sheet: sh, headers: headers, rows: rows };
  tablesCache[name] = t;
  return t;
}

function writeHeaders(sh, fromCol, names) {
  const need = fromCol + names.length - 1 - sh.getMaxColumns();
  if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
  sh.getRange(1, fromCol, 1, names.length).setValues([names]).setFontWeight('bold');
}

function ensureColumns(t, keys) {
  const missing = keys.filter(k => k && t.headers.indexOf(k) === -1);
  if (!missing.length) return;
  writeHeaders(t.sheet, t.headers.length + 1, missing);
  missing.forEach(k => t.headers.push(k));
}

// Строки записываются как текст (через апостроф): иначе таблица превратит
// «- пункт списка» или «=…» в формулу, а «2026-10-01» — в дату.
function safe(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  return s === '' ? '' : "'" + s;
}

function clean(row) {
  const o = {};
  Object.keys(row).forEach(k => { o[k] = row[k]; });
  return o;
}

function nextId(t) {
  return t.rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
}

function appendRow(t, obj) {
  if (!t.sheet) throw new ApiError('server', 'Лист ' + t.name + ' не найден.');
  ensureColumns(t, Object.keys(obj));
  const arr = t.headers.map(h => (Object.prototype.hasOwnProperty.call(obj, h) ? safe(obj[h]) : ''));
  const rowIndex = t.sheet.getLastRow() + 1;
  if (rowIndex > t.sheet.getMaxRows()) t.sheet.insertRowsAfter(t.sheet.getMaxRows(), 50);
  t.sheet.getRange(rowIndex, 1, 1, arr.length).setValues([arr]);
  const rec = clean(obj);
  Object.defineProperty(rec, '__row', { value: rowIndex, enumerable: false, writable: true });
  t.rows.push(rec);
  return rec;
}

// Много строк одним вызовом — перенос каталога иначе шёл бы минуты
function appendRows(t, objs) {
  if (!objs.length) return [];
  const keys = [];
  objs.forEach(o => Object.keys(o).forEach(k => { if (keys.indexOf(k) === -1) keys.push(k); }));
  ensureColumns(t, keys);
  const arr = objs.map(o => t.headers.map(h => (Object.prototype.hasOwnProperty.call(o, h) ? safe(o[h]) : '')));
  const start = t.sheet.getLastRow() + 1;
  const need = start + arr.length - 1 - t.sheet.getMaxRows();
  if (need > 0) t.sheet.insertRowsAfter(t.sheet.getMaxRows(), need + 50);
  t.sheet.getRange(start, 1, arr.length, t.headers.length).setValues(arr);
  return objs.map((o, i) => {
    const rec = clean(o);
    Object.defineProperty(rec, '__row', { value: start + i, enumerable: false, writable: true });
    t.rows.push(rec);
    return rec;
  });
}

function updateRow(t, row, values) {
  ensureColumns(t, Object.keys(values));
  Object.keys(values).forEach(k => {
    t.sheet.getRange(row.__row, t.headers.indexOf(k) + 1).setValue(safe(values[k]));
    row[k] = values[k];
  });
  return row;
}

function deleteRows(t, rows) {
  rows.map(r => r.__row).sort((a, b) => b - a).forEach(i => t.sheet.deleteRow(i));
  delete tablesCache[t.name];
}

function findById(t, id) {
  return t.rows.find(r => String(r.id) === String(id)) || null;
}

// Все записи — под общей блокировкой скрипта, данные внутри читаются заново
function withLock(fn) {
  if (locked) return fn();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new ApiError('busy', 'Сервер занят. Повторите через несколько секунд.');
  locked = true;
  tablesCache = {};
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    locked = false;
    tablesCache = {};
    lock.releaseLock();
  }
}

/* ======================= кеш и защита от повторов ======================= */

function cache() { return CacheService.getScriptCache(); }

// Один и тот же request_id выполняется один раз (двойной клик, повтор при сбое сети)
function once(requestId, fn) {
  if (!requestId) return fn();
  const key = 'req:' + String(requestId).slice(0, 80);
  const hit = cache().get(key);
  if (hit) return JSON.parse(hit);
  const res = fn();
  try { cache().put(key, JSON.stringify(res), 6 * 3600); } catch (e) { /* ответ больше 100 КБ — не кешируем */ }
  return res;
}

function rateLimit(key, max, seconds, message) {
  const c = cache();
  const n = Number(c.get('rl:' + key) || 0);
  if (n >= max) throw new ApiError('too_many', message || 'Слишком много попыток. Подождите немного и попробуйте снова.');
  c.put('rl:' + key, String(n + 1), seconds);
}

/* ======================= публичные данные ======================= */

function isPublished(status) {
  return ['published', 'опубликован', 'опубликовано', 'да', 'yes', 'true', '1'].indexOf(String(status).trim().toLowerCase()) !== -1;
}

// Строкам, добавленным в таблицу вручную без id, номер присваивается автоматически
function fillMissingIds(names) {
  const need = names.filter(n => {
    const t = table(n);
    return t.sheet && t.headers.indexOf('id') !== -1 && t.rows.some(r => r.id === '' || r.id === null || r.id === undefined);
  });
  if (!need.length) return;
  withLock(() => need.forEach(n => {
    const t = table(n);
    let id = nextId(t);
    t.rows.filter(r => r.id === '' || r.id === null || r.id === undefined).forEach(r => updateRow(t, r, { id: id++ }));
  }));
}

function publicData() {
  fillMissingIds(PUBLIC_SHEETS);
  const courses = table('courses').rows
    .filter(r => r.id !== '' && isPublished(r.status))
    .map(r => Object.assign(clean(r), { status: 'published' }));
  const courseIds = {};
  courses.forEach(c => { courseIds[String(c.id)] = true; });
  const lessons = table('lessons').rows.filter(l => l.id !== '' && courseIds[String(l.course_id)]).map(clean);
  const lessonIds = {};
  lessons.forEach(l => { lessonIds[String(l.id)] = true; });
  const questions = table('questions').rows.filter(q => q.id !== '' && lessonIds[String(q.lesson_id)]).map(clean);
  return { courses: courses, lessons: lessons, questions: questions, catalog: catalogInSheet(), updated_at: new Date().toISOString() };
}

// true — встроенный каталог сайта перенесён в таблицу, и сайт показывает
// курсы только из таблицы (удалённый здесь курс пропадает и с сайта)
function catalogInSheet() {
  return PropertiesService.getScriptProperties().getProperty('CATALOG_IN_SHEET') === '1';
}

function hasText(v) {
  return String(v === undefined || v === null ? '' : v).trim() !== '';
}
function lessonAvailable(l) {
  return hasText(l.content) || hasText(l.video_url);
}
function refValue(id) {
  return /^\d+$/.test(id) ? Number(id) : id;
}

/* ======================= пароли и сессии ======================= */

function hex(bytes) {
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function sha256Hex(text) {
  return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}
function randomHex() {
  return Utilities.getUuid().replace(/-/g, '');
}
function derive(password, salt, rounds) {
  const key = Utilities.newBlob(salt).getBytes();
  let b = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(password)).getBytes(), key);
  for (let i = 1; i < rounds; i++) b = Utilities.computeHmacSha256Signature(b, key);
  return hex(b);
}
function makePasswordHash(password) {
  const salt = randomHex();
  return 'v2$' + HASH_ROUNDS + '$' + salt + '$' + derive(password, salt, HASH_ROUNDS);
}
function sameText(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function checkPassword(password, stored) {
  stored = String(stored || '');
  if (stored.indexOf('v2$') === 0) {
    const parts = stored.split('$');
    return parts.length === 4 && sameText(derive(password, parts[2], Number(parts[1]) || HASH_ROUNDS), parts[3]);
  }
  // прежний формат сайта: SHA-256 без соли
  if (/^[0-9a-f]{64}$/i.test(stored)) return sameText(sha256Hex(password), stored.toLowerCase());
  return false;
}

function adminEmails() {
  return String(PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
function isAdmin(u) {
  return String(u.role || '').trim().toLowerCase() === 'admin' || adminEmails().indexOf(String(u.email || '').trim().toLowerCase()) !== -1;
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: isAdmin(u) ? 'admin' : 'student' };
}

function createSession(userId) {
  const token = randomHex() + randomHex();
  const now = new Date();
  const t = table('sessions', true);
  // заодно убираем истёкшие сессии
  const expired = t.rows.filter(s => new Date(s.expires_at).getTime() < now.getTime());
  if (expired.length) deleteRows(t, expired);
  appendRow(table('sessions', true), {
    token_hash: sha256Hex(token),
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_DAYS * 864e5).toISOString()
  });
  return token;
}

function auth(p) {
  const token = String(p.token || '');
  if (!/^[0-9a-f]{64}$/.test(token)) throw new ApiError('unauthorized', 'Войдите в аккаунт.');
  const th = sha256Hex(token);
  let userId = cache().get('sess:' + th);
  if (!userId) {
    const s = table('sessions').rows.find(r => r.token_hash === th);
    if (!s || new Date(s.expires_at).getTime() < Date.now()) throw new ApiError('unauthorized', 'Сессия истекла. Войдите снова.');
    userId = String(s.user_id);
    cache().put('sess:' + th, userId, 600);
  }
  const user = findById(table('users'), userId);
  if (!user) throw new ApiError('unauthorized', 'Аккаунт не найден. Войдите снова.');
  Object.defineProperty(user, '__token_hash', { value: th, enumerable: false, configurable: true, writable: true });
  return user;
}

function requireAdmin(p) {
  const u = auth(p);
  if (!isAdmin(u)) throw new ApiError('forbidden', 'Нужны права администратора.');
  return u;
}

/* ======================= аккаунт ======================= */

function text(v, max) {
  return String(v === undefined || v === null ? '' : v).trim().slice(0, max);
}

function register(p) {
  const name = text(p.name, 80);
  const email = text(p.email, 120).toLowerCase();
  const password = String(p.password || '');
  if (name.length < 2) throw new ApiError('bad_request', 'Укажите имя — минимум 2 символа.');
  if (!EMAIL_RE.test(email)) throw new ApiError('bad_request', 'Проверьте email.');
  if (password.length < 8 || password.length > 200) throw new ApiError('bad_request', 'Пароль должен быть от 8 до 200 символов.');
  rateLimit('reg', 30, 3600, 'Слишком много регистраций. Попробуйте позже.');
  return withLock(() => once(p.request_id, () => {
    const users = table('users', true);
    if (users.rows.some(u => String(u.email).trim().toLowerCase() === email)) throw new ApiError('email_taken', 'Этот email уже зарегистрирован. Войдите в аккаунт.');
    const user = appendRow(users, {
      id: nextId(users), name: name, email: email, password_hash: makePasswordHash(password),
      role: 'student', created_at: new Date().toISOString()
    });
    return { user: publicUser(user), token: createSession(user.id) };
  }));
}

function login(p) {
  const email = text(p.email, 120).toLowerCase();
  const password = String(p.password || '');
  if (!email || !password) throw new ApiError('bad_credentials', 'Неверный email или пароль.');
  rateLimit('login:' + email, 10, 900, 'Слишком много попыток входа. Подождите 15 минут.');
  // В таблице могут быть дубли одного email (старая регистрация без блокировки)
  const candidates = table('users').rows.filter(u => String(u.email).trim().toLowerCase() === email);
  const found = candidates.find(u => checkPassword(password, u.password_hash));
  if (!found) throw new ApiError('bad_credentials', 'Неверный email или пароль.');
  cache().remove('rl:login:' + email);
  return withLock(() => {
    const users = table('users');
    const user = findById(users, found.id);
    if (!user) throw new ApiError('bad_credentials', 'Неверный email или пароль.');
    if (String(user.password_hash).indexOf('v2$') !== 0) updateRow(users, user, { password_hash: makePasswordHash(password) });
    return { user: publicUser(user), token: createSession(user.id) };
  });
}

function logout(p) {
  const token = String(p.token || '');
  if (!/^[0-9a-f]{64}$/.test(token)) return {};
  const th = sha256Hex(token);
  cache().remove('sess:' + th);
  withLock(() => {
    const t = table('sessions');
    if (t.sheet) deleteRows(t, t.rows.filter(s => s.token_hash === th));
  });
  return {};
}

function mine(sheet, userId) {
  return table(sheet).rows.filter(r => String(r.user_id) === String(userId)).map(clean);
}

function me(p) {
  const u = auth(p);
  return {
    user: publicUser(u),
    enrollments: mine('enrollments', u.id),
    progress: mine('progress', u.id),
    favorites: mine('favorites', u.id).map(f => String(f.course_id)),
    notes: mine('notes', u.id)
  };
}

function updateProfile(p) {
  const u = auth(p);
  const name = text(p.name, 80);
  if (name.length < 2) throw new ApiError('bad_request', 'Имя должно содержать минимум 2 символа.');
  return withLock(() => {
    const users = table('users');
    const user = findById(users, u.id);
    updateRow(users, user, { name: name });
    return { user: publicUser(user) };
  });
}

function changePassword(p) {
  const u = auth(p);
  const next = String(p.new_password || '');
  if (!checkPassword(String(p.current_password || ''), u.password_hash)) throw new ApiError('bad_credentials', 'Текущий пароль указан неверно.');
  if (next.length < 8 || next.length > 200) throw new ApiError('bad_request', 'Новый пароль должен быть от 8 до 200 символов.');
  const keep = u.__token_hash;
  withLock(() => {
    const users = table('users');
    updateRow(users, findById(users, u.id), { password_hash: makePasswordHash(next) });
    // другие устройства выходят из аккаунта
    const s = table('sessions');
    const other = s.rows.filter(r => String(r.user_id) === String(u.id) && r.token_hash !== keep);
    other.forEach(r => cache().remove('sess:' + r.token_hash));
    if (other.length) deleteRows(s, other);
  });
  return {};
}

/* ======================= обучение ======================= */

function courseId(raw) {
  const id = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!COURSE_ID_RE.test(id)) throw new ApiError('bad_request', 'Некорректный курс.');
  const row = findById(table('courses'), id);
  if (row) {
    if (!isPublished(row.status)) throw new ApiError('not_found', 'Курс не найден или снят с публикации.');
    return { id: id, sheet: true, value: row.id, row: row };
  }
  // курс встроенного каталога сайта (data/catalog.js), пока он не перенесён в таблицу
  if (/^\d+$/.test(id) || catalogInSheet()) throw new ApiError('not_found', 'Курс не найден или снят с публикации.');
  return { id: id, sheet: false, value: id, row: null };
}

function findEnrollment(t, userId, cid) {
  return t.rows.find(e => String(e.user_id) === String(userId) && String(e.course_id) === cid) || null;
}

function enroll(p) {
  const u = auth(p);
  const c = courseId(p.course_id);
  return withLock(() => {
    const t = table('enrollments', true);
    let e = findEnrollment(t, u.id, c.id);
    if (!e) e = appendRow(t, { id: nextId(t), user_id: u.id, course_id: c.value, enrolled_at: new Date().toISOString(), completed_at: '', certificate_id: '' });
    return { enrollment: clean(e) };
  });
}

function completeLesson(p) {
  const u = auth(p);
  const c = courseId(p.course_id);
  const lid = String(p.lesson_id === undefined ? '' : p.lesson_id).trim();
  let courseLessons = null;
  if (c.sheet) {
    const own = table('lessons').rows.filter(l => String(l.course_id) === c.id);
    if (!own.some(l => String(l.id) === lid)) throw new ApiError('not_found', 'Урок не найден в этом курсе.');
    // Подтверждение — только для полного курса, когда пройдены все опубликованные уроки
    const stage = String(c.row.stage || '').trim() || 'full';
    courseLessons = stage === 'full' ? own.filter(lessonAvailable).map(l => String(l.id)) : [];
  } else if (!new RegExp('^' + c.id + '\\.\\d+\\.\\d+$').test(lid)) {
    throw new ApiError('bad_request', 'Некорректный урок.');
  }
  let score = '';
  if (p.quiz_score !== '' && p.quiz_score !== undefined && p.quiz_score !== null) {
    score = Math.round(Number(p.quiz_score));
    if (!isFinite(score) || score < 0 || score > 100) throw new ApiError('bad_request', 'Некорректный результат теста.');
  }
  return withLock(() => {
    const now = new Date().toISOString();
    const en = table('enrollments', true);
    let e = findEnrollment(en, u.id, c.id);
    if (!e) e = appendRow(en, { id: nextId(en), user_id: u.id, course_id: c.value, enrolled_at: now, completed_at: '', certificate_id: '' });
    const pr = table('progress', true);
    const own = pr.rows.filter(r => String(r.user_id) === String(u.id) && String(r.course_id) === c.id);
    if (!own.some(r => String(r.lesson_id) === lid)) {
      own.push(appendRow(pr, { id: nextId(pr), user_id: u.id, course_id: c.value, lesson_id: refValue(lid), completed_at: now, quiz_score: score }));
    }
    if (c.sheet && !e.completed_at && courseLessons.length) {
      const done = {};
      own.forEach(r => { done[String(r.lesson_id)] = true; });
      if (courseLessons.every(id => done[id])) {
        updateRow(en, e, { completed_at: now, certificate_id: 'CERT-' + c.id + '-' + u.id + '-' + Date.now() });
      }
    }
    return { enrollment: clean(e) };
  });
}

function feedback(p) {
  if (text(p.website, 200)) return {}; // honeypot: заполняют только боты
  const row = {
    name: text(p.name, 80), email: text(p.email, 120), topic: text(p.topic, 120),
    message: text(p.message, 4000), page: text(p.page, 200)
  };
  if (row.name.length < 2) throw new ApiError('bad_request', 'Укажите имя.');
  if (!EMAIL_RE.test(row.email)) throw new ApiError('bad_request', 'Проверьте email.');
  if (row.message.length < 10) throw new ApiError('bad_request', 'Сообщение должно быть не короче 10 символов.');
  let userId = '';
  try { if (p.token) userId = auth(p).id; } catch (e) { /* можно писать и без входа */ }
  return withLock(() => once(p.request_id, () => {
    rateLimit('fb:' + row.email.toLowerCase(), 5, 3600, 'Вы уже отправили несколько сообщений. Попробуйте через час.');
    rateLimit('fb:all', 200, 3600, 'Форма временно перегружена. Попробуйте позже.');
    const t = table('feedback', true);
    const rec = appendRow(t, Object.assign({ id: nextId(t) }, row, { status: 'new', created_at: new Date().toISOString(), user_id: userId }));
    return { id: rec.id };
  }));
}

/* ======================= избранное и заметки ======================= */

function favoritesOf(userId) {
  return mine('favorites', userId).map(f => String(f.course_id));
}

function setFavorite(p) {
  const u = auth(p);
  const cid = String(p.course_id === undefined ? '' : p.course_id).trim();
  if (!COURSE_ID_RE.test(cid)) throw new ApiError('bad_request', 'Некорректный курс.');
  const on = p.on === true || p.on === 'true' || p.on === 1;
  return withLock(() => {
    const t = table('favorites', true);
    const rows = t.rows.filter(f => String(f.user_id) === String(u.id) && String(f.course_id) === cid);
    if (on && !rows.length) {
      if (t.rows.filter(f => String(f.user_id) === String(u.id)).length >= 200) throw new ApiError('bad_request', 'В избранном уже 200 курсов.');
      appendRow(t, { id: nextId(t), user_id: u.id, course_id: refValue(cid), created_at: new Date().toISOString() });
    }
    if (!on && rows.length) deleteRows(t, rows);
    return { favorites: favoritesOf(u.id) };
  });
}

function noteFields(n) {
  const cid = String(n.course_id === undefined ? '' : n.course_id).trim();
  const lid = String(n.lesson_id === undefined ? '' : n.lesson_id).trim();
  if (!COURSE_ID_RE.test(cid) || !LESSON_ID_RE.test(lid)) throw new ApiError('bad_request', 'Некорректный урок.');
  return {
    course_id: refValue(cid), lesson_id: refValue(lid),
    course_title: text(n.course_title, 200), lesson_title: text(n.lesson_title, 200),
    text: String(n.text === undefined || n.text === null ? '' : n.text).slice(0, 5000),
    updated_at: n.updated_at && !isNaN(new Date(n.updated_at)) ? new Date(n.updated_at).toISOString() : new Date().toISOString()
  };
}

// Пишет одну заметку; пустой текст — удалить. Вызывать внутри withLock.
function writeNote(t, userId, f) {
  const rows = t.rows.filter(r => String(r.user_id) === String(userId) && String(r.lesson_id) === String(f.lesson_id));
  if (!f.text.trim()) { if (rows.length) deleteRows(t, rows); return null; }
  if (rows.length) return updateRow(t, rows[0], f);
  return appendRow(t, Object.assign({ id: nextId(t), user_id: userId }, f));
}

function saveNote(p) {
  const u = auth(p);
  const f = noteFields(Object.assign({}, p, { updated_at: '' }));
  return withLock(() => {
    const t = table('notes', true);
    writeNote(t, u.id, f);
    return { updated_at: f.updated_at };
  });
}

// Однократная выгрузка заметок и избранного, которые раньше хранились
// только в браузере. Серверные данные не затираются: из двух версий
// заметки остаётся более новая.
function syncLocal(p) {
  const u = auth(p);
  const favs = (Array.isArray(p.favorites) ? p.favorites : []).slice(0, 200).map(x => String(x).trim()).filter(x => COURSE_ID_RE.test(x));
  const notes = (Array.isArray(p.notes) ? p.notes : []).slice(0, 500).map(noteFields).filter(n => n.text.trim());
  return withLock(() => {
    const ft = table('favorites', true);
    const have = {};
    ft.rows.filter(f => String(f.user_id) === String(u.id)).forEach(f => { have[String(f.course_id)] = true; });
    const now = new Date().toISOString();
    appendRows(ft, favs.filter((x, i) => !have[x] && favs.indexOf(x) === i).map((x, i) => ({ id: nextId(ft) + i, user_id: u.id, course_id: refValue(x), created_at: now })));
    const nt = table('notes', true);
    notes.forEach(n => {
      const cur = nt.rows.find(r => String(r.user_id) === String(u.id) && String(r.lesson_id) === String(n.lesson_id));
      if (!cur || new Date(cur.updated_at).getTime() < new Date(n.updated_at).getTime()) writeNote(nt, u.id, n);
    });
    return { favorites: favoritesOf(u.id), notes: mine('notes', u.id) };
  });
}

/* ======================= администрирование ======================= */

function adminList(p) {
  const sheet = String(p.sheet || '');
  if (ADMIN_READABLE.indexOf(sheet) === -1) throw new ApiError('forbidden', 'Этот лист недоступен.');
  fillMissingIds(PUBLIC_SHEETS.indexOf(sheet) !== -1 ? [sheet] : []);
  const rows = table(sheet).rows.map(clean);
  if (sheet === 'users') rows.forEach(r => { delete r.password_hash; r.role = isAdmin(r) ? 'admin' : (r.role || 'student'); });
  return rows;
}

function pick(sheet, src) {
  const out = {};
  (EDITABLE[sheet] || []).forEach(k => {
    if (!src || !Object.prototype.hasOwnProperty.call(src, k)) return;
    let v = src[k];
    if (REF_FIELDS.indexOf(k) !== -1) {
      v = String(v === null || v === undefined ? '' : v).trim();
      if (!(k === 'course_id' ? COURSE_ID_RE : LESSON_ID_RE).test(v)) throw new ApiError('bad_request', 'Поле ' + k + ': укажите id ' + (k === 'course_id' ? 'курса' : 'урока') + '.');
      v = refValue(v);
    } else if (NUMBER_FIELDS.indexOf(k) !== -1) {
      const empty = v === '' || v === null || v === undefined;
      if (empty && (REQUIRED_NUMBERS[sheet] || []).indexOf(k) === -1) v = '';
      else {
        v = Number(v);
        if (empty || !isFinite(v)) throw new ApiError('bad_request', 'Поле ' + k + ' должно быть числом.');
      }
    } else {
      v = String(v === null || v === undefined ? '' : v).slice(0, MAX_CELL);
    }
    out[k] = v;
  });
  if (out.status !== undefined && sheet === 'courses' && ['draft', 'published'].indexOf(out.status) === -1) throw new ApiError('bad_request', 'Статус: draft или published.');
  if (out.status !== undefined && sheet === 'feedback' && ['new', 'in_progress', 'done'].indexOf(out.status) === -1) throw new ApiError('bad_request', 'Некорректный статус обращения.');
  if (out.role !== undefined && ['admin', 'student'].indexOf(out.role) === -1) throw new ApiError('bad_request', 'Роль: admin или student.');
  if (out.type !== undefined && ['text', 'video'].indexOf(out.type) === -1) throw new ApiError('bad_request', 'Тип урока: text или video.');
  if (out.video_url && !VIDEO_HOSTS.test(out.video_url)) throw new ApiError('bad_request', 'Видео: используйте ссылку для встраивания YouTube, Vimeo, Rutube или VK Видео.');
  if (out.image_url && !/^https:\/\//.test(out.image_url)) throw new ApiError('bad_request', 'Обложка: нужна ссылка, начинающаяся с https://');
  if (out.external_url && !/^https:\/\/[^\s"'<>]+$/.test(out.external_url)) throw new ApiError('bad_request', 'Ссылка на курс должна начинаться с https://');
  if (out.stage && STAGES.indexOf(out.stage) === -1) throw new ApiError('bad_request', 'Стадия курса: full, demo, outline или external.');
  if (out.access && ['open', 'enroll'].indexOf(out.access) === -1) throw new ApiError('bad_request', 'Доступ: open или enroll.');
  if (out.tone && TONES.indexOf(out.tone) === -1) throw new ApiError('bad_request', 'Цвет обложки: ' + TONES.join(', ') + '.');
  if (out.correct_index !== undefined && (out.correct_index < 0 || Math.floor(out.correct_index) !== out.correct_index)) throw new ApiError('bad_request', 'Некорректный номер верного варианта.');
  return out;
}

function adminAdd(p) {
  const sheet = String(p.sheet || '');
  if (ADDABLE.indexOf(sheet) === -1) throw new ApiError('forbidden', 'В этот лист нельзя добавлять записи.');
  const values = pick(sheet, p.row || {});
  return withLock(() => once(p.request_id, () => {
    const t = table(sheet, true);
    return clean(appendRow(t, Object.assign({ id: nextId(t) }, values)));
  }));
}

function adminUpdate(p, admin) {
  const sheet = String(p.sheet || '');
  if (!EDITABLE[sheet]) throw new ApiError('forbidden', 'Этот лист нельзя изменять.');
  const values = pick(sheet, p.values || {});
  if (!Object.keys(values).length) throw new ApiError('bad_request', 'Нет изменений.');
  if (sheet === 'users' && String(p.id) === String(admin.id) && values.role && values.role !== 'admin') {
    throw new ApiError('bad_request', 'Нельзя снять права администратора с самого себя.');
  }
  return withLock(() => {
    const t = table(sheet);
    const row = t.sheet ? findById(t, p.id) : null;
    if (!row) throw new ApiError('not_found', 'Запись не найдена — возможно, её уже удалили.');
    const res = clean(updateRow(t, row, values));
    if (sheet === 'users') delete res.password_hash;
    return res;
  });
}

function adminDelete(p) {
  const sheet = String(p.sheet || '');
  if (DELETABLE.indexOf(sheet) === -1) throw new ApiError('forbidden', 'Из этого листа нельзя удалять записи.');
  return withLock(() => {
    const t = table(sheet);
    const row = t.sheet ? findById(t, p.id) : null;
    if (!row) throw new ApiError('not_found', 'Запись не найдена — возможно, её уже удалили.');
    deleteRows(t, [row]);
    return {};
  });
}

function adminStatus() {
  const sheets = {};
  Object.keys(SCHEMA).filter(n => n !== 'sessions').forEach(n => {
    const t = table(n);
    sheets[n] = {
      exists: !!t.sheet,
      rows: t.rows.length,
      missingColumns: t.sheet ? SCHEMA[n].filter(c => t.headers.indexOf(c) === -1) : []
    };
  });
  return { spreadsheet: spreadsheet().getName(), sheets: sheets, catalog_in_sheet: catalogInSheet() };
}

// Перенос встроенного каталога сайта в таблицу (кнопка в админ-панели → «Обзор»).
// Курсы, которые уже есть в таблице (тот же id), не трогаются — ваши правки не затираются.
function importCatalog(p) {
  const src = p.data || {};
  const list = k => (Array.isArray(src[k]) ? src[k] : []);
  if (!list('courses').length) throw new ApiError('bad_request', 'Нет курсов для переноса.');
  if (list('courses').length > 300 || list('lessons').length > 6000 || list('questions').length > 20000) throw new ApiError('bad_request', 'Слишком много данных за один раз.');
  return withLock(() => {
    const ct = table('courses', true), lt = table('lessons', true), qt = table('questions', true);
    const haveCourse = {}, haveLesson = {};
    ct.rows.forEach(r => { haveCourse[String(r.id)] = true; });
    lt.rows.forEach(r => { haveLesson[String(r.id)] = true; });
    const courses = list('courses').filter(c => COURSE_ID_RE.test(String(c.id)) && !/^\d+$/.test(String(c.id)) && !haveCourse[String(c.id)]);
    const ids = {};
    courses.forEach(c => { ids[String(c.id)] = true; });
    const lessons = list('lessons').filter(l => ids[String(l.course_id)] && LESSON_ID_RE.test(String(l.id)) && !haveLesson[String(l.id)]);
    const lids = {};
    lessons.forEach(l => { lids[String(l.id)] = true; });
    const questions = list('questions').filter(q => lids[String(q.lesson_id)]);
    let qid = nextId(qt);
    appendRows(ct, courses.map(c => Object.assign({ id: String(c.id) }, pick('courses', c))));
    appendRows(lt, lessons.map(l => Object.assign({ id: String(l.id) }, pick('lessons', l))));
    appendRows(qt, questions.map(q => Object.assign({ id: qid++ }, pick('questions', q))));
    PropertiesService.getScriptProperties().setProperty('CATALOG_IN_SHEET', '1');
    return { courses: courses.length, lessons: lessons.length, questions: questions.length, skipped: list('courses').length - courses.length };
  });
}

/* ======================= для запуска из редактора ======================= */

// Запустите один раз из редактора (Выполнить → setup): скрипт попросит доступ
// к таблице, создаст недостающие листы и столбцы и покажет итог в журнале.
function setup() {
  withLock(() => {
    Object.keys(SCHEMA).forEach(n => ensureColumns(table(n, true), SCHEMA[n]));
  });
  const st = adminStatus();
  console.log('Таблица «' + st.spreadsheet + '» готова: ' + JSON.stringify(st.sheets));
  const admins = table('users').rows.filter(isAdmin).map(u => u.email);
  console.log(admins.length ? 'Администраторы: ' + admins.join(', ') : 'Администраторов нет: впишите admin в столбец role нужного пользователя или задайте свойство ADMIN_EMAILS.');
}
