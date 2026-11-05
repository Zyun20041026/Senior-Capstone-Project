// Alex 202384014054
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, put, advance } from '../src/game/world.js';
import { make } from '../src/game/catalog.js';
import * as A from '../src/game/actions.js';
import { L } from '../src/sim/liquid.js';
import { BASE } from '../src/game/difficulty.js';

function world(mentor) {
  const w = createWorld(11);
  w.stations = ['bsc', 'bench', 'incubator', 'fridge'];
  w.level = { aseptic: true };
  if (mentor != null) w.diff = { id: mentor ? 'easy' : 'standard', mentor };
  for (const id of ['p20', 'p200', 'p1000', 'mc200', 'aid', 'vac']) w.tools[id] = A.makeTool(id, 'bsc');
  return w;
}
const bottle = (w) => put(w, make('bottle500', { label: '培养基', liq: L({ medium: 400000 }), sterile: true }), 'bench', 'bf1');
const freeBscSlot = (w) => ['k1', 'k2', 'k3', 'f1'].find((s) => !Object.values(w.items).some((x) => x.at.st === 'bsc' && x.at.slot === s));

test('no tier changes contamination odds', () => {
  assert.ok(!('risk' in BASE));
});

test('mentor stops the first unsprayed item, then lets you', () => {
  const w = world(true);
  A.bsc(w, 'fan'); A.spray(w, 'bsc'); advance(w, 6);
  const b = bottle(w); w.station = 'bench'; A.pick(w, b.id); w.station = 'bsc';
  const slot = freeBscSlot(w);
  assert.equal(A.place(w, 'bsc', slot), false);
  assert.equal(w.held?.id, b.id, 'still in hand');
  assert.ok(w.events.some((e) => e.kind === 'mentor' && e.why));
  assert.ok(!w.sop.counts.unsprayed_in);
  const r0 = b.risk || 0;
  A.place(w, 'bsc', slot);
  assert.equal(w.sop.counts.unsprayed_in.n, 1);
  assert.ok(Math.abs((b.risk || 0) - r0 - 0.35) < 1e-9);
});

test('standard tier is never stopped', () => {
  const w = world(false);
  A.bsc(w, 'fan'); A.spray(w, 'bsc'); advance(w, 6);
  const b = bottle(w); w.station = 'bench'; A.pick(w, b.id); w.station = 'bsc';
  A.place(w, 'bsc', freeBscSlot(w));
  assert.equal(w.sop.counts.unsprayed_in.n, 1);
  assert.ok(!w.events.some((e) => e.kind === 'mentor'));
});

test('mentor stops opening a bottle with the fan off, once', () => {
  const w = world(true);
  const b = put(w, make('bottle500', { label: '培养基', liq: L({ medium: 400000 }), sterile: true, sprayed: true }), 'bsc', 'k1');
  assert.equal(A.toggleCap(w, b.id), false);
  assert.ok(!b.open);
  assert.ok(!w.sop.counts.bsc_off);
  assert.equal(A.toggleCap(w, b.id), true);
  assert.ok(b.open);
  assert.equal(w.sop.counts.bsc_off.n, 1);
});
