// Alex 202384014054
// Each run draws its own lab: a verified value with a reported range is
// sampled log-uniformly inside that range, so a doubling time or an IC50 is
// never exactly what the last run (or the archive's typical value) said.
// One draw per cell line (its doubling time) and one per drug, shared by all
// of that drug's lines: a "potent batch" is potent everywhere, so relations
// between lines (selectivity, resistance) keep the direction the data shows.
// Values that are estimates, or verified without a range, stay fixed.

import { ARCHIVE } from '../data/index.js';
import { LINES } from './cells.js';
import { COMPOUNDS, BYPASS } from './pharm.js';

const pick = (rec, u) => (u == null || rec.status !== 'verified' || !rec.range ? rec.value : Math.exp(Math.log(rec.range[0]) + u * (Math.log(rec.range[1]) - Math.log(rec.range[0]))));

// r: a random-number function for this run, or null for typical values.
// Returns the values this run uses, keyed like 'cells.PC-9.td'.
export function applyRealParams(r) {
  const snap = {};
  for (const c of Object.values(ARCHIVE.cells)) {
    const u = r ? r() : null;
    LINES[c.id].td = snap[`cells.${c.id}.td`] = pick(c.td, u);
  }
  for (const d of Object.values(ARCHIVE.drugs)) {
    const u = r ? r() : null;
    for (const [line, rec] of Object.entries(d.ic50)) COMPOUNDS[d.id].ic50[line] = snap[`drugs.${d.id}.ic50.${line}`] = pick(rec, u);
  }
  // The bypass rescue slides toward the parental line's (now sampled) IC50.
  for (const bp of Object.values(BYPASS)) for (const id of Object.keys(bp.sens)) bp.sens[id] = COMPOUNDS[id].ic50[bp.parent];
  return snap;
}
