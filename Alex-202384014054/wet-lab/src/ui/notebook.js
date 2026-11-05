// Alex 202384014054
// The lab notebook: fields the player must calculate and fill in, a
// calculator, and the automatic log of everything done.

import { clock } from '../game/world.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Arithmetic only: numbers (with e-notation), + - * / × ÷ ^ and parentheses.
export function calc(src) {
  const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').replace(/,/g, '');
  let i = 0;
  const num = () => { const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i)); if (!m) throw new Error('数字'); i += m[0].length; return parseFloat(m[0]); };
  const atom = () => {
    if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') throw new Error(')'); i++; return v; }
    if (s[i] === '-') { i++; return -atom(); }
    return num();
  };
  const pow = () => { let v = atom(); while (s[i] === '^') { i++; v = v ** atom(); } return v; };
  const term = () => { let v = pow(); while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = pow(); v = op === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
  const v = expr();
  if (i !== s.length) throw new Error('多余字符');
  return v;
}

const fmtIC = (u) => (!isFinite(u) ? '—' : u >= 1 ? `${+u.toPrecision(3)} µM` : `${+(u * 1000).toPrecision(3)} nM`);
const KIND = { ct: 'CT', seq: '测序', gel: '凝胶', ice: 'ICE', screen: '药敏', rx: '处方', line: '细胞株', path: '病理' };

// Everything the player has found so far: an IC50 atlas (cell line ×
// compound, latest fit wins), Bliss results and every other result in order.
function results(w) {
  const all = (w.ledger ? w.ledger.order.map((id) => w.ledger.items[id]) : []).filter((e) => !e.void);
  if (!all.length) return '<p class="log" style="margin:0">还没有结果。读板后在数据分析里拟合、签发测序判读或 CT 报告，结果会汇总到这里。</p>';
  const atlas = {}, lines = new Set(), cmpds = new Set();
  for (const e of all.filter((x) => x.kind === 'screen')) for (const f of e.result?.fits || []) { atlas[`${f.line}|${f.cmpd}`] = { ...f, id: e.id, bad: !!e.mismatch }; lines.add(f.line); cmpds.add(f.cmpd); }
  const C = [...cmpds], Ls = [...lines];
  const bliss = all.filter((e) => e.result?.bliss);
  const table = Ls.length ? `<div class="nb-atlas"><table><thead><tr><th>IC50</th>${C.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${Ls.map((l) => `<tr><th>${esc(l)}</th>${C.map((c) => { const f = atlas[`${l}|${c}`]; return `<td${f?.bad ? ' class="bad"' : ''} title="${f ? f.id : ''}">${f ? (f.beyond || f.ic50 > 10 ? '>10 µM' : fmtIC(f.ic50)) : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  const bl = bliss.length ? `<div class="log">${bliss.map((e) => `<div>· ${esc(e.declared.line)} · ${esc(e.result.bliss.a)} + ${esc(e.result.bliss.b)}：Bliss 超额最高 ${(100 * e.result.bliss.max).toFixed(0)}%${e.result.bliss.max > 0.15 ? '（协同）' : ''} <small>${e.id}</small></div>`).join('')}</div>` : '';
  const other = all.filter((e) => e.kind !== 'screen');
  return `${table ? `<h4>药敏图谱</h4>${table}` : ''}${bl ? `<h4>联合用药</h4>${bl}` : ''}${other.length ? `<h4>其他结果</h4><div class="log">${other.slice(-40).map((e) => `<div><span class="tm">${e.id}</span>${KIND[e.kind] || e.kind} · ${esc(e.title)}${e.mismatch ? ' <b style="color:#c0242c">与实际不符</b>' : ''}</div>`).join('')}</div>` : ''}`;
}

const fmtT = (w, t) => { const m = w.clock0 + t; const mm = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(Math.floor(mm % 60)).padStart(2, '0')}`; };

export function createNotebook(app) {
  const nb = $('notebook');
  const N = {};
  N.open = () => { nb.hidden = false; N.render(); };
  N.close = () => { nb.hidden = true; };
  N.toggle = () => (nb.hidden ? N.open() : N.close());
  N.isOpen = () => !nb.hidden;
  N.render = () => {
    const w = app.w, L = app.level;
    if (!w || !L) return;
    const c = clock(w);
    const fields = (L.notes || []).filter((f) => !f.when || f.when(w));
    nb.innerHTML = `<header><h2>实验记录本</h2><span>${esc(L.title)} · ${esc(c.label)}</span><button class="btn" data-x style="margin-left:auto;background:#2b3a52;color:#fff;border-color:#2b3a52;height:30px">关闭 N</button></header>
    <div class="pages">
      <h3>实验目的</h3><p class="log" style="margin:0">${esc(L.aim || '')}</p>
      ${fields.length ? `<h3>需要你计算并填写</h3>${fields.map((f) => `<div class="rec"><label for="nf-${f.id}">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label><input id="nf-${f.id}" data-f="${f.id}" inputmode="decimal" autocomplete="off" value="${w.notes[f.id] != null ? esc(w.notes[f.id]) : ''}" placeholder="—"><em>${esc(f.unit || '')}</em></div>`).join('')}` : ''}
      ${(L.facts || []).length ? `<h3>已知条件</h3><div class="log">${L.facts.map((x) => `<div>· ${esc(typeof x === 'function' ? x(w) : x)}</div>`).join('')}</div>` : ''}
      <h3>实验结果</h3>${results(w)}
      <h3>计算器</h3><div class="calc"><input id="nb-calc" placeholder="例如 7 * 5e4 / 4.8e5" autocomplete="off"><output id="nb-out"></output></div>
      <h3>操作记录</h3><div class="log" id="nb-log">${w.log.slice(-80).map((e) => `<div><span class="tm">${fmtT(w, e.t)}</span>${esc(e.text)}${e.n > 1 ? ` ×${e.n}` : ''}</div>`).join('') || '<div>还没有记录</div>'}</div>
    </div>`;
    nb.querySelector('[data-x]').addEventListener('click', N.close);
    nb.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('change', () => {
      const raw = inp.value.trim();
      let v = null;
      if (raw) { try { v = calc(raw); } catch (e) { v = null; } }
      if (v == null || !isFinite(v)) { inp.style.color = '#c0242c'; return; }
      inp.style.color = '';
      app.note(inp.dataset.f, v);
      inp.value = String(+v.toPrecision(6));
    }));
    const ci = nb.querySelector('#nb-calc'), co = nb.querySelector('#nb-out');
    ci.addEventListener('input', () => { try { const v = calc(ci.value); co.textContent = isFinite(v) ? `= ${+v.toPrecision(6)}` : ''; } catch (e) { co.textContent = ''; } });
    const lg = nb.querySelector('#nb-log'); lg.scrollTop = lg.scrollHeight;
  };
  return N;
}
