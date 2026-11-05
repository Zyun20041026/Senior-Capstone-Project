// Alex 202384014054
// Heads-up display: station tabs, clock, current step, SOP drawer, held-tool
// readout, contextual key hints, toasts and the hover tooltip.

import { STATIONS, STATION_ORDER } from '../game/layout.js';
import { clock, totalVol, items, envOf } from '../game/world.js';
import { heldTool, heldItem, channelSlots } from '../game/actions.js';
import { RULES } from '../game/sop.js';
import { vol, um, dmsoPct } from '../sim/liquid.js';
import { dialDigits } from '../view/tools.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const kbd = (k) => `<kbd${k.length > 2 ? ' class="wide"' : ''}>${esc(k)}</kbd>`;

export function fmtVol(v, coarse = false) {
  if (v <= 0.05) return '空';
  if (v >= 1000) return `${coarse ? (Math.round(v / 100) / 10).toFixed(1) : (v / 1000).toFixed(2)} mL`;
  if (v >= 100) return `${coarse ? Math.round(v / 10) * 10 : Math.round(v)} µL`;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} µL`;
}

export function createHUD(app) {
  const H = { toasts: [], lastSop: null, lastTabs: '' };
  const tabs = $('tabs');

  H.renderTabs = (w) => {
    const key = w.station + w.stations.join();
    if (key === H.lastTabs) return;
    H.lastTabs = key;
    tabs.innerHTML = STATION_ORDER.map((id) => {
      const s = STATIONS[id];
      const on = w.stations.includes(id);
      return `<button class="tab" data-st="${id}" ${on ? '' : 'disabled'} aria-current="${w.station === id}">${kbd(s.key)}${s.name}</button>`;
    }).join('');
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (b && !b.disabled) app.go(b.dataset.st); });
  $('nbbtn').addEventListener('click', () => app.toggleNotebook());
  $('waitbtn').addEventListener('click', () => app.openWait());
  $('menubtn').addEventListener('click', () => app.pause());
  $('step').addEventListener('click', (e) => { if (e.target.closest('[data-submit]')) { e.stopPropagation(); app.submit(); return; } if (e.target.closest('[data-skip]')) { e.stopPropagation(); app.requestSkip(); return; } if (app.level && app.level.kind !== 'level') { app.level.cardClick?.(app); return; } H.toggleSop(); });
  $('step').addEventListener('keydown', (e) => { if (e.key === 'Enter') H.toggleSop(); });

  H.toggleSop = (force) => { if (app.level && app.level.kind !== 'level' && force !== false) return; const s = $('sop'); s.hidden = force != null ? !force : !s.hidden; $('step').hidden = !s.hidden; H.lastSop = null; };

  H.render = (w, level, progress) => {
    H.renderTabs(w);
    $('lvname').textContent = level ? `${level.num} · ${level.title}` : '';
    const c = clock(w);
    $('clk').textContent = c.label;
    const out = w.flags.outMin;
    const sub = $('clks');
    if (items(w).some((it) => it.critical) && out > 0.5) { sub.textContent = `细胞离开培养箱 ${Math.floor(out)} 分钟`; sub.classList.toggle('hot', out > 45); }
    else { sub.textContent = ''; sub.classList.remove('hot'); }
    renderStep(w, level, progress);
    renderHeld(w);
    renderKeys(w);
  };

  function renderStep(w, level, prog) {
    if (!level) return;
    if (level.kind !== 'level') {
      // open modes: a mode card instead of the step list
      const card = level.card ? level.card(w) : { title: level.title, sub: '' };
      const sig = `mode|${card.title}|${card.sub}`;
      if (H.lastStepSig !== sig) { H.lastStepSig = sig; $('step').innerHTML = `<div class="n">${esc(level.badge || '◆')}</div><div class="tx"><b>${esc(card.title)}</b><span>${esc(card.sub || '')}</span></div>${card.btn ? `<button class="btn" data-modebtn>${card.btn}</button>` : ''}`; }
      $('sop').hidden = true;
      return;
    }
    const i = prog.findIndex((p, k) => !p && !level.steps[k].optional);
    const cur = i < 0 ? level.steps.length - 1 : i;
    const s = level.steps[cur];
    const done = prog.filter(Boolean).length;
    const coached = !!app.save.coach && i >= 0;
    const armed = coached && performance.now() - (app.skipArmed || 0) < 4000;
    const sig = `${cur}|${done}|${i}|${coached}|${armed}`;
    if (H.lastStepSig !== sig) {
      H.lastStepSig = sig;
      $('step').innerHTML = `<div class="n">${i < 0 ? '✓' : cur + 1}</div><div class="tx"><b>${esc(i < 0 ? '全部步骤完成' : s.text)}</b>${coached ? '<span class="co"></span>' : `<span>${esc(i < 0 ? '检查记录本里的计算，然后提交实验' : s.hint || '')}</span>`}</div>${i < 0 ? `<button class="btn primary" data-submit>${kbd('⏎')}提交实验</button>` : coached ? `<button class="btn${armed ? ' primary' : ''}" data-skip title="由带教老师完成这一步（本关最高 2★）">${kbd('K')}${armed ? '确认代做' : '跳过'}</button>` : ''}<div class="bar"><i style="width:${(100 * done) / level.steps.length}%"></i></div>`;
    }
    const sop = $('sop');
    if (!sop.hidden && H.lastSop !== sig) {
      H.lastSop = sig;
      sop.innerHTML = `<header><b>操作规程 · ${esc(level.title)}</b><span>${kbd('L')}</span></header><ol>${level.steps.map((st, k) => `<li class="${prog[k] ? 'done' : k === cur ? 'cur' : ''}"><div class="i">${prog[k] ? '✓' : k + 1}</div><div><b>${esc(st.text)}</b>${st.hint ? `<span>${esc(st.hint)}</span>` : ''}${st.keys ? `<div class="k">${st.keys.map(kbd).join('')}</div>` : ''}</div></li>`).join('')}</ol>`;
    }
  }

  function renderHeld(w) {
    const t = heldTool(w), it = heldItem(w);
    let html;
    if (t && t.kind === 'pip') {
      const tips = t.tips.filter(Boolean);
      const lv = tips.length ? Math.max(...tips.map((x) => vol(x.liq))) : 0;
      const d = dialDigits(t);
      const state = !tips.length ? '未装枪头' : `${tips.length > 1 ? `${tips.length} 个枪头 · ` : ''}${lv > 0.3 ? `枪头内约 ${fmtVol(lv)}` : '枪头空'}${w.level?.aseptic && tips.some((x) => !x.sterile) ? ' · 非无菌' : ''}`;
      html = `<svg class="ic" viewBox="0 0 30 42"><rect x="11" y="2" width="8" height="24" rx="3" fill="#e3e7ec"/><rect x="12.5" y="0" width="5" height="4" rx="1.5" fill="${{ p20: '#c9ced6', p200: '#f2c94c', p1000: '#4d8bf0', mc20: '#c9ced6', mc200: '#f2c94c' }[t.id]}"/><path d="M13 26 L14.4 40 H15.6 L17 26Z" fill="${tips.length ? '#f2c94c' : '#59636e'}"/></svg><div class="meta"><b>${esc(t.spec.label)} · ${t.spec.min}–${t.spec.max} µL</b><span>${esc(state)}</span></div><div class="dial">${d.digits.map((x, i) => `<i class="${i === d.red ? 'd' : ''}">${x}</i>`).join('')}</div>`;
    } else if (t && t.kind === 'aid') {
      html = `<svg class="ic" viewBox="0 0 30 42"><path d="M8 4 H22 L20 14 H10Z" fill="#7469e6"/><rect x="13.5" y="14" width="3" height="27" rx="1.5" fill="${t.sp ? '#e9edf1' : '#59636e'}"/></svg><div class="meta"><b>电动移液器</b><span>${t.sp ? `${t.sp.size} mL 移液管 · ${fmtVol(vol(t.sp.liq))}` : '未装移液管'}</span></div>`;
    } else if (t && t.kind === 'vac') {
      html = `<svg class="ic" viewBox="0 0 30 42"><rect x="11" y="4" width="8" height="16" rx="3" fill="#59636e"/><path d="M14 20 L14.6 40 H15.4 L16 20Z" fill="${t.pasteur ? '#e9edf1' : '#3a414a'}"/></svg><div class="meta"><b>真空吸液器</b><span>${t.pasteur ? '已装巴斯德吸管 · 按住 W 吸弃' : '未装吸管'}</span></div>`;
    } else if (it) {
      html = `<div class="meta"><b>${esc(it.label)}</b><span>${esc(describeVol(it))}${it.open ? ' · 开盖' : ''}</span></div>`;
    } else html = `<div class="meta"><b>手上是空的</b><span>轻点工具或物品拿起来</span></div>`;
    if (H.lastHeld !== html) { $('held').innerHTML = html; H.lastHeld = html; }
  }

  function renderKeys(w) {
    const t = heldTool(w), it = heldItem(w);
    const k = [];
    const hov = w.hover && w.hover.id ? w.items[w.hover.id] : null;
    if (t && t.kind === 'pip') {
      const slots = channelSlots(w, t, w.hover);
      k.push([['[', ']'], `量程 ±${t.spec.step}`], [['⇧', '['], `±${t.spec.coarse}`]);
      if (hov && ['tipbox', 'tipboxSide'].includes(hov.type)) k.push([['T'], '装枪头']);
      if (Array.isArray(slots)) k.push([['↓', '↑'], '升降枪头'], [['空格'], '按住=一档', w.plunger.down && w.plunger.stop === 1], [['⇧'], '按住空格时=二档', w.plunger.down && w.plunger.stop === 2]);
      if (t.spec.ch > 1) k.push([['R'], w.orient === 'col' ? '竖向（按列）' : '横向（按行）']);
      if (t.tips.some(Boolean)) k.push([['E'], '退枪头']);
      if (hov && hov.wells) k.push([['←', '→'], '换列']);
      k.push([['轻点空白'], '放下'], [['Esc'], '放回支架']);
    } else if (t && t.kind === 'aid') {
      if (hov && hov.type === 'seropack') k.push([['T'], '装移液管']);
      k.push([['↓', '↑'], '升降'], [['W'], '按住吸液', w.keys.KeyW], [['S'], '按住放液', w.keys.KeyS], [['⇧'], '同时按住=慢速'], [['E'], '丢弃移液管'], [['Esc'], '放回']);
    } else if (t && t.kind === 'vac') {
      if (hov && hov.type === 'pasteur') k.push([['T'], '装吸管']);
      k.push([['↓', '↑'], '升降'], [['W'], '按住吸弃', w.keys.KeyW], [['⇧'], '同时按住=慢速'], [['E'], '丢弃吸管'], [['Esc'], '放回']);
    } else if (it) {
      k.push([['轻点'], '放到高亮的空位'], [['Esc'], '放回原处']);
      if (it.wells) k.push([['R'], it.rot ? '已旋转 180°' : '旋转 180°']);
    } else {
      k.push([['轻点'], '拿起工具或物品']);
      if (hov) { if (hov.open !== undefined && hov.type !== 'res4') k.push([['O'], hov.open ? '盖上' : '打开']); k.push([['A'], '喷 75% 酒精']); }
      if (w.hover && w.hover.fixture === 'bsc-surface') k.push([['A'], '擦拭台面']);
      k.push([['1–5'], '工作站'], [['Z'], '等待'], [['N'], '记录本'], [['H'], app.save.coach ? '关闭教程' : '教程引导']);
    }
    const html = k.map(([ks, label, on]) => `<span class="k${on ? ' on' : ''}">${ks.map(kbd).join('')}${esc(label)}</span>`).join('');
    if (H.lastKeys !== html) { $('keys').innerHTML = html; H.lastKeys = html; }
  }

  // toasts
  H.flush = (w) => {
    while (w.events.length) {
      const e = w.events.shift();
      if (!e.text) continue;
      const rule = e.rule && RULES[e.rule];
      const why = e.kind === 'mentor' ? e.why : rule && e.first ? rule.why : '';
      const d = document.createElement('div');
      d.className = `toast glass ${e.kind}`;
      d.innerHTML = `<b>${esc(e.kind === 'error' ? '严重违规：' : e.kind === 'mentor' ? '带教提醒：' : e.kind === 'warn' && rule ? '违规：' : '')}${esc(e.text)}${e.detail ? `（${esc(e.detail)}）` : ''}</b>${why ? `<span>${esc(why)}</span>` : ''}`;
      $('toasts').prepend(d);
      app.audio?.cue(e.kind);
      const life = why ? 9000 : 4200;
      setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 420); }, life);
      while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
    }
  };

  // tooltip
  H.tooltip = (w, x, y, show) => {
    const tip = $('tip');
    const hov = w.hover && w.hover.id ? w.items[w.hover.id] : null;
    const here = hov && (hov.at.st === w.station || hov.at.st === 'tray' || hov.at.st === 'hand' || (hov.at.st === 'rotor' && w.station === 'bench'));
    if (!show || !hov || !here || heldItem(w)) { tip.hidden = true; return; }
    const tags = [];
    if (hov.open !== undefined && !['res4', 'boat', 'hemo', 'beaker'].includes(hov.type)) tags.push(hov.open ? ['开盖', 'warn'] : ['盖着', '']);
    if (hov.sterile && w.level?.aseptic) tags.push(hov.sprayed ? ['已喷酒精', 'ok'] : ['未消毒外表', '']);
    if (hov.wet) tags.push(['瓶身湿', 'warn']);
    if (hov.frozen) tags.push(['冻结', 'warn']);
    if (hov.temp != null && !hov.wells && totalVol(hov) > 0) tags.push([`${hov.temp.toFixed(0)} °C`, hov.temp < 15 ? 'warn' : '']);
    const contam = (hov.liq?.c.bug || 0) >= 3 || (hov.wells && hov.wells.some((x) => (x.liq.c.bug || 0) >= 3));
    if (contam) tags.push(['浑浊变黄', 'err']);
    let extra = '';
    if (w.hover.well != null && hov.wells) {
      const wl = hov.wells[w.hover.well];
      extra = `${'ABCDEFGH'[Math.floor(w.hover.well / 12)]}${(w.hover.well % 12) + 1} · ${fmtVol(vol(wl.liq))}`;
    } else if (w.hover.lane != null && hov.lanes) extra = `第 ${w.hover.lane + 1} 槽 · ${fmtVol(vol(hov.lanes[w.hover.lane]))}`;
    else if (hov.present) extra = `剩余 ${hov.present.filter(Boolean).length} 个`;
    else extra = describeVol(hov);
    const html = `<b>${esc(hov.label)}</b>${hov.sub ? `<span>${esc(hov.sub)}</span>` : ''}${extra ? `<span>${esc(extra)}</span>` : ''}${tags.length ? `<div class="tags">${tags.map(([t, c]) => `<i class="tag ${c}">${esc(t)}</i>`).join('')}</div>` : ''}`;
    if (tip._h !== html) { tip.innerHTML = html; tip._h = html; }
    tip.hidden = false;
    tip.style.left = `${Math.min(1600 - 300, x + 22)}px`;
    tip.style.top = `${Math.max(64, Math.min(760, y - 20))}px`;
  };

  return H;
}

export function describeVol(it) {
  if (it.wells) { const n = it.wells.filter((x) => vol(x.liq) > 1).length; return n ? `${n} 个孔有液体` : '空板'; }
  if (it.lanes) { const n = it.lanes.filter((l) => vol(l) > 1).length; return n ? `${n} 个槽有液体` : '空'; }
  if (!it.liq) return '';
  const v = vol(it.liq);
  if (it.type === 'flask') return `培养液约 ${fmtVol(v, true)}${it.layer ? '' : ''}`;
  if (['tube15', 'tube50', 'bottle100', 'bottle500', 'beaker'].includes(it.type)) return v > 0.05 ? `约 ${fmtVol(v, true)}` : '空';
  return fmtVol(v);
}

export { um, dmsoPct, envOf };
