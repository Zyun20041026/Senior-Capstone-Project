// Alex 202384014054
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyRealParams } from '../src/sim/params.js';
import { ARCHIVE } from '../src/data/index.js';
import { LINES } from '../src/sim/cells.js';
import { COMPOUNDS, BYPASS } from '../src/sim/pharm.js';
import { rng } from '../src/sim/rng.js';

afterEach(() => applyRealParams(null));

const ranged = () => [
  ...Object.values(ARCHIVE.cells).filter((c) => c.td.range && c.td.status === 'verified').map((c) => [`cells.${c.id}.td`, c.td]),
  ...Object.values(ARCHIVE.drugs).flatMap((d) => Object.entries(d.ic50).filter(([, r]) => r.range && r.status === 'verified').map(([l, r]) => [`drugs.${d.id}.ic50.${l}`, r])),
];

test('null rng restores typical values', () => {
  applyRealParams(rng(7));
  const snap = applyRealParams(null);
  for (const c of Object.values(ARCHIVE.cells)) assert.equal(LINES[c.id].td, c.td.value);
  for (const d of Object.values(ARCHIVE.drugs)) for (const [l, r] of Object.entries(d.ic50)) assert.equal(COMPOUNDS[d.id].ic50[l], r.value);
  assert.equal(snap['drugs.gefitinib.ic50.PC-9'], ARCHIVE.drugs.gefitinib.ic50['PC-9'].value);
  assert.equal(BYPASS['HCC827-GR'].sens.gefitinib, COMPOUNDS.gefitinib.ic50.HCC827);
});

test('sampled values stay inside the recorded range', () => {
  const R = ranged();
  assert.ok(R.length > 10);
  let moved = 0;
  for (let s = 1; s <= 200; s++) {
    const snap = applyRealParams(rng(s));
    for (const [k, r] of R) {
      assert.ok(snap[k] >= r.range[0] * (1 - 1e-12) && snap[k] <= r.range[1] * (1 + 1e-12), `${k} = ${snap[k]} outside ${r.range}`);
      if (snap[k] !== r.value) moved++;
    }
  }
  assert.ok(moved > 0, 'sampling actually moves values');
  // values without a verified range never move
  const snap = applyRealParams(rng(3));
  assert.equal(snap['drugs.capmatinib.ic50.HCC827-GR'], ARCHIVE.drugs.capmatinib.ic50['HCC827-GR'].value);
  assert.equal(snap['cells.H3255.td'], ARCHIVE.cells.H3255.td.value);
});

test('qualitative facts hold across the whole recorded range', () => {
  const g = ARCHIVE.drugs.gefitinib.ic50, o = ARCHIVE.drugs.osimertinib.ic50;
  assert.ok(g['PC-9'].range[1] < g.A431.range[0], 'gefitinib: EGFR-mutant PC-9 always more sensitive than wild-type A431');
  assert.ok(g['PC-9'].range[1] < g.H1975.range[0], 'gefitinib: T790M always resistant');
  assert.ok(o.H1975.range[1] < o.A431.range[0], 'osimertinib: T790M always more sensitive than wild-type A431');
  assert.ok(o.H1975.range[1] < g.H1975.range[0], 'on H1975 osimertinib always beats gefitinib');
});
