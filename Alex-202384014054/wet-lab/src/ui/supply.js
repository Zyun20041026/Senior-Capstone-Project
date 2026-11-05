// Alex 202384014054
// The supply cabinet (U): buy cells, reagents and plastics onto the cart.

import { openPanel } from './panels.js';
import { kbd } from './hud.js';
import { CATALOG, TABS, buy, priceFor, freeCartSlot } from '../modes/stock.js';
import { yuan, PRICE } from '../modes/orders.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A small token flies from the row to the cart (≈280 ms).
function fly(el, i) {
  if (document.documentElement.classList.contains('reduce-motion')) return;
  const row = el.querySelector(`[data-i="${i}"]`), game = document.getElementById('game');
  if (!row || !game) return;
  const g = game.getBoundingClientRect(), r = row.getBoundingClientRect(), k = g.width / 1600;
  const x0 = (r.right - g.left) / k - 60, y0 = (r.top + r.height / 2 - g.top) / k;
  const dot = document.createElement('div');
  dot.className = 'flyer';
  dot.style.transform = `translate(${x0}px,${y0}px)`;
  game.appendChild(dot);
  requestAnimationFrame(() => { dot.style.transform = `translate(1300px,872px) scale(.6)`; dot.style.opacity = '0.2'; });
  setTimeout(() => dot.remove(), 360);
}

export function supplyPanel(app) {
  const w = app.w;
  if (!w.account) { app.toast('hint', '物资柜只在开放模式里使用'); return; }
  const { el, body } = openPanel({ title: '物资柜', sub: '买的东西放到推车上，跟着你去各个工位。推车有 6 个位置。', w: 760, y: 90, id: 'supply' , os: { kind: 'pc', app: 'LabStock', ver: '物资管理', icon: '库', tint: '#6b7a89', menus: 'stock', pin: 'LabStock' } });
  el.classList.add('sup');
  let sel = 0, busy = false, flash = null, tab = (w.flags.supTab ||= TABS[0]);
  const list = () => CATALOG.map((c, i) => [c, i]).filter(([c]) => c.tab === tab);
  const render = () => {
    const a = w.account, slot = freeCartSlot(w), L = list();
    sel = Math.min(sel, L.length - 1);
    body.innerHTML = `<div class="sup-top"><span>余额 <b class="num" data-cash>${yuan(a.cash)}</b>${a.free ? `（沙盒：不扣费，已记账 ${yuan(a.listed)}）` : ''}</span><span>推车 ${slot ? '有空位' : '<b style="color:var(--warn)">已满</b>'}</span></div>
      <div class="sup-tabs" role="tablist">${TABS.map((t, k) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${kbd(String(k + 1))}${t}<em>${CATALOG.filter((c) => c.tab === t).length}</em></button>`).join('')}</div>
      <div class="sup-list" role="listbox">${L.map(([c, i], j) => {
        const ok = !c.need || c.need(w), p = priceFor(w, c);
        return `<button class="sup-row${j === sel ? ' on' : ''}${flash === i ? ' got' : ''}" data-i="${i}" ${ok ? '' : 'aria-disabled="true"'}><span>${esc(c.name)}${ok ? '' : `<em>${esc(c.needText || '')}</em>`}</span><b class="num">${p ? yuan(p) : `免费 <s>${yuan(c.key ? (w.account.free ? PRICE['buy:' + c.key] : 0) : 0)}</s>`}</b></button>`;
      }).join('')}</div>
      <div class="sup-foot">${kbd('1')}–${kbd(String(TABS.length))} 分类 · ${kbd('↑')}${kbd('↓')} 选择 · ${kbd('⏎')} 购买 · 点一行直接购买</div>`;
    body.querySelector('.sup-row.on')?.scrollIntoView({ block: 'nearest' });
  };
  const purchase = (i) => {
    if (busy) return;
    busy = true;
    const r = buy(w, CATALOG[i]);
    if (r.error) app.toast('warn', r.error);
    else { fly(el, i); app.toast('ok', `已放到推车：${CATALOG[i].name}`); w.log.push({ t: w.t, text: `购买 ${CATALOG[i].name}` }); flash = i; app.audio?.click?.(); setTimeout(() => { flash = null; if (el.isConnected) render(); }, 260); }
    render();
    busy = false;
  };
  const setTab = (t) => { tab = w.flags.supTab = t; sel = 0; render(); };
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { setTab(t.dataset.tab); return; }
    const b = e.target.closest('[data-i]'); if (b && b.getAttribute('aria-disabled') !== 'true') { sel = list().findIndex(([, i]) => i === +b.dataset.i); purchase(+b.dataset.i); }
  });
  el._key = (e) => {
    const n = +e.key;
    if (n >= 1 && n <= TABS.length) { setTab(TABS[n - 1]); return true; }
    if (e.code === 'ArrowDown') sel = Math.min(list().length - 1, sel + 1);
    else if (e.code === 'ArrowUp') sel = Math.max(0, sel - 1);
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { setTab(TABS[(TABS.indexOf(tab) + (e.code === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]); return true; }
    else if (e.code === 'Enter') { const r = list()[sel]; if (r) purchase(r[1]); return true; }
    else return false;
    render(); return true;
  };
  render();
}
