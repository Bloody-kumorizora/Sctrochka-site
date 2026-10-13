// certificate.js — подтверждение прохождения курса из таблицы.
// Формируется только для завершённых записей (completed_at заполнен сервером).
(function () {
  'use strict';
  const { $, escapeHtml } = UI;
  const app = $('#app');

  async function init() {
    UI.showHeader('certificate');
    const user = UI.checkLogin();
    if (!user) return;
    const courseId = UI.getParam('course');
    let course, my;
    try {
      [course, my] = await Promise.all([Courses.get(courseId), DB.my()]);
    } catch (e) {
      app.innerHTML = UI.stateBox('error', 'Не удалось загрузить данные', UI.errorText(e), '<button class="btn" type="button" onclick="location.reload()">Повторить</button>');
      return;
    }
    const enrollment = course && my.enrollments.find(e => String(e.course_id) === String(course.id));
    if (!course || course.source !== 'sheet' || !enrollment || !enrollment.completed_at) {
      app.innerHTML = UI.stateBox('lock', 'Подтверждение пока недоступно', 'Оно формируется для полных курсов после прохождения всех уроков.', '<a class="btn" href="profile.html">В личный кабинет</a>');
      return;
    }
    UI.setMeta({ title: 'Подтверждение: ' + course.title, noindex: true });
    app.innerHTML =
      '<div class="cert"><span class="eyebrow" style="color:#5b5b67"><b style="background:#15151c;color:#fff">✓</b> ' + escapeHtml(UI.BRAND) + ' · подтверждение прохождения</span>' +
      '<h1>Курс пройден</h1><p style="color:#5b5b67">Настоящим подтверждается, что</p>' +
      '<div class="name">' + escapeHtml(user.name) + '</div>' +
      '<p style="color:#5b5b67">прошёл(ла) все уроки курса</p><p class="cert-course">«' + escapeHtml(course.title) + '»</p>' +
      (course.instructor ? '<p>Автор курса: ' + escapeHtml(course.instructor) + '</p>' : '') +
      '<p style="color:#5b5b67;margin-top:24px">Дата: ' + escapeHtml(UI.formatDate(enrollment.completed_at)) + '<br>Номер: ' + escapeHtml(enrollment.certificate_id || '—') + '</p>' +
      '<p class="cert-note">Документ сформирован платформой автоматически по данным о прохождении уроков. Он не является документом об образовании или квалификации.</p></div>' +
      '<p class="noprint" style="text-align:center"><button class="btn" type="button" onclick="window.print()">Печать / сохранить в PDF</button> <a class="btn btn-ghost" href="profile.html#certs">В кабинет</a></p>';
  }

  init();
})();
