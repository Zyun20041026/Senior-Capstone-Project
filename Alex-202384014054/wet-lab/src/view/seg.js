// Alex 202384014054
// Seven-segment readouts for instrument displays (balance, centrifuge,
// incubator, cabinet airflow). Unlit segments stay faintly visible, as on
// real LED and LCD panels.

import { el, setA } from './svg.js';

const MAP = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', ' ': '', E: 'adefg', r: 'eg', P: 'abefg', L: 'def', H: 'bcefg', A: 'abcefg', C: 'adef', o: 'cdeg', n: 'ceg', U: 'bcdef', t: 'defg', b: 'cdefg', d: 'bcdeg', F: 'aefg', S: 'afgcd', u: 'cde', y: 'bcdfg', h: 'cefg', I: 'ef',
};

function segPaths(w, h, t) {
  const m = h / 2, k = t / 2;
  const H = (x1, x2, y) => `M${x1 + k},${y}L${x1 + t},${y - k}L${x2 - t},${y - k}L${x2 - k},${y}L${x2 - t},${y + k}L${x1 + t},${y + k}Z`;
  const V = (x, y1, y2) => `M${x},${y1 + k}L${x + k},${y1 + t}L${x + k},${y2 - t}L${x},${y2 - k}L${x - k},${y2 - t}L${x - k},${y1 + t}Z`;
  return { a: H(0, w, 0), g: H(0, w, m), d: H(0, w, h), f: V(0, 0, m), b: V(w, 0, m), e: V(0, m, h), c: V(w, m, h) };
}

export function segDisplay(parent, { x, y, n, h = 28, color = '#5dffb0', dim = 0.07, gap = 0.36 }) {
  const w = h * 0.52, t = h * 0.13;
  const g = el('g', { transform: `translate(${x},${y}) skewX(-7)` }, parent);
  const P = segPaths(w, h, t);
  const digits = [];
  for (let i = 0; i < n; i++) {
    const dg = el('g', { transform: `translate(${i * (w + h * gap)},0)` }, g);
    const segs = {};
    for (const s of 'abcdefg') segs[s] = el('path', { d: P[s], fill: color, opacity: dim }, dg);
    const dp = el('circle', { cx: w + h * gap * 0.5, cy: h - t * 0.2, r: t * 0.62, fill: color, opacity: dim }, dg);
    digits.push({ segs, dp });
  }
  return {
    g, width: n * (w + h * gap),
    set(str, col) {
      // A '.' lights the decimal point of the preceding digit.
      const chars = [];
      for (const ch of String(str)) { if (ch === '.' && chars.length) chars[chars.length - 1].dp = true; else chars.push({ ch, dp: false }); }
      while (chars.length < n) chars.unshift({ ch: ' ', dp: false });
      const vis = chars.slice(-n);
      vis.forEach((c, i) => {
        const on = MAP[c.ch] || '';
        for (const s of 'abcdefg') { setA(digits[i].segs[s], 'opacity', on.includes(s) ? 1 : dim); if (col) setA(digits[i].segs[s], 'fill', col); }
        setA(digits[i].dp, 'opacity', c.dp ? 1 : dim);
        if (col) setA(digits[i].dp, 'fill', col);
      });
    },
  };
}
