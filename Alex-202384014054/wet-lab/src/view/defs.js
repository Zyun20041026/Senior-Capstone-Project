// Alex 202384014054
// Shared materials: brushed steel, enamel, glass, polypropylene, LCD glass.

import { el } from './svg.js';

function lin(defs, id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1, extra = {}) {
  const g = el('linearGradient', { id, x1, y1, x2, y2, ...extra }, defs);
  for (const [o, c, a = 1] of stops) el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}
function rad(defs, id, stops, cx = 0.5, cy = 0.5, r = 0.5) {
  const g = el('radialGradient', { id, cx, cy, r }, defs);
  for (const [o, c, a = 1] of stops) el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}

export function buildDefs(svg) {
  const d = el('defs', null, svg);
  lin(d, 'wall', [[0, '#e9edf1'], [0.55, '#dde2e8'], [1, '#c9d0d8']]);
  lin(d, 'wallWarm', [[0, '#eceef0'], [1, '#d5d9de']]);
  lin(d, 'bench', [[0, '#3a4048'], [0.08, '#2a2f36'], [1, '#1b1f24']]);
  lin(d, 'benchEdge', [[0, '#4b525b'], [1, '#22262c']]);
  lin(d, 'steelV', [[0, '#f4f6f8'], [0.45, '#cdd3da'], [0.55, '#c3c9d0'], [1, '#e6eaee']]);
  lin(d, 'steelH', [[0, '#c4cad1'], [0.18, '#eef1f4'], [0.5, '#d2d8de'], [0.82, '#f1f3f6'], [1, '#bcc3cb']], 0, 0, 1, 0);
  lin(d, 'steelDark', [[0, '#9aa3ad'], [1, '#6e7782']]);
  lin(d, 'surface', [[0, '#d9dee4'], [0.35, '#eef1f4'], [1, '#c3cad2']]);
  lin(d, 'enamel', [[0, '#fdfdfe'], [0.6, '#eef1f4'], [1, '#dfe4ea']]);
  lin(d, 'enamelH', [[0, '#e3e7ec'], [0.15, '#fbfcfd'], [0.85, '#f3f5f7'], [1, '#d8dde3']], 0, 0, 1, 0);
  lin(d, 'graphite', [[0, '#3b424c'], [1, '#262b32']]);
  lin(d, 'lcd', [[0, '#101a17'], [1, '#08100d']]);
  lin(d, 'lcdBlue', [[0, '#0f1622'], [1, '#090d14']]);
  lin(d, 'glassV', [[0, '#ffffff', 0.5], [0.16, '#ffffff', 0.08], [0.55, '#ffffff', 0.02], [0.84, '#ffffff', 0.28], [1, '#ffffff', 0.06]], 0, 0, 1, 0);
  lin(d, 'ppV', [[0, '#ffffff', 0.62], [0.2, '#f2f5f8', 0.3], [0.6, '#e9eef3', 0.22], [0.86, '#ffffff', 0.5], [1, '#dfe5eb', 0.4]], 0, 0, 1, 0);
  lin(d, 'liqShade', [[0, '#000', 0.22], [0.25, '#000', 0], [0.75, '#000', 0], [1, '#000', 0.26]], 0, 0, 1, 0);
  lin(d, 'amber', [[0, '#7a3d0a', 0.92], [0.3, '#b8621a', 0.82], [0.7, '#9c4f12', 0.86], [1, '#5f2e07', 0.95]], 0, 0, 1, 0);
  lin(d, 'capBlue', [[0, '#1f4fa6'], [0.35, '#3a74db'], [1, '#183f86']], 0, 0, 1, 0);
  lin(d, 'capOrange', [[0, '#c4561a'], [0.35, '#f0873a'], [1, '#a9440f']], 0, 0, 1, 0);
  lin(d, 'capWhite', [[0, '#cfd5dc'], [0.35, '#ffffff'], [1, '#bfc6ce']], 0, 0, 1, 0);
  lin(d, 'capRed', [[0, '#9c1d25'], [0.35, '#d93a43'], [1, '#7f141b']], 0, 0, 1, 0);
  lin(d, 'capGreen', [[0, '#1d7a4a'], [0.35, '#35b26f'], [1, '#14603a']], 0, 0, 1, 0);
  lin(d, 'capPurple', [[0, '#4a3fa8'], [0.35, '#7469e6'], [1, '#3a3189']], 0, 0, 1, 0);
  lin(d, 'tipYellow', [[0, '#e7b81c'], [0.4, '#ffe066'], [1, '#d9a510']], 0, 0, 1, 0);
  lin(d, 'tipBlue', [[0, '#2d67c9'], [0.4, '#6fa3ff'], [1, '#2457b0']], 0, 0, 1, 0);
  lin(d, 'tipWhite', [[0, '#d6dce2'], [0.4, '#ffffff'], [1, '#c7cfd7']], 0, 0, 1, 0);
  lin(d, 'pipBody', [[0, '#b9c0c8'], [0.25, '#f5f7f9'], [0.6, '#dfe3e8'], [1, '#a7afb8']], 0, 0, 1, 0);
  lin(d, 'pipDark', [[0, '#3a414a'], [0.35, '#6a737e'], [1, '#2d333a']], 0, 0, 1, 0);
  lin(d, 'plateTop', [[0, '#f7f9fb', 0.95], [1, '#e4e9ee', 0.9]]);
  lin(d, 'water', [[0, '#9fc6e6'], [1, '#6f9fc8']]);
  lin(d, 'monitorG', [[0, '#141b25'], [1, '#0b1018']]);
  lin(d, 'uv', [[0, '#7b4dff', 0.55], [1, '#3a1d9e', 0.25]]);
  lin(d, 'lightBar', [[0, '#ffffff', 0.9], [1, '#f2f6ff', 0.0]]);
  rad(d, 'shadow', [[0, '#000', 0.34], [0.6, '#000', 0.12], [1, '#000', 0]]);
  rad(d, 'glow', [[0, '#fff', 0.85], [1, '#fff', 0]]);
  rad(d, 'vignette', [[0.55, '#000', 0], [1, '#000', 0.22]], 0.5, 0.45, 0.75);

  const perf = el('pattern', { id: 'perf', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, d);
  el('rect', { width: 9, height: 9, fill: '#c9cfd6' }, perf);
  el('circle', { cx: 4.5, cy: 4.5, r: 1.6, fill: '#8a939d' }, perf);
  el('circle', { cx: 4.2, cy: 4.2, r: 0.7, fill: '#5d6670' }, perf);
  const grille = el('pattern', { id: 'grille', width: 6, height: 12, patternUnits: 'userSpaceOnUse' }, d);
  el('rect', { width: 6, height: 12, fill: '#b5bcc4' }, grille);
  el('rect', { x: 1, y: 2, width: 3, height: 8, rx: 1.5, fill: '#4c545d' }, grille);
  const brush = el('pattern', { id: 'brush', width: 240, height: 6, patternUnits: 'userSpaceOnUse' }, d);
  el('rect', { width: 240, height: 6, fill: 'none' }, brush);
  el('path', { d: 'M0 1.5H240M0 4.2H160M60 2.8H240', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 0.6 }, brush);
  const tile = el('pattern', { id: 'tile', width: 120, height: 120, patternUnits: 'userSpaceOnUse' }, d);
  el('rect', { width: 120, height: 120, fill: 'none' }, tile);
  el('path', { d: 'M0 0.5H120M0.5 0V120', stroke: '#000', 'stroke-opacity': 0.05, 'stroke-width': 1 }, tile);

  const f = el('filter', { id: 'soft', x: '-20%', y: '-20%', width: '140%', height: '150%' }, d);
  el('feDropShadow', { dx: 0, dy: 10, stdDeviation: 12, 'flood-color': '#0b1220', 'flood-opacity': 0.28 }, f);
  const f2 = el('filter', { id: 'blurBg', x: '-5%', y: '-5%', width: '110%', height: '110%' }, d);
  el('feGaussianBlur', { stdDeviation: 3.2 }, f2);
  const f3 = el('filter', { id: 'lift', x: '-30%', y: '-30%', width: '160%', height: '170%' }, d);
  el('feDropShadow', { dx: 0, dy: 16, stdDeviation: 10, 'flood-color': '#0b1220', 'flood-opacity': 0.35 }, f3);
  const f4 = el('filter', { id: 'glowF', x: '-50%', y: '-50%', width: '200%', height: '200%' }, d);
  el('feGaussianBlur', { stdDeviation: 2.4, result: 'b' }, f4);
  const m = el('feMerge', null, f4);
  el('feMergeNode', { in: 'b' }, m); el('feMergeNode', { in: 'SourceGraphic' }, m);
  return d;
}
