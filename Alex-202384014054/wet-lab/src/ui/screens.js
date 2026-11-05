// Alex 202384014054
// Full-screen pages. Sandbox build: only the title screen.

import { titleBackdrop } from './titlebg.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function show(root, cls, html) {
  root.hidden = false;
  root.className = `scr ${cls}`;
  root.innerHTML = html;
  root._key = null;
  return root;
}

// ---------------------------------------------------------------- title

let grainURL = null;
export function titleScreen(root, app) {
  // plain words, as on an old engine's menu
  const items = [['sandbox', '进入实验室']];
  show(root, 'title', `
    <canvas class="tt-bgc" aria-hidden="true"></canvas><div class="tt-grain" aria-hidden="true"></div>
    <div class="tt-left">
      <h1 class="tt-mark">湿实验室<small>WET LAB</small></h1>
      <nav class="tt-menu">${items.map(([k, t], i) => `<button class="tt-item${i === 0 ? ' on' : ''}" data-${k}>${esc(t)}</button>`).join('')}</nav>
    </div>
    <p class="tt-foot">v0.1 沙盒 · 建议全屏（F）· 数据出处见暂停菜单「资料来源」</p>`);
  titleBackdrop(root.querySelector('.tt-bgc'));
  // film grain: a small noise tile drawn once
  try {
    grainURL ||= (() => { const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160); for (let k = 0; k < d.data.length; k += 4) { const v = Math.random() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; } g.putImageData(d, 0, 0); return c.toDataURL(); })();
    root.querySelector('.tt-grain').style.backgroundImage = `url(${grainURL})`;
  } catch (e) { /* no canvas: no grain */ }
  root.querySelector('[data-sandbox]').addEventListener('click', () => app.startSandbox());
  root._key = (e) => {
    if (e.key === 'Enter' || e.code === 'KeyS') { app.startSandbox(); return true; }
    return false;
  };
}
