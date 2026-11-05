// Alex 202384014054
// Evidence ledger for the open modes. Each entry is a frozen copy of what the
// player concluded (declared) next to what was really there (actual), with
// the records it came from. Later work never edits an entry; prescriptions
// cite entries by id. The main line keeps no ledger (w.ledger is unset).

import { drugName } from '../data/index.js';

const freeze = (x) => JSON.parse(JSON.stringify(x));

export const ledgerOn = (w) => !!w.ledger;
export function startLedger(w) { w.ledger = { n: 0, items: {}, order: [] }; return w.ledger; }

export function record(w, kind, { declared = null, actual = null, result = null, refs = {}, title = '' } = {}) {
  if (!w.ledger) return null;
  const L = w.ledger, id = `E${++L.n}`;
  const e = freeze({ id, kind, title, month: w.case ? w.case.sim.month : null, labT: w.t, refs, declared, actual, result, attempt: w.case?.attempt ?? 0 });
  e.mismatch = mismatch(e);
  L.items[id] = e; L.order.push(id);
  return e;
}
export const entry = (w, id) => w.ledger?.items[id] || null;
export const entries = (w, pred = () => true) => (w.ledger ? w.ledger.order.map((id) => w.ledger.items[id]).filter(pred) : []);

// Where the declaration contradicts the record it came from.
function mismatch(e) {
  if (e.kind === 'screen' && e.declared && e.actual) {
    const why = [];
    if (e.actual.lines && !e.actual.lines.includes(e.declared.line)) why.push(`声明 ${e.declared.line}，实测为 ${e.actual.lines.join(' + ')}`);
    else if (e.actual.lines?.length > 1) why.push(`孔内混有 ${e.actual.lines.join(' + ')}`);
    for (const c of e.declared.cmpds || []) if (c && !(e.actual.cmpds || []).includes(c)) why.push(`板上没有 ${drugName(c)}`);
    return why.length ? why : null;
  }
  if ((e.kind === 'seq' || e.kind === 'gel' || e.kind === 'ct') && e.declared != null && e.actual != null && e.declared.call !== undefined && e.declared.call !== e.actual.call) return ['判读与实际不符'];
  return null;
}
// Evidence that may be cited for a prescription under the current rules. Any
// record can be cited; in expert mode a record whose conclusion contradicts
// what was really there (a wrong call, a mislabelled plate) is caught at
// review and does not count. The review says that it failed, never what the
// truth is.
export function citable(w, e) {
  if (!e || e.void) return false; // withdrawn attempt
  if (w.diff?.strict && e.mismatch) return false;
  return true;
}

// Plate-read snapshot → the lines and compounds actually on the plate.
export function plateTruth(snap, wells = null) {
  const idx = wells || snap.wells.map((_, i) => i);
  const lines = new Map(), cmpds = new Set();
  for (const i of idx) {
    const x = snap.wells[i]; if (!x) continue;
    for (const [l, f] of Object.entries(x.lines)) if (f > 0.02) lines.set(l, (lines.get(l) || 0) + f);
    for (const c of Object.keys(x.drugs)) cmpds.add(c);
  }
  return { lines: [...lines.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l), cmpds: [...cmpds] };
}
