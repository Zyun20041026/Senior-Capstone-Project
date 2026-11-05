// Alex 202384014054
// Shared level material: reagent factories, standard plates, and the graders
// used by more than one level.

import { make, tipbox } from '../game/catalog.js';
import { makeTool } from '../game/actions.js';
import { put, items, envOf, createWorld, advance } from '../game/world.js';
import { L, vol, um, dmsoPct } from '../sim/liquid.js';
import { LINES } from '../sim/cells.js';
import { fit4pl, zPrime, cv, mean } from '../sim/fit.js';
import { isEdge, wellIndex } from '../sim/plate.js';
import { EASE } from '../game/difficulty.js';
import { drugName, drugAbbr } from '../data/index.js';

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
// 100 when |err| ≤ good, 0 when ≥ bad, linear in between.
export const band = (err, good, bad) => Math.round(100 * clamp01((bad - Math.abs(err) / EASE.band) / (bad - good)));

export function tools(w, ids, home) {
  for (const id of ids) {
    const t = makeTool(id, home);
    if (t.kind === 'pip') t.bias = (w.r() * 2 - 1) * 0.5;
    w.tools[id] = t;
  }
}

export const R = {
  medium: (p = {}) => make('bottle500', { label: 'RPMI-1640 完全培养基', sub: 'RPMI-1640 + 10% 胎牛血清 + 1% 双抗', short: 'RPMI-1640', short2: '+10% FBS', short3: '4 °C 保存', liq: L({ medium: 420000 }), stock: true, temp: 4, band: '#d64860', cap: 'orange', ...p }),
  pbs: (p = {}) => make('bottle100', { label: 'PBS 缓冲液', sub: '无钙镁 · 无菌', short: 'PBS', short2: '无 Ca²⁺/Mg²⁺', liq: L({ pbs: 90000 }), stock: true, temp: 4, band: '#3a74db', cap: 'blue', ...p }),
  trypsin: (p = {}) => make('bottle100', { label: '0.25% 胰酶-EDTA', sub: '消化贴壁细胞用', short: '胰酶-EDTA', short2: '0.25%', liq: L({ trypsin: 80000 }), stock: true, temp: 4, band: '#d93a43', cap: 'red', ...p }),
  tb: (p = {}) => make('ep', { label: '0.4% 台盼蓝', sub: '死细胞染色，计数用（非无菌）', short: 'TB', liq: L({ tb: 900 }), sterile: false, stock: true, cap: 'blue', ...p }),
  dmso: (p = {}) => make('vial', { label: 'DMSO（细胞培养级）', sub: '室温保存，低于 18.5 °C 会凝固', short: 'DMSO', short2: '100%', liq: L({ dmso: 1500 }), stock: true, ...p }),
  cck8: (p = {}) => make('kit', { label: 'CCK-8 试剂', sub: 'WST-8，活细胞脱氢酶将其还原为橙色甲臜', short: 'CCK-8', liq: L({ cck8: 5000 }), stock: true, temp: 4, ...p }),
  stock: (cmpd, p = {}) => make('vial', { label: `${drugName(cmpd)} 母液 10 mM`, sub: '溶于 DMSO，−20 °C 保存', short: drugAbbr(cmpd), short2: '10 mM', liq: L({ dmso: 50, [`drug:${cmpd}`]: 50 * 10000 }), stock: true, temp: -20, frozen: true, cap: cmpd === 'gefitinib' || cmpd === 'osimertinib' ? 'purple' : 'red', ...p }),
  tube: (label, p = {}) => make('tube15', { label, short: label, ...p }),
  tube50: (label, p = {}) => make('tube50', { label, short: label, cap: 'orange', ...p }),
  ep: (label, p = {}) => make('ep', { label, short: label, ...p }),
  sero: (size) => make('seropack', { label: `${size} mL 血清移液管`, sub: '独立包装，无菌', size }),
  pasteur: () => make('pasteur', { label: '巴斯德吸管罐', sub: '高压灭菌的玻璃吸管，接真空吸液器用' }),
  res: (p = {}) => make('res4', { label: '四槽加样槽', sub: '每个槽沿 A–H 方向，多道枪竖着用', ...p }),
  tips: tipbox,
};

export function flask(line, n, p = {}) {
  return make('flask', { label: `${line} 培养瓶`, sub: `${LINES[line].egfr} · 第 12 代`, short: `${line} P12`, line, layer: { n, d: n * 0.03 }, liq: L({ medium: 5000 }), critical: true, temp: 37, ...p });
}

// A plate seeded the textbook way: PBS round the edge, cells in B–G × 2–10,
// medium-only blanks in B–G × 11, then left overnight to attach.
export function seededPlate(line, label, perWell = 5000, r = Math.random, p = {}) {
  const pl = make('plate', { label, short: label, line, critical: true, temp: 37, ...p });
  pl.wells.forEach((wl, i) => {
    const row = Math.floor(i / 12), col = i % 12;
    if (isEdge(i)) wl.liq = L({ pbs: 150 });
    else if (col === 10) wl.liq = L({ medium: 100 });
    else { wl.liq = L({ medium: 100 }); wl.n = perWell * (1 + (r() - 0.5) * 0.06); wl.dead = perWell * 0.03; }
    void row;
  });
  return pl;
}

// Apply a protocol-perfect dose: 50 µL of 3× drug (0.3% DMSO) on top of 100 µL.
export function doseIdeal(pl, top, bottom) {
  for (let row = 1; row <= 6; row++) {
    const cmpd = row <= 3 ? top : bottom;
    for (let col = 1; col <= 10; col++) {
      const i = wellIndex(row, col);
      const wl = pl.wells[i];
      if (col === 10) { wl.liq.c.medium += 50; continue; }
      wl.liq.c.medium += 50 * 0.997; wl.liq.c.dmso = (wl.liq.c.dmso || 0) + 0.15;
      if (col >= 2) wl.liq.c[`drug:${cmpd}`] = 50 * 30 / 3 ** (col - 2);
    }
  }
  return pl;
}

export function incubate(plates, hours, seed = 3) {
  const w = createWorld(seed);
  plates.forEach((p, k) => put(w, p, 'incubator', `i${k + 1}`));
  advance(w, hours * 60);
  return plates;
}

export const findItem = (w, pred) => items(w).find(pred);
export const byTag = (w, tag) => items(w).find((it) => it.tag === tag);
export const inEnv = (w, it, env) => it && envOf(w, it) === env;
export const at = (w, it, st) => it && it.at && it.at.st === st;

// ---------------------------------------------------------------- plate data

export const NOMINAL = Array.from({ length: 8 }, (_, k) => 10 / 3 ** k); // µM, columns 3–10

// Viability (% of vehicle) per compound block from a read, using the plate map
// blanks = col 11 (B–G), vehicle = col 2 (B–G), drugs in cols 3–10.
export function analyse(read, compounds) {
  if (!read) return null;
  const v = (r, c) => read.values[r * 12 + c];
  const rows = [1, 2, 3, 4, 5, 6];
  const blank = mean(rows.map((r) => v(r, 10)));
  const veh = rows.map((r) => v(r, 1) - blank);
  const vm = mean(veh);
  const z = zPrime(rows.map((r) => v(r, 1)), rows.map((r) => v(r, 10)));
  const out = { blank, vehicle: vm, z, read, blocks: [] };
  compounds.forEach((cmpd, b) => {
    const rr = b === 0 ? [1, 2, 3] : [4, 5, 6];
    const x = [], y = [], reps = [];
    for (let k = 0; k < 8; k++) {
      const col = k + 2;
      const ys = rr.map((r) => (100 * (v(r, col) - blank)) / (vm || 1));
      ys.forEach((yy) => { x.push(NOMINAL[k]); y.push(yy); });
      reps.push({ c: NOMINAL[k], ys, m: mean(ys), cv: cv(ys) });
    }
    const f = fit4pl(x, y);
    out.blocks.push({ cmpd, fit: f, reps, meanCV: mean(reps.map((r) => Math.abs(r.cv))) });
  });
  return out;
}

export { vol, um, dmsoPct, mean, cv, LINES };
