// catalog.js — каталог: поиск, фильтры, сортировка, избранное.
// Состояние хранится в адресе страницы, поэтому подборкой можно поделиться.
(function () {
  'use strict';
  const { $, escapeHtml, icon } = UI;
  const FIELDS = ['q', 'level', 'track', 'format', 'status', 'sort', 'fav'];
  const LABELS = { level: 'Уровень', track: 'Направление', format: 'Формат', status: 'Статус' };

  let courses = [];
  let my = null;
  const state = { q: '', level: '', track: '', format: '', status: '', sort: 'recommended', fav: '' };

  function readUrl() {
    const p = new URLSearchParams(location.search);
    FIELDS.forEach(f => { state[f] = p.get(f) || (f === 'sort' ? 'recommended' : ''); });
  }
  function writeUrl() {
    const p = new URLSearchParams();
    FIELDS.forEach(f => { if (state[f] && !(f === 'sort' && state[f] === 'recommended')) p.set(f, state[f]); });
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function fillSelect(id, values, labelFn = v => v) {
    const el = $('#' + id);
    const first = el.options[0].outerHTML;
    el.innerHTML = first + values.map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(labelFn(v)) + '</option>').join('');
  }
  function fillFilters() {
    const uniq = key => [...new Set(courses.map(c => c[key]).filter(Boolean))];
    fillSelect('f-level', Courses.LEVELS.filter(l => courses.some(c => c.level === l)).concat(uniq('level').filter(l => !Courses.LEVELS.includes(l))));
    fillSelect('f-track', uniq('track').sort((a, b) => a.localeCompare(b, 'ru')));
    fillSelect('f-format', uniq('format'));
    fillSelect('f-status', ['full', 'demo', 'outline'].filter(s => courses.some(c => c.status === s)), s => Courses.STATUS[s].label);
    syncControls();
  }
  function syncControls() {
    $('#f-q').value = state.q;
    ['level', 'track', 'format', 'status', 'sort'].forEach(f => {
      const el = $('#f-' + f);
      // значения из адреса, которых нет в списке, сбрасываем
      if (state[f] && ![...el.options].some(o => o.value === state[f])) state[f] = f === 'sort' ? 'recommended' : '';
      el.value = state[f];
    });
    $('#f-fav').setAttribute('aria-pressed', String(!!state.fav));
  }

  function render() {
    const ids = state.fav ? UI.favorites.list() : null;
    const found = Courses.sort(Courses.filter(courses, Object.assign({}, state, { ids })), state.sort);
    const list = $('#list');
    $('#result-count').textContent = found.length + ' ' + UI.plural(found.length, 'курс', 'курса', 'курсов');

    const active = ['level', 'track', 'format', 'status'].filter(f => state[f]);
    let chips = active.map(f => '<button type="button" data-clear="' + f + '">' + escapeHtml(LABELS[f] + ': ' + (f === 'status' ? Courses.STATUS[state[f]].label : state[f])) + icon('close') + '</button>').join('');
    if (state.q) chips = '<button type="button" data-clear="q">«' + escapeHtml(state.q) + '»' + icon('close') + '</button>' + chips;

    if (!found.length) {
      const fav = state.fav && !UI.favorites.list().length;
      list.innerHTML = '<div style="grid-column:1/-1">' + (fav
        ? UI.stateBox('empty', 'В избранном пока пусто', 'Нажмите на сердечко в карточке курса, чтобы отложить его на потом.', '<button class="btn btn-ghost" type="button" data-reset>Показать все курсы</button>')
        : UI.stateBox('empty', 'Ничего не нашлось', 'Попробуйте другое слово — например, «html», «react» или «sql» — или сбросьте фильтры.', '<button class="btn" type="button" data-reset>Сбросить фильтры</button>')) + '</div>';
    } else {
      list.innerHTML = (chips ? '<div class="active-filters" style="grid-column:1/-1">' + chips + '</div>' : '') +
        found.map(c => Courses.card(c, my ? Courses.progressFor(c, my) : null)).join('');
    }
    UI.bindFavoriteButtons(list);
    writeUrl();
  }

  function bind() {
    $('#f-q').addEventListener('input', UI.debounce(e => { state.q = e.target.value.trim(); render(); }, 180));
    ['level', 'track', 'format', 'status', 'sort'].forEach(f => $('#f-' + f).addEventListener('change', e => { state[f] = e.target.value; render(); }));
    $('#f-fav').addEventListener('click', () => { state.fav = state.fav ? '' : '1'; syncControls(); render(); });
    $('#filters-toggle').addEventListener('click', e => {
      const tools = $('#catalog-tools');
      const open = tools.classList.toggle('show-filters');
      e.currentTarget.setAttribute('aria-expanded', String(open));
    });
    $('#list').addEventListener('click', e => {
      const clear = e.target.closest('[data-clear]');
      if (clear) { state[clear.dataset.clear] = ''; syncControls(); render(); return; }
      if (e.target.closest('[data-reset]')) {
        FIELDS.forEach(f => { state[f] = f === 'sort' ? 'recommended' : ''; });
        syncControls();
        render();
      }
    });
  }

  async function init() {
    UI.showHeader('catalog');
    readUrl();
    bind();
    // 1. Встроенный каталог — сразу
    courses = await Courses.builtin();
    fillFilters();
    render();
    // 2. Курсы автора из Google Таблицы — когда ответит сервер
    const res = await Courses.all();
    if (res.sheetError) {
      $('#notice').innerHTML = '<div class="msg msg-warn">' + icon('alert') + '<p>Курсы из базы автора временно недоступны: ' + escapeHtml(UI.errorText(res.sheetError)) + ' Встроенный каталог работает как обычно. <button class="btn-text" type="button" id="retry">Повторить</button></p></div>';
      $('#retry').addEventListener('click', () => { DB.clearCache('public:'); location.reload(); });
    }
    if (res.courses.length !== courses.length) {
      courses = res.courses;
      fillFilters();
      render();
    }
    // 3. Прогресс вошедшего пользователя
    if (DB.currentUser()) {
      try { my = await DB.my(); render(); } catch (e) { /* каталог работает и без прогресса */ }
    }
  }

  init();
})();
