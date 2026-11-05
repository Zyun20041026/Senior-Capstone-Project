// Alex 202384014054
// Station backdrops and fixed instruments. Each builder returns
// { back, front, update(w) }: `back` sits under the items, `front` over them
// (water-bath water, cabinet sash glass). Clickable parts carry data-fx.

import { el, setA, show, txt, setT, rr } from './svg.js';
import { segDisplay } from './seg.js';
import { STATIONS, DECK } from '../game/layout.js';
import { balanceReading } from '../game/actions.js';
import { occupant } from '../game/world.js';

const fx = (e, id, label) => { e.setAttribute('data-fx', id); if (label) e.setAttribute('data-label', label); e.style.cursor = 'pointer'; return e; };

function roomWall(g, { shelf = true } = {}) {
  el('rect', { x: 0, y: 56, width: 1600, height: 772, fill: 'url(#wall)' }, g);
  el('rect', { x: 0, y: 56, width: 1600, height: 772, fill: 'url(#tile)' }, g);
  // ceiling light wash
  el('ellipse', { cx: 800, cy: 40, rx: 900, ry: 260, fill: 'url(#glow)', opacity: 0.55 }, g);
  if (shelf) {
    const s = el('g', { filter: 'url(#blurBg)', opacity: 0.55 }, g);
    el('rect', { x: 60, y: 186, width: 1480, height: 8, fill: '#a7b0ba' }, s);
    const cols = ['#2f6fd6', '#f08a2c', '#e9edf1', '#b8621a', '#e9edf1', '#3a9a6a', '#e9edf1', '#7469e6'];
    for (let i = 0; i < 26; i++) {
      const x = 90 + i * 56 + (i % 3) * 7, h = 40 + ((i * 37) % 50);
      el('rect', { x, y: 186 - h, width: 30 + (i % 4) * 6, height: h, rx: 4, fill: i % 2 ? '#dfe5eb' : '#cdd5dd' }, s);
      el('rect', { x: x + 4, y: 186 - h - 8, width: 22, height: 9, rx: 2, fill: cols[i % cols.length] }, s);
    }
  }
}

function bench(g) {
  el('rect', { x: 0, y: 784, width: 1600, height: 44, fill: 'url(#bench)' }, g);
  el('rect', { x: 0, y: 784, width: 1600, height: 3, fill: '#5a626c' }, g);
  el('rect', { x: 0, y: 787, width: 1600, height: 1, fill: '#fff', opacity: 0.12 }, g);
}

// ---------------------------------------------------------------- biosafety cabinet

function buildBSC() {
  const back = el('g'), front = el('g');
  el('rect', { x: 0, y: 56, width: 1600, height: 772, fill: '#cdd4dc' }, back);
  // interior
  el('rect', { x: 0, y: 176, width: 1600, height: 520, fill: 'url(#perf)' }, back);
  el('rect', { x: 0, y: 176, width: 1600, height: 520, fill: 'url(#steelV)', opacity: 0.55 }, back);
  el('path', { d: 'M0,176L36,200V690L0,700Z', fill: '#9aa3ad' }, back);
  el('path', { d: 'M1600,176L1564,200V690L1600,700Z', fill: '#9aa3ad' }, back);
  // work surface in perspective
  el('path', { d: 'M36,690H1564L1600,800H0Z', fill: 'url(#surface)' }, back);
  el('path', { d: 'M36,690H1564L1600,800H0Z', fill: 'url(#brush)' }, back);
  el('rect', { x: 0, y: 800, width: 1600, height: 14, fill: 'url(#grille)' }, back);
  el('rect', { x: 0, y: 814, width: 1600, height: 14, fill: 'url(#steelDark)' }, back);
  // light bar
  const light = el('g', null, back);
  el('rect', { x: 40, y: 178, width: 1520, height: 6, rx: 3, fill: '#fff' }, light);
  el('rect', { x: 0, y: 184, width: 1600, height: 220, fill: 'url(#lightBar)', opacity: 0.55 }, light);
  // cabinet header with controls
  el('rect', { x: 0, y: 56, width: 1600, height: 120, fill: 'url(#enamel)' }, back);
  el('rect', { x: 0, y: 170, width: 1600, height: 6, fill: '#9aa3ad' }, back);
  const panel = el('g', { transform: 'translate(540,72)' }, back);
  el('path', { d: rr(0, 0, 520, 86, 12), fill: 'url(#lcd)', stroke: '#2b3540', 'stroke-width': 1.5 }, panel);
  txt(panel, '下降气流', { x: 22, y: 26, 'font-size': 11, fill: '#7fa597', 'font-weight': 500 });
  const air = segDisplay(panel, { x: 22, y: 38, n: 4, h: 30, color: '#5dffb0' });
  txt(panel, 'm/s', { x: 118, y: 66, 'font-size': 11, fill: '#7fa597' });
  const status = txt(panel, '', { x: 150, y: 46, 'font-size': 13, fill: '#cfe9df', 'font-weight': 600 });
  const sub = txt(panel, '', { x: 150, y: 66, 'font-size': 11, fill: '#7fa597' });
  const mkBtn = (x, id, label, glyph) => {
    const b = fx(el('g', { transform: `translate(${x},16)` }, panel), id, label);
    const bg = el('path', { d: rr(0, 0, 66, 56, 10), fill: '#1b2530', stroke: '#33424f', 'stroke-width': 1 }, b);
    const led = el('circle', { cx: 56, cy: 10, r: 3.2, fill: '#35414c' }, b);
    el('path', { d: glyph, fill: 'none', stroke: '#cfe0ea', 'stroke-width': 2, 'stroke-linecap': 'round', transform: 'translate(33,24)' }, b);
    txt(b, label, { x: 33, y: 48, 'text-anchor': 'middle', 'font-size': 11, fill: '#cfe0ea', 'font-weight': 500 });
    return { bg, led };
  };
  const bFan = mkBtn(360, 'bsc-fan', '风机', 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0M0,-8V8M-8,0H8');
  const bUV = mkBtn(440, 'bsc-uv', '紫外', 'M0,-10V-5M0,5V10M-10,0H-5M5,0H10M-7,-7L-4,-4M4,4L7,7M-7,7L-4,4M4,-4L7,-7');
  txt(back, 'Class II A2 · 生物安全柜', { x: 1080, y: 108, 'font-size': 15, fill: '#5e6873', 'font-weight': 600 });
  txt(back, '操作前开风机 5 分钟；紫外灯只在无人时使用', { x: 60, y: 132, 'font-size': 12.5, fill: '#7b8590' });
  // pipette stand on the left
  el('path', { d: rr(26, 270, 216, 12, 5), fill: 'url(#graphite)' }, back);
  el('rect', { x: 128, y: 282, width: 8, height: 404, fill: 'url(#graphite)' }, back);
  el('ellipse', { cx: 132, cy: 690, rx: 60, ry: 7, fill: 'url(#shadow)' }, back);
  el('path', { d: rr(80, 680, 104, 12, 5), fill: 'url(#graphite)' }, back);
  // aspirator line and controller dock
  el('path', { d: 'M40,560C40,620 20,640 20,700', fill: 'none', stroke: '#c9d6e0', 'stroke-width': 4, opacity: 0.8 }, back);
  fx(el('path', { d: rr(160, 560, 72, 24, 6), fill: 'url(#graphite)' }, back), 'stand');
  // waste
  const waste = fx(el('g', { transform: 'translate(198,686)' }, back), 'waste', '废弃物缸');
  el('ellipse', { cx: 0, cy: 0, rx: 34, ry: 5, fill: 'url(#shadow)' }, waste);
  el('path', { d: 'M-26,-72L-22,0H22L26,-72Z', fill: 'url(#steelH)', stroke: '#7f8892', 'stroke-width': 1 }, waste);
  el('path', { d: 'M-27,-72Q0,-84 27,-72L24,-62Q0,-70 -24,-62Z', fill: '#f08a2c', opacity: 0.9 }, waste);
  txt(waste, '☣', { x: 0, y: -26, 'text-anchor': 'middle', 'font-size': 22, fill: '#f08a2c' });
  // ethanol bottle (decor; the A key sprays)
  const eth = el('g', { transform: 'translate(620,800)' }, back);
  void eth;
  // deck panel (plan view)
  const dk = el('g', null, back);
  const dx = DECK.x - 18, dy = DECK.y - 44, dw = 3 * DECK.w + 2 * DECK.gapX + 36, dh = 2 * DECK.h + DECK.gapY + 72;
  el('path', { d: rr(dx, dy, dw, dh, 16), fill: '#20262f', opacity: 0.9 }, dk);
  el('path', { d: rr(dx + 6, dy + 34, dw - 12, dh - 40, 11), fill: 'url(#surface)' }, dk);
  el('path', { d: rr(dx + 6, dy + 34, dw - 12, dh - 40, 11), fill: 'url(#perf)', opacity: 0.22 }, dk);
  txt(dk, '台面俯视', { x: dx + 18, y: dy + 22, 'font-size': 13, 'font-weight': 600, fill: '#e9edf3' });
  txt(dk, '孔板、加样槽和多道枪的枪头盒放在这里', { x: dx + 90, y: dy + 22, 'font-size': 11.5, fill: '#98a2b1' });
  for (let i = 0; i < 6; i++) {
    const c = i % 3, r = Math.floor(i / 3);
    const x = DECK.x + c * (DECK.w + DECK.gapX), y = DECK.y + r * (DECK.h + DECK.gapY);
    el('path', { d: rr(x - 4, y - 4, DECK.w + 8, DECK.h + 8, 9), fill: 'none', stroke: '#8a939d', 'stroke-width': 1.2, 'stroke-dasharray': '6 6', opacity: 0.6 }, dk);
    txt(dk, `D${i + 1}`, { x: x + 2, y: y + DECK.h + 20, 'font-size': 11, 'font-weight': 700, fill: '#59636e' });
  }
  // front: dimming / UV wash and the sash glass edge
  const dim = el('rect', { x: 0, y: 176, width: 1600, height: 652, fill: '#0b1220', opacity: 0 }, front);
  const uv = el('rect', { x: 0, y: 176, width: 1600, height: 652, fill: 'url(#uv)', opacity: 0 }, front);
  el('rect', { x: 0, y: 176, width: 1600, height: 60, fill: '#dfe9f2', opacity: 0.16 }, front);
  el('rect', { x: 0, y: 234, width: 1600, height: 3, fill: '#fff', opacity: 0.35 }, front);
  el('path', { d: 'M220,176L170,236H210L260,176Z M300,176L250,236H262L312,176Z', fill: '#fff', opacity: 0.18 }, front);
  return {
    back, front,
    update(w) {
      const b = w.bsc;
      const warm = b.fan ? Math.min(1, (w.t - b.fanSince) / 5) : 0;
      show(light, b.light);
      setA(dim, 'opacity', b.light ? 0 : 0.42);
      setA(uv, 'opacity', b.uv ? 0.75 : 0);
      if (!b.fan) { air.set(' --', '#4a6a5e'); setT(status, '风机已关闭'); setT(sub, b.uv ? '紫外灯开启中——不要在柜内操作' : '按「风机」启动层流'); }
      else if (warm < 1) { const left = Math.max(0, 5 - (w.t - b.fanSince)); air.set((0.3 + 0.15 * warm).toFixed(2), '#f3b64a'); setT(status, '气流稳定中'); setT(sub, `还需约 ${Math.ceil(left)} 分钟（Z 等待）`); }
      else { air.set('0.45', '#5dffb0'); setT(status, b.uv ? '紫外灯开启中' : '气流正常，可以操作'); setT(sub, b.wiped ? '台面已用 75% 酒精擦拭' : '台面还没有擦拭（悬停台面按 A）'); }
      setA(bFan.led, 'fill', b.fan ? '#5dffb0' : '#35414c');
      setA(bUV.led, 'fill', b.uv ? '#a98bff' : '#35414c');
      setA(status, 'fill', b.uv ? '#c9b6ff' : '#cfe9df');
    },
  };
}

// ---------------------------------------------------------------- bench

function buildBench(level) {
  const back = el('g'), front = el('g');
  roomWall(back);
  bench(back);
  const parts = {};
  const has = (k) => !level.benchFixtures || level.benchFixtures.includes(k);
  // analytical balance
  if (has('balance')) {
    const b = fx(el('g', { transform: 'translate(250,784)' }, back), 'balance', '分析天平');
    el('ellipse', { cx: 0, cy: 2, rx: 150, ry: 8, fill: 'url(#shadow)' }, b);
    el('path', { d: rr(-130, -72, 260, 72, 10), fill: 'url(#graphite)' }, b);
    el('path', { d: rr(-122, -64, 110, 44, 6), fill: 'url(#lcd)', stroke: '#2b3540' }, b);
    parts.bal = segDisplay(b, { x: -112, y: -56, n: 6, h: 22, color: '#a8f0ff', gap: 0.32 });
    txt(b, 'g', { x: -18, y: -26, 'font-size': 11, fill: '#7fb7c4' });
    const mk = (x, id, label) => { const k = fx(el('g', { transform: `translate(${x},-42)` }, b), id, label); el('path', { d: rr(-22, -12, 44, 24, 6), fill: '#3c4550', stroke: '#566170' }, k); txt(k, label, { x: 0, y: 4.5, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: '#e9edf3' }); return k; };
    mk(24, 'bal-tare', '去皮'); mk(78, 'bal-print', '打印');
    // draft shield
    el('path', { d: 'M-100,-72V-262H100V-72', fill: '#dfe9f2', opacity: 0.18, stroke: '#9fb0c0', 'stroke-width': 1.5 }, b);
    el('rect', { x: -104, y: -268, width: 208, height: 10, rx: 3, fill: 'url(#graphite)' }, b);
    parts.door = fx(el('rect', { x: -100, y: -258, width: 100, height: 186, fill: '#e3eef7', opacity: 0.32, stroke: '#8aa0b4', 'stroke-width': 1 }, b), 'bal-doors', '防风罩门');
    el('ellipse', { cx: 0, cy: -184, rx: 52, ry: 7, fill: 'url(#steelH)', stroke: '#7f8892' }, b);
    el('rect', { x: -3, y: -184, width: 6, height: 112, fill: 'url(#steelDark)' }, b);
    parts.doorTxt = txt(b, '', { x: 0, y: -280, 'text-anchor': 'middle', 'font-size': 12, fill: '#55606d' });
  }
  // centrifuge
  if (has('centrifuge')) {
    const c = fx(el('g', { transform: 'translate(540,784)' }, back), 'centrifuge', '离心机');
    el('ellipse', { cx: 0, cy: 2, rx: 140, ry: 9, fill: 'url(#shadow)' }, c);
    el('path', { d: 'M-118,0V-120Q-118,-150 -88,-150H88Q118,-150 118,-120V0Z', fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1 }, c);
    parts.lid = el('path', { d: 'M-108,-150Q-100,-176 -60,-180H60Q100,-176 108,-150Z', fill: '#e6eaee', stroke: '#9aa4ae', 'stroke-width': 1 }, c);
    parts.lidOpen = el('path', { d: 'M-108,-150L-96,-252Q-60,-262 -40,-258L-30,-150Z', fill: '#e6eaee', opacity: 0.9, stroke: '#9aa4ae' }, c);
    el('path', { d: rr(-92, -112, 184, 54, 8), fill: 'url(#lcdBlue)', stroke: '#2b3540' }, c);
    parts.rpm = segDisplay(c, { x: -84, y: -104, n: 4, h: 22, color: '#ff8a5c' });
    txt(c, 'rpm', { x: 4, y: -76, 'font-size': 10, fill: '#9aa8bb' });
    parts.cmin = segDisplay(c, { x: 34, y: -104, n: 2, h: 22, color: '#ff8a5c' });
    txt(c, 'min', { x: 74, y: -76, 'font-size': 10, fill: '#9aa8bb' });
    txt(c, '转子半径 10 cm', { x: 0, y: -26, 'text-anchor': 'middle', 'font-size': 12, fill: '#55606d', 'font-weight': 600 });
    parts.calarm = txt(c, '', { x: 0, y: -126, 'text-anchor': 'middle', 'font-size': 13, fill: '#d93a43', 'font-weight': 700 });
  }
  // inverted microscope
  if (has('scope')) {
    const m = fx(el('g', { transform: 'translate(800,784)' }, back), 'scope', '倒置显微镜');
    el('ellipse', { cx: 0, cy: 2, rx: 120, ry: 8, fill: 'url(#shadow)' }, m);
    el('path', { d: rr(-100, -40, 200, 40, 10), fill: 'url(#enamelH)', stroke: '#a7b0ba' }, m);
    el('path', { d: 'M40,-40V-330Q40,-350 20,-350H-40V-300H0V-40Z', fill: 'url(#enamelH)', stroke: '#a7b0ba' }, m);
    el('path', { d: 'M-70,-224H70V-210H-70Z', fill: 'url(#graphite)' }, m);
    el('path', { d: 'M-40,-350L-96,-404L-80,-418L-24,-364Z', fill: 'url(#graphite)' }, m);
    el('path', { d: 'M-40,-60V-210', stroke: '#3a414a', 'stroke-width': 10 }, m);
    el('circle', { cx: 52, cy: -100, r: 16, fill: 'url(#graphite)' }, m);
    el('circle', { cx: 52, cy: -100, r: 9, fill: '#59636e' }, m);
    txt(m, '点击观察', { x: -10, y: -240, 'text-anchor': 'middle', 'font-size': 12, fill: '#55606d', 'font-weight': 600 });
  }
  // water bath
  if (has('bath')) {
    const wb = el('g', { transform: 'translate(1100,784)' }, back);
    el('ellipse', { cx: 0, cy: 2, rx: 190, ry: 9, fill: 'url(#shadow)' }, wb);
    el('path', { d: 'M-160,-120H160V0H-160Z', fill: 'url(#steelH)', stroke: '#7f8892' }, wb);
    el('path', { d: 'M-150,-112H150V-10H-150Z', fill: '#7da9cc', opacity: 0.55 }, wb);
    el('path', { d: rr(-150, -36, 92, 28, 5), fill: 'url(#lcd)' }, wb);
    parts.bath = segDisplay(wb, { x: -144, y: -32, n: 4, h: 18, color: '#ffb35c' });
    txt(wb, '°C', { x: -70, y: -14, 'font-size': 10, fill: '#cfd6de' });
    txt(wb, '37 °C 水浴锅', { x: 60, y: -18, 'text-anchor': 'middle', 'font-size': 12, fill: '#2b3540', 'font-weight': 600 });
    const wf = el('g', { transform: 'translate(1100,784)' }, front);
    el('path', { d: 'M-150,-90H150V-38H-150Z', fill: '#6f9fc8', opacity: 0.42 }, wf);
    el('rect', { x: -150, y: -92, width: 300, height: 3, fill: '#fff', opacity: 0.5 }, wf);
    el('path', { d: 'M-160,-38H160V0H-160Z', fill: 'url(#steelH)', stroke: '#7f8892' }, wf);
    el('path', { d: rr(-150, -34, 92, 28, 5), fill: 'url(#lcd)' }, wf);
    parts.bath2 = segDisplay(wf, { x: -144, y: -30, n: 4, h: 18, color: '#ffb35c' });
    txt(wf, '°C', { x: -70, y: -12, 'font-size': 10, fill: '#cfd6de' });
    txt(wf, '37 °C 水浴锅', { x: 60, y: -14, 'text-anchor': 'middle', 'font-size': 12, fill: '#2b3540', 'font-weight': 600 });
  }
  // vortex
  if (has('vortex')) {
    const v = fx(el('g', { transform: 'translate(1336,784)' }, back), 'vortex', '涡旋混匀仪');
    el('ellipse', { cx: 0, cy: 2, rx: 46, ry: 6, fill: 'url(#shadow)' }, v);
    el('path', { d: 'M-38,0L-30,-50H30L38,0Z', fill: 'url(#enamelH)', stroke: '#a7b0ba' }, v);
    el('ellipse', { cx: 0, cy: -52, rx: 18, ry: 5, fill: '#3a414a' }, v);
    el('circle', { cx: 0, cy: -26, r: 9, fill: '#d93a43' }, v);
    txt(v, '点击混匀', { x: 0, y: 18, 'text-anchor': 'middle', 'font-size': 11, fill: '#cfd6de' });
  }
  // tube rack on the bench
  if (has('rack')) {
    const r = el('g', { transform: 'translate(1491,790)' }, back);
    el('path', { d: rr(-76, -46, 152, 10, 3), fill: '#e9edf1', stroke: '#9aa4ae' }, r);
    el('path', { d: 'M-72,-36V0M72,-36V0', stroke: '#9aa4ae', 'stroke-width': 4 }, r);
  }
  if (has('stand')) {
    const s = el('g', null, back);
    el('path', { d: rr(1400, 296, 140, 12, 5), fill: 'url(#graphite)' }, s);
    el('rect', { x: 1466, y: 308, width: 8, height: 476, fill: 'url(#graphite)' }, s);
    el('path', { d: rr(1420, 772, 100, 12, 5), fill: 'url(#graphite)' }, s);
  }
  // tip waste
  const wst = fx(el('g', { transform: 'translate(46,790)' }, back), 'waste', '废枪头盒');
  el('path', { d: 'M-28,0L-24,-58H24L28,0Z', fill: '#f2f4f6', stroke: '#9aa4ae' }, wst);
  el('path', { d: 'M-25,-48H25', stroke: '#f08a2c', 'stroke-width': 6 }, wst);
  txt(wst, '废弃', { x: 0, y: -20, 'text-anchor': 'middle', 'font-size': 11, fill: '#55606d', 'font-weight': 600 });
  return {
    back, front,
    update(w) {
      if (parts.bal) {
        const r = balanceReading(w);
        parts.bal.set(r.toFixed(4));
        setA(parts.door, 'opacity', w.inst.balance.doors ? 0.32 : 0.08);
        setT(parts.doorTxt, w.inst.balance.doors ? '防风罩已关（点击玻璃门开关）' : '防风罩开着——读数会漂移');
      }
      if (parts.lid) {
        const c = w.inst.centrifuge;
        show(parts.lid, !c.lid); show(parts.lidOpen, c.lid);
        parts.rpm.set(c.rpm ? String(Math.round(c.rpm)).slice(0, 4) : '----');
        parts.cmin.set(String(c.min || 0));
        setT(parts.calarm, c.alarm ? '不平衡！' : '');
      }
      if (parts.bath) { parts.bath.set('37.0'); parts.bath2.set('37.0'); }
    },
  };
}

// ---------------------------------------------------------------- incubator

function buildIncubator() {
  const back = el('g'), front = el('g');
  roomWall(back, { shelf: false });
  bench(back);
  const x0 = 470, y0 = 150, W = 640, H = 620;
  el('ellipse', { cx: x0 + W / 2, cy: 786, rx: W * 0.6, ry: 12, fill: 'url(#shadow)' }, back);
  el('path', { d: rr(x0 - 20, y0 - 30, W + 40, H + 60, 18), fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, back);
  el('path', { d: rr(x0, y0, W, H, 8), fill: 'url(#steelV)' }, back);
  el('path', { d: rr(x0, y0, W, H, 8), fill: 'url(#perf)', opacity: 0.25 }, back);
  for (let s = 0; s < 3; s++) {
    const y = 330 + s * 170;
    el('rect', { x: x0 + 16, y, width: W - 32, height: 7, rx: 2, fill: 'url(#steelDark)' }, back);
  }
  // display
  const d = el('g', { transform: `translate(${x0 + W + 40},${y0 + 10})` }, back);
  el('path', { d: rr(0, 0, 200, 150, 14), fill: 'url(#lcd)', stroke: '#2b3540' }, d);
  txt(d, '温度', { x: 18, y: 28, 'font-size': 12, fill: '#7fa597' });
  segDisplay(d, { x: 18, y: 38, n: 4, h: 30, color: '#5dffb0' }).set('37.0');
  txt(d, '°C', { x: 160, y: 66, 'font-size': 12, fill: '#7fa597' });
  txt(d, 'CO₂', { x: 18, y: 98, 'font-size': 12, fill: '#7fa597' });
  segDisplay(d, { x: 18, y: 106, n: 4, h: 26, color: '#5dffb0' }).set(' 5.0');
  txt(d, '%', { x: 160, y: 130, 'font-size': 12, fill: '#7fa597' });
  txt(back, 'CO₂ 培养箱 · 37 °C · 5% CO₂ · 95% 湿度', { x: x0, y: y0 - 44, 'font-size': 13, fill: '#55606d', 'font-weight': 600 });
  // door (front)
  const door = fx(el('g', null, front), 'inc-door', '培养箱门');
  el('path', { d: rr(x0 - 10, y0 - 10, W + 20, H + 20, 12), fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, door);
  el('path', { d: rr(x0 + 40, y0 + 40, W - 80, H - 80, 10), fill: '#eef1f4', stroke: '#c3cad2' }, door);
  el('rect', { x: x0 + W - 34, y: y0 + H / 2 - 70, width: 14, height: 140, rx: 7, fill: 'url(#graphite)' }, door);
  txt(door, '点击开门', { x: x0 + W / 2, y: y0 + H / 2, 'text-anchor': 'middle', 'font-size': 16, fill: '#8a939d', 'font-weight': 600 });
  const openDoor = fx(el('g', null, front), 'inc-door', '培养箱门');
  el('path', { d: `M${x0 - 10},${y0 - 10}L${x0 - 110},${y0 + 30}V${y0 + H - 30}L${x0 - 10},${y0 + H + 10}Z`, fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, openDoor);
  el('rect', { x: x0 - 96, y: y0 + H / 2 - 60, width: 10, height: 120, rx: 5, fill: 'url(#graphite)' }, openDoor);
  return { back, front, update(w) { show(door, !w.inst.incubator.door); show(openDoor, w.inst.incubator.door); } };
}

// ---------------------------------------------------------------- fridge & freezer

function buildFridge() {
  const back = el('g'), front = el('g');
  roomWall(back, { shelf: false });
  bench(back);
  const box = (x, y, w, h) => {
    el('ellipse', { cx: x + w / 2, cy: 788, rx: w * 0.62, ry: 11, fill: 'url(#shadow)' }, back);
    el('path', { d: rr(x - 16, y - 24, w + 32, 784 - y + 24, 14), fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, back);
    el('path', { d: rr(x, y, w, h, 8), fill: '#e8eef4' }, back);
  };
  box(186, 168, 470, 560);
  for (let s = 0; s < 3; s++) el('rect', { x: 196, y: 330 + s * 172, width: 450, height: 6, rx: 2, fill: '#c9d4de' }, back);
  txt(back, '4 °C 试剂冰箱', { x: 186, y: 130, 'font-size': 14, fill: '#3a4450', 'font-weight': 700 });
  txt(back, '培养基、PBS、胰酶、台盼蓝、CCK-8', { x: 186, y: 150, 'font-size': 12, fill: '#6b7683' });
  box(880, 230, 420, 470);
  for (let s = 0; s < 2; s++) el('rect', { x: 890, y: 404 + s * 170, width: 400, height: 6, rx: 2, fill: '#c9d4de' }, back);
  txt(back, '−20 °C 冰箱', { x: 880, y: 190, 'font-size': 14, fill: '#3a4450', 'font-weight': 700 });
  txt(back, '化合物 10 mM DMSO 母液', { x: 880, y: 210, 'font-size': 12, fill: '#6b7683' });
  const fd = fx(el('g', null, front), 'fridge-door', '冰箱门');
  el('path', { d: rr(178, 160, 486, 576, 10), fill: '#dfeaf4', opacity: 0.38, stroke: '#9fb0c0', 'stroke-width': 3 }, fd);
  el('path', { d: 'M240,190L340,190L230,560Z', fill: '#fff', opacity: 0.16 }, fd);
  el('rect', { x: 630, y: 360, width: 12, height: 140, rx: 6, fill: 'url(#graphite)' }, fd);
  const fdo = fx(el('g', null, front), 'fridge-door', '冰箱门');
  el('path', { d: 'M178,160L96,196V700L178,736Z', fill: '#dfeaf4', opacity: 0.55, stroke: '#9fb0c0', 'stroke-width': 3 }, fdo);
  const zd = fx(el('g', null, front), 'freezer-door', '冰箱门');
  el('path', { d: rr(872, 222, 436, 486, 10), fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, zd);
  el('rect', { x: 1272, y: 380, width: 12, height: 140, rx: 6, fill: 'url(#graphite)' }, zd);
  const zl = el('g', { transform: 'translate(1090,330)' }, zd);
  el('path', { d: rr(-80, -24, 160, 48, 8), fill: 'url(#lcd)' }, zl);
  segDisplay(zl, { x: -64, y: -14, n: 4, h: 26, color: '#7ec8ff' }).set('-20.0');
  txt(zd, '点击开门', { x: 1090, y: 470, 'text-anchor': 'middle', 'font-size': 16, fill: '#8a939d', 'font-weight': 600 });
  const zdo = fx(el('g', null, front), 'freezer-door', '冰箱门');
  el('path', { d: 'M1308,222L1390,258V672L1308,708Z', fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, zdo);
  return { back, front, update(w) { show(fd, !w.inst.fridge.door); show(fdo, w.inst.fridge.door); show(zd, !w.inst.freezer.door); show(zdo, w.inst.freezer.door); } };
}

// ---------------------------------------------------------------- plate reader & analysis computer

function buildReader() {
  const back = el('g'), front = el('g');
  roomWall(back);
  bench(back);
  const r = fx(el('g', { transform: 'translate(430,784)' }, back), 'reader', '酶标仪');
  el('ellipse', { cx: 0, cy: 2, rx: 260, ry: 11, fill: 'url(#shadow)' }, r);
  el('path', { d: rr(-230, -250, 460, 250, 16), fill: 'url(#enamelH)', stroke: '#a7b0ba', 'stroke-width': 1.5 }, r);
  el('path', { d: rr(-230, -250, 460, 52, 16), fill: 'url(#graphite)' }, r);
  txt(r, '多功能酶标仪', { x: -206, y: -218, 'font-size': 15, fill: '#e9edf3', 'font-weight': 700 });
  txt(r, '吸光度 · 340–750 nm', { x: -206, y: -202, 'font-size': 11, fill: '#98a2b1' });
  el('path', { d: rr(60, -238, 150, 30, 6), fill: 'url(#lcd)' }, r);
  const wl = segDisplay(r, { x: 72, y: -232, n: 3, h: 18, color: '#5dffb0' });
  txt(r, 'nm', { x: 158, y: -214, 'font-size': 10, fill: '#7fa597' });
  el('rect', { x: -170, y: -150, width: 340, height: 8, rx: 4, fill: '#3a414a' }, r);
  const drawer = el('g', null, r);
  el('path', { d: rr(-164, -188, 328, 26, 4), fill: '#d6dce2', stroke: '#9aa4ae' }, drawer);
  el('path', { d: rr(-164, -188, 328, 26, 4), fill: 'url(#brush)' }, drawer);
  const drawerOut = el('g', null, r);
  el('path', { d: 'M-170,-184L-200,-170H200L170,-184Z', fill: '#c9d0d8', stroke: '#9aa4ae' }, drawerOut);
  txt(r, '点击操作', { x: 0, y: -60, 'text-anchor': 'middle', 'font-size': 13, fill: '#8a939d', 'font-weight': 600 });
  // computer
  const c = fx(el('g', { transform: 'translate(1110,784)' }, back), 'computer', '数据分析电脑');
  el('ellipse', { cx: 0, cy: 2, rx: 220, ry: 9, fill: 'url(#shadow)' }, c);
  el('path', { d: 'M-40,0L-24,-90H24L40,0Z', fill: 'url(#graphite)' }, c);
  el('path', { d: rr(-300, -470, 600, 380, 16), fill: '#11161d', stroke: '#2f3843', 'stroke-width': 2 }, c);
  el('path', { d: rr(-286, -456, 572, 352, 8), fill: 'url(#monitorG)' }, c);
  const scr = el('g', { transform: 'translate(-286,-456)' }, c);
  el('rect', { width: 572, height: 30, fill: '#1c2430' }, scr);
  txt(scr, 'Dose–Response Studio', { x: 16, y: 20, 'font-size': 12.5, fill: '#cfd6de', 'font-weight': 600 });
  for (let i = 0; i < 3; i++) el('circle', { cx: 540 - i * 16, cy: 15, r: 4.5, fill: ['#ff6262', '#f3b64a', '#3fd18f'][i], opacity: 0.8 }, scr);
  const axis = el('g', { transform: 'translate(60,60)' }, scr);
  el('path', { d: 'M0,0V220H440', stroke: '#3a4552', fill: 'none', 'stroke-width': 1.5 }, axis);
  el('path', { d: 'M0,20C120,20 170,30 220,110S330,200 440,205', stroke: '#8b84ff', fill: 'none', 'stroke-width': 3 }, axis);
  el('path', { d: 'M0,24C200,24 300,40 360,110S420,180 440,186', stroke: '#e06478', fill: 'none', 'stroke-width': 3, opacity: 0.8 }, axis);
  txt(scr, '点击打开分析软件', { x: 286, y: 330, 'text-anchor': 'middle', 'font-size': 15, fill: '#e9edf3', 'font-weight': 600 });
  return {
    back, front,
    update(w) {
      const d = w.inst.reader.drawer;
      show(drawer, !d); show(drawerOut, d);
      wl.set(String(w.inst.reader.wl));
      void occupant;
    },
  };
}

export function buildStation(id, level) {
  if (id === 'bsc') return buildBSC();
  if (id === 'bench') return buildBench(level || {});
  if (id === 'incubator') return buildIncubator();
  if (id === 'fridge') return buildFridge();
  return buildReader();
}

export { STATIONS };
