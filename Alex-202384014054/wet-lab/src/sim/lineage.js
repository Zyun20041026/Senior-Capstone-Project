// Alex 202384014054
// Cell identity. Wherever cells go, a parallel set of `src:<line>` weights
// goes with them: in a liquid they are solute keys (so pipetting, mixing and
// splitting carry them in proportion); in a pellet or a well they are a plain
// map. Only the ratios matter. A culture that never had foreign cells added
// has no weights and falls back to its container's line.

export const SRC = 'src:';
export const isSrc = (k) => k.startsWith(SRC);

export function tagCells(l, line, amount) {
  if (!line || !(amount > 0)) return;
  l.c[SRC + line] = (l.c[SRC + line] || 0) + amount;
}
// Move `frac` of a liquid's identity weights into a map (pellet, well).
export function takeSrc(l, map, frac = 1) {
  for (const k of Object.keys(l.c)) {
    if (!isSrc(k)) continue;
    const m = l.c[k] * frac;
    map[k.slice(SRC.length)] = (map[k.slice(SRC.length)] || 0) + m;
    l.c[k] -= m;
    if (l.c[k] < 1e-9) delete l.c[k];
  }
  return map;
}
// The reverse: `frac` of a map's weights back into a liquid.
export function giveSrc(map, l, frac = 1) {
  if (!map) return;
  for (const line in map) { const m = map[line] * frac; tagCells(l, line, m); map[line] -= m; }
}
export function liquidSrc(l) {
  const out = {};
  for (const k in l.c) if (isSrc(k)) out[k.slice(SRC.length)] = l.c[k];
  return out;
}
// Normalised composition { line: fraction }, falling back to one line.
export function composition(map, fallback) {
  const tot = Object.values(map || {}).reduce((s, x) => s + x, 0);
  if (!(tot > 0)) return fallback ? { [fallback]: 1 } : {};
  const out = {};
  for (const k in map) if (map[k] / tot > 1e-4) out[k] = map[k] / tot;
  return out;
}
// The identity of a well right now: attached cells plus any still settling.
export function wellComposition(wl, fallback) {
  const m = { ...(wl.src || {}) };
  if (!wl.src && wl.n > 0 && fallback) m[fallback] = wl.n;
  for (const [k, v] of Object.entries(liquidSrc(wl.liq))) m[k] = (m[k] || 0) + v;
  return composition(m, wl.n > 0 || wl.liq.c.cells ? fallback : null);
}
