/* The solver: every deduction is checked against brute force, and hints and
 * mistake explanations are checked against the readings they point at. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Rules, grid, level, viewOf, evidenceForces, worlds } = require('./helpers.js');
const { rng32, shuffle } = require('../js/core.js');

const ADJ = grid(4, 4);
function randomState(rnd) {
  const cells = shuffle(Array.from({ length: 16 }, (_, i) => i), rnd), total = 2 + Math.floor(rnd() * 4);
  const mines = cells.slice(0, total), isMine = new Uint8Array(16);
  mines.forEach((m) => { isMine[m] = 1; });
  const nums = Rules.numbers(ADJ, isMine), K = Rules.knowledge(ADJ, total);
  // reveal a random share of the normal proteins, and expose some resistant ones
  const share = 0.2 + rnd() * 0.6;
  for (let i = 0; i < 16; i++) { if (!isMine[i] && rnd() < share) K.num[i] = nums[i]; else if (isMine[i] && rnd() < 0.15) K.mine[i] = 1; }
  return K;
}

test('every deduction of every tier holds in all layouts that fit the readings (brute force, 4 x 4)', () => {
  const rnd = rng32(20261110);
  let checked = 0, byTier = [0, 0, 0, 0];
  for (let round = 0; round < 1500; round++) {
    const K = randomState(rnd), all = worlds(K);
    assert.ok(all.length > 0);
    const cons = Rules.constraints(K);
    const lists = [[1, Rules.tier1(cons)], [2, Rules.tier2(cons)], [2, Rules.countRule(K)], [3, Rules.tier3(cons)]];
    for (const [tier, list] of lists) for (const d of list) {
      for (const w of all) assert.strictEqual(((w >> d.cell) & 1) === 1, d.mine, 'tier ' + tier + ' deduction about cell ' + d.cell + ' is wrong in a layout that fits');
      assert.ok(evidenceForces(K, d), 'the readings named as evidence are enough on their own');
      checked++; byTier[tier]++;
    }
  }
  assert.ok(byTier[1] > 500 && byTier[2] > 200 && byTier[3] > 200, 'all tiers were exercised: ' + byTier.join(' '));
  assert.ok(checked > 2000);
});

test('tier 3 finds everything the visible readings settle (complete on 4 x 4, together with the counter)', () => {
  const rnd = rng32(77);
  let settled = 0;
  for (let round = 0; round < 400; round++) {
    const K = randomState(rnd), all = worlds(K);
    // ignore the global count here: compare against layouts with any number of resistant proteins
    const free = [];
    for (let total = 0; total <= 16; total++) { const Q = Object.assign({}, K, { total }); for (const w of worlds(Q)) free.push(w); }
    const found = new Map();
    for (const d of Rules.tier3(Rules.constraints(K))) found.set(d.cell, d.mine);
    for (const c of Rules.constraints(K)) for (const x of c.cells) {
      const first = (free[0] >> x) & 1;
      if (free.every((w) => ((w >> x) & 1) === first)) { settled++; if (c.cells.length && Rules.constraints(K).length > 1) assert.ok(found.has(x) || Rules.tier1(Rules.constraints(K)).some((d) => d.cell === x), 'cell ' + x + ' is settled by the readings but tier 3 missed it'); }
    }
    assert.ok(all.length > 0);
  }
  assert.ok(settled > 300);
});

test('the pair rule explains itself: needs, owned cells and the shared count add up', () => {
  // 1 x 5 strip:  [1] ? ? ? [.]  with readings arranged so that two readings must be combined
  const rnd = rng32(5);
  let seen = 0;
  for (let round = 0; round < 800 && seen < 60; round++) {
    const K = randomState(rnd), cons = Rules.constraints(K);
    for (const d of Rules.tier2(cons)) {
      seen++;
      assert.strictEqual(d.why.length, 2);
      const [a, b] = d.why.map((src) => cons.find((c) => c.src === src));
      assert.deepStrictEqual(d.needs, [a.need, b.need]);
      const shared = a.cells.filter((x) => b.cells.includes(x));
      assert.strictEqual(d.shared, shared.length);
      assert.deepStrictEqual(d.owns, [a.cells.length - shared.length, b.cells.length - shared.length]);
      assert.ok(d.sharedMines >= 0 && d.sharedMines <= shared.length);
      if (d.part === 'own') assert.ok(a.cells.includes(d.cell) && !shared.includes(d.cell), 'the first reading owns the settled cell');
      else assert.ok(shared.includes(d.cell));
    }
  }
  assert.ok(seen >= 60);
});

test('prove() rejects a layout that needs a guess and accepts one that does not', () => {
  // 4 x 2, one resistant protein in a corner: two readings of 1 both look at the
  // same two unlocked proteins, and nothing tells them apart
  const coin = Rules.prove(grid(4, 2), [3], 0);
  assert.strictEqual(coin.solved, false);
  assert.strictEqual(coin.reason, 'stuck');
  assert.strictEqual(Rules.prove(grid(4, 2), [3], 3).solved, false, 'the first dose must be on a 0');
  assert.strictEqual(Rules.prove(grid(5, 5), [3, 8, 13, 18, 23], 0).solved, true);

  // when prove() says solved, a hint-following player never has to guess
  const adj = grid(4, 4), rnd = rng32(9);
  let solved = 0, stuck = 0;
  for (let round = 0; round < 300; round++) {
    const cells = shuffle(Array.from({ length: 16 }, (_, i) => i), rnd), mines = cells.slice(0, 3), isMine = new Uint8Array(16);
    mines.forEach((m) => { isMine[m] = 1; });
    const nums = Rules.numbers(adj, isMine), start = cells.find((c) => !isMine[c] && nums[c] === 0);
    if (start === undefined) continue;
    const res = Rules.prove(adj, mines, start);
    if (!res.solved) { stuck++; continue; }
    solved++;
    const s = Rules.Session(level(adj, mines, start), 0);
    for (let guard = 0; s.status !== 'won'; guard++) {
      assert.ok(guard < 60);
      const h = s.hint();
      assert.ok(h, 'a proven layout always has a certain next move');
      if (h.kind === 'flag') { assert.ok(s.isMine(h.cell)); s.toggleFlag(h.cell); } else { const ev = s.dose(h.cell); assert.strictEqual(ev.misses.length, 0); }
    }
    assert.strictEqual(s.mistakes, 0);
  }
  assert.ok(solved > 50 && stuck > 5, 'both kinds of layout were seen: ' + solved + ' / ' + stuck);
});

// 5 x 5 with resistant proteins at 3, 8, 13, 23 (column 3, except 18):
// 7 reads 3 over {3, 8, 13}; 12 reads 2 over {8, 13, 18}; so 18 is normal.
const GAP = [3, 8, 13, 23];

test('a wrong flag is caught first, with the two readings that prove it', () => {
  const s = Rules.Session(level(grid(5, 5), GAP, 0), 0);
  s.dose(0);
  s.toggleFlag(18);
  const h = s.hint();
  assert.strictEqual(h.kind, 'badflag');
  assert.strictEqual(h.cell, 18);
  assert.strictEqual(h.mine, false);
  assert.ok(h.why.length >= 1 && h.why.every((w) => s.reading(w) >= 0));
  assert.ok(evidenceForces(viewOf(s), h));
  // once it is taken off, the hints go back to ordinary moves
  s.toggleFlag(18);
  const next = s.hint();
  assert.ok(next.kind === 'flag' || next.kind === 'dose');
  assert.strictEqual(s.isMine(next.cell), next.mine);
});

test('a provable mistake is explained with the readings that gave it away', () => {
  const s = Rules.Session(level(grid(5, 5), GAP, 0), 0);
  s.dose(0);
  const before = viewOf(s), ev = s.dose(3);          // 2 reads 2 and only 3 and 8 are left around it
  const proof = ev.misses[0].proof;
  assert.strictEqual(proof.known, true);
  assert.strictEqual(proof.cell, 3);
  assert.strictEqual(proof.rule, 'single');
  assert.ok(proof.why.length === 1 && s.reading(proof.why[0]) >= 2);
  assert.ok(evidenceForces(before, Object.assign({}, proof, { mine: true })));
});

test('a guess is called a guess, and the explanation points to a certain move when one exists', () => {
  // the coin flip from above: neither reading settles 3 or 7
  const coin = Rules.Session(level(grid(4, 2), [3], 0), 0);
  coin.dose(0);
  assert.strictEqual(coin.hint(), null, 'nothing certain to offer');
  const ev = coin.dose(3);
  assert.strictEqual(ev.misses[0].proof.known, false);
  assert.strictEqual(ev.misses[0].proof.alt, null);

  // wall layout: column 4 cannot be reasoned about until the wall is found, but the wall can
  const s = Rules.Session(level(grid(5, 5), [3, 8, 13, 18, 23, 4], 0), 0);
  s.dose(0);
  const ev2 = s.dose(4);
  assert.strictEqual(ev2.misses[0].proof.known, false);
  assert.ok(ev2.misses[0].proof.alt, 'a certain move existed elsewhere');
  assert.strictEqual(s.isMine(ev2.misses[0].proof.alt.cell), ev2.misses[0].proof.alt.mine);
});

test('the counter: when every resistant protein is found, the rest is normal', () => {
  const s = Rules.Session(level(grid(5, 5), [3, 8, 13, 18, 23], 0), 0);
  s.dose(0);
  // flag the wall by following hints, then the far column must come from the counter
  for (let guard = 0; guard < 10; guard++) { const h = s.hint(); if (h.rule === 'count') break; assert.strictEqual(h.kind, 'flag'); h.cells.forEach((c) => s.toggleFlag(c)); }
  const h = s.hint();
  assert.strictEqual(h.rule, 'count');
  assert.strictEqual(h.mine, false);
  assert.strictEqual(h.left, 0);
  assert.deepStrictEqual(h.cells.slice().sort((a, b) => a - b), [4, 9, 14, 19, 24]);
});
