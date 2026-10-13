// feedback.js — форма обратной связи (страницы «Помощь» и «Об авторе»).
// Сообщение уходит в лист feedback Google Таблицы (скрипт v2).
// Защита: honeypot-поле, блокировка кнопки, request_id против повторной отправки,
// черновик сохраняется в браузере, чтобы текст не пропал при ошибке сети.
(function () {
  'use strict';
  const { escapeHtml, icon } = UI;
  const DRAFT_KEY = 'stroka:feedback-draft';

  function html(id, topics) {
    const user = window.DB && DB.currentUser();
    return '<form class="form-card" id="' + id + '" novalidate>' +
      '<div class="field"><label for="' + id + '-name">Как к вам обращаться *</label><input id="' + id + '-name" name="name" autocomplete="name" maxlength="80" required value="' + escapeHtml(user ? user.name : '') + '"></div>' +
      '<div class="field"><label for="' + id + '-email">Email для ответа *</label><input id="' + id + '-email" name="email" type="email" autocomplete="email" maxlength="120" required value="' + escapeHtml(user ? user.email : '') + '"></div>' +
      '<div class="field"><label for="' + id + '-topic">Тема</label><select id="' + id + '-topic" name="topic">' + topics.map(t => '<option>' + escapeHtml(t) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="' + id + '-message">Сообщение *</label><textarea id="' + id + '-message" name="message" rows="6" minlength="10" maxlength="4000" required></textarea><span class="hint" id="' + id + '-count">0 / 4000</span></div>' +
      '<div class="hp" aria-hidden="true"><label for="' + id + '-website">Не заполняйте это поле</label><input id="' + id + '-website" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<p class="hint" style="font-size:13px;color:var(--muted)">Отправляя форму, вы соглашаетесь с <a href="privacy.html">обработкой данных</a>: имя и email нужны только для ответа.</p>' +
      '<button class="btn btn-lg" type="submit">Отправить ' + icon('send') + '</button>' +
      '<div id="' + id + '-status" aria-live="polite"></div></form>';
  }

  function mount(container, { id = 'feedback-form', topics = ['Вопрос по курсу', 'Предложение', 'Ошибка на сайте', 'Сотрудничество', 'Другое'] } = {}) {
    container.innerHTML = html(id, topics);
    const form = container.querySelector('form');
    const $f = n => form.querySelector('[name="' + n + '"]');
    const status = form.querySelector('#' + id + '-status');
    const counter = form.querySelector('#' + id + '-count');
    let requestId = DB.requestId();

    const draft = UI.store.get(DRAFT_KEY, null);
    if (draft && draft.message) { $f('message').value = draft.message; if (draft.topic) $f('topic').value = draft.topic; }
    const updateCount = () => { counter.textContent = $f('message').value.length + ' / 4000'; };
    updateCount();
    form.addEventListener('input', UI.debounce(() => {
      updateCount();
      UI.store.set(DRAFT_KEY, { message: $f('message').value, topic: $f('topic').value });
    }, 300));

    form.addEventListener('submit', e => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      const data = {
        name: $f('name').value.trim(), email: $f('email').value.trim(), topic: $f('topic').value,
        message: $f('message').value.trim(), website: $f('website').value,
        page: location.pathname.split('/').pop() || 'index.html', request_id: requestId
      };
      const errors = [];
      if (data.name.length < 2) { errors.push('укажите имя'); $f('name').setAttribute('aria-invalid', 'true'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { errors.push('проверьте email'); $f('email').setAttribute('aria-invalid', 'true'); }
      if (data.message.length < 10) { errors.push('сообщение должно быть не короче 10 символов'); $f('message').setAttribute('aria-invalid', 'true'); }
      if (errors.length) {
        status.innerHTML = '<div class="msg msg-err">' + icon('alert') + '<p>Пожалуйста, ' + escapeHtml(errors.join(', ')) + '.</p></div>';
        const bad = form.querySelector('[aria-invalid="true"]'); if (bad) bad.focus();
        return;
      }
      UI.withBusy(form.querySelector('button[type="submit"]'), async () => {
        try {
          await DB.sendFeedback(data);
          try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
          requestId = DB.requestId();
          form.reset();
          updateCount();
          status.innerHTML = '<div class="msg msg-ok">' + icon('check') + '<p>Сообщение отправлено. Ответ придёт на указанный email.</p></div>';
        } catch (err) {
          const email = UI.cfg.author && UI.cfg.author.contacts && UI.cfg.author.contacts.email;
          status.innerHTML = '<div class="msg msg-err">' + icon('alert') + '<p>Не удалось отправить: ' + escapeHtml(UI.errorText(err)) + ' Текст сообщения сохранён в черновике — попробуйте ещё раз' +
            (email ? ' или напишите на <a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a>' : '') + '.</p></div>';
        }
      });
    });
  }

  window.Feedback = { mount };
})();
