// Alex 202384014054
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, drugsOf } from '../src/sim/liquid.js';
import { specimenOf } from '../src/ui/microscope.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// Review #3: concentrations come from the liquid's volume, never from a sum
// that also counts cells and pmol.
test('drugsOf reports µM from the liquid volume', () => {
  const l = L({ medium: 100, 'drug:x': 100 }); // 100 pmol in 100 µL = 1 µM
  near(drugsOf(l).x, 1, 1e-12, 'plain');
  l.c.cells = 5000;
  near(drugsOf(l).x, 1, 1e-12, 'with suspended cells');
});

test('suspended cells do not dilute the drug stress the microscope shows', () => {
  const well = () => ({ liq: L({ medium: 100, 'drug:gefitinib': 100 }), n: 5000, dead: 0, src: null });
  const plate = (wl) => ({ id: 'p', type: 'plate', line: 'PC-9', wells: [wl] });
  const a = specimenOf({}, plate(well()), { well: 0 });
  const wl = well(); wl.liq.c.cells = 5000;
  const b = specimenOf({}, plate(wl), { well: 0 });
  assert.ok(a.round > 0.5, `1 µM of a first-generation TKI stresses PC-9 (round ${a.round})`);
  near(b.round, a.round, 1e-9, 'stress with suspended cells');
});

// Review #8: a plate redraws whenever anything that changes a well's look changes.
test('well signature changes with composition and contamination', async () => {
  const { wellSig } = await import('../src/view/liquidSig.js');
  const well = (c) => ({ liq: L(c), n: 0, dead: 0, cck: 0 });
  assert.notEqual(wellSig(well({ medium: 90, tb: 10 })), wellSig(well({ medium: 10, tb: 90 })), '90/10 vs 10/90');
  assert.notEqual(wellSig(well({ medium: 100 })), wellSig(well({ medium: 100, bug: 2 })), 'contamination');
  assert.equal(wellSig(well({ medium: 100, tb: 10 })), wellSig(well({ tb: 10, medium: 100 })), 'key order does not matter');
});

// Review #9: one volume → height curve per well type, shared by the plate
// model and the pipette poses; "below the surface" really is below it.
test('well level follows the well geometry', async () => {
  const { levelOf, WELL_DEPTH } = await import('../src/view/wellGeom.js');
  near(levelOf('plate', 0), 0, 1e-12, 'empty flat well');
  near(levelOf('plate', 100), 100 / (Math.PI * 3.2 * 3.2), 1e-9, '100 µL in a Ø 6.4 mm flat well');
  near(levelOf('uplate', (2 / 3) * Math.PI * 3.2 ** 3), 3.2, 1e-6, 'U well: hemisphere full at r');
  for (const t of ['plate', 'uplate']) {
    let last = -1;
    for (let v = 0; v <= 400; v += 5) {
      const h = levelOf(t, v);
      assert.ok(h >= last - 1e-9, `${t} rises with volume at ${v} µL`);
      assert.ok(h <= WELL_DEPTH + 1e-12, `${t} capped at the rim`);
      last = h;
    }
  }
});

test('the submerged tip stop is under the surface and above the floor', async () => {
  const { plateMeta, depthStops } = await import('../src/view/wellGeom.js');
  for (const type of ['plate', 'uplate']) {
    const meta = plateMeta(type);
    for (const v of [10, 20, 50, 100, 150, 200, 300]) {
      const ys = depthStops(meta, v), surface = meta.level(v);
      assert.ok(ys[2] < surface, `${type} ${v} µL: tip ${(ys[2] * 1000).toFixed(2)} mm vs surface ${(surface * 1000).toFixed(2)} mm`);
      assert.ok(ys[2] > meta.floor, `${type} ${v} µL: tip above the floor`);
      assert.ok(ys[1] > surface, `${type} ${v} µL: mouth stop stays above the liquid`);
      assert.ok(surface - ys[2] <= 0.0025 + 1e-9, `${type} ${v} µL: immersed no deeper than 2.5 mm`);
    }
  }
});
