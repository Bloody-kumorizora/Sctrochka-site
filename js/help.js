// help.js — страница помощи: статичный FAQ в разметке + форма обратной связи.
(function () {
  'use strict';
  UI.showHeader('help');
  Feedback.mount(UI.$('#help-form'), { id: 'help-feedback' });
  UI.$('#help-contacts').innerHTML = UI.contactLinks('contact-link');
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView();
  }
})();
