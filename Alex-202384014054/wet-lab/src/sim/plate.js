// Alex 202384014054
// 96-well plate geometry and the CCK-8 read model.

export const ROWS = 'ABCDEFGH';
export const wellIndex = (row, col) => row * 12 + col;
export const rc = (i) => [Math.floor(i / 12), i % 12];
export const wellName = (i) => ROWS[Math.floor(i / 12)] + ((i % 12) + 1);
export const isEdge = (i) => { const [r, c] = rc(i); return r === 0 || r === 7 || c === 0 || c === 11; };

// Fraction of volume lost to evaporation per 24 h. Outer wells lose most; the
// second ring loses more when the outer ring was left dry.
export function evapRate(i, vols) {
  if (isEdge(i)) return 0.045;
  const [r, c] = rc(i);
  let dryNeighbour = false;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const j = wellIndex(r + dr, c + dc);
    if (isEdge(j) && (vols[j] || 0) < 50) dryNeighbour = true;
  }
  return dryNeighbour ? 0.03 : 0.006;
}

// Absorbance of one well. cells: viable cells; frac: CCK-8 volume fraction;
// minutes: development time at 37 °C; wl: read wavelength (nm).
export function absorbance({ cells, frac, minutes, wl, light = 0, bubble = 0, vol = 100 }, noise) {
  if (vol < 5) return 0.042 + noise() * 0.002;
  const reagent = Math.min(1.5, frac / 0.0909) ** 0.9;
  const dev = Math.min(minutes, 240) / 120;
  const signal = 6.6e-5 * cells * reagent * dev;
  const bg = 0.045 + 0.05 * reagent * (1 + light);
  const shape = wl === 450 ? 1 : wl === 570 ? 0.22 : wl === 650 ? 0.02 : 0.1;
  let a = 0.04 + (bg - 0.04) * (wl === 450 ? 1 : 0.4) + signal * shape;
  a *= 1 + noise() * 0.015;
  a += noise() * 0.008 + bubble * (0.15 + Math.abs(noise()) * 0.25);
  if (a > 2.6) a = 2.6 + (a - 2.6) * 0.5;
  return Math.max(0.035, Math.min(4, a));
}
