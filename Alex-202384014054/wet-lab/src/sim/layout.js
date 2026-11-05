// Alex 202384014054
// Free plate layouts. Given a read snapshot (values + what was really in each
// well), group wells by cell line and drug content, then:
//   blanks      no cells, liquid present (A > 0.06)
//   vehicle     cells, no drug — 100 % for that line
//   series      one drug at ≥ 4 concentrations → 4PL fit
//   matrices    two drugs in the same wells → observed vs Bliss-expected
// Nothing depends on where on the plate the wells are.

import { fit4pl, mean, cv } from './fit.js';

const sig = (c) => +c.toPrecision(3);
const EMPTY = 0.06;

export function wellKind(x) {
  const ls = Object.entries(x?.lines || {}).filter(([, f]) => f > 0.02).sort((a, b) => b[1] - a[1]);
  const drugs = Object.entries(x?.drugs || {}).filter(([, c]) => c > 1e-6).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { line: ls[0]?.[0] || null, mixed: ls.length > 1, drugs };
}

export function autoLayout(snap) {
  const n = snap.values.length;
  const kinds = snap.wells.map(wellKind);
  const blankW = [], groups = new Map();
  for (let i = 0; i < n; i++) {
    const k = kinds[i], v = snap.values[i];
    if (!k.line) { if (v > EMPTY) blankW.push(i); continue; }
    const key = `${k.line}|${k.drugs.map(([d]) => d).join('+')}`;
    if (!groups.has(key)) groups.set(key, { key, line: k.line, drugs: k.drugs.map(([d]) => d), wells: [], mixed: false });
    const g = groups.get(key); g.wells.push(i); g.mixed ||= k.mixed;
  }
  const blank = blankW.length ? mean(blankW.map((i) => snap.values[i])) : 0;
  const veh = {};
  for (const g of groups.values()) if (!g.drugs.length) veh[g.line] = mean(g.wells.map((i) => snap.values[i] - blank));
  const pct = (i, line) => (100 * (snap.values[i] - blank)) / (veh[line] || NaN);

  // replicate means by concentration
  const byConc = (g, d) => {
    const m = new Map();
    for (const i of g.wells) { const c = sig(snap.wells[i].drugs[d]); if (!m.has(c)) m.set(c, []); m.get(c).push(pct(i, g.line)); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([c, ys]) => ({ c, ys, m: mean(ys), cv: cv(ys) }));
  };
  const series = [], matrices = [];
  for (const g of groups.values()) {
    if (g.drugs.length !== 1 || !veh[g.line]) continue;
    const reps = byConc(g, g.drugs[0]);
    const s = { line: g.line, cmpd: g.drugs[0], reps, wells: g.wells, mixed: g.mixed, fit: null };
    if (reps.length >= 4) s.fit = fit4pl(reps.flatMap((r) => r.ys.map(() => r.c)), reps.flatMap((r) => r.ys));
    series.push(s);
  }
  for (const g of groups.values()) {
    if (g.drugs.length !== 2 || !veh[g.line]) continue;
    const [a, b] = g.drugs;
    const single = (d) => series.find((s) => s.line === g.line && s.cmpd === d);
    const sa = single(a), sb = single(b);
    const cells = new Map();
    for (const i of g.wells) {
      const ca = sig(snap.wells[i].drugs[a]), cb = sig(snap.wells[i].drugs[b]), k = `${ca}|${cb}`;
      if (!cells.has(k)) cells.set(k, { ca, cb, ys: [] });
      cells.get(k).ys.push(pct(i, g.line));
    }
    const cA = [...new Set([...cells.values()].map((x) => x.ca))].sort((p, q) => p - q);
    const cB = [...new Set([...cells.values()].map((x) => x.cb))].sort((p, q) => p - q);
    // single-agent effect at a concentration: replicate mean if measured, else the fit
    const one = (s, c) => { if (!s) return null; const r = s.reps.find((x) => Math.abs(x.c - c) / c < 0.02); if (r) return r.m / 100; if (!s.fit) return null; const f = s.fit; return (f.bottom + (f.top - f.bottom) / (1 + (c / f.ic50) ** f.hill)) / 100; };
    const grid = cA.map((ca) => cB.map((cb) => {
      const x = cells.get(`${ca}|${cb}`); if (!x) return null;
      const obs = mean(x.ys) / 100, va = one(sa, ca), vb = one(sb, cb);
      const exp = va != null && vb != null ? Math.max(0, Math.min(1.2, va)) * Math.max(0, Math.min(1.2, vb)) : null;
      return { obs, exp, excess: exp != null ? exp - obs : null };
    }));
    const ex = grid.flat().filter((x) => x?.excess != null).map((x) => x.excess);
    matrices.push({ line: g.line, a, b, cA, cB, grid, wells: g.wells, mean: ex.length ? mean(ex) : null, max: ex.length ? Math.max(...ex) : null, missing: [!sa && a, !sb && b].filter(Boolean) });
  }
  const map = kinds.map((k, i) => (!k.line ? (blankW.includes(i) ? 'blank' : null) : `${k.line}|${k.drugs.map(([d]) => d).join('+')}`));
  return { blank, nBlank: blankW.length, veh, series, matrices, map, groups: [...groups.values()] };
}
