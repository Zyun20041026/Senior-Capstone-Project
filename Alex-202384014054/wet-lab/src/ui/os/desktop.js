// Alex 202384014054
// Workstation chrome for every computer- or instrument-type panel, so they
// read as real software: a PC application window (title bar with window
// buttons, menu bar, info strip, status bar, and the desktop taskbar with a
// clock that follows the game), or an instrument touchscreen in a bezel.
// All product names are fictional.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let clockFn = () => ({ hh: 9, mm: 0, day: 1 });
let userFn = () => 'lab01';
export const setOsClock = (f) => { clockFn = f; };
export const setOsUser = (f) => { userFn = f; };

const MENUS = {
  ct: ['患者', '检查', '扫描', '重建', '阅片', '工具', '帮助'],
  lab: ['文件', '编辑', '视图', '分析', '工具', '窗口', '帮助'],
  his: ['工作站', '患者', '医嘱', '检查', '检验', '报告', '帮助'],
  stock: ['文件', '采购', '库存', '报表', '帮助'],
};

// Pinned apps on the taskbar: name, letter (for canvas thumbnails), tint and
// a small vector glyph; the open one is lit.
const PINNED = [
  ['ScanSuite', 'CT', '#3a7bd5', 'ct'], ['GelView', 'G', '#2e9b6a', 'gel'], ['SeqViewer', 'S', '#8a5cd6', 'seq'],
  ['PlateMaster', 'P', '#d07a2c', 'plate'], ['GuideLab', 'C', '#c2457a', 'crispr'], ['HIS', '病', '#2a8fb0', 'his'], ['LabStock', '库', '#6b7a89', 'box'],
  ['LabAssist', 'AI', '#7c5cf0', 'ai'],
];
// 16×16 white glyphs drawn as SVG paths.
const GLYPH = {
  ct: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="#fff" stroke-width="2.2"/><rect x="1" y="11.6" width="14" height="2.2" rx="1" fill="#fff"/>',
  gel: '<rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M4.5 5h2M9.5 5h2M4.5 8h2M9.5 9h2M4.5 11h2M9.5 11.5h2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  seq: '<path d="M1 11c1.6 0 1.6-7 3.2-7s1.6 9 3.2 9 1.6-6 3.2-6 1.6 4 4.4 4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  plate: '<rect x="1.5" y="3" width="13" height="10" rx="1.6" fill="none" stroke="#fff" stroke-width="1.4"/><g fill="#fff"><circle cx="4.5" cy="6" r="1"/><circle cx="8" cy="6" r="1"/><circle cx="11.5" cy="6" r="1"/><circle cx="4.5" cy="10" r="1"/><circle cx="8" cy="10" r="1"/><circle cx="11.5" cy="10" r="1"/></g>',
  crispr: '<circle cx="4" cy="12" r="2.2" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M5.5 10.3L12 2M10.5 10.3L4 2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  his: '<rect x="2" y="2" width="12" height="12" rx="2.5" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M8 4.8v6.4M4.8 8h6.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  ai: '<path d="M8 1.5l1.6 3.9 3.9 1.6-3.9 1.6L8 12.5 6.4 8.6 2.5 7l3.9-1.6z" fill="#fff"/><circle cx="12.8" cy="12.6" r="1.6" fill="#fff"/>',
  box: '<path d="M2 5l6-3 6 3v6.5L8 14.5 2 11.5z M2 5l6 3 6-3M8 8v6.5" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>',
};
const icon = (k) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">${GLYPH[k] || ''}</svg>`;
// Menu entries as real software lists them; only "关闭窗口" acts here, the
// rest are shown disabled rather than pretending to work.
const MENU_ITEMS = {
  '文件': [['新建', 'Ctrl+N'], ['打开…', 'Ctrl+O'], ['导出 PDF…', 'Ctrl+P'], null, ['关闭窗口', 'Esc', 'close']],
  '编辑': [['撤销', 'Ctrl+Z'], ['重做', 'Ctrl+Y'], null, ['复制', 'Ctrl+C'], ['粘贴', 'Ctrl+V']],
  '视图': [['放大', 'Ctrl++'], ['缩小', 'Ctrl+-'], ['全屏', 'F11']],
  '帮助': [['用户手册', 'F1'], ['检查更新…', ''], null, ['关于', '', 'about']],
};
const itemsFor = (m) => MENU_ITEMS[m] || [[`${m}选项…`, ''], ['首选项…', ''], null, ['关闭窗口', 'Esc', 'close']];

function hhmm() { const c = clockFn(); return `${String(c.hh).padStart(2, '0')}:${String(c.mm).padStart(2, '0')}`; }
function dateStr() { const c = clockFn(); const d = new Date(2026, 9, 29 + (c.day || 1)); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; }

// Decorate a freshly opened panel. os = { app, ver, icon, tint, kind: 'pc' | 'device', menus, status() }
export function osChrome(el, os, { title, sub }) {
  const header = el.querySelector(':scope > header');
  const body = el.querySelector(':scope > .body');
  if (os.kind === 'device') {
    el.classList.add('os', 'os-dev');
    header.className = 'os-devbar';
    header.innerHTML = `<span class="os-devname">${esc(os.app)}</span><span class="os-devdoc">${esc(title)}</span><span class="os-devicons"><i class="ic-wifi"></i><i class="ic-usb"></i><b data-osclock>${hhmm()}</b></span><button class="os-devhome" data-close title="Esc">⌂ <kbd>Esc</kbd></button>`;
    if (sub) { const s = document.createElement('div'); s.className = 'os-info'; s.innerHTML = `<i>i</i>${esc(sub)}`; header.after(s); }
  } else {
    el.classList.add('os', 'os-pc');
    const tint = os.tint || '#3a7bd5';
    header.className = 'os-title';
    const pin = PINNED.find((p) => p[0] === os.pin);
    header.innerHTML = `<span class="os-ico" style="background:${tint}">${pin ? icon(pin[3]) : esc(os.icon || os.app[0])}</span><span class="os-app">${esc(os.app)}${os.ver ? ` <em>${esc(os.ver)}</em>` : ''}</span><span class="os-doc">${esc(title)}${os.info === false && sub ? ` · ${esc(sub)}` : ''}</span>
      <span class="os-wb"><i class="min" aria-hidden="true"></i><i class="max" aria-hidden="true"></i><button class="cls" data-close aria-label="关闭（Esc）" title="关闭（Esc）"></button></span>`;
    const menu = document.createElement('div');
    menu.className = 'os-menu';
    menu.innerHTML = (MENUS[os.menus] || MENUS.lab).map((m) => `<span data-menu="${m}">${m}</span>`).join('') + `<span class="os-user">${esc(userFn())}</span>`;
    header.after(menu);
    // dropdowns: click a menu to open it, click elsewhere to close
    let drop = null;
    const shut = () => { drop?.remove(); drop = null; menu.querySelectorAll('[data-menu]').forEach((x) => x.classList.remove('open')); };
    menu.addEventListener('click', (e) => {
      const m = e.target.closest('[data-menu]'); if (!m) return;
      const was = m.classList.contains('open'); shut(); if (was) return;
      m.classList.add('open');
      drop = document.createElement('div'); drop.className = 'os-drop';
      drop.innerHTML = itemsFor(m.dataset.menu).map((it) => (it ? `<button ${it[2] ? `data-do="${it[2]}"` : 'disabled'}><span>${esc(it[0])}</span>${it[1] ? `<kbd>${esc(it[1])}</kbd>` : ""}</button>` : '<hr>')).join('');
      drop.style.left = `${m.offsetLeft}px`; drop.style.top = `${menu.offsetTop + menu.offsetHeight}px`;
      el.appendChild(drop);
      drop.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-do]'); if (!b) return;
        shut();
        if (b.dataset.do === 'close') el._close?.();
        if (b.dataset.do === 'about') { const s2 = el.querySelector('[data-osst]'); if (s2) s2.textContent = `${os.app} ${os.ver || ''} · 实验室工作站软件（虚构）`; }
      });
    });
    el.addEventListener('pointerdown', (e) => { if (drop && !e.target.closest('.os-drop') && !e.target.closest('[data-menu]')) shut(); });
    if (sub && os.info !== false) { const s = document.createElement('div'); s.className = 'os-info'; s.innerHTML = `<i>i</i>${esc(sub)}`; menu.after(s); }
    const st = document.createElement('footer');
    st.className = 'os-status';
    st.innerHTML = `<span data-osst>就绪</span><span class="os-sep"></span><span>${esc(os.node || '网络：LAB-NET')}</span><span class="os-sep"></span><span>用户 ${esc(userFn())}</span>`;
    body.after(st);
    const task = document.createElement('div');
    task.className = 'os-task';
    task.innerHTML = `<span class="os-tl"><span class="os-wx">22°C<small>多云</small></span></span>
      <span class="os-center"><span class="os-start" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="os-search">搜索</span>
      ${PINNED.map(([n, , c, g]) => `<span class="os-pin${n === os.pin ? ' on' : ''}" title="${n}"><b style="background:linear-gradient(145deg,${c},${c}cc)">${icon(g)}</b></span>`).join('')}</span>
      <span class="os-tray"><span class="os-chev">⌃</span><span class="os-ime">中</span><span class="os-ic3"><i class="ic-net"></i><i class="ic-vol"></i></span><span class="os-time"><b data-osclock>${hhmm()}</b><small data-osdate>${dateStr()}</small></span><span class="os-bell"></span></span>`;
    st.after(task);
  }
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => el._close?.()));
  // live clock and status text
  const tick = () => {
    if (!el.isConnected) { clearInterval(iv); return; }
    el.querySelectorAll('[data-osclock]').forEach((n) => { const v = hhmm(); if (n.textContent !== v) n.textContent = v; });
    const d = el.querySelector('[data-osdate]'); if (d) { const v = dateStr(); if (d.textContent !== v) d.textContent = v; }
    const s = el.querySelector('[data-osst]'); if (s && os.status) { const v = os.status() || '就绪'; if (s.textContent !== v) s.textContent = v; }
  };
  const iv = setInterval(tick, 400);
}

// ---------------------------------------------------------------- canvas thumbnails

// A small PC desktop drawn on a 3D monitor: taskbar, one maximised window
// with title bar and menu, and a content area drawn by `content`.
export function drawDesktop(g, W, H, { app, doc = '', tint = '#3a7bd5', icon = '', dark = true, clock = '', content } = {}) {
  const tb = H * 0.065, tt = H * 0.06, mb = H * 0.045;
  g.fillStyle = '#1b2633'; g.fillRect(0, 0, W, H);
  // window
  g.fillStyle = dark ? '#1f2329' : '#f3f4f6'; g.fillRect(0, 0, W, H - tb);
  g.fillStyle = dark ? '#2b3038' : '#e4e7eb'; g.fillRect(0, 0, W, tt);
  g.fillStyle = tint; g.fillRect(W * 0.012, tt * 0.18, tt * 0.64, tt * 0.64);
  g.fillStyle = '#fff'; g.font = `700 ${tt * 0.38}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon || app[0], W * 0.012 + tt * 0.32, tt * 0.52);
  g.textAlign = 'left'; g.fillStyle = dark ? '#dfe5ec' : '#22272e'; g.font = `600 ${tt * 0.46}px "PingFang SC",sans-serif`;
  g.fillText(`${app}${doc ? ' — ' + doc : ''}`, W * 0.012 + tt * 0.9, tt * 0.52);
  // window buttons
  g.strokeStyle = dark ? '#aeb7c2' : '#4a525c'; g.lineWidth = Math.max(1, H * 0.003);
  const bx = W - tt * 3.2, cy = tt / 2, s = tt * 0.18;
  g.beginPath(); g.moveTo(bx - s, cy); g.lineTo(bx + s, cy); g.stroke();
  g.strokeRect(bx + tt - s, cy - s, 2 * s, 2 * s);
  g.beginPath(); g.moveTo(bx + 2 * tt - s, cy - s); g.lineTo(bx + 2 * tt + s, cy + s); g.moveTo(bx + 2 * tt + s, cy - s); g.lineTo(bx + 2 * tt - s, cy + s); g.stroke();
  // menu
  g.fillStyle = dark ? '#252a31' : '#fafbfc'; g.fillRect(0, tt, W, mb);
  g.fillStyle = dark ? '#9aa6b3' : '#4b5560'; g.font = `500 ${mb * 0.5}px "PingFang SC",sans-serif`;
  ['文件', '编辑', '视图', '工具', '帮助'].forEach((m, i) => g.fillText(m, W * 0.015 + i * W * 0.06, tt + mb * 0.55));
  // content
  g.save(); g.beginPath(); g.rect(0, tt + mb, W, H - tb - tt - mb); g.clip(); g.translate(0, tt + mb);
  content?.(g, W, H - tb - tt - mb);
  g.restore();
  // taskbar
  g.fillStyle = '#121a24'; g.fillRect(0, H - tb, W, tb);
  // centred start button and pinned apps, as on the real desktop
  const x0 = W / 2 - ((PINNED.length + 1) * tb * 1.1) / 2;
  g.fillStyle = '#4c8dff'; for (let i = 0; i < 4; i++) g.fillRect(x0 + (i % 2) * tb * 0.3, H - tb + tb * 0.22 + Math.floor(i / 2) * tb * 0.3, tb * 0.26, tb * 0.26);
  PINNED.forEach(([n, l, c], i) => { g.fillStyle = c; g.globalAlpha = n === app.split(' ')[0] ? 1 : 0.55; g.fillRect(x0 + (i + 1) * tb * 1.1, H - tb + tb * 0.2, tb * 0.6, tb * 0.6); });
  g.globalAlpha = 1;
  g.fillStyle = '#dfe6ee'; g.font = `500 ${tb * 0.42}px sans-serif`; g.textAlign = 'right'; g.fillText(clock, W * 0.985, H - tb / 2 + 1); g.textAlign = 'left';
}

// An instrument touchscreen: status bar, big readout, soft tiles.
export function drawDevice(g, W, H, { name, state = '', tint = '#2f8f6f', clock = '', content } = {}) {
  const sb = H * 0.13;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f4f6f8'); bg.addColorStop(1, '#e3e8ed');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = tint; g.fillRect(0, 0, W, sb);
  g.fillStyle = '#fff'; g.font = `600 ${sb * 0.48}px "PingFang SC",sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(name, W * 0.04, sb / 2);
  g.textAlign = 'right'; g.font = `500 ${sb * 0.42}px sans-serif`; g.fillText(`${state}  ${clock}`, W * 0.96, sb / 2); g.textAlign = 'left';
  g.save(); g.translate(0, sb); content?.(g, W, H - sb); g.restore();
}
