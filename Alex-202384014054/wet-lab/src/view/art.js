// Alex 202384014054
// Item artwork. Elevation items are drawn in millimetres around their
// baseline centre (y up is negative) and scaled into the scene; deck items are
// drawn in plan view in pixels. Each builder returns { g, update, geo }.
// geo answers where a pipette tip sits at each depth: 0 above, 1 inside the
// mouth, 2 under the liquid surface, 3 touching the bottom.

import { el, setA, show, txt, setT, rr } from './svg.js';
import { vol, color } from '../sim/liquid.js';
import { TYPES } from '../game/catalog.js';
import { DECK } from '../game/layout.js';
import { liquidsOf } from '../game/world.js';

let uid = 0;
const nid = (p) => `${p}${++uid}`;

// Interior radius profile → height for a volume (µL = mm³).
function profile(segs) {
  // segs: [[h0, r0, h1, r1], ...] frusta from the bottom up
  const area = (h) => { for (const [a, ra, b, rb] of segs) if (h >= a && h <= b) { const r = ra + (rb - ra) * ((h - a) / (b - a || 1)); return Math.PI * r * r; } return 0; };
  const table = [[0, 0]];
  let v = 0;
  const top = segs[segs.length - 1][2];
  for (let h = 0.25; h <= top; h += 0.25) { v += area(h - 0.125) * 0.25; table.push([h, v]); }
  return (vv) => {
    if (vv <= 0) return 0;
    let lo = 0, hi = table.length - 1;
    if (vv >= table[hi][1]) return top;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m][1] < vv) lo = m; else hi = m; }
    const [h0, v0] = table[lo], [h1, v1] = table[hi];
    return h0 + ((vv - v0) / (v1 - v0 || 1)) * (h1 - h0);
  };
}

function floorShadow(g, w, h = 5) { el('ellipse', { cx: 0, cy: 0, rx: w * 0.62, ry: h, fill: 'url(#shadow)' }, g); }

function liquidLayer(g, interiorD) {
  const id = nid('clip');
  const cp = el('clipPath', { id }, g);
  el('path', { d: interiorD }, cp);
  const lg = el('g', { 'clip-path': `url(#${id})` }, g);
  const body = el('rect', { x: -60, y: 0, width: 120, height: 0 }, lg);
  const haze = el('rect', { x: -60, y: 0, width: 120, height: 0, fill: '#fff', opacity: 0 }, lg);
  const shade = el('rect', { x: -60, y: 0, width: 120, height: 0, fill: 'url(#liqShade)' }, lg);
  const men = el('ellipse', { cx: 0, cy: 0, rx: 10, ry: 0.9, fill: '#fff', opacity: 0.35 }, lg);
  const menLine = el('path', { d: '', fill: 'none', stroke: '#3d5568', 'stroke-width': 0.55, opacity: 0.5 }, lg);
  return {
    set(l, H, rx, extra) {
      const v = vol(l);
      const c = color(l, extra);
      const vis = v > 0.05;
      show(lg, vis);
      if (!vis) return;
      setA(body, 'y', (-H).toFixed(2)); setA(body, 'height', (H + 2).toFixed(2));
      setA(body, 'fill', c.fill); setA(body, 'opacity', c.alpha.toFixed(2));
      setA(haze, 'y', (-H).toFixed(2)); setA(haze, 'height', (H + 2).toFixed(2)); setA(haze, 'opacity', c.haze.toFixed(2));
      setA(shade, 'y', (-H).toFixed(2)); setA(shade, 'height', (H + 2).toFixed(2));
      setA(men, 'cy', (-H).toFixed(2)); setA(men, 'rx', rx.toFixed(2));
      setA(menLine, 'd', `M${(-rx).toFixed(2)},${(-H - 0.6).toFixed(2)}Q0,${(-H + 1.4).toFixed(2)} ${rx.toFixed(2)},${(-H - 0.6).toFixed(2)}`);
    },
  };
}

function capOpenDrawing(g, x, w, h, fill) {
  const c = el('g', { transform: `translate(${x},0)` }, g);
  el('path', { d: rr(-w / 2, -h, w, h, 1.6), fill, stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.3 }, c);
  el('rect', { x: -w / 2 + 1, y: -h + 1, width: w - 2, height: 1.2, fill: '#fff', opacity: 0.3 }, c);
  return c;
}

const CAPS = { blue: 'url(#capBlue)', orange: 'url(#capOrange)', white: 'url(#capWhite)', red: 'url(#capRed)', green: 'url(#capGreen)', purple: 'url(#capPurple)' };

// ---------------------------------------------------------------- tubes

function tubeArt(it, { r, h, cone, capW, capH, gradStep, gradMax, skirt = false }) {
  const g = el('g');
  floorShadow(g, r * 1.4, 2.2);
  const lev = profile([[0, 0.9, cone, r - 0.7], [cone, r - 0.7, h - 1, r - 0.7]]);
  const outer = `M${-r},${-h}L${-r},${-cone}L${-1.4},${-1.2}Q0,0.6 ${1.4},${-1.2}L${r},${-cone}L${r},${-h}Z`;
  const inner = `M${-r + 0.7},${-h + 0.5}L${-r + 0.7},${-cone}L${-1},${-1.8}Q0,-0.4 ${1},${-1.8}L${r - 0.7},${-cone}L${r - 0.7},${-h + 0.5}Z`;
  const pellet = el('ellipse', { cx: 0, cy: -2.6, rx: 1.4, ry: 1.1, fill: '#f3ead8', opacity: 0 }, g);
  const liq = liquidLayer(g, inner);
  el('path', { d: outer, fill: 'url(#ppV)', stroke: '#8a96a3', 'stroke-opacity': 0.55, 'stroke-width': 0.45 }, g);
  if (skirt) el('path', { d: `M${-r + 1},${-cone + 1}L${-r + 1},-0.2M${r - 1},${-cone + 1}L${r - 1},-0.2`, stroke: '#9aa6b2', 'stroke-width': 0.5, opacity: 0.6 }, g);
  // graduations
  const gr = el('g', { stroke: '#4a5563', 'stroke-width': 0.35, opacity: 0.55 }, g);
  for (let m = gradStep; m <= gradMax + 1e-6; m += gradStep) { const y = -lev(m * 1000); el('path', { d: `M${r - 0.2},${y}h${-(Math.round(m) === m ? 3.4 : 1.8)}` }, gr); }
  // label sticker
  const lab = el('g', null, g);
  el('rect', { x: -r + 1.3, y: -h + 22, width: r * 2 - 2.6, height: Math.min(26, h * 0.3), rx: 0.8, fill: '#fbfbf8', opacity: 0.94 }, lab);
  const t1 = txt(lab, '', { x: 0, y: -h + 30, 'text-anchor': 'middle', 'font-size': Math.min(5.2, r * 0.62), 'font-weight': 600, fill: '#1e2b45', 'font-family': 'var(--sans)' });
  const t2 = txt(lab, '', { x: 0, y: -h + 37, 'text-anchor': 'middle', 'font-size': Math.min(4, r * 0.5), fill: '#55606d', 'font-family': 'var(--sans)' });
  el('path', { d: `M${-r + 1.2},${-h + 3}V${-cone - 2}`, stroke: '#fff', 'stroke-width': 1.1, opacity: 0.55, 'stroke-linecap': 'round' }, g);
  const cap = el('g', null, g);
  el('path', { d: rr(-capW / 2, -h - capH + 1, capW, capH, 1.6), fill: CAPS[it.cap || 'blue'] }, cap);
  for (let i = 1; i < 6; i++) el('path', { d: `M${-capW / 2 + (capW / 6) * i},${-h - capH + 2}v${capH - 2.5}`, stroke: '#000', 'stroke-opacity': 0.13, 'stroke-width': 0.5 }, cap);
  el('rect', { x: -capW / 2 + 0.8, y: -h - capH + 1.6, width: capW - 1.6, height: 1.1, fill: '#fff', opacity: 0.35 }, cap);
  const capOff = capOpenDrawing(g, r + capW * 0.55, capW, capH * 0.7, CAPS[it.cap || 'blue']);
  return {
    g,
    geo: { top: -h - capH, mouth: -h, w: r * 2, level: (v) => -lev(v), bottom: -2.2 },
    update(it2) {
      liq.set(it2.liq, lev(vol(it2.liq)), r - 0.8);
      show(cap, !it2.open); show(capOff, it2.open);
      setT(t1, it2.short || ''); setT(t2, it2.short2 || '');
      const pn = it2.pellet ? it2.pellet.n + it2.pellet.d : 0;
      setA(pellet, 'opacity', pn > 2e4 ? Math.min(0.95, 0.4 + pn / 4e6) : 0);
    },
  };
}

function epArt(it) {
  const r = 4.6, h = 38, cone = 18;
  const g = el('g');
  floorShadow(g, 6, 1.6);
  const lev = profile([[0, 0.6, cone, r - 0.6], [cone, r - 0.6, h - 1, r - 0.6]]);
  const outer = `M${-r},${-h}L${-r},${-cone}L${-1},${-0.9}Q0,0.3 ${1},${-0.9}L${r},${-cone}L${r},${-h}Z`;
  const inner = `M${-r + 0.6},${-h + 0.5}L${-r + 0.6},${-cone}L${-0.7},${-1.4}Q0,-0.4 ${0.7},${-1.4}L${r - 0.6},${-cone}L${r - 0.6},${-h + 0.5}Z`;
  const liq = liquidLayer(g, inner);
  el('path', { d: outer, fill: 'url(#ppV)', stroke: '#8a96a3', 'stroke-opacity': 0.6, 'stroke-width': 0.4 }, g);
  el('rect', { x: -r - 0.8, y: -h - 1.4, width: r * 2 + 1.6, height: 1.8, rx: 0.6, fill: '#e9eef3', stroke: '#8a96a3', 'stroke-width': 0.3 }, g);
  const t1 = txt(g, '', { x: 0, y: -h + 9, 'text-anchor': 'middle', 'font-size': 3.4, 'font-weight': 700, fill: '#1e2b45' });
  const lidC = el('g', null, g);
  el('path', { d: rr(-r - 0.6, -h - 4.2, r * 2 + 1.2, 3, 1), fill: it.cap ? CAPS[it.cap] : 'url(#capWhite)', stroke: '#8a96a3', 'stroke-width': 0.3 }, lidC);
  const lidO = el('g', null, g);
  el('path', { d: `M${r + 0.6},${-h - 1}l1.6,-1.2l0.6,-9.6l-2.8,0z`, fill: it.cap ? CAPS[it.cap] : 'url(#capWhite)', stroke: '#8a96a3', 'stroke-width': 0.3 }, lidO);
  return {
    g,
    geo: { top: -h - 4.2, mouth: -h, w: r * 2, level: (v) => -lev(v), bottom: -1.6 },
    update(it2) { liq.set(it2.liq, lev(vol(it2.liq)), r - 0.6); show(lidC, !it2.open); show(lidO, it2.open); setT(t1, it2.short || ''); },
  };
}

function vialArt(it, { r = 6, h = 44, amber = true, capColor } = {}) {
  const g = el('g');
  floorShadow(g, r * 1.4, 1.8);
  const lev = profile([[0, r - 0.8, h - 2, r - 0.8]]);
  const inner = `M${-r + 0.8},${-h + 1}V-1H${r - 0.8}V${-h + 1}Z`;
  const liq = liquidLayer(g, inner);
  const frost = el('rect', { x: -r + 0.8, y: -12, width: r * 2 - 1.6, height: 11, fill: '#fff', opacity: 0 }, g);
  el('path', { d: rr(-r, -h, r * 2, h, 1.6), fill: amber ? 'url(#amber)' : 'url(#ppV)', stroke: '#3a1d06', 'stroke-opacity': 0.4, 'stroke-width': 0.4, opacity: amber ? 0.62 : 1 }, g);
  el('path', { d: `M${-r + 1.2},${-h + 3}V-3`, stroke: '#fff', 'stroke-width': 1, opacity: 0.4, 'stroke-linecap': 'round' }, g);
  el('rect', { x: -r + 0.6, y: -h + 12, width: r * 2 - 1.2, height: 14, rx: 0.6, fill: '#fbfbf8', opacity: 0.95 }, g);
  const t1 = txt(g, '', { x: 0, y: -h + 18.5, 'text-anchor': 'middle', 'font-size': 3.6, 'font-weight': 700, fill: '#1e2b45' });
  const t2 = txt(g, '', { x: 0, y: -h + 23.5, 'text-anchor': 'middle', 'font-size': 2.9, fill: '#55606d' });
  const cap = el('g', null, g);
  el('path', { d: rr(-r - 0.6, -h - 7, r * 2 + 1.2, 8, 1.4), fill: CAPS[capColor || it.cap || 'white'] }, cap);
  const capOff = capOpenDrawing(g, r + 7, r * 2 + 1.2, 5.6, CAPS[capColor || it.cap || 'white']);
  return {
    g,
    geo: { top: -h - 7, mouth: -h, w: r * 2, level: (v) => -lev(v), bottom: -1.5 },
    update(it2) {
      liq.set(it2.liq, lev(vol(it2.liq)), r - 0.9);
      setA(frost, 'opacity', it2.frozen ? 0.55 : 0);
      setA(frost, 'y', (-lev(vol(it2.liq))).toFixed(2)); setA(frost, 'height', lev(vol(it2.liq)).toFixed(2));
      show(cap, !it2.open); show(capOff, it2.open);
      setT(t1, it2.short || ''); setT(t2, it2.short2 || '');
    },
  };
}

// ---------------------------------------------------------------- bottles

function bottleArt(it, { r, h, shoulder, neckR, capR, capH }) {
  const g = el('g');
  floorShadow(g, r * 1.25, 3.4);
  const lev = profile([[0, r - 1.2, shoulder, r - 1.2], [shoulder, r - 1.2, h - 12, neckR - 1], [h - 12, neckR - 1, h, neckR - 1]]);
  const outer = `M${-r},-3Q${-r},0 ${-r + 3},0H${r - 3}Q${r},0 ${r},-3V${-shoulder}Q${r},${-shoulder - (h - shoulder) * 0.55} ${neckR},${-h + 10}V${-h}H${-neckR}V${-h + 10}Q${-r},${-shoulder - (h - shoulder) * 0.55} ${-r},${-shoulder}Z`;
  const inner = `M${-r + 1.2},-1.5V${-shoulder}Q${-r + 1.2},${-shoulder - (h - shoulder) * 0.55} ${-neckR + 1},${-h + 10}V${-h + 1}H${neckR - 1}V${-h + 10}Q${r - 1.2},${-shoulder - (h - shoulder) * 0.55} ${r - 1.2},${-shoulder}V-1.5Z`;
  const liq = liquidLayer(g, inner);
  el('path', { d: outer, fill: 'url(#glassV)', stroke: '#6f7c8a', 'stroke-opacity': 0.45, 'stroke-width': 0.6 }, g);
  el('path', { d: `M${-r + 3},-6V${-shoulder + 4}`, stroke: '#fff', 'stroke-width': 2.2, opacity: 0.5, 'stroke-linecap': 'round' }, g);
  // graduations
  for (let k = 1; k <= 4; k++) el('path', { d: `M${r - 2},${-(shoulder * k) / 5}h-6`, stroke: '#fff', 'stroke-width': 0.8, opacity: 0.7 }, g);
  const lab = el('g', null, g);
  el('rect', { x: -r * 0.72, y: -shoulder * 0.86, width: r * 1.44, height: shoulder * 0.46, rx: 1.4, fill: '#fbfbf8', opacity: 0.96 }, lab);
  el('rect', { x: -r * 0.72, y: -shoulder * 0.86, width: r * 1.44, height: 3.2, rx: 1, fill: it.band || '#2e5fb8' }, lab);
  const t1 = txt(lab, '', { x: 0, y: -shoulder * 0.86 + 12, 'text-anchor': 'middle', 'font-size': Math.min(8, r * 0.25), 'font-weight': 700, fill: '#18233a' });
  const t2 = txt(lab, '', { x: 0, y: -shoulder * 0.86 + 20.5, 'text-anchor': 'middle', 'font-size': Math.min(6, r * 0.19), fill: '#4b5562' });
  const t3 = txt(lab, '', { x: 0, y: -shoulder * 0.86 + 28, 'text-anchor': 'middle', 'font-size': Math.min(5, r * 0.16), fill: '#7a838e' });
  const cap = el('g', null, g);
  el('path', { d: rr(-capR, -h - capH, capR * 2, capH + 1, 2), fill: CAPS[it.cap || 'blue'] }, cap);
  for (let i = 1; i < 9; i++) el('path', { d: `M${-capR + ((capR * 2) / 9) * i},${-h - capH + 2}v${capH - 2}`, stroke: '#000', 'stroke-opacity': 0.14, 'stroke-width': 0.8 }, cap);
  el('rect', { x: -capR + 1.2, y: -h - capH + 1.2, width: capR * 2 - 2.4, height: 1.6, fill: '#fff', opacity: 0.35 }, cap);
  const capOff = capOpenDrawing(g, r + capR + 2, capR * 2, capH * 0.75, CAPS[it.cap || 'blue']);
  const drops = el('g', { opacity: 0 }, g);
  for (const [x, y] of [[-r * 0.5, -shoulder * 0.3], [r * 0.4, -shoulder * 0.55], [r * 0.1, -shoulder * 0.15], [-r * 0.2, -shoulder * 0.62]]) el('ellipse', { cx: x, cy: y, rx: 1.4, ry: 2, fill: '#fff', opacity: 0.7 }, drops);
  return {
    g,
    geo: { top: -h - capH, mouth: -h, w: r * 2, level: (v) => -lev(v), bottom: -3 },
    update(it2) {
      liq.set(it2.liq, lev(vol(it2.liq)), r - 1.5);
      show(cap, !it2.open); show(capOff, it2.open);
      setT(t1, it2.short || ''); setT(t2, it2.short2 || ''); setT(t3, it2.short3 || '');
      setA(drops, 'opacity', it2.wet ? 1 : 0);
    },
  };
}

function beakerArt() {
  const r = 25, h = 70;
  const g = el('g');
  floorShadow(g, r * 1.3, 3);
  const lev = profile([[0, r - 1, h - 2, r - 1]]);
  const inner = `M${-r + 1},-1V${-h + 1}H${r - 1}V-1Z`;
  const liq = liquidLayer(g, inner);
  el('path', { d: `M${-r},${-h}V-2Q${-r},0 ${-r + 2},0H${r - 2}Q${r},0 ${r},-2V${-h}L${r + 3},${-h - 3}`, fill: 'url(#glassV)', stroke: '#6f7c8a', 'stroke-opacity': 0.5, 'stroke-width': 0.6 }, g);
  for (let k = 1; k <= 4; k++) { el('path', { d: `M${-r + 2},${-k * 14}h7`, stroke: '#fff', 'stroke-width': 0.9, opacity: 0.8 }, g); txt(g, `${k * 20}`, { x: -r + 10, y: -k * 14 + 1.8, 'font-size': 4, fill: '#fff', opacity: 0.85 }); }
  return { g, geo: { top: -h - 3, mouth: -h, w: r * 2, level: (v) => -lev(v), bottom: -2 }, update(it2) { liq.set(it2.liq, lev(vol(it2.liq)), r - 1.2); } };
}

// ---------------------------------------------------------------- flask (3/4 view)

function flaskArt(it) {
  const g = el('g');
  floorShadow(g, 70, 5);
  const W = 92, H = 22, D = 20; // front face width/height, depth offset
  const body = `M${-W / 2},0V${-H}L${-W / 2 + D},${-H - D * 0.55}H${W / 2 + D * 0.2}L${W / 2},${-H}V0Z`;
  el('path', { d: `M${-W / 2},0H${W / 2}L${W / 2 + D * 0.2},${-D * 0.55}V${-H - D * 0.55}H${-W / 2 + D}`, fill: 'none' }, g);
  // pool of medium on the growth surface
  const pool = el('path', { d: `M${-W / 2 + 3},-2L${-W / 2 + D},${-D * 0.5}H${W / 2 + D * 0.15}L${W / 2 - 3},-2Z`, fill: '#e06478', opacity: 0 }, g);
  const sheet = el('path', { d: `M${-W / 2 + 4},-3L${-W / 2 + D},${-D * 0.48}H${W / 2 + D * 0.14}L${W / 2 - 4},-3Z`, fill: '#f5ece4', opacity: 0 }, g);
  el('path', { d: body, fill: 'url(#ppV)', stroke: '#7d8996', 'stroke-opacity': 0.6, 'stroke-width': 0.55 }, g);
  el('path', { d: `M${-W / 2},${-H}H${W / 2}`, stroke: '#7d8996', 'stroke-opacity': 0.45, 'stroke-width': 0.4 }, g);
  el('rect', { x: -W / 2 + 10, y: -H - D * 0.5 + 3, width: 46, height: 11, rx: 1, fill: '#fbfbf8', opacity: 0.92, transform: `skewX(-35)` }, g);
  const t1 = txt(g, '', { x: -W / 2 + 20, y: -H - D * 0.5 + 10.6, 'font-size': 5.6, 'font-weight': 700, fill: '#1e2b45' });
  // neck and vented cap on the right
  el('path', { d: `M${W / 2 - 2},${-H + 2}L${W / 2 + 12},${-H - 10}L${W / 2 + 18},${-H - 4}L${W / 2 + 4},${-H + 8}Z`, fill: 'url(#ppV)', stroke: '#7d8996', 'stroke-opacity': 0.6, 'stroke-width': 0.5 }, g);
  const cap = el('g', { transform: `translate(${W / 2 + 15},${-H - 7}) rotate(-40)` }, g);
  el('path', { d: rr(-7, -6, 14, 12, 2), fill: 'url(#capBlue)' }, cap);
  el('rect', { x: -5, y: -5, width: 10, height: 2, fill: '#fff', opacity: 0.25 }, cap);
  const capOff = capOpenDrawing(g, W / 2 + 34, 14, 8, 'url(#capBlue)');
  return {
    g,
    geo: { top: -H - 22, mouth: -H - 6, mouthX: W / 2 + 15, w: W, level: () => -6, bottom: -3, flask: true },
    update(it2) {
      const v = vol(it2.liq);
      const c = color(it2.liq);
      setA(pool, 'opacity', v > 50 ? Math.min(0.75, 0.25 + v / 9000).toFixed(2) : 0);
      setA(pool, 'fill', c.fill);
      const cells = it2.layer ? it2.layer.n : 0;
      setA(sheet, 'opacity', Math.min(0.5, cells / 6e6).toFixed(2));
      show(cap, !it2.open); show(capOff, it2.open);
      setT(t1, it2.short || '');
    },
  };
}

// ---------------------------------------------------------------- side-view consumables

function tipboxSideArt(it) {
  const g = el('g');
  floorShadow(g, 64, 4);
  const W = 104, H = 40;
  const tint = { white: '#d9dee5', yellow: '#f2c94c', blue: '#5b8def' }[it.color];
  el('path', { d: rr(-W / 2, -H, W, H, 3), fill: tint, opacity: 0.85 }, g);
  el('path', { d: rr(-W / 2, -H, W, H, 3), fill: 'url(#glassV)' }, g);
  el('rect', { x: -W / 2, y: -H - 3, width: W, height: 4, rx: 1, fill: '#e9edf1', stroke: '#9aa4ae', 'stroke-width': 0.4 }, g);
  const tips = el('g', null, g);
  const tipFill = { white: 'url(#tipWhite)', yellow: 'url(#tipYellow)', blue: 'url(#tipBlue)' }[it.color];
  const cones = [];
  for (let i = 0; i < 12; i++) {
    const x = -W / 2 + 6 + i * ((W - 12) / 11);
    cones.push(el('path', { d: `M${x - 2.6},${-H - 3}L${x - 1.2},${-H - 15}H${x + 1.2}L${x + 2.6},${-H - 3}Z`, fill: tipFill, opacity: 0.95 }, tips));
  }
  const lid = el('path', { d: rr(-W / 2 - 1, -H - 20, W + 2, 18, 2.6), fill: tint, opacity: 0.45, stroke: '#7d8996', 'stroke-opacity': 0.5, 'stroke-width': 0.4 }, g);
  const lidOpen = el('path', { d: `M${-W / 2 - 1},${-H - 3}L${-W / 2 - 6},${-H - 34}H${W / 2 - 6}L${W / 2 + 1},${-H - 3}`, fill: tint, opacity: 0.28, stroke: '#7d8996', 'stroke-opacity': 0.4, 'stroke-width': 0.4 }, g);
  el('rect', { x: -W / 2 + 6, y: -H + 10, width: 40, height: 12, rx: 1, fill: '#fff', opacity: 0.9 }, g);
  txt(g, it.color === 'white' ? '10/20 µL' : it.color === 'yellow' ? '200 µL' : '1000 µL', { x: -W / 2 + 26, y: -H + 18.2, 'text-anchor': 'middle', 'font-size': 5.4, 'font-weight': 700, fill: '#1e2b45' });
  return {
    g, geo: { top: -H - 20, mouth: -H - 16, w: W, level: () => -H - 14, bottom: -H - 4, tipbox: true },
    update(it2) {
      show(lid, !it2.open); show(lidOpen, it2.open);
      const left = it2.present.filter(Boolean).length;
      cones.forEach((c, i) => show(c, left > i * 8));
    },
  };
}

function seropackArt(it) {
  const g = el('g');
  floorShadow(g, 22, 2.5);
  const band = it.size === 5 ? '#2f6fd6' : it.size === 10 ? '#f08a2c' : '#d93a43';
  for (let i = 0; i < 5; i++) {
    const x = -10 + i * 5;
    el('rect', { x: x - 1.6, y: -150 + (i % 2) * 6, width: 3.2, height: 120, rx: 1.4, fill: '#f6f3ea', stroke: '#c9c2ae', 'stroke-width': 0.3 }, g);
    el('rect', { x: x - 1.6, y: -150 + (i % 2) * 6, width: 3.2, height: 5, rx: 1.4, fill: band }, g);
  }
  el('path', { d: rr(-16, -60, 32, 60, 3), fill: 'url(#steelH)', stroke: '#8a939d', 'stroke-width': 0.5 }, g);
  el('rect', { x: -12, y: -46, width: 24, height: 13, rx: 1.2, fill: band }, g);
  txt(g, `${it.size} mL`, { x: 0, y: -37, 'text-anchor': 'middle', 'font-size': 7, 'font-weight': 700, fill: '#fff' });
  return { g, geo: { top: -156, mouth: -150, w: 32, level: () => -150, bottom: -150, holder: true }, update() {} };
}

function pasteurArt() {
  const g = el('g');
  floorShadow(g, 18, 2.4);
  const body = el('path', { d: rr(-13, -120, 26, 120, 3), fill: 'url(#steelH)', stroke: '#7f8892', 'stroke-width': 0.5 }, g);
  const pipes = el('g', null, g);
  for (let i = 0; i < 4; i++) el('path', { d: `M${-6 + i * 4},-120V-146`, stroke: '#e8f2f8', 'stroke-width': 1.6, opacity: 0.9 }, pipes);
  const lid = el('path', { d: rr(-14.5, -132, 29, 16, 3), fill: 'url(#steelH)', stroke: '#7f8892', 'stroke-width': 0.5 }, g);
  el('rect', { x: -10, y: -80, width: 20, height: 22, rx: 1.4, fill: '#fbfbf8' }, g);
  txt(g, '巴氏', { x: 0, y: -71, 'text-anchor': 'middle', 'font-size': 6, 'font-weight': 700, fill: '#1e2b45' });
  txt(g, '灭菌', { x: 0, y: -63, 'text-anchor': 'middle', 'font-size': 6, fill: '#55606d' });
  void body;
  return { g, geo: { top: -150, mouth: -130, w: 26, level: () => -125, bottom: -125, holder: true }, update(it2) { show(lid, !it2.open); show(pipes, it2.open); } };
}

function boatArt() {
  const g = el('g');
  // antistatic polystyrene weighing boat, seen from the front
  el('path', { d: 'M-25,-9L-18,0H18L25,-9Z', fill: '#e9eef4', stroke: '#6f7c8a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, g);
  el('path', { d: 'M-25,-9H25', stroke: '#fff', 'stroke-width': 1.2 }, g);
  el('path', { d: 'M-17,-2H17', stroke: '#b8c3cf', 'stroke-width': 0.8 }, g);
  const liq = el('ellipse', { cx: 0, cy: -4, rx: 0, ry: 2, fill: '#9cc1e2', opacity: 0.9 }, g);
  return { g, geo: { top: -12, mouth: -9, w: 48, level: (v) => -1 - Math.min(5, v / 200), bottom: -1 }, update(it2) { const v = vol(it2.liq); setA(liq, 'rx', Math.min(16, 3 + Math.sqrt(v) * 0.45).toFixed(2)); show(liq, v > 0.5); } };
}

function hemoArt() {
  const g = el('g');
  floorShadow(g, 44, 2.2);
  el('path', { d: rr(-38, -5, 76, 5, 0.8), fill: 'url(#glassV)', stroke: '#7d8996', 'stroke-width': 0.4 }, g);
  el('rect', { x: -38, y: -5, width: 76, height: 5, fill: '#cfe2f0', opacity: 0.45 }, g);
  el('rect', { x: -14, y: -7, width: 28, height: 1.4, fill: '#eaf4fb', stroke: '#8fa3b5', 'stroke-width': 0.3 }, g);
  el('path', { d: 'M-30,-2.5H-20M20,-2.5H30', stroke: '#3a4a5a', 'stroke-width': 0.5 }, g);
  const s = el('rect', { x: -12, y: -5.6, width: 24, height: 0.9, fill: '#3a5aa8', opacity: 0 }, g);
  return { g, geo: { top: -10, mouth: -7.5, mouthX: -15, w: 76, level: () => -6, bottom: -6 }, update(it2) { setA(s, 'opacity', vol(it2.liq) > 0 ? 0.6 : 0); } };
}

// 3/4 elevation for plates and reservoirs when they sit on shelves or benches.
function plateSideArt(it) {
  const g = el('g');
  floorShadow(g, 72, 4);
  const W = 128, D = 34, H = 14;
  el('path', { d: `M${-W / 2},0V${-H}L${-W / 2 + 12},${-H - D}H${W / 2 + 12}L${W / 2},${-H}V0Z`, fill: 'url(#plateTop)', stroke: '#8a96a3', 'stroke-width': 0.5 }, g);
  el('path', { d: `M${-W / 2},${-H}H${W / 2}L${W / 2 + 12},${-H - D}`, fill: 'none', stroke: '#8a96a3', 'stroke-width': 0.4 }, g);
  const wells = [];
  const wg = el('g', null, g);
  if (it.wells) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const u = (r + 0.5) / 8;
      const x = -W / 2 + 7 + c * 9.3 + 12 * (1 - u), y = -H - D + 3 + r * 3.9;
      wells.push(el('ellipse', { cx: x, cy: y, rx: 3.5, ry: 1.35, fill: '#cfd6de', opacity: 0.55 }, wg));
    }
  } else {
    for (let k = 0; k < 4; k++) wells.push(el('path', { d: `M${-W / 2 + 14 + k * 30},${-H - 3}L${-W / 2 + 24 + k * 30},${-H - D + 3}h22l-10,${D - 6}z`, fill: '#cfd6de', opacity: 0.5 }, wg));
  }
  const lid = el('path', { d: `M${-W / 2 - 1},${-H - 1}L${-W / 2 + 11},${-H - D - 1}H${W / 2 + 13}L${W / 2 + 1},${-H - 1}Z`, fill: '#e8f0f7', opacity: 0.45, stroke: '#9fb0c0', 'stroke-width': 0.5 }, g);
  el('rect', { x: -W / 2 + 4, y: -H + 3, width: 52, height: 8, rx: 1, fill: '#fbfbf8', opacity: 0.94 }, g);
  const t1 = txt(g, '', { x: -W / 2 + 7, y: -H + 9, 'font-size': 5.4, 'font-weight': 700, fill: '#1e2b45' });
  return {
    g, geo: { top: -H - D - 2, mouth: -H - D, w: W, level: () => -H, bottom: -H, plate: true },
    update(it2) {
      show(lid, !it2.open);
      setT(t1, it2.short || '');
      const ls = liquidsOf(it2);
      wells.forEach((e, i) => {
        const l = ls[i];
        if (!l) return;
        const v = vol(l);
        const c = color(l, it2.wells ? { formazan: formazanOf(it2.wells[i]) } : {});
        setA(e, 'fill', v > 1 ? c.fill : '#cfd6de');
        setA(e, 'opacity', v > 1 ? Math.min(0.95, 0.35 + c.alpha * 0.7).toFixed(2) : 0.5);
      });
    },
  };
}

export const formazanOf = (wl) => (wl.liq.c.cck8 ? Math.min(1, (wl.n * 6.6e-5 * Math.min(wl.cck, 240)) / 120 / 1.6) : 0);

const BUILDERS = {
  tube15: (it) => tubeArt(it, { r: 8.4, h: 118, cone: 22, capW: 20, capH: 13, gradStep: 1, gradMax: 15 }),
  tube50: (it) => tubeArt(it, { r: 14.6, h: 112, cone: 18, capW: 33, capH: 14, gradStep: 5, gradMax: 50, skirt: true }),
  ep: epArt,
  vial: (it) => vialArt(it, { r: 6.2, h: 44, amber: true }),
  kit: (it) => vialArt(it, { r: 9.5, h: 38, amber: true, capColor: 'white' }),
  bottle500: (it) => bottleArt(it, { r: 43, h: 178, shoulder: 132, neckR: 21, capR: 25, capH: 20 }),
  bottle100: (it) => bottleArt(it, { r: 28, h: 108, shoulder: 74, neckR: 15, capR: 18, capH: 15 }),
  beaker: beakerArt,
  flask: flaskArt,
  tipboxSide: tipboxSideArt,
  seropack: seropackArt,
  pasteur: pasteurArt,
  boat: boatArt,
  hemo: hemoArt,
  plate: plateSideArt,
  uplate: plateSideArt,
  res4: plateSideArt,
  tipbox: (it) => tipboxSideArt({ ...it, color: it.color }),
};

// Visual scale (px per mm) by item kind; small things are drawn larger than life.
export const SCALE = { ep: 2.4, vial: 2.2, kit: 2, hemo: 1.5, boat: 1.6, tube15: 1.55, tube50: 1.45 };

export function buildElev(it) {
  const b = BUILDERS[it.type](it);
  b.g.setAttribute('data-item', it.id);
  return b;
}

// ---------------------------------------------------------------- deck (plan view)

const MM = DECK.px;
export const PLATE = { w: 127.76, h: 85.48, a1x: 14.38, a1y: 11.24, pitch: 9 };

export function wellCenter(r, c) { return [(PLATE.a1x + c * PLATE.pitch) * MM, (PLATE.a1y + r * PLATE.pitch) * MM]; }

export function buildDeck(it) {
  const g = el('g', { 'data-item': it.id });
  const W = PLATE.w * MM, H = PLATE.h * MM;
  el('rect', { x: 3, y: 6, width: W, height: H, rx: 7, fill: '#0b1220', opacity: 0.18 }, g);
  if (it.type === 'tipbox') return deckTipbox(it, g, W, H);
  if (it.type === 'res4') return deckReservoir(it, g, W, H);
  return deckPlate(it, g, W, H);
}

function deckPlate(it, g, W, H) {
  const u = it.type === 'uplate';
  el('rect', { width: W, height: H, rx: 6, fill: u ? '#f4f6f8' : '#f8fafc', stroke: '#8d99a6', 'stroke-width': 1 }, g);
  el('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 4, fill: 'none', stroke: '#c5cdd6', 'stroke-width': 1 }, g);
  // chamfered corner marks A1 orientation on real plates (top-right here)
  el('path', { d: `M${W - 14},0L${W},14V0Z`, fill: '#d6dde4' }, g);
  const lab = el('g', { 'font-size': 9, fill: '#6b7683', 'font-weight': 600, 'font-family': 'var(--num)' }, g);
  for (let c = 0; c < 12; c++) txt(lab, String(c + 1), { x: wellCenter(0, c)[0], y: 14.5, 'text-anchor': 'middle' });
  for (let r = 0; r < 8; r++) txt(lab, 'ABCDEFGH'[r], { x: 8, y: wellCenter(r, 0)[1] + 3.2, 'text-anchor': 'middle' });
  const wells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
    const [x, y] = wellCenter(r, c);
    const wg = el('g', { transform: `translate(${x},${y})` }, g);
    el('circle', { r: 3.4 * MM, fill: u ? '#e9edf1' : '#eef2f5', stroke: '#a9b3bd', 'stroke-width': 0.8 }, wg);
    const liq = el('circle', { r: 3.05 * MM, fill: '#fff', opacity: 0 }, wg);
    const cells = el('circle', { r: 2.2 * MM, fill: 'none', stroke: '#f6efe2', 'stroke-width': 2.2, 'stroke-dasharray': '1.5 1.5', opacity: 0 }, wg);
    el('circle', { cx: -1.6, cy: -1.8, r: 1.6, fill: '#fff', opacity: 0.7 }, wg);
    wells.push({ liq, cells });
  }
  const lid = el('g', null, g);
  el('rect', { x: -3, y: -3, width: W + 6, height: H + 6, rx: 8, fill: '#dfe9f2', opacity: 0.42, stroke: '#9fb0c0', 'stroke-width': 1.2 }, lid);
  el('path', { d: `M10,${H - 12}L${W * 0.42},4`, stroke: '#fff', 'stroke-width': 10, opacity: 0.18, 'stroke-linecap': 'round' }, lid);
  const tag = el('g', { transform: `translate(${W - 4},${H + 2})` }, g);
  el('rect', { x: -120, y: 2, width: 120, height: 17, rx: 4, fill: '#1e2b45' }, tag);
  const tt = txt(tag, '', { x: -60, y: 14, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600, fill: '#fff' });
  return {
    g,
    update(it2) {
      show(lid, !it2.open);
      setT(tt, it2.short || it2.label);
      it2.wells.forEach((wl, i) => {
        const v = vol(wl.liq);
        const c = color(wl.liq, { formazan: formazanOf(wl) });
        setA(wells[i].liq, 'opacity', v > 0.5 ? Math.min(0.95, 0.3 + c.alpha * 0.75).toFixed(2) : 0);
        setA(wells[i].liq, 'fill', c.fill);
        setA(wells[i].liq, 'r', (3.05 * MM * Math.min(1, 0.55 + v / 260)).toFixed(2));
        const n = wl.n + (wl.liq.c.cells || 0);
        setA(wells[i].cells, 'opacity', n > 200 ? Math.min(0.9, 0.3 + n / 30000).toFixed(2) : 0);
      });
    },
  };
}

function deckReservoir(it, g, W, H) {
  el('rect', { width: W, height: H, rx: 6, fill: '#f7f9fb', stroke: '#8d99a6', 'stroke-width': 1 }, g);
  const lanes = [];
  const lw = (W - 30) / 4;
  for (let k = 0; k < 4; k++) {
    const x = 12 + k * (lw + 2);
    el('rect', { x, y: 12, width: lw - 4, height: H - 24, rx: 8, fill: '#e3e8ed', stroke: '#a9b3bd', 'stroke-width': 0.8 }, g);
    const l = el('rect', { x: x + 3, y: 15, width: lw - 10, height: H - 30, rx: 6, fill: '#fff', opacity: 0 }, g);
    el('rect', { x: x + 5, y: 17, width: 4, height: H - 36, rx: 2, fill: '#fff', opacity: 0.55 }, g);
    txt(g, String(k + 1), { x: x + (lw - 4) / 2, y: H - 2, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: '#6b7683' });
    const name = txt(g, '', { x: x + (lw - 4) / 2, y: H / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: '#1e2b45' });
    lanes.push({ l, name });
  }
  return {
    g,
    update(it2) {
      it2.lanes.forEach((lq, k) => {
        const v = vol(lq);
        const c = color(lq);
        setA(lanes[k].l, 'opacity', v > 1 ? Math.min(0.9, 0.3 + c.alpha * 0.8 + Math.min(0.2, v / 40000)).toFixed(2) : 0);
        setA(lanes[k].l, 'fill', c.fill);
        setT(lanes[k].name, v > 1 ? (v >= 1000 ? `${(v / 1000).toFixed(1)} mL` : `${Math.round(v)} µL`) : '');
      });
    },
  };
}

function deckTipbox(it, g, W, H) {
  const tint = { white: '#cfd6de', yellow: '#f2c94c', blue: '#5b8def' }[it.color];
  el('rect', { width: W, height: H, rx: 7, fill: tint, opacity: 0.55, stroke: '#7d8996', 'stroke-width': 1 }, g);
  el('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 5, fill: '#2a3038', opacity: 0.85 }, g);
  const tipFill = { white: '#f4f6f8', yellow: '#ffd84a', blue: '#79a7ff' }[it.color];
  const tips = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
    const [x, y] = wellCenter(r, c);
    el('circle', { cx: x, cy: y, r: 2.4 * MM, fill: '#14181d' }, g);
    tips.push(el('circle', { cx: x, cy: y, r: 2.6 * MM, fill: tipFill, stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.8 }, g));
  }
  const lid = el('rect', { x: -3, y: -3, width: W + 6, height: H + 6, rx: 9, fill: tint, opacity: 0.6, stroke: '#7d8996', 'stroke-width': 1.2 }, g);
  const tag = el('g', { transform: `translate(${W - 4},${H + 2})` }, g);
  el('rect', { x: -150, y: 2, width: 150, height: 17, rx: 4, fill: '#1e2b45' }, tag);
  txt(tag, it.label, { x: -75, y: 14, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600, fill: '#fff' });
  return { g, update(it2) { show(lid, !it2.open); tips.forEach((t, i) => show(t, it2.present[i])); } };
}

export { TYPES };
