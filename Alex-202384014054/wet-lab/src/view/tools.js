// Alex 202384014054
// Tool artwork: single and 8-channel pipettes, the pipette controller with a
// serological pipette, and the vacuum aspirator. Drawn in mm with the working
// end (tip end) at the origin, pointing down.

import { el, setA, show, txt, setT, rr } from './svg.js';
import { vol, color } from '../sim/liquid.js';

const TIP_LEN = { white: 32, yellow: 50, blue: 71 };
const TIP_FILL = { white: 'url(#tipWhite)', yellow: 'url(#tipYellow)', blue: 'url(#tipBlue)' };
const BUTTON = { p20: '#c9ced6', p200: '#f2c94c', p1000: '#4d8bf0', mc20: '#c9ced6', mc200: '#f2c94c' };

function tipShape(len) { const top = 3.3, bot = 0.45; return `M${-top},${-len}L${-bot},0H${bot}L${top},${-len}Z`; }

function pipetteBody(g, tool, multi) {
  const sh = el('g', null, g);
  const bodyW = multi ? 26 : 22;
  // plunger (moves with the stop) and thumb button
  const plunger = el('g', null, g);
  el('rect', { x: -2.4, y: -262, width: 4.8, height: 30, fill: 'url(#steelH)' }, plunger);
  el('path', { d: rr(-9, -272, 18, 12, 4), fill: BUTTON[tool.id] }, plunger);
  el('rect', { x: -7, y: -270.5, width: 14, height: 2.2, rx: 1, fill: '#fff', opacity: 0.4 }, plunger);
  // handle
  el('path', { d: `M${-bodyW / 2},-232Q${-bodyW / 2 - 2},-150 ${-bodyW / 2 + 3},-118H${bodyW / 2 - 3}Q${bodyW / 2 + 2},-150 ${bodyW / 2},-232Z`, fill: 'url(#pipBody)', stroke: '#7f8892', 'stroke-width': 0.6 }, sh);
  el('path', { d: `M${bodyW / 2 - 1},-224Q${bodyW / 2 + 16},-226 ${bodyW / 2 + 15},-210Q${bodyW / 2 + 4},-212 ${bodyW / 2 - 1},-206Z`, fill: 'url(#pipDark)' }, sh);
  // volume window: one drum per digit, read top to bottom
  const nd = tool.spec.id === 'p1000' ? 4 : 3;
  el('path', { d: rr(-7, -200, 14, 4 + nd * 10.6, 2.5), fill: '#1b1f25' }, sh);
  const digits = Array.from({ length: nd }, (_, i) => {
    el('rect', { x: -5.6, y: -197 + i * 10.6, width: 11.2, height: 9.4, rx: 1.2, fill: '#f2f3f5' }, sh);
    return txt(sh, '0', { x: 0, y: -189.5 + i * 10.6, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#151a20', 'font-family': 'var(--num)' });
  });
  txt(sh, tool.spec.label, { x: 0, y: -126, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#2a3038' });
  // ejector collar
  el('path', { d: rr(-bodyW / 2 + 2, -118, bodyW - 4, 10, 2), fill: 'url(#pipDark)' }, sh);
  return { plunger, digits };
}

export function buildPipette(tool) {
  const multi = tool.spec.ch > 1;
  const g = el('g', { 'pointer-events': 'none' });
  const tipLen = TIP_LEN[tool.spec.tip];
  const tips = [];
  if (!multi) {
    // shaft (tip cone)
    el('path', { d: `M-5.5,-108L-2.4,${-tipLen + 6}H2.4L5.5,-108Z`, fill: 'url(#pipBody)', stroke: '#7f8892', 'stroke-width': 0.5 }, g);
    const tg = el('g', null, g);
    const liq = el('path', { d: '', fill: '#e06478', opacity: 0.8 }, tg);
    el('path', { d: tipShape(tipLen), fill: TIP_FILL[tool.spec.tip], opacity: tool.spec.tip === 'white' ? 0.82 : 0.6, stroke: '#000', 'stroke-opacity': 0.2, 'stroke-width': 0.3 }, tg);
    tips.push({ tg, liq, x: 0 });
  } else {
    el('path', { d: rr(-38, -118, 76, 18, 4), fill: 'url(#pipBody)', stroke: '#7f8892', 'stroke-width': 0.6 }, g);
    for (let k = 0; k < 8; k++) {
      const x = -31.5 + k * 9;
      el('path', { d: `M${x - 3},-100L${x - 1.8},${-tipLen + 6}H${x + 1.8}L${x + 3},-100Z`, fill: 'url(#pipBody)', stroke: '#7f8892', 'stroke-width': 0.4 }, g);
      const tg = el('g', { transform: `translate(${x},0)` }, g);
      const liq = el('path', { d: '', fill: '#e06478', opacity: 0.8 }, tg);
      el('path', { d: tipShape(tipLen), fill: TIP_FILL[tool.spec.tip], opacity: 0.62, stroke: '#000', 'stroke-opacity': 0.2, 'stroke-width': 0.3 }, tg);
      tips.push({ tg, liq, x });
    }
  }
  const body = pipetteBody(g, tool, multi);
  return {
    g, tipLen,
    update(t, w, held) {
      const dd = dialDigits(t);
      body.digits.forEach((d, i) => { setT(d, dd.digits[i] ?? ''); setA(d, 'fill', i === dd.red ? '#c0242c' : '#151a20'); });
      const stop = held && w.plunger.down ? w.plunger.stop : 0;
      setA(body.plunger, 'transform', `translate(0,${stop === 2 ? 16 : stop === 1 ? 11 : 0})`);
      t.tips.forEach((tp, k) => {
        const T = tips[k];
        show(T.tg, !!tp);
        if (!tp) return;
        const lv = vol(tp.liq);
        const cap = t.spec.max * 1.25;
        const f = Math.min(1, lv / cap);
        // fill from the tip end upward; the tip is a cone so height ∝ cbrt
        const h = (tipLen - 2) * Math.cbrt(f);
        const wTop = 0.45 + (3.0 - 0.45) * (h / tipLen);
        setA(T.liq, 'd', lv > 0.05 ? `M-0.42,0L${-wTop},${-h}H${wTop}L0.42,0Z` : '');
        if (lv > 0.05) setA(T.liq, 'fill', color(tp.liq).fill);
      });
    },
  };
}

export function buildAid() {
  const g = el('g', { 'pointer-events': 'none' });
  const sp = el('g', null, g);
  const L = 190;
  el('path', { d: rr(-4.2, -L, 8.4, L - 4, 3), fill: 'url(#glassV)', stroke: '#8a96a3', 'stroke-width': 0.5 }, sp);
  el('path', { d: `M-4.2,-4L-1,0H1L4.2,-4Z`, fill: 'url(#glassV)', stroke: '#8a96a3', 'stroke-width': 0.4 }, sp);
  const liq = el('rect', { x: -3.4, y: 0, width: 6.8, height: 0, fill: '#e06478', opacity: 0.8 }, sp);
  const grads = el('g', { stroke: '#2b3540', 'stroke-width': 0.35 }, sp);
  const band = el('rect', { x: -4.4, y: -L + 4, width: 8.8, height: 5, fill: '#f08a2c' }, sp);
  el('rect', { x: -4.4, y: -L - 6, width: 8.8, height: 8, fill: '#f6f3ea' }, sp);
  // controller
  const c = el('g', { transform: `translate(0,${-L - 6})` }, g);
  el('path', { d: 'M-12,0L-14,-46Q-14,-60 0,-62H34Q48,-62 48,-48V-40Q48,-30 36,-30H14L12,0Z', fill: 'url(#capPurple)', stroke: '#2a2466', 'stroke-width': 0.7 }, c);
  el('path', { d: 'M14,-30L22,48Q22,56 14,56H4Q-2,56 -2,48L4,-12Z', fill: 'url(#pipDark)' }, c);
  const up = el('path', { d: rr(14, -28, 10, 9, 3), fill: '#d6d2ff' }, c);
  const dn = el('path', { d: rr(14, -16, 10, 9, 3), fill: '#d6d2ff' }, c);
  el('path', { d: 'M-8,-40H30', stroke: '#fff', 'stroke-width': 1.2, opacity: 0.35 }, c);
  return {
    g, L,
    update(t, w) {
      show(sp, !!t.sp);
      if (t.sp) {
        const cap = t.sp.size * 1000;
        const mmPerUL = (L - 30) / (cap * 1.3);
        const h = vol(t.sp.liq) * mmPerUL;
        setA(liq, 'y', (-h - 2).toFixed(2)); setA(liq, 'height', h.toFixed(2));
        setA(liq, 'fill', color(t.sp.liq).fill);
        setA(band, 'fill', t.sp.size === 5 ? '#2f6fd6' : '#f08a2c');
        if (grads._size !== t.sp.size) {
          grads._size = t.sp.size;
          grads.replaceChildren();
          const step = t.sp.size === 5 ? 100 : 100;
          for (let u = step; u <= cap * 1.2; u += step) {
            const y = -2 - u * mmPerUL;
            el('path', { d: `M-4.2,${y}h${u % 1000 === 0 ? 3.8 : u % 500 === 0 ? 2.6 : 1.6}` }, grads);
          }
        }
      }
      setA(up, 'fill', w.keys.KeyW ? '#8b84ff' : '#d6d2ff');
      setA(dn, 'fill', w.keys.KeyS ? '#8b84ff' : '#d6d2ff');
    },
  };
}

export function buildVac() {
  const g = el('g', { 'pointer-events': 'none' });
  const p = el('g', null, g);
  el('path', { d: 'M-1.2,0L-2.4,-80H2.4L1.2,0Z', fill: 'url(#glassV)', stroke: '#8a96a3', 'stroke-width': 0.4 }, p);
  el('path', { d: 'M-3,-80V-120H3V-80Z', fill: 'url(#glassV)', stroke: '#8a96a3', 'stroke-width': 0.4 }, p);
  el('path', { d: rr(-7, -168, 14, 50, 5), fill: 'url(#pipDark)' }, g);
  el('path', { d: 'M0,-168C0,-200 -30,-210 -60,-240', fill: 'none', stroke: '#c9d6e0', 'stroke-width': 5, opacity: 0.85 }, g);
  const trig = el('path', { d: rr(6, -156, 6, 16, 2), fill: '#d6d2ff' }, g);
  return { g, update(t, w) { show(p, !!t.pasteur); setA(trig, 'fill', w.keys.KeyW ? '#8b84ff' : '#d6d2ff'); } };
}

export function buildTool(tool) {
  if (tool.kind === 'pip') return buildPipette(tool);
  if (tool.kind === 'aid') return buildAid(tool);
  return buildVac(tool);
}

// Mechanical counter digits for the bottom-bar readout.
// P20 reads 1-0-0 for 10.0 µL with the tenths drum in red.
export function dialDigits(t) {
  const v = t.vol;
  if (t.spec.id === 'p1000') return { digits: String(Math.round(v)).padStart(4, '0').split(''), red: -1 };
  if (t.spec.max <= 20) return { digits: (v * 10).toFixed(0).padStart(3, '0').split(''), red: 2 };
  return { digits: String(Math.round(v)).padStart(3, '0').split(''), red: -1 };
}
