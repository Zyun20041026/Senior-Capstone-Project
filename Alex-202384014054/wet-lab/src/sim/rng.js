// Alex 202384014054
// Seeded randomness. Every stochastic event in the lab draws from a world rng
// so a run can be replayed exactly from its seed.

export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function poisson(r, lam) {
  if (lam <= 0) return 0;
  if (lam < 40) {
    const lim = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= r(); } while (p > lim);
    return k - 1;
  }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(r)));
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
