// Alex 202384014054
// Drugs the sim knows, built from the real-world archive (src/data/drugs.js):
// IC50 (72 h viability, µM) per cell line, molecular weight and curve shape.

import { ARCHIVE } from '../data/index.js';

export const COMPOUNDS = Object.fromEntries(Object.values(ARCHIVE.drugs).map((d) => [d.id, {
  id: d.id, zh: d.zh, cls: d.cls, note: d.note, mw: d.mw.value, h: d.h.value, bottom: d.bottom.value,
  ic50: Object.fromEntries(Object.entries(d.ic50).map(([line, r]) => [line, r.value])),
}]));

// Bypass rescue: in MET-amplified cells an EGFR inhibitor works again once
// MET is blocked — its IC50 slides from the resistant value toward the value
// in the parental line (HCC827) as MET target engagement rises.
const sensOf = (line, ids) => Object.fromEntries(ids.map((id) => [id, COMPOUNDS[id].ic50[line]]));
export const BYPASS = { 'HCC827-GR': { by: 'capmatinib', parent: 'HCC827', engage: 0.02, sens: sensOf('HCC827', ['gefitinib', 'osimertinib', 'afatinib']) } };

export const hill = (c, ic50, h) => (c <= 0 ? 0 : 1 / (1 + (ic50 / c) ** h));

// DMSO vehicle tolerance: none up to 0.1 %, then a soft quadratic decline.
export const dmsoTox = (p) => (p <= 0.1 ? 1 : Math.exp(-0.52 * (p - 0.1) ** 2));

// Fraction of vehicle-control viable cells after `hours` of exposure.
export function viability(line, cmpd, uM, dmso = 0.1, hours = 72) {
  return drugFactor(line, uM > 0 ? { [cmpd]: uM } : {}) ** (hours / 72) * dmsoTox(dmso) ** (hours / 72);
}

// 72 h surviving fraction for any mix of drugs ({ cmpd: µM }): independent
// action (Bliss) plus the bypass rescue above.
export function drugFactor(line, drugs) {
  let f = 1;
  const bp = BYPASS[line];
  const E = bp && drugs[bp.by] > 0 ? hill(drugs[bp.by], bp.engage, 1.2) : 0;
  for (const c in drugs) {
    const k = COMPOUNDS[c], uM = drugs[c];
    if (!k || !(uM > 0)) continue;
    let ic = k.ic50[line] ?? 5;
    if (E > 0 && bp.sens[c]) ic = ic ** (1 - E) * bp.sens[c] ** E;
    f *= k.bottom + (1 - k.bottom) * (1 - hill(uM, ic, k.h));
  }
  return f;
}

// Bliss excess at a pair of doses: observed inhibition minus the inhibition
// expected if the two drugs acted independently (> 0 means synergy).
export function blissExcess(line, a, uA, b, uB) {
  const fa = drugFactor(line, { [a]: uA }), fb = drugFactor(line, { [b]: uB }), fab = drugFactor(line, { [a]: uA, [b]: uB });
  return (1 - fab) - (1 - fa * fb);
}
