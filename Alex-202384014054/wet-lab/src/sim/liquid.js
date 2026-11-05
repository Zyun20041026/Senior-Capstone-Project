// Alex 202384014054
// Liquids are plain objects { c: {key: amount}, mix }.
// Solvent keys are volumes in µL; everything else is a solute amount:
//   drug:<id>  pmol   (pmol/µL = µM)
//   cells      live cells        dead   dead cells
//   bug        contamination load (arbitrary units)
// mix is homogeneity in [0,1]; 1 means a pipetted sample has the bulk composition.

export const SOLVENTS = ['medium', 'pbs', 'trypsin', 'water', 'dmso', 'tb', 'cck8', 'ethanol'];
const SOLV = new Set(SOLVENTS);
export const isSolvent = (k) => SOLV.has(k);

export function L(parts = {}, mix = 1) {
  const c = {};
  for (const k in parts) if (parts[k] > 0) c[k] = parts[k];
  return { c, mix };
}

export const EMPTY = L();

export function vol(l) {
  let v = 0;
  for (const k in l.c) if (SOLV.has(k)) v += l.c[k];
  return v;
}

// How patchy the mixture of a and b is right after they meet: for each
// component, the coefficient of variation of a two-zone liquid (b's share of
// the volume at b's concentration, the rest at a's). Traces that cannot
// matter to any measurement are ignored, so a wet tip film barely counts while
// a drop of stock in medium is fully unmixed.
const TRACE = { cells: 0.05, dead: 0.05 }; // per µL; drugs 1e-4 µM; solvents 0.5 %
function patchiness(a, b, va, vb) {
  const s = vb / (va + vb);
  let h = 0;
  const keys = new Set([...Object.keys(a.c), ...Object.keys(b.c)]);
  for (const k of keys) {
    if (k === 'bug' || k.startsWith('src:')) continue;
    const ca = (a.c[k] || 0) / va, cb = (b.c[k] || 0) / vb;
    const m = s * cb + (1 - s) * ca;
    const floor = SOLV.has(k) ? 0.005 : TRACE[k] ?? 1e-4;
    if (m < floor) continue;
    h = Math.max(h, (Math.sqrt(s * (1 - s)) * Math.abs(cb - ca)) / m);
  }
  return Math.min(1, h);
}

export function add(a, b) {
  const va = vol(a), vb = vol(b);
  const c = { ...a.c };
  for (const k in b.c) c[k] = (c[k] || 0) + b.c[k];
  let mix;
  if (va < 1e-6) mix = b.mix;
  else if (vb < 1e-6) mix = a.mix;
  else {
    // A fully foreign addition leaves a local plume; a big one churns the
    // receiving liquid a little on its own.
    const share = vb / (va + vb), base = 0.12 + 0.35 * share;
    mix = Math.min(a.mix, b.mix, 1 - patchiness(a, b, va, vb) * (1 - base));
  }
  return { c, mix };
}

// Take `v` µL. When the liquid is not homogeneous the solutes in the sample are
// scaled by `skew` (drawn by the caller from the world rng).
export function split(l, v, skew = 1) {
  const total = vol(l);
  if (total <= 1e-9 || v <= 0) return [L(), { c: { ...l.c }, mix: l.mix }];
  const f = Math.min(1, v / total);
  const s = f >= 0.999 ? 1 : skew;
  const take = {}, rest = {};
  for (const k in l.c) {
    const amt = l.c[k];
    const t = SOLV.has(k) ? amt * f : Math.min(amt, amt * f * s);
    if (t > 1e-12) take[k] = t;
    if (amt - t > 1e-9) rest[k] = amt - t;
  }
  return [{ c: take, mix: l.mix }, { c: rest, mix: l.mix }];
}

export const um = (l, key) => { const v = vol(l); return v > 1e-9 ? (l.c[key] || 0) / v : 0; };
// Every drug in a liquid, { compound id: µM }: the shape drugFactor() takes.
export function drugsOf(l) {
  const out = {};
  for (const k in l.c) if (k.startsWith('drug:')) out[k.slice(5)] = um(l, k);
  return out;
}
export const perUL = (l, key) => um(l, key);
export const dmsoPct = (l) => { const v = vol(l); return v > 1e-9 ? 100 * (l.c.dmso || 0) / v : 0; };
export const mixed = (l, amount = 1) => ({ c: { ...l.c }, mix: Math.min(1, l.mix + amount) });
export const scale = (l, f) => { const c = {}; for (const k in l.c) c[k] = l.c[k] * f; return { c, mix: l.mix }; };
export const drugs = (l) => Object.keys(l.c).filter((k) => k.startsWith('drug:'));

// Display colour. Each solvent carries an RGB and a strength; cells add haze;
// contamination turns phenol red yellow and cloudy.
const TINT = {
  medium: [214, 72, 96, 0.72],
  trypsin: [232, 132, 150, 0.42],
  pbs: [184, 208, 234, 0.3],
  water: [176, 204, 234, 0.3],
  dmso: [206, 216, 230, 0.24],
  tb: [34, 58, 156, 3.2],
  cck8: [236, 196, 92, 0.6],
  ethanol: [230, 236, 240, 0.1],
};
export function color(l, extra = {}) {
  const v = vol(l);
  if (v < 1e-6) return { fill: 'rgb(220,228,236)', alpha: 0, haze: 0 };
  let r = 0, g = 0, b = 0, w = 0, a = 0;
  for (const k in TINT) {
    const amt = l.c[k];
    if (!amt) continue;
    const [tr, tg, tb, ts] = TINT[k];
    const wt = (amt / v) * ts;
    r += tr * wt; g += tg * wt; b += tb * wt; w += wt;
    a += (amt / v) * Math.min(1, ts);
  }
  if (w <= 0) return { fill: 'rgb(220,228,236)', alpha: 0.15, haze: 0 };
  r /= w; g /= w; b /= w;
  // Acidified medium (contamination or overgrowth) shifts phenol red to yellow.
  const acid = Math.min(1, Math.max(extra.acid || 0, (l.c.bug || 0) / 3));
  if (acid > 0 && l.c.medium) { r = r + (226 - r) * acid; g = g + (178 - g) * acid; b = b + (66 - b) * acid; }
  // Developed CCK-8 formazan: orange, scaled by caller-provided signal.
  if (extra.formazan) { const f = Math.min(1, extra.formazan); r += (232 - r) * f; g += (128 - g) * f; b += (36 - b) * f; a = Math.max(a, 0.5 + 0.4 * f); }
  const cells = (l.c.cells || 0) + (l.c.dead || 0);
  const haze = Math.min(0.55, (cells / v) / 6000 + acid * 0.5);
  return { fill: `rgb(${r | 0},${g | 0},${b | 0})`, alpha: Math.min(0.95, 0.12 + a), haze };
}
