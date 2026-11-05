// Alex 202384014054
// The inverted microscope: an eyepiece-style field rendered in WebGL
// (scopegl.js) with real controls — objectives, coarse and fine focus, the
// stage, light, phase / bright field / GFP fluorescence, and a camera.
// The same view counts cells on a hemocytometer.

import * as A from '../game/actions.js';
import { log } from '../game/world.js';
import { LINES, counted } from '../sim/cells.js';
import { rng, hash } from '../sim/rng.js';
import { openPanel, closePanel } from './panels.js';
import { kbd } from './hud.js';
import { scopeGL } from './scopegl.js';
import { formazanOf } from '../view/art.js';
import { drugFactor } from '../sim/pharm.js';
import { drugsOf } from '../sim/liquid.js';

const VW = 700, VH = 620;
const OBJ = [
  { m: 4, fov: 3000, k: 0.07, col: '#d93a43', na: 0.13 },
  { m: 10, fov: 1150, k: 0.32, col: '#f2c94c', na: 0.25 },
  { m: 20, fov: 575, k: 0.9, col: '#2fa36b', na: 0.4 },
  { m: 40, fov: 290, k: 2.2, col: '#2f6fd6', na: 0.6 },
];
const MODES = ['相差', '明场', '荧光 GFP'];
const SQ_ORIGIN = [[0, 0], [2, 0], [0, 2], [2, 2]];

// Remembered between openings, like a real microscope left as it was.
export const scopeState = { obj: 1, mode: 0, light: 1, expo: 1.2, focus: 0 };

export function scopePanel(app) {
  const w = app.w;
  const it = A.scope(w);
  if (!it) { app.toast('hint', '显微镜载物台上没有东西：拿着培养瓶、孔板或计数板轻点显微镜的载物台'); return; }
  const hemo = it.type === 'hemo';
  if (hemo) {
    if (!w.hemo || w.hemo.id !== it.id) A.loadHemo(w, it);
    if (!w.hemo) { app.toast('hint', '计数板里没有样品：先用 P20 取 10 µL 混匀的细胞/台盼蓝混合液加到盖玻片边缘'); return; }
  }
  const S = scopeState;
  if (hemo) { S.mode = 1; if (S.obj > 1) S.obj = 1; }
  const r0 = rng(hash(`${it.id}:${Math.floor(w.t / 30)}`));
  const st = {
    x: hemo ? 0.5 : 0, y: hemo ? 0.5 : 0, // mm (stage centre)
    z0: (r0() - 0.5) * 50,               // where the specimen sits relative to the focus knob (µm)
    objOff: OBJ.map(() => (r0() - 0.5) * 6),
    well: 4 * 12 + 5, sq: 0, photo: null,
  };
  app.scopeStage = st;
  const title = hemo ? '显微镜 · 血球计数板' : `倒置荧光显微镜 · ${it.label}`;
  const { el, body } = openPanel({ title, sub: hemo ? '明场 10×。数四个角上的大方格：压上线和左线的算，压下线和右线的不算。活细胞透亮，死细胞被台盼蓝染成蓝色。' : '先对焦再判断。相差看形态和汇合度，荧光看 GFP 表达。', w: 1240, y: 46, id: hemo ? 'hemo' : 'scope' , os: { kind: 'pc', app: 'ScopeCam', ver: '1.8', icon: 'M', tint: '#4b6cb7' } });
  body.innerHTML = `
  <div class="scope">
    <div class="eye"><canvas class="gl"></canvas><canvas class="ov"></canvas><div class="cap" hidden></div></div>
    <div class="ctl">
      <div class="grp"><div class="lbl">观察方式 ${kbd('M')}</div><div class="seg" data-g="mode">${MODES.map((m, i) => `<button data-mode="${i}">${m}</button>`).join('')}</div></div>
      <div class="grp"><div class="lbl">物镜转盘 ${kbd('Q')}${kbd('E')}</div><div class="seg obj" data-g="obj">${OBJ.map((o, i) => `<button data-obj="${i}"><i style="background:${o.col}"></i>${o.m}×</button>`).join('')}</div></div>
      <div class="grp focus"><div class="lbl">对焦 ${kbd('↑')}${kbd('↓')} 粗调 · ${kbd('⇧')}+${kbd('↑')}${kbd('↓')} 细调</div>
        <div class="knob"><svg viewBox="-50 -50 100 100"><circle r="44" class="kr"/><g class="kt">${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="-44" x2="0" y2="${i % 6 ? -38 : -32}" transform="rotate(${i * 15})"/>`).join('')}</g><circle r="30" class="kc"/></svg><div class="fz num"></div></div></div>
      <div class="grp"><div class="lbl lightlbl">光强 ${kbd('[')}${kbd(']')}</div><div class="bar"><b></b></div></div>
      <div class="grp"><div class="lbl">载物台 ${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')}${hemo ? ` · 方格 ${kbd('1')}–${kbd('4')}` : it.wells ? ` · 换孔 ${kbd('←')}${kbd('→')}` : ''}</div><canvas class="map"></canvas><div class="where num"></div></div>
      ${hemo ? `<div class="grp tally"></div><button class="btn primary" data-rec>把计数记到记录本</button>` : `<button class="btn" data-shot>拍照存档 ${kbd('C')}</button>`}
    </div>
  </div>`;
  const glc = body.querySelector('.gl'), ov = body.querySelector('.ov');
  const k = Math.min(2, (window.devicePixelRatio || 1) * app.scale);
  for (const c of [glc, ov]) { c.width = Math.round(VW * k); c.height = Math.round(VH * k); c.style.width = `${VW}px`; c.style.height = `${VH}px`; }
  const map = body.querySelector('.map');
  map.width = Math.round(250 * k); map.height = Math.round(130 * k); map.style.width = '250px'; map.style.height = '130px';
  const R = scopeGL(glc);
  if (!R) { body.querySelector('.eye').innerHTML = '<p style="padding:40px;color:var(--muted)">这台电脑的浏览器不支持 WebGL2，无法显示显微镜图像。</p>'; return; }
  const octx = ov.getContext('2d');
  const buf = new Float32Array(8 * 24000);
  let cache = { key: null, n: 0 };
  const t0 = performance.now();

  const spec = () => specimenOf(w, it, st);

  function view() {
    const o = OBJ[S.obj];
    const ppm = (glc.height / o.fov) * 1000; // device px per mm
    return { o, ppm, cx: st.x, cy: st.y };
  }

  function build(t) {
    const v = view();
    const sp = spec();
    const blurOf = (z) => Math.min(60, Math.abs(S.focus - st.z0 - st.objOff[S.obj] - z) * v.o.k * k);
    const toPx = (X, Y) => [(X - v.cx) * v.ppm + glc.width / 2, (Y - v.cy) * v.ppm + glc.height / 2];
    let n = 0;
    const push = (X, Y, sizeUm, ang, kind, z, extra, seed) => {
      if (n >= 24000) return;
      const [px, py] = toPx(X, Y);
      const s = (sizeUm / 2000) * v.ppm; // sprite half-extent
      if (px < -s * 3 || py < -s * 3 || px > glc.width + s * 3 || py > glc.height + s * 3) return;
      buf.set([px, py, Math.max(0.8, s), ang, kind, blurOf(z), extra, seed], n * 8);
      n++;
    };
    const half = (v.o.fov / 1000) * 0.75;
    if (sp.hemo) {
      w.hemo.squares.forEach((cells, q) => {
        const [ox, oy] = SQ_ORIGIN[q];
        cells.forEach((c, i) => {
          const X = ox + c.x, Y = oy + c.y;
          if (Math.abs(X - v.cx) > half || Math.abs(Y - v.cy) > half) return;
          const stained = c.dead && sp.tb > 0;
          push(X, Y, c.r * 1000 * 0.62, c.a, stained ? 5 : 4, (c.k - 0.5) * 6, 0, i + q * 977);
        });
      });
      return n;
    }
    // adherent layer from a hashed grid so the field is stable as you move
    const bin = 0.06; // mm
    const bx0 = Math.floor((v.cx - half) / bin), bx1 = Math.floor((v.cx + half) / bin);
    const by0 = Math.floor((v.cy - half) / bin), by1 = Math.floor((v.cy + half) / bin);
    const per = 2.7 * sp.conf;
    for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) {
      if (sp.inside && !sp.inside((bx + 0.5) * bin, (by + 0.5) * bin)) continue;
      const hb = hash(`${sp.seed}:${bx}:${by}`);
      const r = rng(hb);
      const m = Math.floor(per + r());
      for (let j = 0; j < m; j++) {
        const X = (bx + r()) * bin, Y = (by + r()) * bin;
        const a = r() * Math.PI, sz = sp.size * (0.8 + r() * 0.5), u = r(), g = r();
        const seed = (hb % 1000) + j * 13.7;
        if (u < sp.dead) push(X, Y, sz * 0.38, a, 2, (r() - 0.5) * 3, sp.stain, seed);
        else if (u < sp.dead + sp.round) push(X, Y, sp.roundSize * (0.85 + r() * 0.3), a, 1, 2 + r() * 3, g < sp.gfp ? sp.gfpLevel * (0.5 + r()) : 0, seed);
        else push(X, Y, sz, a, 0, (r() - 0.5) * 3, g < sp.gfp ? sp.gfpLevel * (0.5 + r()) : 0, seed);
      }
    }
    // floating cells drift above the layer
    const nf = Math.round(sp.floating * 260 * Math.min(1, 1150 / v.o.fov));
    const rf = rng(hash(`${sp.seed}:float`));
    for (let i = 0; i < nf; i++) {
      const d = rf();
      const X = v.cx - half + ((rf() * 2 * half + t * 0.012 * (0.4 + d)) % (2 * half)), Y = v.cy - half + rf() * 2 * half + Math.sin(t * 0.7 + i) * 0.004;
      push(X, Y, sp.roundSize, 0, 1, 14 + d * 40, 0, i);
    }
    // bacteria jitter in Brownian motion
    const nb = Math.min(6000, Math.round(sp.bug * 900 * (v.o.fov < 600 ? 0.4 : 1)));
    const rb = rng(hash(`${sp.seed}:bug`));
    for (let i = 0; i < nb; i++) {
      const X = v.cx - half + rb() * 2 * half + Math.sin(t * 9 + i) * 0.0015, Y = v.cy - half + rb() * 2 * half + Math.cos(t * 8 + i * 1.3) * 0.0015;
      push(X, Y, 2.4, t * 3 + i, 3, (rb() - 0.5) * 10, 0, i);
    }
    return n;
  }

  function overlay() {
    const W = ov.width, H = ov.height, v = view();
    octx.clearRect(0, 0, W, H);
    // scale bar
    const um = v.o.fov > 2000 ? 500 : v.o.fov > 800 ? 200 : v.o.fov > 400 ? 100 : 50;
    const L = (um / 1000) * v.ppm;
    octx.fillStyle = 'rgba(255,255,255,.9)';
    octx.fillRect(W - 40 * k - L, H - 46 * k, L, 4 * k);
    octx.font = `600 ${13 * k}px -apple-system, "PingFang SC", sans-serif`; octx.textAlign = 'right';
    octx.fillText(`${um} µm`, W - 40 * k, H - 54 * k);
    octx.textAlign = 'left';
    octx.fillText(`${v.o.m}× · ${MODES[S.mode]}`, 34 * k, H - 40 * k);
    if (!w.hemo || !hemo) return;
    w.hemo.squares.forEach((cells, q) => {
      const [ox, oy] = SQ_ORIGIN[q];
      const marks = w.hemo.marks[q];
      cells.forEach((c, i) => {
        const m = marks[i];
        if (!m) return;
        const x = (ox + c.x - v.cx) * v.ppm + W / 2, y = (oy + c.y - v.cy) * v.ppm + H / 2, r = c.r * 0.62 * v.ppm;
        octx.lineWidth = 2.2 * k; octx.strokeStyle = m === 'live' ? '#21b36f' : '#3a63d8';
        octx.beginPath(); octx.arc(x, y, r + 5 * k, 0, Math.PI * 2); octx.stroke();
        octx.fillStyle = octx.strokeStyle; octx.font = `700 ${11 * k}px -apple-system, sans-serif`;
        octx.fillText(m === 'live' ? '活' : '死', x + r + 6 * k, y - r - 2 * k);
      });
    });
  }

  function drawMap() {
    const g = map.getContext('2d'), W = map.width, H = map.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, W, H);
    const sp = spec();
    const ext = sp.extent; // [x0, y0, x1, y1] mm
    const sc = Math.min((W - 16 * k) / (ext[2] - ext[0]), (H - 16 * k) / (ext[3] - ext[1]));
    const tx = (X) => 8 * k + (X - ext[0]) * sc, ty = (Y) => 8 * k + (Y - ext[1]) * sc;
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1 * k;
    if (sp.hemo) {
      for (let i = 0; i <= 3; i++) { g.beginPath(); g.moveTo(tx(i), ty(0)); g.lineTo(tx(i), ty(3)); g.stroke(); g.beginPath(); g.moveTo(tx(0), ty(i)); g.lineTo(tx(3), ty(i)); g.stroke(); }
      SQ_ORIGIN.forEach(([x, y], q) => { g.fillStyle = q === st.sq ? 'rgba(139,132,255,.35)' : 'rgba(139,132,255,.12)'; g.fillRect(tx(x), ty(y), sc, sc); });
    } else if (sp.wellR) { g.beginPath(); g.arc(tx(0), ty(0), sp.wellR * sc, 0, Math.PI * 2); g.stroke(); }
    else { g.strokeRect(tx(ext[0] + 0.5), ty(ext[1] + 0.5), (ext[2] - ext[0] - 1) * sc, (ext[3] - ext[1] - 1) * sc); }
    const v = view();
    g.strokeStyle = '#8b84ff'; g.lineWidth = 2 * k;
    g.beginPath(); g.arc(tx(st.x), ty(st.y), Math.max(3 * k, (v.o.fov / 2000) * sc), 0, Math.PI * 2); g.stroke();
    body.querySelector('.where').textContent = sp.hemo ? `第 ${st.sq + 1} 个角方格（${['左上', '右上', '左下', '右下'][st.sq]}）` : it.wells ? `孔 ${'ABCDEFGH'[Math.floor(st.well / 12)]}${(st.well % 12) + 1}` : `X ${st.x.toFixed(1)} mm · Y ${st.y.toFixed(1)} mm`;
  }

  function controls() {
    body.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', +b.dataset.mode === S.mode));
    body.querySelectorAll('[data-obj]').forEach((b) => b.classList.toggle('on', +b.dataset.obj === S.obj));
    body.querySelector('.kt').setAttribute('transform', `rotate(${(S.focus * 6) % 360})`);
    body.querySelector('.fz').textContent = `${S.focus >= 0 ? '+' : ''}${S.focus.toFixed(1)} µm`;
    body.querySelector('.lightlbl').innerHTML = `${S.mode === 2 ? '曝光' : '光强'} ${kbd('[')}${kbd(']')}`;
    body.querySelector('.bar b').style.width = `${Math.round((S.mode === 2 ? S.expo / 4 : S.light / 1.6) * 100)}%`;
    if (hemo) {
      const tal = w.hemo.marks.map((mm) => { const v = Object.values(mm); return [v.filter((x) => x === 'live').length, v.filter((x) => x === 'dead').length]; });
      const tl = tal.reduce((s, x) => s + x[0], 0), td = tal.reduce((s, x) => s + x[1], 0);
      body.querySelector('.tally').innerHTML = tal.map(([l, d], q) => `<div class="row ${q === st.sq ? 'on' : ''}" data-sq="${q}"><span>${['左上', '右上', '左下', '右下'][q]}</span><span class="num">活 <b>${l}</b> · 死 <b>${d}</b></span></div>`).join('') + `<div class="row sum"><span>合计</span><span class="num">活 <b>${tl}</b> · 死 <b>${td}</b></span></div><p>轻点细胞：一次 = <b style="color:#7fe6b5">活</b>，两次 = <b style="color:#8fb3ff">死</b>，三次取消。</p>`;
    }
    drawMap();
  }

  const defocusAmt = () => Math.min(1, Math.abs(S.focus - st.z0 - st.objOff[S.obj]) * OBJ[S.obj].k / 6);
  const frame = () => {
    if (!glc.isConnected) return;
    const t = (performance.now() - t0) / 1000;
    const sp = spec();
    const v = view();
    const key = `${S.obj}|${S.focus.toFixed(2)}|${st.x.toFixed(4)}|${st.y.toFixed(4)}|${st.well}|${sp.key}`;
    let n;
    if (key !== cache.key || sp.animated) { n = build(t); cache = { key, n }; } else n = cache.n;
    R.draw(buf, n, { mode: S.mode, light: S.light, expo: S.expo, t, defocus: defocusAmt(), grid: sp.hemo, acid: Math.min(1, sp.bug / 3), formazan: sp.formazan || 0, stagePx: [v.cx * v.ppm - glc.width / 2, v.cy * v.ppm + glc.height / 2], pxPerMm: v.ppm });
    overlay();
    requestAnimationFrame(frame);
  };
  controls();
  frame();

  const setWell = (d) => { st.well = (st.well + d + 96) % 96; st.x = 0; st.y = 0; controls(); };
  const jumpSq = (q) => { st.sq = q; st.x = SQ_ORIGIN[q][0] + 0.5; st.y = SQ_ORIGIN[q][1] + 0.5; controls(); };
  const nudge = (dx, dy) => {
    const step = OBJ[S.obj].fov / 1000 * 0.18;
    const ext = spec().extent;
    st.x = Math.max(ext[0], Math.min(ext[2], st.x + dx * step));
    st.y = Math.max(ext[1], Math.min(ext[3], st.y + dy * step));
    if (hemo) { let best = 0, bd = 1e9; SQ_ORIGIN.forEach(([x, y], q) => { const d = Math.hypot(st.x - x - 0.5, st.y - y - 0.5); if (d < bd) { bd = d; best = q; } }); st.sq = best; }
    controls();
  };
  const shoot = () => {
    const sharp = defocusAmt() < 0.18;
    const v = view();
    st.photo = { obj: v.o.m, mode: MODES[S.mode], sharp };
    (w.flags.photos ||= []).push({ item: it.id, t: w.t, obj: v.o.m, mode: S.mode, sharp, well: it.wells ? st.well : null });
    log(w, `显微照片：${it.label} ${it.wells ? `孔 ${'ABCDEFGH'[Math.floor(st.well / 12)]}${(st.well % 12) + 1} ` : ''}${v.o.m}× ${MODES[S.mode]}${sharp ? '' : '（失焦）'}`);
    const cap = body.querySelector('.cap');
    cap.hidden = false; cap.textContent = sharp ? '已拍照，存进记录本' : '已拍照——但图像没对上焦';
    cap.classList.toggle('bad', !sharp);
    app.audio?.cue('click');
    setTimeout(() => { cap.hidden = true; }, 1600);
  };

  el._key = (e) => {
    const c = e.code;
    if (c === 'ArrowUp' || c === 'ArrowDown') { S.focus += (c === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.5 : 4); controls(); return true; }
    if (c === 'KeyQ') { S.obj = Math.max(0, S.obj - 1); controls(); return true; }
    if (c === 'KeyE') { S.obj = Math.min(3, S.obj + 1); controls(); return true; }
    if (c === 'KeyM') { S.mode = (S.mode + 1) % 3; controls(); return true; }
    if (c === 'BracketLeft' || c === 'BracketRight') { const d = c === 'BracketRight' ? 1 : -1; if (S.mode === 2) S.expo = Math.max(0.2, Math.min(4, S.expo + d * 0.2)); else S.light = Math.max(0.3, Math.min(1.6, S.light + d * 0.1)); controls(); return true; }
    if (c === 'KeyW') { nudge(0, -1); return true; }
    if (c === 'KeyS') { nudge(0, 1); return true; }
    if (c === 'KeyA') { nudge(-1, 0); return true; }
    if (c === 'KeyD') { nudge(1, 0); return true; }
    if (it.wells && (c === 'ArrowLeft' || c === 'ArrowRight')) { setWell(c === 'ArrowRight' ? 1 : -1); return true; }
    if (hemo && /^Digit[1-4]$/.test(c)) { jumpSq(+c.slice(5) - 1); return true; }
    if (c === 'KeyC' && !hemo) { shoot(); return true; }
    return false;
  };
  body.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { S.mode = +m.dataset.mode; controls(); }
    const o = e.target.closest('[data-obj]'); if (o) { S.obj = +o.dataset.obj; controls(); }
    const q = e.target.closest('[data-sq]'); if (q) jumpSq(+q.dataset.sq);
    if (e.target.closest('[data-shot]')) shoot();
    if (e.target.closest('[data-rec]')) { recordCounts(app); closePanel(); app.openNotebook(); }
  });
  ov.addEventListener('click', (e) => {
    if (!hemo) return;
    const rect = ov.getBoundingClientRect();
    const v = view();
    const x = ((e.clientX - rect.left) / rect.width) * ov.width, y = ((e.clientY - rect.top) / rect.height) * ov.height;
    let best = null, bd = 1e9;
    w.hemo.squares.forEach((cells, q) => {
      const [ox, oy] = SQ_ORIGIN[q];
      cells.forEach((c, i) => {
        const cx = (ox + c.x - v.cx) * v.ppm + ov.width / 2, cy = (oy + c.y - v.cy) * v.ppm + ov.height / 2;
        const d = Math.hypot(cx - x, cy - y);
        if (d < c.r * 0.62 * v.ppm + 7 * k && d < bd) { bd = d; best = [q, i]; }
      });
    });
    if (!best) return;
    const [q, i] = best;
    const cur = w.hemo.marks[q][i];
    A.mark(w, q, i, cur == null ? 'live' : cur === 'live' ? 'dead' : null);
    app.audio?.cue('click');
    controls();
  });
}

// What is on the stage, reduced to what the optics need.
export function specimenOf(w, it, st) {
  if (it.type === 'hemo') return { hemo: true, tb: w.hemo?.tb || 0, extent: [0, 0, 3, 3], key: `h${JSON.stringify(w.hemo.marks).length}`, bug: 0 };
  const line = LINES[it.line] || LINES['PC-9'];
  const base = { seed: it.id, size: 34 + line.shape * 12, roundSize: 17, stain: 0, gfp: it.gfp || 0, gfpLevel: it.gfpLevel || 1, bug: 0, floating: 0, round: 0, dead: 0 };
  if (it.type === 'flask') {
    const lay = it.layer || { n: 0, d: 0 };
    const sus = it.liq.c.cells || 0;
    const tot = lay.n + lay.d;
    return {
      ...base, conf: Math.min(1.05, tot / line.capT25),
      round: Math.min(1, (it.tryMin || 0) / 3.5) * (1 - lay.d / Math.max(1, tot)),
      dead: lay.d / Math.max(1, tot), floating: sus / Math.max(1, lay.n + sus),
      bug: it.liq.c.bug || 0, extent: [-30, -14, 30, 14], animated: sus > 0 || (it.liq.c.bug || 0) > 0.05,
      key: `${Math.round(tot / 2e4)}|${Math.round((it.tryMin || 0) * 4)}|${Math.round(sus / 2e4)}|${(it.liq.c.bug || 0).toFixed(1)}`,
    };
  }
  if (it.wells) {
    const wl = it.wells[st.well];
    const cells = wl.n + (wl.liq.c.cells || 0);
    const dead = wl.dead || 0;
    // drug stress: cells round up and detach before they die
    const drugs = drugsOf(wl.liq);
    const wlLine = wl.src ? Object.entries(wl.src).sort((a2, b2) => b2[1] - a2[1])[0]?.[0] : it.line;
    const stress = Object.keys(drugs).length ? 1 - drugFactor(wlLine || 'PC-9', drugs) : 0;
    const L2 = LINES[wlLine] || line;
    return {
      ...base, size: 34 + L2.shape * 12, round: Math.min(0.85, stress * 0.9), seed: `${it.id}:${st.well}`, conf: Math.min(1.05, (cells + dead * 0.3) / L2.capWell),
      dead: dead / Math.max(1, cells + dead) * 0.8, floating: (wl.liq.c.cells || 0) / Math.max(1, cells),
      bug: wl.liq.c.bug || 0, formazan: formazanOf(wl), wellR: 3.2, extent: [-3.2, -3.2, 3.2, 3.2],
      inside: (x, y) => x * x + y * y < 3.2 * 3.2,
      animated: (wl.liq.c.cells || 0) > 0 || (wl.liq.c.bug || 0) > 0.05,
      key: `${st.well}|${Math.round(cells / 500)}|${Math.round(dead / 500)}|${(wl.liq.c.bug || 0).toFixed(1)}|${stress.toFixed(2)}`,
    };
  }
  return { ...base, conf: 0, extent: [-5, -5, 5, 5], key: 'empty' };
}

export function recordCounts(app) {
  const H = app.w.hemo;
  if (!H) return;
  const tal = H.marks.map((mm) => { const v = Object.values(mm); return [v.filter((x) => x === 'live').length, v.filter((x) => x === 'dead').length]; });
  app.w.notes.hemoCounts = tal;
  app.w.log.push({ t: app.w.t, text: `血球计数：${tal.map(([l, d], k) => `${['左上', '右上', '左下', '右下'][k]} 活${l}/死${d}`).join('，')}` });
}

// The counts a careful counter would get, for grading.
export function trueCounts(H) {
  return H.squares.map((cells) => [cells.filter((c) => counted(c) && !c.dead).length, cells.filter((c) => counted(c) && c.dead).length]);
}

export { closePanel };
