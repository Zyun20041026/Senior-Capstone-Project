// Alex 202384014054
// SVG element helpers. setA caches the last value on the element so a frame
// only touches the DOM where something changed.

export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function setA(e, k, v) {
  const key = '_' + k;
  if (e[key] !== v) { e.setAttribute(k, v); e[key] = v; }
}

export const show = (e, on) => setA(e, 'visibility', on ? 'inherit' : 'hidden');

export function txt(parent, s, attrs) {
  const t = el('text', attrs, parent);
  t.textContent = s;
  return t;
}

export function setT(e, s) { if (e._t !== s) { e.textContent = s; e._t = s; } }

export const f1 = (x) => Math.round(x * 10) / 10;
export const f2 = (x) => Math.round(x * 100) / 100;

// Rounded-rect path, handy for organic instrument bodies.
export function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x + r}Q${x},${y + h} ${x},${y + h - r}V${y + r}Q${x},${y} ${x + r},${y}Z`;
}
