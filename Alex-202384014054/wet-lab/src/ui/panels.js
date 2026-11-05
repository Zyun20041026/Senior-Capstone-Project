// Alex 202384014054
// Instrument and game panels: wait, centrifuge, plate reader, pause.

import { osChrome } from './os/desktop.js';
import * as A from '../game/actions.js';
import { items, totalVol } from '../game/world.js';
import { rcf } from '../sim/cells.js';
import { R_CM } from '../game/layout.js';
import { kbd, fmtVol } from './hud.js';
import { sourcesPanel } from './sources.js';

const host = () => document.getElementById('panelhost');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function openPanel({ title, sub = '', w = 560, h = null, x = null, y = 90, id = 'panel', modal = false, os = null }) {
  closePanel();
  const p = document.createElement('section');
  p.className = 'panel glass';
  p.id = id;
  p.style.width = `${w}px`;
  if (h) p.style.height = `${h}px`;
  p.style.maxHeight = `${900 - y - 14}px`; // stays on the 1600×900 stage; the body scrolls
  p.style.left = `${x ?? (1600 - w) / 2}px`;
  p.style.top = `${y}px`;
  p.style.zIndex = 12;
  p.innerHTML = `<header><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="btn x" data-close>${kbd('Esc')}关闭</button></header><div class="body"></div>`;
  if (modal) { const veil = document.createElement('div'); veil.id = 'veil'; veil.style.cssText = 'position:absolute;inset:0;background:rgba(6,9,14,.45);z-index:11'; host().appendChild(veil); }
  host().appendChild(p);
  if (os) { p._close = () => closePanel(); osChrome(p, os, { title, sub }); }
  else p.querySelector('[data-close]').addEventListener('click', () => closePanel());
  return { el: p, body: p.querySelector('.body') };
}

export function closePanel() {
  const p = host().querySelector('.panel');
  if (p && p._onClose) p._onClose();
  host().replaceChildren();
}
export const panelOpen = () => !!host().querySelector('.panel');
export const panelId = () => host().querySelector('.panel')?.id || null;

// ---------------------------------------------------------------- wait

export function waitPanel(app) {
  const w = app.w;
  const opts = (app.level.waits || [1, 3, 5, 10, 15, 30]).map((m) => ({ m, label: m >= 1440 ? `${m / 1440} 天（${m / 60} 小时）` : m >= 60 ? `${m / 60} 小时` : `${m} 分钟` }));
  const { el, body } = openPanel({ title: '等待', sub: '时间会照常作用在所有东西上：培养箱里的细胞会长，安全柜里没盖的瓶子会一直暴露。', w: 520, y: 120, id: 'wait' });
  body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${opts.map((o, i) => `<button class="btn" data-m="${o.m}">${i < 9 ? kbd(String(i + 1)) : ''}${esc(o.label)}</button>`).join('')}</div>
  <div class="field" style="margin-top:14px"><label for="waitmin">自定义（分钟）</label><div style="display:flex;gap:8px"><input id="waitmin" type="number" min="1" max="6000" value="5" style="flex:1"><button class="btn primary" data-go>等待</button></div></div>`;
  const go = (m) => { if (m > 0) { app.wait(m); closePanel(); } };
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) go(+b.dataset.m); if (e.target.closest('[data-go]')) go(+body.querySelector('#waitmin').value); });
  el._key = (e) => { const n = +e.key; if (n >= 1 && n <= opts.length) { go(opts[n - 1].m); return true; } return false; };
  void w;
}

// ---------------------------------------------------------------- centrifuge

export function centrifugePanel(app) {
  const { el, body } = openPanel({ title: '台式离心机', sub: '水平转子，6 个吊篮。对称位置（1↔4、2↔5、3↔6）的管子质量要相等。转子半径 10 cm。', w: 680, y: 84, id: 'centrifuge' , os: { kind: 'device', app: 'Centri 5424' } });
  const c = app.w.inst.centrifuge;
  body.innerHTML = `<div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start">
    <svg id="rotor" viewBox="-150 -150 300 300" width="300" height="300" style="background:radial-gradient(circle,#2a313b,#151a21);border-radius:50%"></svg>
    <div style="display:grid;gap:14px">
      <div class="field"><label for="crpm">转速（rpm）</label><input id="crpm" type="number" min="0" max="6000" step="10" value="${c.rpm || ''}" placeholder="例如 1500"></div>
      <div class="field"><label for="cmin">时间（分钟）</label><input id="cmin" type="number" min="1" max="30" value="${c.min || 5}"></div>
      <p id="cg" style="margin:0;font:400 12.5px/1.6 var(--sans);color:var(--muted)"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-lid></button><button class="btn primary" data-start>启动</button></div>
      <p style="margin:0;font:400 12px/1.6 var(--sans);color:var(--faint)">拿着离心管时轻点吊篮放入；空手轻点吊篮里的管子取出。离心力 RCF = 1.118 × 10⁻⁵ × r(cm) × rpm²。</p>
    </div></div>`;
  const svg = body.querySelector('#rotor');
  const draw = () => {
    const tubes = items(app.w).filter((x) => x.at && x.at.st === 'rotor');
    let s = '<circle r="128" fill="#3a434e" stroke="#59636e" stroke-width="2"/><circle r="22" fill="#59636e"/>';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * 88, y = Math.sin(a) * 88;
      const t = tubes.find((q) => q.at.slot === i);
      s += `<g data-bucket="${i}" style="cursor:pointer" transform="translate(${x},${y})"><circle r="30" fill="${t ? '#e9eef3' : '#262d36'}" stroke="${t ? '#8b84ff' : '#6b7683'}" stroke-width="2"/><text y="-36" text-anchor="middle" font-size="12" fill="#98a2b1" font-weight="700">${i + 1}</text>${t ? `<text y="-2" text-anchor="middle" font-size="10.5" fill="#1e2b45" font-weight="700">${esc((t.short || t.label).slice(0, 6))}</text><text y="12" text-anchor="middle" font-size="10" fill="#55606d">${esc(fmtVol(totalVol(t), true))}</text>` : ''}</g>`;
    }
    svg.innerHTML = s;
    body.querySelector('[data-lid]').textContent = c.lid ? '盖上盖子' : '打开盖子';
    const rpm = +body.querySelector('#crpm').value;
    body.querySelector('#cg').textContent = rpm > 0 ? `当前设定约 ${Math.round(rcf(rpm, R_CM))} ×g` : '';
  };
  draw();
  svg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bucket]');
    if (!b) return;
    const i = +b.dataset.bucket;
    const occ = items(app.w).find((q) => q.at && q.at.st === 'rotor' && q.at.slot === i);
    if (A.heldItem(app.w)) A.rotorPut(app.w, i);
    else if (occ) A.pick(app.w, occ.id);
    draw();
  });
  body.querySelector('[data-lid]').addEventListener('click', () => { c.lid = !c.lid; draw(); });
  body.querySelector('#crpm').addEventListener('input', draw);
  body.querySelector('[data-start]').addEventListener('click', () => {
    const rpm = +body.querySelector('#crpm').value, m = +body.querySelector('#cmin').value;
    c.rpm = rpm; c.min = m;
    if (c.lid) { app.toast('hint', '先盖上离心机盖'); return; }
    const r = A.spin(app.w, rpm, m);
    if (r && r.ok) { app.audio?.spin(); app.toast('ok', `离心完成：${Math.round(r.g)} ×g，${m} 分钟`); }
    draw();
  });
  el._tick = draw;
}

// ---------------------------------------------------------------- plate reader

export function readerPanel(app) {
  const r = app.w.inst.reader;
  const { body } = openPanel({ title: '酶标仪', sub: '吸光度读板。放板时 A1 孔朝左上（切角在右上）。', w: 760, y: 76, id: 'reader' , os: { kind: 'pc', app: 'PlateMaster', ver: '5.0 · 读板', icon: 'P', tint: '#d07a2c', pin: 'PlateMaster' } });
  const draw = () => {
    const p = items(app.w).find((x) => x.at && x.at.st === 'reader' && x.at.slot === 'drawer');
    const last = p && app.w.reads[p.id];
    body.innerHTML = `<div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
      <button class="btn" data-drawer>${r.drawer ? '关上抽屉' : '打开抽屉'}</button>
      <div class="field"><label for="rwl">检测波长</label><select id="rwl">${[405, 450, 570, 600, 650].map((n) => `<option value="${n}" ${n === r.wl ? 'selected' : ''}>${n} nm</option>`).join('')}</select></div>
      <button class="btn primary" data-read ${p && !r.drawer ? '' : 'disabled'}>读板</button>
      <span style="font:400 12.5px/1.4 var(--sans);color:var(--muted)">${p ? `抽屉里：${esc(p.label)}${p.rot ? '（旋转了 180°）' : ''}` : '抽屉是空的：打开抽屉，拿着板轻点抽屉放入'}</span></div>
      ${last ? heat(last) : ''}`;
  };
  draw();
  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer]')) { A.door(app.w, 'reader'); r.drawer = app.w.inst.reader.drawer; draw(); }
    if (e.target.closest('[data-read]')) { const wl = +body.querySelector('#rwl').value; const res = A.readPlate(app.w, wl); if (res) { app.audio?.cue('ok'); draw(); } }
  });
}

function heat(read) {
  const max = Math.max(...read.values, 0.5);
  const cell = (v) => { const u = Math.min(1, v / max); return `background:rgba(${Math.round(240 - 10 * u)},${Math.round(200 - 110 * u)},${Math.round(120 - 90 * u)},${0.15 + 0.85 * u});color:${u > 0.55 ? '#1a1206' : '#e9edf3'}`; };
  let h = `<p style="margin:14px 0 8px;font:500 12.5px/1 var(--sans);color:var(--muted)">${esc(read.label)} · ${read.wl} nm · 吸光度 (OD)</p><div style="display:grid;grid-template-columns:22px repeat(12,1fr);gap:3px;font:500 11px/1 var(--num);font-variant-numeric:tabular-nums">`;
  h += '<span></span>' + Array.from({ length: 12 }, (_, c) => `<span style="text-align:center;color:var(--faint)">${c + 1}</span>`).join('');
  for (let r = 0; r < 8; r++) {
    h += `<span style="color:var(--faint);align-self:center">${'ABCDEFGH'[r]}</span>`;
    for (let c = 0; c < 12; c++) { const v = read.values[r * 12 + c]; h += `<span style="padding:6px 0;text-align:center;border-radius:4px;${cell(v)}">${v.toFixed(2)}</span>`; }
  }
  return h + '</div>';
}

// ---------------------------------------------------------------- pause

export function pausePanel(app) {
  const lvl = app.level?.kind === 'level';
  const { body } = openPanel({ title: '暂停', sub: app.level ? (lvl ? `${app.level.num} · ${app.level.title}` : app.level.title) : '', w: 640, y: 110, id: 'pause', modal: true });
  const keys = [['空格', '按住：活塞压到一档；松开回弹（在液面下松开就是吸液）'], ['⇧ + 空格', '压到二档：打液时吹出残留；吸液时不要用'], ['↓ / ↑', '把枪头/移液管放进容器、伸到液面下、触底，或提起来'], ['[ / ]', '调量程（⇧ 加大步长）'], ['T / E', '装枪头或移液管 / 退掉'], ['W / S', '电动移液器吸 / 放；吸液器吸弃'], ['O / A', '开关盖 / 喷 75% 酒精（悬停台面按 A 擦台面）'], ['R', '多道枪切换竖向和横向；拿着孔板时旋转 180°'], ['← / →', '在孔板上逐列移动'], ['Z / N / L', '等待 / 记录本 / 操作规程'], ['H', '教程引导：开 / 关'], ['K', '开启教程时：跳过当前步骤，由带教老师代做（按两次确认）']];
  body.innerHTML = `<div style="display:grid;gap:8px;margin-bottom:16px">${keys.map(([k, t]) => `<div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center;font:400 13px/1.45 var(--sans);color:var(--muted)"><span>${k.split(' ').map((x) => (x === '+' || x === '/' ? `<span style="color:var(--faint)">${x}</span>` : kbd(x))).join(' ')}</span><span>${esc(t)}</span></div>`).join('')}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-resume>继续实验</button><button class="btn" data-sound>${app.audio?.on ? '关闭音效' : '打开音效'}</button><button class="btn" data-motion>${app.save?.reduceMotion ? '恢复动效' : '减少动效'}</button><button class="btn" data-sources>资料来源</button><button class="btn" data-restart>${lvl ? '重新开始本关' : app.level?.kind === 'sandbox' ? '重置实验室' : '重新开始病例'}</button>${!lvl && app.level?.end ? `<button class="btn" data-end>${esc(app.level.endLabel || '结束')}</button>` : ''}<button class="btn danger" data-quit>${lvl ? '返回关卡选择' : '返回标题'}</button></div>`;
  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-resume]')) closePanel();
    if (e.target.closest('[data-sound]')) { app.audio?.toggle(); pausePanel(app); }
    if (e.target.closest('[data-motion]')) { app.setReduceMotion(!app.save.reduceMotion); pausePanel(app); }
    if (e.target.closest('[data-sources]')) sourcesPanel(app);
    if (e.target.closest('[data-restart]')) { closePanel(); app.restart(); }
    if (e.target.closest('[data-end]')) { closePanel(); app.endRun(); }
    if (e.target.closest('[data-quit]')) { closePanel(); app.back(); }
  });
}
