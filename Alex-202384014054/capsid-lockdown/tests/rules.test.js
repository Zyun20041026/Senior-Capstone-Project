/* The rules: dosing, readings, spreading, flags, mistakes, winning, stars. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Rules, grid, level } = require('./helpers.js');

// 5 x 5 grid with a wall of resistant proteins in column 3: the first dose
// locks columns 0-2 and can never reach column 4.
//   .  .  .  M  .        0  1  2  3  4
//   .  .  .  M  .        5  6  7  8  9
//   .  .  .  M  .       10 11 12 13 14
//   .  .  .  M  .       15 16 17 18 19      GAP: the same wall with 18 normal
//   .  .  .  M  .       20 21 22 23 24
const ADJ = grid(5, 5), WALL = [3, 8, 13, 18, 23], GAP = [3, 8, 13, 23];
const fresh = (mines) => Rules.Session(level(ADJ, mines || WALL, 0), 0);
const rest = (s) => { const out = []; for (let i = 0; i < s.n; i++) if (!s.isMine(i) && s.state[i] === 0) out.push(i); return out; };

test('readings count resistant neighbours, sharing an edge or a corner', () => {
  const isMine = new Uint8Array(25);
  WALL.forEach((m) => { isMine[m] = 1; });
  const nums = Rules.numbers(ADJ, isMine);
  assert.strictEqual(nums[2], 2);      // touches 3 by an edge and 8 by a corner
  assert.strictEqual(nums[7], 3);      // touches 3, 8 and 13
  assert.strictEqual(nums[4], 2);
  assert.strictEqual(nums[14], 3);
  assert.strictEqual(nums[1], 0);
});

test('the first dose must go on the start protein; flags wait until then', () => {
  const s = fresh();
  assert.strictEqual(s.status, 'ready');
  assert.strictEqual(s.canDose(7), false);
  assert.strictEqual(s.dose(7), null);
  assert.strictEqual(s.toggleFlag(3), false);
  assert.ok(s.dose(0));
  assert.strictEqual(s.status, 'playing');
});

test('a reading of 0 spreads outwards in rings and stops at numbers', () => {
  const s = fresh(), ev = s.dose(0);
  assert.deepStrictEqual(ev.misses, []);
  assert.deepStrictEqual(ev.waves[0], [0]);
  assert.ok(ev.waves.length >= 3, 'the drug spreads over several rings');
  const locked = ev.waves.reduce((a, w) => a.concat(w), []);
  assert.strictEqual(new Set(locked).size, locked.length, 'no protein locks twice');
  assert.strictEqual(locked.length, 15, 'columns 0-2');
  assert.strictEqual(s.locked, 15);
  for (const i of locked) assert.ok(i % 5 <= 2);
  assert.strictEqual(s.reading(2), 2);
  assert.strictEqual(s.reading(7), 3);
  assert.strictEqual(s.reading(1), 0);
  assert.strictEqual(s.reading(3), -1, 'unlocked proteins show no reading');
  assert.strictEqual(s.reading(4), -1, 'the drug does not jump over the wall');
  // each ring only contains proteins next to the ring before it
  for (let k = 1; k < ev.waves.length; k++) for (const i of ev.waves[k]) assert.ok(ADJ[i].some((j) => ev.waves[k - 1].includes(j)));
  assert.strictEqual(ev.won, false);
});

test('flags mark, unmark, block a dose and count down the resistant proteins left', () => {
  const s = fresh();
  s.dose(0);
  assert.strictEqual(s.left(), 5);
  assert.strictEqual(s.toggleFlag(3), true);
  assert.strictEqual(s.flag[3], 1);
  assert.strictEqual(s.flags(), 1);
  assert.strictEqual(s.left(), 4);
  assert.strictEqual(s.canDose(3), false);
  assert.strictEqual(s.dose(3), null, 'a flagged protein cannot be dosed');
  assert.strictEqual(s.toggleFlag(3), true);
  assert.strictEqual(s.flag[3], 0);
  assert.strictEqual(s.toggleFlag(0), false, 'a locked protein cannot be flagged');
});

test('dosing a resistant protein is one mistake and exposes it; three end the game', () => {
  const s = fresh();
  s.dose(0);
  let ev = s.dose(3);
  assert.strictEqual(ev.misses.length, 1);
  assert.strictEqual(ev.misses[0].cell, 3);
  assert.deepStrictEqual(ev.waves, []);
  assert.strictEqual(s.mistakes, 1);
  assert.strictEqual(s.state[3], 2);
  assert.strictEqual(s.left(), 4, 'an exposed resistant protein is no longer unaccounted for');
  assert.strictEqual(s.dose(3), null, 'it cannot be dosed again');
  ev = s.dose(8);
  assert.strictEqual(ev.lost, false);
  ev = s.dose(13);
  assert.strictEqual(ev.lost, true);
  assert.strictEqual(s.status, 'lost');
  assert.strictEqual(s.dose(4), null, 'nothing more can be dosed after the escape');
  assert.strictEqual(s.stars(), 0);
  assert.strictEqual(Rules.MAX_MISTAKES, 3);
  assert.strictEqual(s.max, 3);
});

test('locking every normal protein wins, flags or no flags', () => {
  const s = fresh();
  s.dose(0);
  const todo = rest(s);
  assert.deepStrictEqual(todo, [4, 9, 14, 19, 24]);
  let won = false;
  todo.forEach((i, k) => { const ev = s.dose(i); assert.strictEqual(ev.won, k === todo.length - 1); won = ev.won; });
  assert.strictEqual(won, true);
  assert.strictEqual(s.status, 'won');
  assert.strictEqual(s.locked, s.safeTotal);
  assert.strictEqual(s.flags(), 0);
  assert.strictEqual(s.stars(), 3);
});

test('stars: three for a clean run, two for one slip or any hint, one otherwise', () => {
  const play = (slips, hint) => {
    const s = fresh();
    s.dose(0);
    if (hint) s.hint();
    WALL.slice(0, slips).forEach((m) => s.dose(m));
    rest(s).forEach((i) => s.dose(i));
    assert.strictEqual(s.status, 'won');
    return s.stars();
  };
  assert.strictEqual(play(0, false), 3);
  assert.strictEqual(play(1, false), 2);
  assert.strictEqual(play(0, true), 2);
  assert.strictEqual(play(1, true), 1);
  assert.strictEqual(play(2, false), 1);
  const peek = fresh();
  peek.dose(0); peek.hint({ peek: true });
  assert.strictEqual(peek.hints, 0, 'the coach can look at a hint without spending one');
});

test('clicking a satisfied reading doses the rest of its ring; a wrong flag costs a mistake', () => {
  const s = fresh(GAP);
  s.dose(0);
  assert.strictEqual(s.reading(12), 2);                 // touches 8, 13 and the normal 18
  assert.strictEqual(s.canChord(12), false, 'not until its resistant neighbours are marked');
  s.toggleFlag(8); s.toggleFlag(13);
  assert.strictEqual(s.canChord(12), true);
  const ev = s.chord(12);
  assert.deepStrictEqual(ev.misses, []);
  assert.strictEqual(s.state[18], 1);
  assert.strictEqual(s.reading(18), 2);
  assert.strictEqual(s.canChord(12), false, 'nothing left around it');

  const t = fresh(GAP);
  t.dose(0);
  t.toggleFlag(8); t.toggleFlag(18);                    // wrong: 18 is normal, 13 is the resistant one
  const bad = t.chord(12);
  assert.strictEqual(bad.misses.length, 1);
  assert.strictEqual(bad.misses[0].cell, 13);
  assert.strictEqual(t.mistakes, 1);
  assert.strictEqual(t.state[18], 0, 'the flagged protein was left alone');
});

test('spreading does not run through a flagged protein', () => {
  // a strip of seven:  .  .  1  M  1  .  .
  const s = Rules.Session(level(grid(7, 1), [3], 0), 0);
  assert.deepStrictEqual(s.dose(0).waves, [[0], [1], [2]]);
  s.toggleFlag(6);
  const ev = s.dose(5);
  assert.deepStrictEqual(ev.waves, [[5], [4]]);
  assert.strictEqual(s.state[6], 0);
  assert.strictEqual(s.status, 'playing', 'a wrongly flagged normal protein still has to be locked');
  s.toggleFlag(6);
  assert.strictEqual(s.dose(6).won, true);
});
