// Alex 202384014054
/*
 * Capsid Lockdown — the English / Chinese switch.
 * English is the default. ?lang=zh or ?lang=en in the address picks a
 * language and remembers it in localStorage ('capsid-lang'); the 中文 / EN
 * button in the top bar flips it and reloads the page.
 * In code, both texts sit side by side: L('Hint', '提示').
 * In index.html the page text is English, and the Chinese is kept in a
 * data-zh attribute (data-zh-label for aria-label).
 * No DOM needed to load it: runs in the browser (window.I18N) and in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.I18N = api.boot(root);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'capsid-lang';

  // which language to use: the address wins, then the saved choice, then English
  function pick(search, saved) {
    const m = /[?&]lang=(zh|en)(?:&|$)/.exec(search || '');
    if (m) return { lang: m[1], fromUrl: true };
    return { lang: saved === 'zh' ? 'zh' : 'en', fromUrl: false };
  }

  function make(lang) {
    const zh = lang === 'zh';
    return { lang: zh ? 'zh' : 'en', zh, L: (en, cn) => (zh ? cn : en) };
  }

  // swap the fixed page text to Chinese (the HTML itself is English)
  function apply(t, doc) {
    doc.documentElement.lang = t.zh ? 'zh-CN' : 'en';
    if (!t.zh) return;
    doc.querySelectorAll('[data-zh]').forEach((e) => { e.innerHTML = e.getAttribute('data-zh'); });
    doc.querySelectorAll('[data-zh-label]').forEach((e) => { e.setAttribute('aria-label', e.getAttribute('data-zh-label')); });
  }

  function boot(win) {
    let saved = null;
    try { saved = win.localStorage.getItem(KEY); } catch (e) { /* storage blocked: English */ }
    const p = pick(win.location && win.location.search, saved);
    if (p.fromUrl) try { win.localStorage.setItem(KEY, p.lang); } catch (e) { /* not saved */ }
    const t = make(p.lang);
    t.toggle = () => {
      const next = t.zh ? 'en' : 'zh';
      try { win.localStorage.setItem(KEY, next); } catch (e) { /* the address still carries it */ }
      const q = new URLSearchParams(win.location.search);
      q.set('lang', next);
      win.location.search = q.toString();               // reloads the page
    };
    if (win.document) apply(t, win.document);
    return t;
  }

  return { KEY, pick, make, apply, boot };
});
