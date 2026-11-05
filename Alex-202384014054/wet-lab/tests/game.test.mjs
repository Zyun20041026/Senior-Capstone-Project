// Alex 202384014054
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, put, advance } from '../src/game/world.js';
import { make, tipbox } from '../src/game/catalog.js';
import * as A from '../src/game/actions.js';
import { L, vol, um, dmsoPct } from '../src/sim/liquid.js';
import { penalty } from '../src/game/sop.js';

function bscWorld() {
  const w = createWorld(11);
  w.stations = ['bsc', 'bench', 'incubator', 'fridge'];
  w.level = { aseptic: true };
  for (const id of ['p20', 'p200', 'p1000', 'mc200', 'aid', 'vac']) w.tools[id] = A.makeTool(id, 'bsc');
  A.bsc(w, 'fan'); A.spray(w, 'bsc'); advance(w, 6);
  return w;
}

const aspirateFrom = (w, id, sub = {}) => { A.hover(w, { id, ...sub }); A.depthBy(w, 1); A.press(w); A.depthBy(w, 1); A.release(w); A.depthBy(w, -2); };
const dispenseInto = (w, id, sub = {}) => { A.hover(w, { id, ...sub }); A.depthBy(w, 1); A.press(w); A.shift(w, true); A.shift(w, false); A.depthBy(w, -1); A.release(w); };

test('a clean P200 transfer moves the set volume and leaves no violations', () => {
  const w = bscWorld();
  const box = put(w, tipbox('yellow', 'full', { sprayed: true }), 'bsc', 'd1');
  const src = put(w, make('tube15', { label: '培养基', liq: L({ medium: 5000 }), sprayed: true }), 'bsc', 'r1');
  const dst = put(w, make('ep', { label: '空管', sprayed: true }), 'bsc', 'e1');
  A.toggleCap(w, box.id); A.toggleCap(w, src.id); A.toggleCap(w, dst.id);
  A.take(w, 'p200');
  A.hover(w, { id: box.id, tip: 0 }); assert.ok(A.tipOn(w));
  aspirateFrom(w, src.id);
  dispenseInto(w, dst.id);
  assert.ok(Math.abs(vol(dst.liq) - 100) < 2.5, `delivered ${vol(dst.liq)}`);
  assert.equal(penalty(w), 0, JSON.stringify(w.sop.list));
});

test('pressing to the second stop before aspirating over-draws and is flagged', () => {
  const w = bscWorld();
  const box = put(w, tipbox('yellow', 'full', { sprayed: true }), 'bsc', 'd1');
  const src = put(w, make('tube15', { liq: L({ medium: 5000 }), sprayed: true }), 'bsc', 'r1');
  const dst = put(w, make('ep', { sprayed: true }), 'bsc', 'e1');
  [box, src, dst].forEach((x) => A.toggleCap(w, x.id));
  A.take(w, 'p200'); A.hover(w, { id: box.id, tip: 0 }); A.tipOn(w);
  A.hover(w, { id: src.id }); A.depthBy(w, 1); A.press(w); A.shift(w, true); A.depthBy(w, 1); A.release(w); A.shift(w, false); A.depthBy(w, -2);
  dispenseInto(w, dst.id);
  assert.ok(vol(dst.liq) > 108, `over-aspirated ${vol(dst.liq)}`);
  assert.ok(w.sop.counts.second_stop_asp);
});

test('opening a sterile bottle outside the cabinet is a major violation', () => {
  const w = bscWorld();
  const b = put(w, make('bottle100', { liq: L({ pbs: 50000 }) }), 'bench', 'bf1');
  A.toggleCap(w, b.id);
  assert.ok(w.sop.counts.open_outside);
  assert.ok(b.liq.c.bug > 0);
});

test('multichannel three-fold serial dilution across a U plate', () => {
  const w = bscWorld();
  const box = put(w, tipbox('yellow', 'BG', { sprayed: true }), 'bsc', 'd1');
  const pl = put(w, make('uplate', { sprayed: true }), 'bsc', 'd2');
  A.toggleCap(w, box.id); A.toggleCap(w, pl.id);
  for (let r = 1; r <= 6; r++) {
    pl.wells[r * 12 + 2].liq = L({ medium: 225, dmso: 0.675, 'drug:gefitinib': 225 * 30 });
    for (let c = 3; c <= 9; c++) pl.wells[r * 12 + c].liq = L({ medium: 150, dmso: 0.45 });
  }
  A.take(w, 'mc200');
  for (let i = 0; i < 125; i++) A.setVol(w, -1); // 200 → 75 µL (clamped at min 20 then up)
  w.tools.mc200.vol = 75;
  A.hover(w, { id: box.id, col: 0, row: 0 }); assert.ok(A.tipOn(w));
  assert.equal(w.tools.mc200.tips.filter(Boolean).length, 6);
  for (let c = 2; c < 9; c++) {
    aspirateFrom(w, pl.id, { col: c });
    // dispense, mix three times, blow out, lift, release
    A.hover(w, { id: pl.id, col: c + 1 }); A.depthBy(w, 1); A.depthBy(w, 1);
    A.press(w); A.release(w); A.press(w); A.release(w); A.press(w); A.release(w);
    A.press(w); A.shift(w, true); A.shift(w, false); A.depthBy(w, -2); A.release(w);
  }
  const conc = (c) => um(pl.wells[1 * 12 + c].liq, 'drug:gefitinib');
  for (let c = 3; c <= 9; c++) {
    const ratio = conc(c - 1) / conc(c);
    assert.ok(ratio > 2.6 && ratio < 3.5, `col ${c + 1} ratio ${ratio.toFixed(2)}`);
  }
  assert.ok(Math.abs(dmsoPct(pl.wells[12 + 9].liq) - 0.3) < 0.02, 'DMSO stays constant along the series');
  assert.equal(um(pl.wells[0 * 12 + 3].liq, 'drug:gefitinib'), 0, 'row A untouched by the B–G tips');
});

test('centrifuge refuses an unbalanced rotor and pellets a balanced one', () => {
  const w = bscWorld();
  const cells = put(w, make('tube15', { liq: L({ medium: 5000, trypsin: 1000, cells: 2e6, dead: 1e5 }) }), 'bench', 'b1');
  const bal = put(w, make('tube15', { liq: L({ water: 6000 }), sterile: false }), 'bench', 'b2');
  A.door(w, 'centrifuge');
  w.inst.centrifuge.lid = true;
  w.held = { type: 'item', id: cells.id, from: cells.at }; A.rotorPut(w, 0);
  w.inst.centrifuge.lid = false;
  assert.equal(A.spin(w, 1638, 5)?.ok ?? false, false);
  assert.ok(w.sop.counts.imbalance);
  w.inst.centrifuge.lid = true;
  w.held = { type: 'item', id: bal.id, from: bal.at }; A.rotorPut(w, 3);
  w.inst.centrifuge.lid = false;
  const r = A.spin(w, 1638, 5);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.g - 300) < 2);
  assert.ok(cells.pellet.n > 1.8e6, `pellet ${cells.pellet.n}`);
});

test('trypsin detaches cells at 37 °C and harms them when left too long', () => {
  const w = bscWorld();
  const f = put(w, make('flask', { line: 'PC-9', layer: { n: 2.4e6, d: 6e4 }, liq: L({ trypsin: 1000 }) }), 'incubator', 'i1');
  f.temp = 37;
  advance(w, 4);
  assert.ok(f.liq.c.cells > 2.0e6, `detached ${f.liq.c.cells}`);
  advance(w, 12);
  assert.ok(w.sop.counts.over_trypsin);
});

// Review #17: pausing in the middle of a stroke ends it without moving liquid;
// letting go of the key after the pause changes nothing.
