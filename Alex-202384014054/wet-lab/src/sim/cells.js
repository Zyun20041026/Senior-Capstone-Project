// Alex 202384014054
// Cell-line biology used by the lab. Identity, genotype, doubling time and
// confluent numbers come from the real-world archive (src/data/cells.js);
// `shape` only sets how cells are drawn.

import { poisson } from './rng.js';
import { ARCHIVE } from '../data/index.js';

const SHAPE = { 'PC-9': 1.7, H1975: 1.4, 'PC-9-T790M': 1.6, A431: 1.15, HCC827: 1.5, H3255: 1.6, A549: 1.3, 'BEAS-2B': 1.25, 'HCC827-GR': 1.45, 'PC-9-T790M-C797S': 1.6, 'PC-9-EGFR-KO': 1.5 };
const MADE = new Set(['PC-9-T790M', 'PC-9-T790M-C797S', 'PC-9-EGFR-KO']);

export const LINES = Object.fromEntries(Object.values(ARCHIVE.cells).map((c) => [c.id, {
  id: c.id, tissue: c.tissue.text, egfr: c.egfr.text,
  td: c.td.value, capT25: c.capT25.value, capWell: c.capWell.value,
  shape: SHAPE[c.id] ?? 1.5, ...(MADE.has(c.id) ? { made: true } : {}),
}]));

// Logistic growth from n over h hours with doubling time td and capacity cap.
export function grow(n, h, td, cap) {
  if (n <= 0 || h <= 0) return n;
  const r = Math.LN2 / td;
  return cap / (1 + (cap / n - 1) * Math.exp(-r * h));
}

// Fraction still attached after `min` minutes in 0.25% trypsin-EDTA.
export const detach = (min, tempC) => Math.exp(-(tempC >= 34 ? 0.55 : 0.12) * Math.max(0, min));

// Viability multiplier for active trypsin exposure beyond what the cells tolerate.
export const trypsinHarm = (min) => (min <= 8 ? 1 : Math.exp(-0.022 * (min - 8)));

// Pelleted fraction and shear damage in a swing-out rotor.
export const pellet = (g, min) => 1 - Math.exp(-(g * min) / 400);
export const spinDamage = (g) => (g <= 800 ? 1 : Math.exp(-(g - 800) / 2500));

export const rcf = (rpm, rcm) => 1.118e-5 * rcm * rpm * rpm;
export const rpmFor = (g, rcm) => Math.sqrt(g / (1.118e-5 * rcm));

// Neubauer large square: 1 mm × 1 mm × 0.1 mm = 0.1 µL.
// Returns cells around one square in local mm units [0,1], with a margin so
// border cells exist. Radii are drawn ~2× real size so they can be clicked.
export function hemoSquare(r, liveUL, deadUL) {
  const m = 0.07, side = 1 + 2 * m;
  const out = [];
  const place = (n, dead) => {
    for (let i = 0; i < n; i++) {
      out.push({ x: -m + r() * side, y: -m + r() * side, r: 0.017 + r() * 0.006, dead, a: r() * Math.PI * 2, k: r() });
    }
  };
  place(poisson(r, liveUL * 0.1 * side * side), false);
  place(poisson(r, deadUL * 0.1 * side * side), true);
  return out;
}

const crosses = (c, at, axis) => Math.abs((axis === 'x' ? c.x : c.y) - at) < c.r;
// Count cells inside or touching the top and left lines; skip bottom and right.
export function counted(c) {
  const overlaps = c.x + c.r > 0 && c.x - c.r < 1 && c.y + c.r > 0 && c.y - c.r < 1;
  if (!overlaps) return false;
  if (crosses(c, 1, 'x') || crosses(c, 1, 'y')) return false;
  return true;
}
