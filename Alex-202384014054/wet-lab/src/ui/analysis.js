// Alex 202384014054
// The analysis computer: normalise the two plate reads, fit four-parameter
// curves, compare IC50s, and choose a candidate and its target exposure.

import { items, log } from '../game/world.js';
import { analyse } from '../levels/common.js';
import { curve, mean } from '../sim/fit.js';
import { openPanel, closePanel } from './panels.js';
import { kbd } from './hud.js';
import { drugName } from '../data/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CW = 700, CH = 430;
const PAL = ['#8b84ff', '#4cc9d9'];
const X0 = -3.2, X1 = 1.5; // log10 µM
const Y0 = -15, Y1 = 130;

export const fmtIC = (uM) => (!isFinite(uM) ? '—' : uM >= 1 ? `${+uM.toPrecision(3)} µM` : `${+(uM * 1000).toPrecision(3)} nM`);
const plateOf = (w, tag) => items(w).find((it) => it.tag === tag);

// A fit belongs to the plate reads it was made from (their versions); after a
// new read it is stale until fitted again.
export function fitCurrent(A, reads) {
  return !!(A && A.vers && reads.M && reads.W && A.vers.M === reads.M.ver && A.vers.W === reads.W.ver);
}

export function analysisPanel(app) {
  const w = app.w, L = app.level, cfg = L.cfg;
  if (!cfg) { app.toast('hint', '这一关不需要分析软件'); return; }
  const { el, body } = openPanel({ title: '数据分析 · 剂量反应', sub: `扣除空白（第 11 列），按溶剂对照（第 2 列）归一化，log 浓度上做四参数 logistic 拟合。${cfg.lines[0]} 代表肿瘤，${cfg.lines[1]} 代表正常组织。`, w: 1260, y: 62, id: 'analysis' , os: { kind: 'pc', app: 'PlateMaster', ver: '5.0', icon: 'P', tint: '#d07a2c', pin: 'PlateMaster' } });
  const st = { cmpd: w.flags.decision?.cmpd ?? null, lg: Math.log10(w.flags.decision?.exposureNM ?? 100) };

  const reads = () => ({ M: w.reads[plateOf(w, 'plateM')?.id], W: w.reads[plateOf(w, 'plateW')?.id] });

  const fit = () => {
    const r = reads();
    if (!r.M || !r.W) return;
    const res = { M: analyse(r.M, cfg.cmpds), W: analyse(r.W, cfg.cmpds) };
    const fits = {};
    cfg.cmpds.forEach((c, k) => { fits[c] = { M: res.M.blocks[k].fit, W: res.W.blocks[k].fit }; });
    w.flags.analysis = { plates: res, fits, at: w.t, vers: { M: r.M.ver, W: r.W.ver } };
    w.flags.analysed = true;
    log(w, '四参数拟合剂量反应曲线');
    app.audio?.cue('ok');
    draw();
  };

  const predict = (c, line) => {
    const f = w.flags.analysis?.fits?.[c]?.[line];
    if (!f) return NaN;
    return Math.max(0, Math.min(100, 100 - curve(f, 10 ** st.lg / 1000)));
  };

  const submit = () => {
    if (!w.flags.analysis || !st.cmpd) return;
    if (!fitCurrent(w.flags.analysis, reads())) { app.toast('warn', '读板数据已经更新，这组拟合基于旧数据：请先重新拟合'); return; }
    const nm = 10 ** st.lg;
    w.flags.decision = { cmpd: st.cmpd, exposureNM: nm, predM: predict(st.cmpd, 'M'), predW: predict(st.cmpd, 'W') };
    log(w, `选定候选药 ${drugName(st.cmpd)}，目标暴露量 ${nm >= 1000 ? `${(nm / 1000).toPrecision(3)} µM` : `${nm.toPrecision(3)} nM`}`);
    app.toast('ok', `已提交：${drugName(st.cmpd)}，目标暴露量 ${fmtIC(nm / 1000)}`);
    closePanel();
  };

  function draw() {
    const r = reads();
    const A = w.flags.analysis;
    const ready = r.M && r.W;
    const stale = !!A && !fitCurrent(A, r);
    const plateLine = (tag, rd) => {
      const p = plateOf(w, tag);
      return `<div class="an-pl"><i style="background:${rd ? 'var(--ok)' : 'var(--faint)'}"></i><b>${esc(p?.label || tag)}</b><span>${rd ? `${rd.wl} nm${rd.rot ? ' · 放反了' : ''}` : '还没有读板'}</span></div>`;
    };
    body.innerHTML = `
      <div class="an-top">${plateLine('plateM', r.M)}${plateLine('plateW', r.W)}
        <button class="btn ${A ? '' : 'primary'}" data-fit ${ready ? '' : 'disabled'}>${A ? '' : kbd('⏎')}${A ? '重新拟合' : '拟合四参数曲线'}</button></div>
      <div class="an-grid">
        <div><canvas id="anv"></canvas><div class="an-legend">${cfg.cmpds.map((c, k) => `<span><i style="background:${PAL[k]}"></i>${esc(drugName(c))} · ${esc(cfg.lines[0])}</span><span><i class="dash" style="border-color:${PAL[k]}"></i>${esc(c)} · ${esc(cfg.lines[1])}</span>`).join('')}</div></div>
        <div class="an-side">${A ? (stale ? '<p class="hint warn">读板数据已经更新，下面的曲线和 IC50 来自上一次读板。请重新拟合后再提交。</p>' : '') + table(A) + decide(A) : `<p class="an-empty">${ready ? '两块板都读好了。拟合后这里会列出每条曲线的 IC50、Hill 系数和 R²，以及每块板的 Z′ 和复孔 CV。' : '先在酶标仪上读两块板（450 nm），数据会自动传到这台电脑。'}</p>`}</div>
      </div>`;
    const cv = body.querySelector('#anv');
    chart(cv, app.scale, cfg, A, st);
    body.querySelector('[data-fit]')?.addEventListener('click', fit);
    body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { st.cmpd = b.dataset.c; draw(); }));
    const sl = body.querySelector('#anx');
    if (sl) sl.addEventListener('input', () => { st.lg = +sl.value; refresh(); });
    body.querySelector('[data-submit]')?.addEventListener('click', submit);
  }

  // Cheap update while dragging the exposure slider.
  function refresh() {
    const out = body.querySelector('#anpred');
    if (out) out.innerHTML = predHTML();
    chart(body.querySelector('#anv'), app.scale, cfg, w.flags.analysis, st);
  }

  function table(A) {
    const row = (c, k, line, lk) => {
      const f = A.fits[c][lk];
      const out = !isFinite(f.ic50) || f.beyond;
      return `<tr><td><i class="sw ${lk === 'W' ? 'dash' : ''}" style="${lk === 'W' ? `border-color:${PAL[k]}` : `background:${PAL[k]}`}"></i>${esc(drugName(c))}</td><td>${esc(line)}</td><td class="n">${out ? `<span title="IC50 超出测试浓度范围" style="color:var(--warn)">${f.ic50 > 1 ? '>10 µM' : fmtIC(f.ic50)}</span>` : fmtIC(f.ic50)}</td><td class="n">${isFinite(f.hill) ? f.hill.toFixed(2) : '—'}</td><td class="n">${isFinite(f.r2) ? f.r2.toFixed(3) : '—'}</td></tr>`;
    };
    const qc = (lk, line) => { const p = A.plates[lk]; return `<tr><td colspan="2">${esc(line)} 板</td><td class="n">${p.z.toFixed(2)}</td><td class="n">${p.vehicle.toFixed(2)}</td><td class="n">${mean(p.blocks.map((b) => b.meanCV)).toFixed(1)}%</td></tr>`; };
    return `<table class="an-t"><thead><tr><th>化合物</th><th>细胞</th><th>IC50</th><th>Hill</th><th>R²</th></tr></thead><tbody>${cfg.cmpds.map((c, k) => row(c, k, cfg.lines[0], 'M') + row(c, k, cfg.lines[1], 'W')).join('')}</tbody></table>
      <table class="an-t"><thead><tr><th colspan="2">质控</th><th>Z′</th><th>对照 OD</th><th>复孔 CV</th></tr></thead><tbody>${qc('M', cfg.lines[0])}${qc('W', cfg.lines[1])}</tbody></table>`;
  }

  function predHTML() {
    if (!st.cmpd) return '<span>先选一个候选药</span>';
    const pm = predict(st.cmpd, 'M'), pw = predict(st.cmpd, 'W');
    return `<span>目标暴露量 <b class="num">${fmtIC(10 ** st.lg / 1000)}</b></span><span>按你的曲线预测：肿瘤（${esc(cfg.lines[0])}）抑制 <b class="num">${isFinite(pm) ? pm.toFixed(0) : '—'}%</b>，正常组织（${esc(cfg.lines[1])}）抑制 <b class="num" style="color:${pw > 50 ? 'var(--err)' : pw > 30 ? 'var(--warn)' : 'inherit'}">${isFinite(pw) ? pw.toFixed(0) : '—'}%</b></span>`;
  }

  function decide() {
    const stale = !fitCurrent(w.flags.analysis, reads());
    return `<div class="an-dec"><h3>候选药与目标暴露量</h3>
      <p>肿瘤抑制越深，缓解越深、越持久；正常组织（皮肤、肠道上皮）被抑制超过约一半时，3 级皮疹或腹泻就很常见，需要减量甚至停药。</p>
      <div class="an-ch">${cfg.cmpds.map((c, k) => `<button class="btn ${st.cmpd === c ? 'on' : ''}" data-c="${esc(c)}">${kbd(String(k + 1))}${esc(drugName(c))}</button>`).join('')}</div>
      <div class="field"><label for="anx">目标稳态血药浓度（游离药，对数刻度）${kbd('←')}${kbd('→')}</label><input id="anx" type="range" min="0" max="4" step="0.01" value="${st.lg}"></div>
      <div class="an-pred" id="anpred">${predHTML()}</div>
      <button class="btn primary" data-submit ${st.cmpd && !stale ? '' : 'disabled'}>${kbd('⏎')}提交给临床团队</button></div>`;
  }

  el._key = (e) => {
    const A = w.flags.analysis;
    if (e.key === 'Enter') { if (!A || !fitCurrent(A, reads())) fit(); else if (st.cmpd) submit(); return true; }
    if (A && (e.key === '1' || e.key === '2')) { st.cmpd = cfg.cmpds[+e.key - 1]; draw(); return true; }
    if (A && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      st.lg = Math.max(0, Math.min(4, st.lg + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.02)));
      const sl = body.querySelector('#anx'); if (sl) sl.value = st.lg;
      refresh();
      return true;
    }
    return false;
  };
  draw();
}

function chart(cv, scale, cfg, A, st) {
  if (!cv) return;
  const k = (window.devicePixelRatio || 1) * scale;
  if (cv.width !== Math.round(CW * k)) { cv.width = Math.round(CW * k); cv.height = Math.round(CH * k); cv.style.width = `${CW}px`; cv.style.height = `${CH}px`; }
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);
  const pad = { l: 56, r: 18, t: 18, b: 44 };
  const W = CW - pad.l - pad.r, H = CH - pad.t - pad.b;
  const X = (lg) => pad.l + ((lg - X0) / (X1 - X0)) * W;
  const Y = (v) => pad.t + (1 - (v - Y0) / (Y1 - Y0)) * H;
  g.fillStyle = '#0d1218'; g.fillRect(0, 0, CW, CH);
  g.font = '500 11px "SF Pro Display",-apple-system,"PingFang SC",sans-serif';
  // grid
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  for (let d = -3; d <= 1; d++) for (let m = 1; m < 10; m++) {
    const lg = d + Math.log10(m);
    if (lg < X0 || lg > X1) continue;
    g.globalAlpha = m === 1 ? 1 : 0.45;
    g.beginPath(); g.moveTo(X(lg) + 0.5, pad.t); g.lineTo(X(lg) + 0.5, pad.t + H); g.stroke();
  }
  g.globalAlpha = 1;
  for (let v = 0; v <= 125; v += 25) { g.beginPath(); g.moveTo(pad.l, Y(v) + 0.5); g.lineTo(pad.l + W, Y(v) + 0.5); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.moveTo(pad.l, Y(0) + 0.5); g.lineTo(pad.l + W, Y(0) + 0.5); g.stroke();
  // labels
  g.fillStyle = '#7f8896'; g.textAlign = 'center';
  [[-3, '1 nM'], [-2, '10 nM'], [-1, '100 nM'], [0, '1 µM'], [1, '10 µM']].forEach(([lg, s]) => g.fillText(s, X(lg), pad.t + H + 18));
  g.fillText('浓度（终浓度，对数刻度）', pad.l + W / 2, CH - 6);
  g.textAlign = 'right';
  for (let v = 0; v <= 125; v += 25) g.fillText(`${v}`, pad.l - 8, Y(v) + 4);
  g.save(); g.translate(14, pad.t + H / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('活力（% 溶剂对照）', 0, 0); g.restore();
  // exposure marker
  if (A && st.cmpd) {
    const x = X(st.lg - 3);
    g.fillStyle = 'rgba(139,132,255,.08)'; g.fillRect(x - 3, pad.t, 6, H);
    g.strokeStyle = '#8b84ff'; g.setLineDash([5, 4]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + H); g.stroke(); g.setLineDash([]);
  }
  if (!A) {
    g.fillStyle = '#4a5361'; g.textAlign = 'center'; g.font = '500 14px "PingFang SC",-apple-system,sans-serif';
    g.fillText('拟合后显示剂量反应曲线', pad.l + W / 2, pad.t + H / 2);
    return;
  }
  g.save();
  g.beginPath(); g.rect(pad.l, pad.t, W, H); g.clip();
  cfg.cmpds.forEach((c, k) => {
    for (const lk of ['W', 'M']) {
      const p = A.plates[lk], b = p.blocks[k], f = b.fit;
      const col = PAL[k];
      // curve
      g.strokeStyle = col; g.lineWidth = lk === 'M' ? 2.4 : 1.8; g.setLineDash(lk === 'W' ? [7, 5] : []);
      g.globalAlpha = st.cmpd && st.cmpd !== c ? 0.3 : 1;
      if (isFinite(f.ic50)) {
        g.beginPath();
        for (let i = 0; i <= 160; i++) { const lg = X0 + ((X1 - X0) * i) / 160; const y = curve(f, 10 ** lg); i ? g.lineTo(X(lg), Y(y)) : g.moveTo(X(lg), Y(y)); }
        g.stroke();
      }
      g.setLineDash([]);
      // points: mean ± SD
      for (const r of b.reps) {
        const x = X(Math.log10(r.c)), sdv = Math.sqrt(r.ys.reduce((s, y) => s + (y - r.m) ** 2, 0) / Math.max(1, r.ys.length - 1));
        g.strokeStyle = col; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, Y(r.m - sdv)); g.lineTo(x, Y(r.m + sdv)); g.moveTo(x - 4, Y(r.m - sdv)); g.lineTo(x + 4, Y(r.m - sdv)); g.moveTo(x - 4, Y(r.m + sdv)); g.lineTo(x + 4, Y(r.m + sdv)); g.stroke();
        g.beginPath(); g.arc(x, Y(r.m), lk === 'M' ? 4.2 : 3.8, 0, Math.PI * 2);
        if (lk === 'M') { g.fillStyle = col; g.fill(); } else { g.fillStyle = '#0d1218'; g.fill(); g.lineWidth = 1.6; g.stroke(); }
      }
      g.globalAlpha = 1;
    }
  });
  g.restore();
}

export { closePanel };
