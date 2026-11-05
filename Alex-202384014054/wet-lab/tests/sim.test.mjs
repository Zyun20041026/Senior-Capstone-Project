// Alex 202384014054
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, poisson, gauss } from '../src/sim/rng.js';
import { L, vol, add, split, um, dmsoPct, color } from '../src/sim/liquid.js';
import { SPECS, accuracy, aspirateVol, residual } from '../src/sim/pipette.js';
import { grow, detach, pellet, rcf, rpmFor, hemoSquare, counted, LINES } from '../src/sim/cells.js';
import { COMPOUNDS, hill, viability, dmsoTox } from '../src/sim/pharm.js';
import { wellIndex, rc, isEdge, wellName } from '../src/sim/plate.js';
import { fit4pl, zPrime, cv, mean } from '../src/sim/fit.js';
import { levelScore } from '../src/sim/score.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('rng is deterministic and poisson has the right mean', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const r = rng(7);
  let s = 0; for (let i = 0; i < 4000; i++) s += poisson(r, 18);
  near(s / 4000, 18, 0.4, 'poisson mean');
  let g = 0; for (let i = 0; i < 4000; i++) g += gauss(r);
  near(g / 4000, 0, 0.06, 'gauss mean');
});

test('liquid volumes add and split by proportion', () => {
  const stock = L({ dmso: 100, 'drug:gefitinib': 100 * 10000 }); // 10 mM = 10 000 pmol/µL
  near(um(stock, 'drug:gefitinib'), 10000, 1e-6, 'stock µM');
  const [take, rest] = split(stock, 3);
  near(vol(take), 3, 1e-9); near(vol(rest), 97, 1e-9);
  const work = add(L({ medium: 997 }), take);
  near(um(work, 'drug:gefitinib'), 30, 1e-6, '3× working solution is 30 µM');
  near(dmsoPct(work), 0.3, 1e-9, 'DMSO 0.3%');
  assert.ok(work.mix < 1, 'adding a different liquid leaves it unmixed');
});

test('three-fold serial dilution', () => {
  let src = L({ medium: 225, 'drug:X': 225 * 30 });
  const vals = [um(src, 'drug:X')];
  for (let i = 0; i < 7; i++) {
    const [t, r] = split(src, 75); src = r;
    const next = add(L({ medium: 150 }), t);
    vals.push(um(next, 'drug:X'));
    src = { ...next, mix: 1 };
  }
  for (let i = 1; i < vals.length; i++) near(vals[i - 1] / vals[i], 3, 1e-9, `step ${i}`);
});

test('liquid colour reflects trypan blue and phenol red', () => {
  assert.match(color(L({ medium: 1000 })).fill, /^rgb/);
  const blue = color(L({ tb: 10, medium: 10 }));
  const [r, , b] = blue.fill.match(/\d+/g).map(Number);
  assert.ok(b > r, 'trypan mix is blue');
});

test('pipette accuracy follows ISO-like specs and the second stop over-aspirates', () => {
  const p200 = SPECS.p200;
  const hi = accuracy(p200, 200), lo = accuracy(p200, 20);
  assert.ok(lo.sys > hi.sys && lo.cv > hi.cv, 'error grows toward the bottom of the range');
  const r = rng(3);
  let s = 0; for (let i = 0; i < 400; i++) s += aspirateVol(p200, 100, 1, r, 0);
  near(s / 400, 100, 0.4, 'first stop mean');
  const over = aspirateVol(p200, 100, 2, rng(1), 0);
  assert.ok(over > 108 && over < 125, `second stop over-aspirates: ${over}`);
  near(residual(100), 3, 0.5, 'first-stop-only dispense leaves ~3%');
});

test('cell growth, trypsin detachment, pelleting and rcf', () => {
  const n = grow(5000, 28, 28, 1e9);
  near(n, 10000, 20, 'one doubling');
  assert.ok(grow(5000, 72, 28, 6e4) < 6e4, 'logistic cap');
  assert.ok(detach(4, 37) < 0.15, 'mostly detached after 4 min at 37 °C');
  assert.ok(detach(4, 22) > 0.5, 'slow at room temperature');
  assert.ok(pellet(300, 5) > 0.95);
  assert.ok(pellet(50, 2) < 0.4);
  near(rcf(rpmFor(300, 10), 10), 300, 1e-6, 'rpm ↔ g round trip');
  near(rpmFor(300, 10), 1638, 2, 'rpm for 300 ×g at r = 10 cm');
  assert.ok(LINES['PC-9'] && LINES.H1975 && LINES.A431);
});

test('hemocytometer counting rule: top/left lines count, bottom/right do not', () => {
  const r = 0.02;
  assert.equal(counted({ x: 0.5, y: 0.5, r }), true);
  assert.equal(counted({ x: 0.5, y: 0.01, r }), true, 'touching top');
  assert.equal(counted({ x: 0.01, y: 0.5, r }), true, 'touching left');
  assert.equal(counted({ x: 0.5, y: 0.99, r }), false, 'touching bottom');
  assert.equal(counted({ x: 0.99, y: 0.5, r }), false, 'touching right');
  assert.equal(counted({ x: 0.5, y: -0.05, r }), false, 'outside');
  const sq = hemoSquare(rng(9), 200, 20); // per µL: 200 live, 20 dead → ~20 live/square
  const live = sq.filter((c) => counted(c) && !c.dead).length;
  assert.ok(live > 8 && live < 35, `live count ${live}`);
});

test('pharmacology: hill, compound selectivity, DMSO toxicity', () => {
  near(hill(1, 1, 1), 0.5, 1e-9);
  const a = COMPOUNDS['gefitinib'];
  assert.ok(a.ic50.A431 / a.ic50['PC-9'] > 10, 'gefitinib is EGFR-mutant selective');
  const c = COMPOUNDS['paclitaxel'];
  assert.ok(c.ic50.A431 / c.ic50['PC-9'] < 2, 'paclitaxel is not selective');
  assert.ok(viability('PC-9', 'gefitinib', 10, 0.1) < 0.2);
  assert.ok(viability('PC-9', 'gefitinib', 0.0001, 0.1) > 0.98);
  assert.equal(dmsoTox(0.1), 1);
  assert.ok(dmsoTox(0.5) > 0.85 && dmsoTox(1) < 0.75 && dmsoTox(2) < 0.25);
});

test('plate indexing', () => {
  assert.equal(wellIndex(0, 0), 0);
  assert.deepEqual(rc(wellIndex(3, 7)), [3, 7]);
  assert.equal(wellName(wellIndex(1, 1)), 'B2');
  assert.equal(isEdge(wellIndex(0, 5)), true);
  assert.equal(isEdge(wellIndex(3, 5)), false);
});

test('4PL fit recovers a known IC50', () => {
  const x = [10, 3.333, 1.111, 0.3704, 0.1235, 0.04115, 0.01372, 0.004572];
  const truth = (c) => 12 + 88 / (1 + (c / 0.05) ** 1.2);
  const r = rng(5);
  const y = x.map((c) => truth(c) + gauss(r) * 1.5);
  const f = fit4pl(x, y);
  near(Math.log10(f.ic50), Math.log10(0.05), 0.08, 'log IC50');
  assert.ok(f.r2 > 0.98, `r2 ${f.r2}`);
  near(f.bottom, 12, 4); near(f.top, 100, 4);
});

test('level score and stars', () => {
  const s = levelScore({ penalty: 0, data: 95, minutes: 50, par: 60 });
  assert.equal(s.stars, 3);
  const f = levelScore({ penalty: 60, data: 40, minutes: 200, par: 60 });
  assert.ok(f.stars <= 1);
  const c = levelScore({ penalty: 0, data: 90, minutes: 50, par: 60, cancer: 20 });
  assert.ok(c.total < s.total, 'cancer index weighs in when present');
});
