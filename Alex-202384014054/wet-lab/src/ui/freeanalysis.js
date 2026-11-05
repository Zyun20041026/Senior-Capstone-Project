// Alex 202384014054
// Free dose-response analysis for the open modes. Every plate read is a
// numbered version (R#). The player declares, per version, the cell line and
// which compound is in the upper (B–D) and lower (E–G) block of the standard
// plate map; fits are grouped by line and compound. Each fitted plate goes to
// the evidence ledger with the declaration next to what was really there.

import { openPanel, closePanel } from './panels.js';
import { kbd } from './hud.js';
import { analyse } from '../levels/common.js';
import { curve } from '../sim/fit.js';
import { LINES } from '../sim/cells.js';
import { COMPOUNDS } from '../sim/pharm.js';
import { record, plateTruth } from '../modes/ledger.js';
import { fmtIC } from './analysis.js';
import { wellIndex } from '../sim/plate.js';
import { autoLayout } from '../sim/layout.js';
import { drugName } from '../data/index.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LINE_IDS = Object.keys(LINES);
const CMPDS = ['', ...Object.keys(COMPOUNDS)];
const NORMAL = ['BEAS-2B', 'A431'];
const TUMOUR = LINE_IDS.filter((l) => !NORMAL.includes(l));
const COL = { 'PC-9': '#8b84ff', H1975: '#ff8a6a', 'PC-9-T790M': '#ffc857', A431: '#4cc9d9', 'BEAS-2B': '#7fe0c4', HCC827: '#b29cff', H3255: '#f59ad3', A549: '#a3b1bf', 'HCC827-GR': '#ff6b9a', 'PC-9-T790M-C797S': '#ffe08a', 'PC-9-EGFR-KO': '#6c7a89' };
// the normal-tissue reference: bronchial epithelium if measured, else A431
const refFit = (st, c) => NORMAL.map((l) => st.fits[`${l}|${c}`]).find(Boolean) || null;
const CW = 640, CH = 380, X0 = -3.2, X1 = 1.5, Y0 = -15, Y1 = 130;
const rowsOf = (b) => (b === 0 ? [1, 2, 3] : [4, 5, 6]).flatMap((r) => [2, 3, 4, 5, 6, 7, 8, 9].map((c) => wellIndex(r, c)));

// Fit every declared, not yet fitted plate; each becomes a ledger entry.
export function fitPlates(w, st) {
  const snapOf = (id) => (w.readLog || []).find((v) => v.id === id);
  for (const p of st.plates.filter((x) => !x.ev)) {
    const sn = snapOf(p.ver), cm = [p.up || null, p.low || null];
    const A = analyse(sn, cm.map((c) => c || '—'));
    const fits = [];
    cm.forEach((c, b) => { if (!c) return; const f = A.blocks[b].fit; fits.push({ line: p.line, cmpd: c, ic50: f.ic50, hill: f.hill, top: f.top, bottom: f.bottom, r2: f.r2, beyond: !!f.beyond, reps: A.blocks[b].reps }); });
    const truth = plateTruth(sn, [0, 1].filter((b) => cm[b]).flatMap(rowsOf));
    const e = record(w, 'screen', { title: `${p.ver} 药敏拟合 · ${p.line} · ${cm.filter(Boolean).join(' / ')}`, declared: { line: p.line, cmpds: cm.filter(Boolean) }, actual: { lines: truth.lines, cmpds: truth.cmpds }, result: { ver: p.ver, z: A.z, fits: fits.map(({ reps, ...f }) => f) }, refs: { read: p.ver, plate: sn.plateId } });
    p.ev = e?.id || 'local';
    p.mismatch = e?.mismatch || null;
    for (const f of fits) st.fits[`${f.line}|${f.cmpd}`] = { ...f, ev: p.ev, ver: p.ver };
  }
  w.flags.analysed = true;
}

export function freeAnalysisPanel(app) {
  const w = app.w;
  const vers = () => w.readLog || [];
  const st = (w.flags.freeAn ||= { ver: null, line: null, up: 'gefitinib', low: '', plates: [], fits: {}, cmpd: null, lg: 2 });
  const { el, body } = openPanel({ title: '数据分析 · 自由模式', sub: '标准板图：第 11 列空白、第 2 列溶剂对照，B–D 行与 E–G 行各一个化合物，第 3–10 列从 10 µM 起 3 倍稀释。每次读板都是一个版本，先声明它是什么，再拟合。', w: 1300, y: 56, id: 'analysis' , os: { kind: 'pc', app: 'PlateMaster', ver: '5.0', icon: 'P', tint: '#d07a2c', pin: 'PlateMaster' } });
  el.classList.add('fa');
  if (!st.ver && vers().length) st.ver = vers().at(-1).id;
  const snapOf = (id) => vers().find((v) => v.id === id);
  if (!st.line) st.line = snapOf(st.ver)?.declaredLine || 'PC-9';

  const add = () => {
    const sn = snapOf(st.ver);
    if (!sn) { app.toast('warn', '还没有读板数据'); return; }
    if (st.plates.some((p) => p.ver === st.ver)) { app.toast('warn', `${st.ver} 已经加入了：同一次读板不能当两块板用`); return; }
    if (!st.up && !st.low) { app.toast('warn', '至少声明一个化合物'); return; }
    st.plates.push({ ver: st.ver, line: st.line, up: st.up, low: st.low });
  };
  // Free layouts: read what is in each well, fit every single-drug series and
  // score every two-drug matrix against Bliss independence.
  const auto = () => {
    const sn = snapOf(st.ver);
    if (!sn) { app.toast('warn', '还没有读板数据'); return; }
    const L = autoLayout(sn);
    st.auto = { ver: st.ver, L, m: 0 };
    if (!L.series.length && !L.matrices.length) { app.toast('warn', `${st.ver} 上没有找到剂量系列：每个细胞系需要不加药的对照孔，单药至少 4 个浓度`); return; }
    const done = (st.autoDone ||= {});
    for (const x of L.series.filter((x) => x.fit)) {
      const key = `${st.ver}|${x.line}|${x.cmpd}`; if (done[key]) continue;
      const f = { line: x.line, cmpd: x.cmpd, ic50: x.fit.ic50, hill: x.fit.hill, top: x.fit.top, bottom: x.fit.bottom, r2: x.fit.r2, beyond: !!x.fit.beyond };
      const truth = plateTruth(sn, x.wells);
      const e = record(w, 'screen', { title: `${st.ver} 自由布局拟合 · ${x.line} · ${x.cmpd}`, declared: { line: x.line, cmpds: [x.cmpd] }, actual: { lines: truth.lines, cmpds: truth.cmpds }, result: { ver: st.ver, auto: true, fits: [f] }, refs: { read: st.ver, plate: sn.plateId } });
      done[key] = e?.id || 'local';
      st.fits[`${x.line}|${x.cmpd}`] = { ...f, reps: x.reps, ev: done[key], ver: st.ver };
    }
    for (const m of L.matrices) {
      const key = `${st.ver}|${m.line}|${m.a}+${m.b}`; if (done[key] || m.max == null) continue;
      const e = record(w, 'screen', { title: `${st.ver} 联合用药 · ${m.line} · ${m.a} + ${m.b}：Bliss 超额最高 ${(100 * m.max).toFixed(0)}%`, declared: { line: m.line, cmpds: [m.a, m.b] }, actual: plateTruth(sn, m.wells), result: { ver: st.ver, auto: true, fits: [], bliss: { a: m.a, b: m.b, mean: m.mean, max: m.max } }, refs: { read: st.ver, plate: sn.plateId } });
      done[key] = e?.id || 'local';
    }
    w.flags.analysed = true;
    app.audio?.cue?.('ok');
  };
  const fit = () => {
    if (!st.plates.length) { app.toast('warn', '先加入要拟合的读板'); return; }
    fitPlates(w, st);
    app.audio?.cue?.('ok');
  };
  const choose = () => {
    if (!st.cmpd) { app.toast('warn', '先选一个化合物'); return; }
    const tum = TUMOUR.map((l) => st.fits[`${l}|${st.cmpd}`]).filter(Boolean);
    if (!tum.length) { app.toast('warn', `还没有 ${drugName(st.cmpd)} 在肿瘤细胞上的拟合，不能据此定剂量`); return; }
    const nM = 10 ** st.lg;
    const evs = [...tum.map((f) => f.ev), refFit(st, st.cmpd)?.ev].filter((x) => x && x !== 'local');
    w.flags.freeDecision = { cmpd: st.cmpd, nM: +nM.toPrecision(3), ev: [...new Set(evs)] };
    app.toast('ok', `已记下：${drugName(st.cmpd)}，目标暴露量 ${fmtIC(nM / 1000)}${w.case ? '（在病例看板开处方时默认使用）' : ''}`);
  };
  const render = () => {
    const sn = snapOf(st.ver);
    const groups = Object.values(st.fits);
    const cm = [...new Set(groups.map((f) => f.cmpd))];
    const lines = [...new Set(groups.map((f) => f.line))];
    const gaps = cm.filter((c) => lines.some((l) => !st.fits[`${l}|${c}`]));
    const tum = st.cmpd ? TUMOUR.map((l) => st.fits[`${l}|${st.cmpd}`]).filter(Boolean) : [];
    const ref = st.cmpd ? refFit(st, st.cmpd) : null;
    const nM = 10 ** st.lg;
    const inh = (f) => (f ? Math.max(0, Math.min(100, 100 - curve(f, nM / 1000))) : NaN);
    body.innerHTML = `<div class="fa-grid"><div>
      <h3>声明读板</h3>
      ${vers().length ? `<div class="fa-row"><span>读板版本 ${kbd(',')}${kbd('.')}</span>${vers().slice(-8).map((v) => `<button class="chip" data-v="${v.id}" aria-pressed="${v.id === st.ver}">${v.id} · ${esc(v.label)}</button>`).join('')}</div>
      ${sn ? `<p class="hint">${esc(sn.label)} · ${sn.wl} nm · 读于第 ${Math.floor(sn.t / 1440) + 1} 天${sn.rot ? ' · 板放反了' : ''}</p>` : ''}
      <div class="fa-row"><span>细胞 ${kbd('L')}</span>${LINE_IDS.map((l) => `<button class="chip" data-l="${l}" aria-pressed="${st.line === l}">${l}</button>`).join('')}</div>
      <div class="fa-row"><span>B–D 行 ${kbd('Q')}</span>${CMPDS.map((c) => `<button class="chip" data-up="${c}" aria-pressed="${st.up === c}">${c ? drugName(c) : '无'}</button>`).join('')}</div>
      <div class="fa-row"><span>E–G 行 ${kbd('A')}</span>${CMPDS.map((c) => `<button class="chip" data-low="${c}" aria-pressed="${st.low === c}">${c ? drugName(c) : '无'}</button>`).join('')}</div>
      <div class="fa-row"><button class="btn" data-a="add">${kbd('⏎')}加入这块板</button><button class="btn primary" data-a="fit">${kbd('F')}拟合</button><button class="btn" data-a="auto">${kbd('T')}自由布局：自动识别</button></div>`
      : '<p class="hint">还没有读板数据。在酶标仪上读一块板后再来。</p>'}
      <div class="fa-plates">${st.plates.map((p, i) => `<div class="fa-p${p.mismatch ? ' bad' : ''}"><b>${p.ver}</b> ${esc(p.line)} · ${p.up || '—'} / ${p.low || '—'} ${p.ev ? `<span class="ok">已拟合 ${p.ev}</span>` : '<span>待拟合</span>'}${p.mismatch ? `<em>${esc(p.mismatch.join('；'))}</em>` : ''}${p.ev ? '' : ` <button class="chip" data-rm="${i}">移除</button>`}</div>`).join('')}</div>
      ${groups.length ? `<table class="an-t"><thead><tr><th>化合物</th><th>细胞</th><th>IC50</th><th>Hill</th><th>R²</th><th>来源</th></tr></thead><tbody>${groups.map((f) => `<tr><td>${drugName(f.cmpd)}</td><td>${f.line}</td><td class="n">${!isFinite(f.ic50) || f.beyond ? `<span style="color:var(--warn)">${f.ic50 > 1 ? '>10 µM' : fmtIC(f.ic50)}</span>` : fmtIC(f.ic50)}</td><td class="n">${isFinite(f.hill) ? f.hill.toFixed(2) : '—'}</td><td class="n">${isFinite(f.r2) ? f.r2.toFixed(3) : '—'}</td><td class="n">${f.ver} / ${f.ev}</td></tr>`).join('')}</tbody></table>` : ''}
      ${gaps.length ? `<p class="hint warn">${gaps.map((c) => `${drugName(c)} 只在 ${lines.filter((l) => st.fits[`${l}|${c}`]).join('、')} 上测过`).join('；')}：不同细胞之间无法直接比较这些化合物。</p>` : ''}
    </div><div>
      <canvas id="fac"></canvas>
      <h3>选择候选药与暴露量</h3>
      <div class="fa-row">${cm.map((c, i) => `<button class="chip" data-c="${c}" aria-pressed="${st.cmpd === c}">${kbd(String(i + 1))}${drugName(c)}</button>`).join('') || '<span class="hint">拟合后可选</span>'}</div>
      ${st.cmpd ? `<div class="fa-row"><span>暴露量 ${kbd('←')}${kbd('→')}</span><b class="num">${fmtIC(nM / 1000)}</b></div>
        ${tum.length ? tum.map((f) => `<p class="hint">肿瘤（${f.line}）预计抑制 <b class="num">${inh(f).toFixed(0)}%</b></p>`).join('') : `<p class="hint warn">还没有 ${drugName(st.cmpd)} 在任何肿瘤细胞上的拟合，不能据此定剂量。</p>`}
        ${ref ? `<p class="hint">正常组织（${ref.line}）预计抑制 <b class="num" style="color:${inh(ref) > 50 ? 'var(--err)' : inh(ref) > 30 ? 'var(--warn)' : 'inherit'}">${inh(ref).toFixed(0)}%</b></p>` : '<p class="hint warn">缺少正常组织参照（BEAS-2B 或 A431），无法评估毒性窗口。</p>'}
        <button class="btn primary" data-a="pick" ${tum.length ? '' : 'disabled'}>${kbd('D')}记下这个选择</button>` : ''}
      ${st.auto ? autoHtml(st) : ''}
    </div></div>`;
    draw(body.querySelector('#fac'), app.scale, st);
    if (st.auto) { drawMap(body.querySelector('#fam'), app.scale, st.auto.L); drawBliss(body.querySelector('#fab'), app.scale, st.auto.L.matrices[st.auto.m]); }
  };
  const cyc = (arr, v, d = 1) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
  body.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.v) { st.ver = d.v; st.line = snapOf(d.v)?.declaredLine || st.line; }
    else if (d.l) st.line = d.l; else if (d.up != null) st.up = d.up; else if (d.low != null) st.low = d.low;
    else if (d.c) st.cmpd = d.c; else if (d.rm != null) st.plates.splice(+d.rm, 1);
    else if (d.a === 'add') add(); else if (d.a === 'fit') fit(); else if (d.a === 'pick') choose(); else if (d.a === 'auto') auto();
    else if (d.mx != null && st.auto) st.auto.m = +d.mx;
    render();
  });
  el._key = (e) => {
    const c = e.code, ids = vers().map((v) => v.id), cm = [...new Set(Object.values(st.fits).map((f) => f.cmpd))];
    if (c === 'Comma' || c === 'Period') { if (ids.length) st.ver = cyc(ids, st.ver, c === 'Comma' ? -1 : 1); }
    else if (c === 'KeyL') st.line = cyc(LINE_IDS, st.line);
    else if (c === 'KeyQ') st.up = cyc(CMPDS, st.up);
    else if (c === 'KeyA') st.low = cyc(CMPDS, st.low);
    else if (c === 'Enter') add(); else if (c === 'KeyF') fit(); else if (c === 'KeyD') choose(); else if (c === 'KeyT') auto();
    else if (c === 'KeyB' && st.auto?.L.matrices.length) st.auto.m = (st.auto.m + 1) % st.auto.L.matrices.length;
    else if (/^Digit[1-9]$/.test(c) && cm[+c.slice(5) - 1]) st.cmpd = cm[+c.slice(5) - 1];
    else if (c === 'ArrowLeft') st.lg = Math.max(0, st.lg - (e.shiftKey ? 0.25 : 0.05));
    else if (c === 'ArrowRight') st.lg = Math.min(4, st.lg + (e.shiftKey ? 0.25 : 0.05));
    else return false;
    render(); return true;
  };
  render();
}

// one colour per well group (line × drugs), so a single-line plate still reads
const GPAL = ['#8b84ff', '#46d39a', '#ff8a6a', '#ffc857', '#4cc9d9', '#e46fb0', '#b9c6d3', '#f5a65b', '#7fe0c4', '#c79bff'];
const gcol = (L, key) => GPAL[L.groups.findIndex((g) => g.key === key) % GPAL.length];
function autoHtml(st) {
  const L = st.auto.L, m = L.matrices[st.auto.m];
  const legend = L.groups.map((g) => `<span class="fa-lg"><i style="background:${gcol(L, g.key)}"></i>${esc(g.line)} · ${g.drugs.length ? esc(g.drugs.map(drugName).join(' + ')) : '无药对照'} · ${g.wells.length} 孔${g.mixed ? ' <em>混有其他细胞</em>' : ''}</span>`).join('');
  return `<div class="fa-auto"><h3>${st.auto.ver} 自由布局</h3>
    <div class="fa-autog"><canvas id="fam"></canvas><div class="fa-lgs"><span class="fa-lg"><i style="background:#e6edf3;opacity:.5"></i>空白 · ${L.nBlank} 孔</span>${legend}</div></div>
    ${L.series.map((x) => `<p class="hint">${esc(x.line)} · ${x.cmpd}：${x.reps.length} 个浓度${x.fit ? `，IC50 <b class="num">${fmtIC(x.fit.ic50)}</b>，R² ${x.fit.r2.toFixed(3)}` : '，不足 4 个浓度，无法拟合'}</p>`).join('')}
    ${!L.nBlank ? '<p class="hint warn">没有空白孔（只加培养基和 CCK-8）：背景按 0 计算。</p>' : ''}
    ${L.groups.some((g) => !L.veh[g.line]) ? `<p class="hint warn">${[...new Set(L.groups.filter((g) => !L.veh[g.line]).map((g) => g.line))].join('、')} 没有不加药的对照孔，无法归一化。</p>` : ''}
    ${L.matrices.length ? `<h3>联合用药 · Bliss 独立模型 ${L.matrices.length > 1 ? kbd('B') : ''}</h3><div class="fa-row">${L.matrices.map((x, i) => `<button class="chip" data-mx="${i}" aria-pressed="${i === st.auto.m}">${esc(x.line)} · ${x.a} + ${x.b}</button>`).join('')}</div>
      <canvas id="fab"></canvas>
      <p class="hint">格内数字：实测抑制率 − Bliss 预期抑制率。绿色为协同（比两药独立作用更强），红色为拮抗。${m?.missing.length ? `<b class="warn">缺少 ${m.missing.join('、')} 的单药系列，无法算预期值。</b>` : m?.max != null ? `最高超额 <b class="num">${(100 * m.max).toFixed(0)}%</b>${m.max > 0.15 ? '：明显协同。' : m.max < 0.05 ? '：接近相加。' : '。'}` : ''}</p>` : ''}
  </div>`;
}
function drawMap(cv, scale, L) {
  if (!cv) return;
  const W = 290, H = 196, k = (window.devicePixelRatio || 1) * scale;
  cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = '#0d1218'; g.fillRect(0, 0, W, H);
  g.font = '500 9px -apple-system,sans-serif'; g.fillStyle = '#5d6673'; g.textAlign = 'center';
  for (let c = 0; c < 12; c++) g.fillText(String(c + 1), 24 + c * 23, 11);
  g.textAlign = 'right'; for (let r = 0; r < 8; r++) g.fillText('ABCDEFGH'[r], 12, 26 + r * 23);
  const grp = Object.fromEntries(L.groups.map((x) => [x.key, x]));
  L.map.forEach((key, i) => {
    const r = Math.floor(i / 12), c = i % 12, x = 24 + c * 23, y = 23 + r * 23;
    g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2);
    if (!key) { g.strokeStyle = '#2a323d'; g.stroke(); return; }
    if (key === 'blank') { g.fillStyle = 'rgba(230,237,243,.5)'; g.fill(); return; }
    const G = grp[key]; g.fillStyle = gcol(L, key); g.fill();
    if (G.drugs.length === 2) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); }
  });
}
function drawBliss(cv, scale, m) {
  if (!cv || !m) return;
  const cw = 54, ch = 30, l = 70, t = 26, W = l + cw * m.cB.length + 10, H = t + ch * m.cA.length + 26, k = (window.devicePixelRatio || 1) * scale;
  cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = '#0d1218'; g.fillRect(0, 0, W, H);
  g.font = '500 10px -apple-system,"PingFang SC",sans-serif'; g.fillStyle = '#7f8896'; g.textAlign = 'center';
  m.cB.forEach((c, j) => g.fillText(fmtIC(c), l + cw * j + cw / 2, t - 8));
  g.fillText(`${m.b} →`, l + (cw * m.cB.length) / 2, H - 8);
  g.textAlign = 'right'; m.cA.forEach((c, i) => g.fillText(fmtIC(c), l - 6, t + ch * i + ch / 2 + 4));
  g.save(); g.translate(12, t + (ch * m.cA.length) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(`${m.a} →`, 0, 0); g.restore();
  g.textAlign = 'center'; g.font = '600 11px "SF Mono",ui-monospace,monospace';
  m.grid.forEach((row, i) => row.forEach((x, j) => {
    const X = l + cw * j, Y = t + ch * i;
    if (!x) { g.strokeStyle = '#222a33'; g.strokeRect(X + 1.5, Y + 1.5, cw - 3, ch - 3); return; }
    const e = x.excess ?? 0, a = Math.min(1, Math.abs(e) / 0.5);
    g.fillStyle = x.excess == null ? '#1c232c' : e >= 0 ? `rgba(70,211,154,${0.15 + 0.75 * a})` : `rgba(255,107,107,${0.15 + 0.75 * a})`;
    g.fillRect(X + 1, Y + 1, cw - 2, ch - 2);
    g.fillStyle = a > 0.55 ? '#06110c' : '#dfe6ee';
    g.fillText(x.excess == null ? '—' : `${e >= 0 ? '+' : ''}${(100 * e).toFixed(0)}`, X + cw / 2, Y + ch / 2 + 4);
  }));
}

function draw(cv, scale, st) {
  if (!cv) return;
  const k = (window.devicePixelRatio || 1) * scale;
  cv.width = Math.round(CW * k); cv.height = Math.round(CH * k); cv.style.width = `${CW}px`; cv.style.height = `${CH}px`;
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  const pad = { l: 50, r: 14, t: 14, b: 38 }, W = CW - pad.l - pad.r, H = CH - pad.t - pad.b;
  const X = (lg) => pad.l + ((lg - X0) / (X1 - X0)) * W, Y = (v) => pad.t + (1 - (v - Y0) / (Y1 - Y0)) * H;
  g.fillStyle = '#0d1218'; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#7f8896'; g.font = '500 11px "SF Pro Display",-apple-system,"PingFang SC",sans-serif'; g.textAlign = 'center';
  [[-3, '1 nM'], [-2, '10 nM'], [-1, '100 nM'], [0, '1 µM'], [1, '10 µM']].forEach(([lg, s]) => { g.beginPath(); g.moveTo(X(lg) + 0.5, pad.t); g.lineTo(X(lg) + 0.5, pad.t + H); g.stroke(); g.fillText(s, X(lg), pad.t + H + 18); });
  g.textAlign = 'right'; for (let v = 0; v <= 125; v += 25) { g.beginPath(); g.moveTo(pad.l, Y(v) + 0.5); g.lineTo(pad.l + W, Y(v) + 0.5); g.stroke(); g.fillText(`${v}`, pad.l - 6, Y(v) + 4); }
  const fits = Object.values(st.fits);
  if (!fits.length) { g.fillStyle = '#4a5361'; g.textAlign = 'center'; g.font = '500 14px "PingFang SC",-apple-system,sans-serif'; g.fillText('拟合后显示剂量反应曲线', pad.l + W / 2, pad.t + H / 2); return; }
  if (st.cmpd) { const x = X(st.lg - 3); g.strokeStyle = '#8b84ff'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + H); g.stroke(); g.setLineDash([]); }
  g.save(); g.beginPath(); g.rect(pad.l, pad.t, W, H); g.clip();
  for (const f of fits) {
    const col = COL[f.line] || '#ccc';
    g.globalAlpha = st.cmpd && st.cmpd !== f.cmpd ? 0.25 : 1;
    g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(NORMAL.includes(f.line) ? [7, 5] : []);
    if (isFinite(f.ic50)) { g.beginPath(); for (let i = 0; i <= 160; i++) { const lg = X0 + ((X1 - X0) * i) / 160; const y = curve(f, 10 ** lg); i ? g.lineTo(X(lg), Y(y)) : g.moveTo(X(lg), Y(y)); } g.stroke(); }
    g.setLineDash([]);
    for (const r of f.reps || []) { g.fillStyle = col; g.beginPath(); g.arc(X(Math.log10(r.c)), Y(r.m), 3.6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = col; g.textAlign = 'left';
  }
  g.globalAlpha = 1; g.restore();
  let ly = pad.t + 14; g.textAlign = 'left';
  for (const f of fits) { g.fillStyle = COL[f.line] || '#ccc'; g.fillText(`${drugName(f.cmpd)} · ${f.line}`, pad.l + W - 150, ly); ly += 15; }
}
export { closePanel };
