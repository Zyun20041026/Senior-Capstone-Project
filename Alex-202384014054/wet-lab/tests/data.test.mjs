// Alex 202384014054
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, validate } from '../src/data/schema.js';
import { ARCHIVE, allRecords, val, drugName } from '../src/data/index.js';

const src = { title: 'Integra Biosciences: Z-factors', url: 'https://www.integra-biosciences.com/x.pdf', accessed: '2026-11-01' };

test('every archive record passes validate()', () => {
  const bad = allRecords().map(({ path, rec }) => [path, validate(rec)]).filter(([, p]) => p.length);
  assert.deepEqual(bad, [], bad.map(([p, q]) => `${p}: ${q.join('; ')}`).join('\n'));
  assert.ok(allRecords().length > 0, 'the archive is not empty');
});

test('validate accepts the three statuses and nothing else', () => {
  assert.deepEqual(Object.keys(STATUS), ['verified', 'estimate', 'pending']);
  assert.ok(validate({ status: 'guess', text: 'x', basis: 'y' }).length > 0);
});

test('validate rejects a verified record without sources', () => {
  assert.ok(validate({ status: 'verified', value: 1, unit: 'h', kind: 'literature' }).some((p) => /出处/.test(p)));
});

test('validate rejects an estimate without basis', () => {
  assert.ok(validate({ status: 'estimate', value: 1, unit: 'h', kind: 'model' }).some((p) => /依据/.test(p)));
});

test('validate rejects value outside range', () => {
  assert.ok(validate({ status: 'verified', value: 50, range: [10, 40], unit: 'h', kind: 'literature', sources: [src] }).some((p) => /范围/.test(p)));
  assert.ok(validate({ status: 'verified', value: -1, unit: 'h', kind: 'literature', sources: [src] }).length > 0, 'negative value');
  assert.ok(validate({ status: 'verified', value: 1, kind: 'literature', sources: [src] }).some((p) => /单位/.test(p)), 'missing unit');
  assert.ok(validate({ status: 'verified', value: 1, unit: 'h', sources: [src] }).some((p) => /性质/.test(p)), 'missing kind');
});

test('validate rejects non-https source or bad date', () => {
  assert.ok(validate({ status: 'verified', text: 'x', sources: [{ ...src, url: 'http://a.b' }] }).length > 0);
  assert.ok(validate({ status: 'verified', text: 'x', sources: [{ ...src, accessed: '1 Nov 2026' }] }).length > 0);
  assert.deepEqual(validate({ status: 'verified', text: 'x', sources: [src] }), []);
});

test('z-water-22c is 1.0033 µL/mg, verified', () => {
  const z = ARCHIVE.constants['z-water-22c'];
  assert.equal(z.value, 1.0033);
  assert.equal(z.unit, 'µL/mg');
  assert.equal(z.status, 'verified');
  assert.equal(val('constants', 'z-water-22c'), 1.0033);
});

test('drugName falls back to the id', () => {
  assert.equal(drugName('no-such-drug'), 'no-such-drug');
});

// Task 3: cell lines come from the archive.
test('cell archive covers every line the sim uses', async () => {
  const { LINES } = await import('../src/sim/cells.js');
  assert.deepEqual(Object.keys(LINES).sort(), Object.keys(ARCHIVE.cells).sort());
});

test('LINES take doubling time and capacity from the archive', async () => {
  const { LINES } = await import('../src/sim/cells.js');
  for (const id of Object.keys(LINES)) {
    assert.equal(LINES[id].td, ARCHIVE.cells[id].td.value, `${id} td`);
    assert.equal(LINES[id].capWell, ARCHIVE.cells[id].capWell.value, `${id} capWell`);
  }
});

test('EGFR genotypes match the archive', () => {
  assert.match(ARCHIVE.cells['PC-9'].egfr.text, /E746/);
  assert.match(ARCHIVE.cells.H1975.egfr.text, /L858R/);
  assert.match(ARCHIVE.cells.H1975.egfr.text, /T790M/);
  assert.match(ARCHIVE.cells['HCC827-GR'].egfr.text, /MET/);
});

// Task 4: drugs come from the archive under their real names.
test('drug archive covers COMPOUNDS and every IC50 the sim uses', async () => {
  const { COMPOUNDS } = await import('../src/sim/pharm.js');
  assert.deepEqual(Object.keys(COMPOUNDS).sort(), Object.keys(ARCHIVE.drugs).sort());
  for (const [id, d] of Object.entries(ARCHIVE.drugs)) {
    assert.deepEqual(Object.keys(d.ic50).sort(), Object.keys(ARCHIVE.cells).sort(), `${id} covers every line`);
    for (const line of Object.keys(d.ic50)) assert.equal(COMPOUNDS[id].ic50[line], d.ic50[line].value, `${id} ${line}`);
    assert.equal(COMPOUNDS[id].mw, d.mw.value);
    assert.equal(COMPOUNDS[id].h, d.h.value);
    assert.equal(COMPOUNDS[id].bottom, d.bottom.value);
    assert.match(d.ic50['PC-9'].cond || d.ic50['PC-9'].basis, /./);
  }
});

test('IC50 magnitudes are sane (µM)', () => {
  const v = (d, l) => val('drugs', d, `ic50.${l}`);
  assert.ok(v('gefitinib', 'PC-9') >= 0.001 && v('gefitinib', 'PC-9') <= 0.1);
  assert.ok(v('gefitinib', 'A431') > 3 * v('gefitinib', 'PC-9'));
  assert.ok(v('gefitinib', 'H1975') > 1, 'T790M makes gefitinib fail');
  assert.ok(v('osimertinib', 'H1975') < 0.5);
  assert.ok(v('paclitaxel', 'PC-9') < 0.05);
  assert.ok(v('capmatinib', 'HCC827-GR') < v('capmatinib', 'HCC827'), 'MET inhibitor works only on the MET-amplified line');
});

test('no legacy drug codes remain in src/', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('../src', import.meta.url).pathname);
  const hits = files.filter((p) => !p.endsWith('data/legacy.js')).flatMap((p) => readFileSync(p, 'utf8').split('\n').map((l, i) => [p, i + 1, l]).filter(([, , l]) => /TKI-[A-F]|CHEMO-P|\bMETi\b/.test(l)));
  assert.deepEqual(hits.map(([p, i]) => `${p}:${i}`), []);
});

test('drugName shows Chinese names', () => {
  assert.equal(drugName('gefitinib'), '吉非替尼');
  assert.equal(drugName('osimertinib'), '奥希替尼');
  for (const d of Object.values(ARCHIVE.drugs)) { assert.match(d.zh, /[\u4e00-\u9fff]/); assert.match(d.abbr, /^[A-Z]{3,4}$/); }
});

test('every approved drug states its approval with a source', () => {
  for (const d of Object.values(ARCHIVE.drugs)) { assert.ok(d.approval?.text, d.id); assert.equal(d.approval.status, 'verified', d.id); }
});

// Task 6: prices come from the archive.
test('PRICE comes from the archive', async () => {
  const { PRICE } = await import('../src/modes/orders.js');
  assert.deepEqual(Object.keys(PRICE).sort(), Object.keys(ARCHIVE.prices).sort());
  for (const [k, v] of Object.entries(PRICE)) {
    assert.equal(v, Math.round(ARCHIVE.prices[k].value), k);
    assert.equal(ARCHIVE.prices[k].kind, 'price', k);
    assert.match(ARCHIVE.prices[k].cond, /./, `${k} states what is priced`);
  }
});

// Task 9: the in-game sources page.
test('sources page lists every record once with a status label', async () => {
  const { sourcesModel } = await import('../src/ui/sources.js');
  const m = sourcesModel();
  const rows = m.flatMap((g) => g.rows);
  assert.equal(rows.length, allRecords().length);
  assert.equal(new Set(rows.map((r) => r.path)).size, rows.length, 'no duplicates');
  for (const r of rows) {
    assert.equal(r.statusText, STATUS[r.status]);
    assert.ok(r.name && r.valueText, r.path);
    for (const l of r.links) assert.match(l.url, /^https:\/\//);
  }
  const g = rows.find((r) => r.path === 'drugs.gefitinib.ic50.PC-9');
  assert.match(g.name, /吉非替尼/);
  assert.ok(g.links.length > 0);
  assert.deepEqual(m.map((x) => x.cat), ['cells', 'drugs', 'prices', 'constants']);
});
