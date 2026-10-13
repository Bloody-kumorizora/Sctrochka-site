// content.js — безопасный рендер учебных материалов: упрощённый Markdown,
// подсветка синтаксиса (HTML, CSS, JS/TS, SQL, bash, JSON) и копирование кода.
// Сначала весь текст экранируется, затем добавляется только известная разметка,
// поэтому HTML из таблицы не может выполниться на странице.
(function () {
  'use strict';
  const esc = window.UI.escapeHtml;

  /* ---------------- подсветка ---------------- */
  const JS_KW = 'await|async|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|interface|let|new|of|return|static|switch|throw|try|type|typeof|var|void|while|yield|true|false|null|undefined|this|enum|implements|readonly|as|keyof|public|private';
  const SQL_KW = 'select|from|where|and|or|not|insert|into|values|update|set|delete|create|table|primary|key|foreign|references|join|left|right|inner|on|group|by|order|asc|desc|limit|offset|having|count|sum|avg|min|max|distinct|as|null|is|like|in|between|unique|default|integer|text|varchar|serial|boolean|timestamp|alter|add|drop|index|returning|case|when|then|else|end|with';
  const RULES = {
    js: [
      ['c', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
      ['s', /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
      ['k', new RegExp('\\b(?:' + JS_KW + ')\\b', 'y')],
      ['n', /\b\d[\d_]*(?:\.\d+)?\b/y],
      ['f', /\b[A-Za-z_$][\w$]*(?=\s*\()/y],
      ['p', /\b[A-Z][\w$]*\b/y]
    ],
    html: [
      ['c', /<!--[\s\S]*?-->/y],
      ['k', /<\/?[a-zA-Z][\w-]*|\/?>|<!DOCTYPE[^>]*>/y],
      ['a', /\b[a-zA-Z-:@]+(?==)/y],
      ['s', /"[^"]*"|'[^']*'/y]
    ],
    css: [
      ['c', /\/\*[\s\S]*?\*\//y],
      ['k', /@[\w-]+/y],
      ['a', /[\w-]+(?=\s*:[^:{};]*[;}\n])/y],
      ['s', /"[^"]*"|'[^']*'/y],
      ['n', /#[0-9a-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|fr|s|ms|deg|ch)?\b/y],
      ['f', /\b[\w-]+(?=\()/y],
      ['p', /[.#:][\w-]+/y]
    ],
    sql: [
      ['c', /--[^\n]*/y],
      ['s', /'(?:''|[^'])*'/y],
      ['k', new RegExp('\\b(?:' + SQL_KW + ')\\b', 'iy')],
      ['n', /\b\d+(?:\.\d+)?\b/y]
    ],
    bash: [
      ['c', /#[^\n]*/y],
      ['s', /"(?:\\.|[^"\\])*"|'[^']*'/y],
      ['k', /(?:^|(?<=\n)|(?<=&&\s?)|(?<=\|\s?))\s*(?:npm|npx|git|cd|ls|mkdir|node|curl|echo|cat|pnpm|yarn|ssh|touch)\b/y],
      ['a', /\s--?[\w-]+/y]
    ],
    json: [
      ['a', /"(?:\\.|[^"\\])*"(?=\s*:)/y],
      ['s', /"(?:\\.|[^"\\])*"/y],
      ['n', /-?\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b/y]
    ]
  };
  const ALIASES = { javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', mjs: 'js', xml: 'html', svg: 'html', vue: 'html', shell: 'bash', sh: 'bash', console: 'bash', scss: 'css' };

  function highlight(code, lang) {
    const rules = RULES[ALIASES[lang] || lang];
    if (!rules) return esc(code);
    let out = '', plain = '', i = 0;
    while (i < code.length) {
      let matched = null;
      for (const [cls, re] of rules) {
        re.lastIndex = i;
        const m = re.exec(code);
        if (m && m[0].length) { matched = [cls, m[0]]; break; }
      }
      if (matched) {
        if (plain) { out += esc(plain); plain = ''; }
        out += '<span class="t-' + matched[0] + '">' + esc(matched[1]) + '</span>';
        i += matched[1].length;
      } else {
        plain += code[i++];
      }
    }
    return out + esc(plain);
  }

  /* ---------------- Markdown ---------------- */
  function inline(text) {
    let s = esc(text);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      const raw = href.replace(/&amp;/g, '&');
      if (/^https:\/\//.test(raw)) return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      if (/^[\w-]+\.html(\?[\w=&.%-]*)?(#[\w-]*)?$/.test(raw)) return '<a href="' + href + '">' + label + '</a>';
      return label;
    });
    // eslint-disable-next-line no-control-regex -- \u0000 — служебный маркер вставки кода
    return s.replace(/\u0000(\d+)\u0000/g, (_, n) => '<code>' + codes[n] + '</code>');
  }

  function codeBlock(code, lang) {
    const label = { js: 'JavaScript', ts: 'TypeScript', html: 'HTML', css: 'CSS', sql: 'SQL', bash: 'Терминал', json: 'JSON', jsx: 'JSX', tsx: 'TSX', text: 'Текст' }[lang] || (lang ? lang.toUpperCase() : 'Код');
    return '<figure class="code"><figcaption><span>' + esc(label) + '</span><button type="button" class="copy-btn" data-copy>' + window.UI.icon('copy') + '<span>Копировать</span></button></figcaption>' +
      '<pre tabindex="0"><code class="lang-' + esc(lang || 'text') + '">' + highlight(code, lang) + '</code></pre></figure>';
  }

  function render(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<' + list.type + '>' + list.items.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + list.type + '>'); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push('<aside class="callout">' + window.UI.icon('spark') + '<div>' + quote.map(inline).join('<br>') + '</div></aside>'); quote = []; } };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fence = line.match(/^```\s*([\w+-]*)\s*$/);
      if (fence) {
        flushAll();
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        out.push(codeBlock(buf.join('\n'), fence[1].toLowerCase()));
        continue;
      }
      let m;
      if ((m = line.match(/^(#{2,4})\s+(.+)$/))) {
        flushAll();
        const level = Math.min(4, m[1].length + 0);
        out.push('<h' + level + '>' + inline(m[2]) + '</h' + level + '>');
      } else if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
        flushPara(); flushQuote();
        if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
        flushPara(); flushQuote();
        if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); flushList();
        quote.push(m[1]);
      } else if (!line.trim()) {
        flushAll();
      } else {
        flushList(); flushQuote();
        para.push(line);
      }
    }
    flushAll();
    return out.join('\n');
  }

  /* ---------------- копирование ---------------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.closest('.code').querySelector('code').innerText;
    const ok = await copyText(code);
    const label = btn.querySelector('span');
    label.textContent = ok ? 'Скопировано' : 'Не удалось';
    btn.classList.toggle('is-done', ok);
    setTimeout(() => { label.textContent = 'Копировать'; btn.classList.remove('is-done'); }, 1800);
  });

  window.Content = { render, highlight, inline, copyText };
})();
