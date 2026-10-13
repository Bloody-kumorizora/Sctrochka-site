// login.js — вход и регистрация с проверкой полей и защитой от повторной отправки.
(function () {
  'use strict';
  const { $, escapeHtml, icon } = UI;
  let mode = location.hash === '#register' ? 'register' : 'login';

  // Возврат на страницу, с которой пришли (только внутренние страницы сайта)
  function nextUrl() {
    const n = UI.getParam('next') || '';
    return /^[\w-]+\.html(\?[\w=&.%-]*)?$/.test(n) ? n : 'profile.html';
  }

  function render(error = '', values = {}) {
    const reg = mode === 'register';
    $('#auth-card').innerHTML =
      '<div class="seg" role="tablist" aria-label="Вход или регистрация">' +
      '<button type="button" role="tab" aria-selected="' + !reg + '" data-mode="login">Вход</button>' +
      '<button type="button" role="tab" aria-selected="' + reg + '" data-mode="register">Регистрация</button></div>' +
      '<h1>' + (reg ? 'Создать аккаунт' : 'С возвращением') + '</h1>' +
      '<p class="muted">' + (reg ? 'Аккаунт нужен, чтобы сохранять пройденные уроки и результаты тестов.' : 'Войдите, чтобы продолжить обучение.') + '</p>' +
      (error ? '<div class="msg msg-err" role="alert">' + icon('alert') + '<p>' + escapeHtml(error) + '</p></div>' : '') +
      '<form id="auth-form" novalidate>' +
      (reg ? '<div class="field"><label for="name">Имя</label><input id="name" name="name" autocomplete="name" required minlength="2" maxlength="80" value="' + escapeHtml(values.name || '') + '"></div>' : '') +
      '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="120" inputmode="email" value="' + escapeHtml(values.email || '') + '"></div>' +
      '<div class="field"><label for="password">Пароль</label><div class="input-wrap"><input id="password" name="password" type="password" required ' + (reg ? 'minlength="8" autocomplete="new-password" aria-describedby="pass-hint"' : 'autocomplete="current-password"') + '>' +
      '<button type="button" class="icon-btn" id="toggle-pass" aria-label="Показать пароль" aria-pressed="false">' + icon('settings') + '</button></div>' +
      (reg ? '<span class="hint" id="pass-hint">Минимум 8 символов. Длинная фраза надёжнее короткого пароля со спецсимволами.</span>' : '') + '</div>' +
      (reg ? '<label class="check" style="margin:6px 0 20px"><input type="checkbox" id="agree" required><span>Я согласен(на) с <a href="privacy.html" target="_blank">условиями обработки данных</a></span></label>' : '') +
      '<button class="btn btn-lg btn-block" type="submit" id="submit">' + (reg ? 'Создать аккаунт' : 'Войти') + ' ' + icon('arrow') + '</button>' +
      '</form>' +
      '<p class="muted" style="font-size:14px;margin-top:20px">' + (reg ? 'Уже есть аккаунт? <a href="#login" data-mode="login">Войти</a>' : 'Нет аккаунта? <a href="#register" data-mode="register">Зарегистрироваться</a>') + '</p>' +
      (!reg ? '<p class="muted" style="font-size:13px">Забыли пароль? Автоматическое восстановление пока не реализовано — <a href="help.html#contact">напишите автору</a>, и доступ восстановят вручную.</p>' : '');
    bind();
    const first = $('#auth-form input[aria-invalid="true"]') || $('#auth-form input');
    if (first && document.activeElement !== document.body) first.focus();
  }

  function setInvalid(id, message) {
    const input = $('#' + id);
    input.setAttribute('aria-invalid', 'true');
    let err = $('#' + id + '-err');
    if (!err) {
      err = document.createElement('span');
      err.className = 'error';
      err.id = id + '-err';
      input.closest('.field').appendChild(err);
      input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
    }
    err.textContent = message;
  }

  async function submit(e) {
    e.preventDefault();
    const reg = mode === 'register';
    const form = e.currentTarget;
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    form.querySelectorAll('.error').forEach(x => { x.textContent = ''; });
    const values = {
      name: reg ? $('#name').value.trim() : '',
      email: $('#email').value.trim(),
      password: $('#password').value
    };
    let bad = false;
    if (reg && values.name.length < 2) { setInvalid('name', 'Укажите имя — минимум 2 символа.'); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) { setInvalid('email', 'Проверьте email: например, name@example.com.'); bad = true; }
    if (!values.password) { setInvalid('password', 'Введите пароль.'); bad = true; }
    else if (reg && values.password.length < 8) { setInvalid('password', 'Пароль должен быть не короче 8 символов.'); bad = true; }
    if (reg && !$('#agree').checked) { UI.toast('Подтвердите согласие с условиями обработки данных', 'error'); bad = true; }
    if (bad) { const f = form.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }

    await UI.withBusy($('#submit'), async () => {
      try {
        if (reg) await DB.register(values.name, values.email, values.password);
        else await DB.login(values.email, values.password);
        location.href = nextUrl();
      } catch (err) {
        if (err.code === 'email_taken') { mode = 'login'; render(err.message, values); return; }
        render(UI.errorText(err), values);
      }
    });
  }

  function bind() {
    document.querySelectorAll('#auth-card [data-mode]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const values = { name: ($('#name') || {}).value, email: $('#email').value };
      mode = b.dataset.mode;
      history.replaceState(null, '', location.pathname + location.search + (mode === 'register' ? '#register' : ''));
      render('', values);
    }));
    $('#auth-form').addEventListener('submit', submit);
    const toggle = $('#toggle-pass');
    toggle.innerHTML = '<span aria-hidden="true" style="font:600 12px var(--f-body)">Abc</span>';
    toggle.addEventListener('click', () => {
      const p = $('#password');
      const show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    });
  }

  UI.showHeader('login');
  if (DB.currentUser() && !UI.getParam('next')) {
    $('#auth-card').innerHTML = UI.stateBox('success', 'Вы уже вошли', 'Продолжайте обучение в личном кабинете.', '<a class="btn" href="profile.html">В кабинет</a><button class="btn btn-ghost" type="button" id="logout">Выйти</button>');
    $('#logout').addEventListener('click', async () => { await DB.logout(); location.reload(); });
  } else {
    render();
  }
})();
