// app.js — общий каркас интерфейса: шапка, меню, подвал, тема, поиск,
// уведомления и небольшие вспомогательные функции для всех страниц.
(function () {
  'use strict';
  const cfg = window.STROKA_CONFIG || {};
  const BRAND = (cfg.brand && cfg.brand.name) || 'Stroka';

  /* ================= вспомогательные функции ================= */
  function escapeHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const getParam = name => new URLSearchParams(location.search).get(name);
  function plural(n, one, few, many) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }
  function formatDate(value) {
    const d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '•';
  }
  const scripts = new Map();
  function loadScript(src) {
    if (scripts.has(src)) return scripts.get(src);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { scripts.delete(src); reject(new Error('Не удалось загрузить ' + src)); };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
    return p;
  }
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ================= иконки (inline SVG sprite) ================= */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    send: '<path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z"/><path d="m10 13 4-4"/>',
    github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    play: '<path d="M7 5v14l12-7L7 5Z"/>',
    note: '<path d="M5 4h10l4 4v12H5V4Z"/><path d="M14 4v5h5M8 13h8M8 17h5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z"/>',
    vk: '<path d="M3 7h3.2c.3 3.4 1.8 5.4 3.3 5.8V7h3v3.4c1.5-.2 3-1.8 3.6-3.4h3c-.5 2.2-2.2 4-3.4 4.7 1.2.6 3.1 2 3.8 4.8h-3.3c-.6-1.8-2.1-3.2-3.7-3.4v3.4h-.4C6.5 16.5 3.4 13 3 7Z"/>'
  };
  function icon(name, cls = '') {
    return '<svg class="i ' + cls + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  }
  function injectSprite() {
    if (document.getElementById('stroka-sprite')) return;
    const symbols = Object.entries(ICONS).map(([k, v]) => '<symbol id="i-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + v + '</symbol>').join('');
    const div = document.createElement('div');
    div.innerHTML = '<svg id="stroka-sprite" xmlns="http://www.w3.org/2000/svg" style="display:none">' + symbols + '</svg>';
    document.body.prepend(div.firstChild);
  }

  /* ================= SEO-метаданные ================= */
  function absoluteUrl(path) {
    const base = (cfg.siteUrl || '').replace(/\/$/, '');
    if (base) return base + '/' + String(path || '').replace(/^\//, '');
    return new URL(path || '', location.href).href;
  }
  function setMeta({ title, description, path, type, image, noindex } = {}) {
    if (title) document.title = title === BRAND ? BRAND : title + ' — ' + BRAND;
    const set = (selector, attr, key, value) => {
      if (!value) return;
      let el = document.head.querySelector(selector);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', value);
    };
    set('meta[name="description"]', 'name', 'description', description);
    set('meta[property="og:title"]', 'property', 'og:title', title);
    set('meta[property="og:description"]', 'property', 'og:description', description);
    set('meta[property="og:type"]', 'property', 'og:type', type || 'website');
    set('meta[property="og:image"]', 'property', 'og:image', absoluteUrl(image || 'img/og-image.png'));
    if (path !== undefined) {
      set('meta[property="og:url"]', 'property', 'og:url', absoluteUrl(path));
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = absoluteUrl(path);
    }
    if (noindex) set('meta[name="robots"]', 'name', 'robots', 'noindex');
  }
  function setJsonLd(data) {
    let el = document.getElementById('jsonld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'jsonld'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /* ================= тема ================= */
  function currentTheme() {
    const set = document.documentElement.dataset.theme;
    if (set) return set;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('stroka-theme', next); } catch (e) { /* ignore */ }
    $$('[data-theme-toggle]').forEach(updateThemeButton);
  }
  function updateThemeButton(btn) {
    const dark = currentTheme() === 'dark';
    btn.innerHTML = icon(dark ? 'sun' : 'moon');
    btn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    btn.title = btn.getAttribute('aria-label');
  }

  /* ================= шапка ================= */
  const NAV = [
    { href: 'catalog.html', label: 'Каталог', key: 'catalog' },
    { href: 'index.html#tracks', label: 'Направления', key: 'tracks' },
    { href: 'index.html#start', label: 'С чего начать', key: 'start' },
    { href: 'about.html', label: 'Об авторе', key: 'about' },
    { href: 'help.html', label: 'Помощь', key: 'help' }
  ];
  function logo() {
    return '<a class="logo" href="index.html" aria-label="' + escapeHtml(BRAND) + ' — на главную"><span class="logo-mark" aria-hidden="true"><i></i></span><span class="logo-word">' + escapeHtml(BRAND.toLowerCase()) + '</span></a>';
  }
  function showHeader(active) {
    const hdr = document.getElementById('hdr');
    if (!hdr) return;
    injectSprite();
    const user = window.DB ? DB.currentUser() : null;
    const page = active || document.body.dataset.page || '';
    const links = NAV.map(n => '<a href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + n.label + '</a>').join('');
    let account;
    if (user) {
      account =
        '<div class="account">' +
        '<button class="avatar-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="account-menu" title="Аккаунт">' +
        '<span class="avatar" aria-hidden="true">' + escapeHtml(initials(user.name)) + '</span><span class="sr-only">Меню аккаунта ' + escapeHtml(user.name) + '</span></button>' +
        '<div class="menu" id="account-menu" hidden>' +
        '<div class="menu-head"><strong>' + escapeHtml(user.name) + '</strong><span>' + escapeHtml(user.email) + '</span></div>' +
        '<a href="profile.html">' + icon('grid') + 'Личный кабинет</a>' +
        (user.role === 'admin' ? '<a href="admin.html">' + icon('settings') + 'Администрирование</a>' : '') +
        '<button type="button" data-logout>' + icon('logout') + 'Выйти</button>' +
        '</div></div>';
    } else {
      account = '<a class="btn btn-sm" href="login.html">Войти</a>';
    }
    hdr.innerHTML =
      '<a class="skip-link" href="#app">Перейти к содержимому</a>' +
      '<nav class="nav" aria-label="Основная навигация">' + logo() +
      '<div class="nav-links">' + links + '</div>' +
      '<div class="nav-tools">' +
      '<button class="search-trigger" type="button" data-search-open aria-label="Поиск по курсам">' + icon('search') + '<span>Поиск</span><kbd>/</kbd></button>' +
      '<button class="icon-btn" type="button" data-theme-toggle></button>' +
      account +
      '<button class="icon-btn burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-menu">' + icon('menu') + '</button>' +
      '</div></nav>' +
      '<div class="mobile-menu" id="mobile-menu" hidden><div class="mobile-menu-inner">' +
      NAV.map(n => '<a href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + n.label + icon('arrow') + '</a>').join('') +
      (user ? '<a href="profile.html">Личный кабинет' + icon('arrow') + '</a>' + (user.role === 'admin' ? '<a href="admin.html">Администрирование' + icon('arrow') + '</a>' : '') + '<button type="button" data-logout>Выйти' + icon('logout') + '</button>'
        : '<a class="btn" href="login.html">Войти или зарегистрироваться</a>') +
      '</div></div>';

    // Меню переносим в body: backdrop-filter шапки иначе ограничивает position: fixed её высотой
    const oldMenu = document.querySelector('body > #mobile-menu');
    if (oldMenu) oldMenu.remove();
    document.body.appendChild($('#mobile-menu', hdr));
    $$('[data-theme-toggle]', hdr).forEach(btn => { updateThemeButton(btn); btn.addEventListener('click', toggleTheme); });
    $$('[data-logout]', hdr).concat($$('#mobile-menu [data-logout]')).forEach(b => b.addEventListener('click', async () => { await DB.logout(); location.href = 'index.html'; }));
    $('[data-search-open]', hdr).addEventListener('click', openSearch);

    const burger = $('.burger', hdr), mobile = $('#mobile-menu');
    burger.addEventListener('click', () => {
      const open = mobile.hidden;
      mobile.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.innerHTML = icon(open ? 'close' : 'menu');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.body.classList.toggle('menu-open', open);
    });
    $$('a', mobile).forEach(a => a.addEventListener('click', () => { if (!mobile.hidden) burger.click(); }));

    const avatarBtn = $('.avatar-btn', hdr);
    if (avatarBtn) {
      const menu = $('#account-menu', hdr);
      const close = () => { menu.hidden = true; avatarBtn.setAttribute('aria-expanded', 'false'); };
      avatarBtn.addEventListener('click', e => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        avatarBtn.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) { const first = $('a,button', menu); if (first) first.focus(); }
      });
      document.addEventListener('click', e => { if (!menu.contains(e.target)) close(); });
      menu.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); avatarBtn.focus(); } });
    }
    ensureFooter();
    ensureContactButton();
  }

  /* ================= подвал ================= */
  function contactLinks(cls = '') {
    const c = (cfg.author && cfg.author.contacts) || {};
    const items = [];
    if (c.email) items.push(['mailto:' + c.email, 'mail', 'Email', c.email]);
    if (c.telegram) items.push([c.telegram, 'send', 'Telegram', 'Telegram']);
    if (c.github) items.push([c.github, 'github', 'GitHub', 'GitHub']);
    if (c.vk) items.push([c.vk, 'vk', 'ВКонтакте', 'ВКонтакте']);
    if (c.website) items.push([c.website, 'globe', 'Сайт', 'Сайт']);
    return items.map(([href, ic, label, text]) => {
      const external = /^https?:/.test(href);
      return '<a class="' + cls + '" href="' + escapeHtml(href) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + ' aria-label="' + escapeHtml(label) + '">' + icon(ic) + '<span>' + escapeHtml(text) + '</span></a>';
    }).join('');
  }
  function ensureFooter() {
    if (document.querySelector('.site-footer')) return;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const contacts = contactLinks('footer-contact');
    footer.innerHTML =
      '<div class="footer-inner">' +
      '<div class="footer-brand">' + logo() + '<p>' + escapeHtml((cfg.brand && cfg.brand.tagline) || '') + '</p>' +
      (contacts ? '<div class="footer-contacts">' + contacts + '</div>' : '') + '</div>' +
      '<nav class="footer-col" aria-label="Обучение"><h2>Обучение</h2><a href="catalog.html">Каталог курсов</a><a href="index.html#start">С чего начать</a><a href="index.html#tracks">Направления</a><a href="index.html#projects">Учебные проекты</a></nav>' +
      '<nav class="footer-col" aria-label="Платформа"><h2>Платформа</h2><a href="about.html">Об авторе</a><a href="help.html">Помощь и FAQ</a><a href="help.html#contact">Обратная связь</a><a href="privacy.html">Конфиденциальность</a></nav>' +
      '<nav class="footer-col" aria-label="Аккаунт"><h2>Аккаунт</h2><a href="login.html">Вход и регистрация</a><a href="profile.html">Личный кабинет</a></nav>' +
      '</div>' +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + escapeHtml(BRAND) + '</span><span>Статус каждого курса указан на его странице: полный курс, демо-версия или программа в разработке.</span></div>';
    document.body.appendChild(footer);
  }

  // «Написать автору» — небольшая плавающая кнопка
  function ensureContactButton() {
    const page = document.body.dataset.page;
    if (['help', 'admin', 'lesson', 'login', 'certificate'].includes(page) || $('.contact-fab')) return;
    const a = document.createElement('a');
    a.className = 'contact-fab';
    a.href = 'help.html#contact';
    a.innerHTML = icon('chat') + '<span>Написать</span>';
    a.setAttribute('aria-label', 'Написать автору проекта');
    document.body.appendChild(a);
  }

  /* ================= уведомления ================= */
  function toast(message, type = 'info', timeout = 4200) {
    let region = $('#toasts');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info') + '<span>' + escapeHtml(message) + '</span>';
    region.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, timeout);
  }

  /* ================= состояния ================= */
  function stateBox(type, title, text, actionHtml = '') {
    const ic = { error: 'alert', empty: 'search', lock: 'lock', success: 'check', info: 'info' }[type] || 'info';
    return '<div class="state state-' + type + '"><div class="state-icon">' + icon(ic) + '</div><h2>' + escapeHtml(title) + '</h2>' + (text ? '<p>' + escapeHtml(text) + '</p>' : '') + (actionHtml ? '<div class="state-actions">' + actionHtml + '</div>' : '') + '</div>';
  }
  function errorText(err) {
    return (err && err.message) || 'Что-то пошло не так. Попробуйте ещё раз.';
  }
  // Кнопка в состоянии загрузки: защита от повторной отправки
  async function withBusy(button, fn) {
    if (!button || button.dataset.busy === '1') return;
    button.dataset.busy = '1';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-busy');
    try { return await fn(); } finally {
      button.dataset.busy = '';
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.classList.remove('is-busy');
    }
  }

  /* ================= поиск (Ctrl+K или /) ================= */
  let searchEl = null;
  async function openSearch() {
    if (!searchEl) {
      searchEl = document.createElement('dialog');
      searchEl.className = 'search-dialog';
      searchEl.setAttribute('aria-label', 'Поиск по курсам');
      searchEl.innerHTML =
        '<form method="dialog" class="search-form" role="search">' + icon('search') +
        '<input type="search" id="palette-input" placeholder="Курс, тема или технология" autocomplete="off" aria-label="Что ищем" aria-controls="palette-results">' +
        '<button class="icon-btn" value="close" aria-label="Закрыть поиск">' + icon('close') + '</button></form>' +
        '<div id="palette-results" class="palette-results" role="listbox" aria-label="Результаты"></div>' +
        '<div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span></div>';
      document.body.appendChild(searchEl);
      const input = $('#palette-input', searchEl);
      input.addEventListener('input', debounce(() => renderPalette(input.value), 80));
      input.addEventListener('keydown', paletteKeys);
      searchEl.addEventListener('click', e => { if (e.target === searchEl) searchEl.close(); });
    }
    if (!searchEl.open) searchEl.showModal();
    const input = $('#palette-input', searchEl);
    input.value = '';
    input.focus();
    renderPalette('');
  }
  let paletteIndex = 0;
  let paletteSeq = 0;
  async function renderPalette(q) {
    const seq = ++paletteSeq;
    const box = $('#palette-results', searchEl);
    if (!window.Courses) {
      box.innerHTML = '<p class="palette-empty">Загружаем каталог…</p>';
      try { await loadScript('js/courses.js'); } catch (e) { box.innerHTML = '<p class="palette-empty">' + escapeHtml(errorText(e)) + '</p>'; return; }
    }
    let items;
    try { items = await Courses.search(q, 8); } catch (e) { box.innerHTML = '<p class="palette-empty">' + escapeHtml(errorText(e)) + '</p>'; return; }
    if (seq !== paletteSeq) return; // пока искали, запрос уже изменился
    paletteIndex = 0;
    if (!items.length) {
      box.innerHTML = '<p class="palette-empty">Ничего не нашлось. Попробуйте «html», «react» или «sql».</p>';
      return;
    }
    box.innerHTML = (q ? '' : '<p class="palette-label">Рекомендуем начать</p>') + items.map((c, i) =>
      '<a role="option" id="opt-' + i + '" aria-selected="' + (i === 0) + '" class="palette-item" href="' + Courses.url(c) + '">' +
      Courses.coverMini(c) + '<span><strong>' + escapeHtml(c.title) + '</strong><small>' + escapeHtml(c.level + ' · ' + c.track) + '</small></span>' + icon('arrow') + '</a>').join('') +
      (q ? '<a class="palette-all" href="catalog.html?q=' + encodeURIComponent(q) + '">Все результаты в каталоге' + icon('arrow') + '</a>' : '');
  }
  function paletteKeys(e) {
    const opts = $$('.palette-item', searchEl);
    if (!opts.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      paletteIndex = (paletteIndex + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === paletteIndex)));
      opts[paletteIndex].scrollIntoView({ block: 'nearest' });
      e.target.setAttribute('aria-activedescendant', opts[paletteIndex].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      location.href = opts[paletteIndex].href;
    }
  }
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ================= появление блоков при прокрутке ================= */
  function reveal(root = document) {
    const els = $$('[data-reveal]:not(.is-in)', root);
    if (!('IntersectionObserver' in window) || reducedMotion()) { els.forEach(el => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ================= избранное и заметки (в этом браузере) ================= */
  function favKey() { const u = window.DB && DB.currentUser(); return 'stroka:fav:' + (u ? u.id : 'guest'); }
  const favorites = {
    list: () => store.get(favKey(), []),
    has: id => favorites.list().includes(String(id)),
    toggle(id) {
      const list = favorites.list();
      const i = list.indexOf(String(id));
      if (i === -1) list.unshift(String(id)); else list.splice(i, 1);
      store.set(favKey(), list.slice(0, 200));
      return i === -1;
    }
  };
  function bindFavoriteButtons(root = document) {
    $$('[data-fav]', root).forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      const sync = () => {
        const on = favorites.has(btn.dataset.fav);
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        const label = on ? 'Убрать из избранного' : 'В избранное';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        const text = btn.querySelector('[data-fav-text]');
        if (text) text.textContent = on ? 'В избранном' : 'В избранное';
      };
      sync();
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const on = favorites.toggle(btn.dataset.fav);
        $$('[data-fav="' + btn.dataset.fav + '"]').forEach(b => b.dispatchEvent(new Event('fav-sync')));
        sync();
        toast(on ? 'Курс добавлен в избранное' : 'Курс убран из избранного', 'success', 2200);
      });
      btn.addEventListener('fav-sync', sync);
    });
  }

  window.addEventListener('stroka:session-expired', () => {
    toast('Сессия истекла. Войдите снова, чтобы сохранять прогресс.', 'error', 6000);
    showHeader();
  });

  // Совместимость с прежними скриптами страниц
  function getCurrentUser() { return window.DB ? DB.currentUser() : null; }
  function checkLogin() {
    const user = getCurrentUser();
    if (!user) location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return user;
  }

  window.UI = {
    BRAND, cfg, escapeHtml, $, $$, getParam, plural, formatDate, debounce, initials, loadScript, reducedMotion,
    icon, setMeta, setJsonLd, absoluteUrl, showHeader, toast, stateBox, errorText, withBusy, openSearch, reveal,
    favorites, bindFavoriteButtons, contactLinks, store, checkLogin, getCurrentUser
  };
  // прежние глобальные имена
  window.escapeHtml = escapeHtml;
  window.getParam = getParam;
  window.plural = plural;
})();
