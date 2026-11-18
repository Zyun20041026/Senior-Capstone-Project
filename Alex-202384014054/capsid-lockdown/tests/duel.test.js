/* 交锋 · 守住这团细胞: the pure rules module, replay, the particle's life,
 * bursts, the three kinds of cell (mucus, regrowth), clouds, the waves, the pick after wave 2, the reference bots, and the
 * line between the duel and the main game's save. Node built-ins only. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Duel = require('../js/duel.js');
const Boards = require('../js/boards.js');
const Viruses = require('../js/viruses.js');

const { T, TUNE, HEALTHY, INFECTED, LOST, ABSORB, GOBLET, STEM } = Duel;
const board = Boards.build(Viruses.LIST.find((v) => v.id === 'noro').board);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const make = (seed, o) => Duel.create(Object.assign({ board, seed }, o || {}));
const PLAIN = new Array(32).fill(ABSORB);      // every cell a plain one, for timing tests
const kinds = (list) => { const t = PLAIN.slice(); for (const [i, k] of list) t[i] = k; return t; };
// run a session tick by tick; `each(s, events)` sees every step's events
function run(s, ticks, each) {
  for (let k = 0; k < ticks && (s.phase === 'wave' || s.phase === 'gap'); k++) { s.step(); const ev = s.drain(); if (each && each(s, ev) === false) break; }
  return s;
}
// a one-wave session: a single particle `ring` steps from the macrophage, and a
// second one a minute later that keeps the wave open meanwhile
const single = (ring, bind) => make(5, { types: PLAIN, waves: [{ zh: '测', en: 'TEST', bind: bind || 2, script: [{ wait: 0.2, n: 1, ring: [ring, ring] }, { wait: 60, n: 1, ring: [3, 3] }] }] });

test('the board: 32 cells, every one with neighbours, all reachable', () => {
  assert.strictEqual(board.cells.length, 32);
  const d = Duel.distances(board.adj);
  for (let i = 0; i < 32; i++) {
    assert.ok(board.adj[i].length >= 5, 'cell ' + i + ' has a ring of neighbours');
    assert.ok(d[i].every((x) => x >= 0), 'every cell reachable from ' + i);
  }
});

test('the rules module uses no Math.random, no Date, no clock and no storage', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/duel.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'Date', 'performance', 'localStorage', 'setTimeout', 'requestAnimationFrame', 'document', 'window']) {
    assert.ok(src.indexOf(bad) < 0, 'duel.js does not use ' + bad);
  }
});

test('the duel in game.js never touches the main save', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
  const a = src.indexOf('// ------------------------------------------------------------ 交锋 · 守住这团细胞');
  const b = src.indexOf('// ------------------------------------------------------------ input');
  assert.ok(a > 0 && b > a, 'the duel section is where it should be');
  const part = src.slice(a, b).replace(/\/\/.*$/gm, '');      // code only, not the comments that name the save
  assert.ok(!/\bstore\(\)/.test(part), 'no store() in the duel');
  assert.ok(!/SAVE_KEY|capsid-lockdown-v1/.test(part), 'no main save key in the duel');
  assert.ok(/'capsid-duel-v1'/.test(part), 'its own key');
  assert.ok(/游戏数据为虚构/.test(part), 'the fiction notice is there');
  // the sound switch only saves outside the duel
  assert.ok(/name === 'sound'\) \{ save\.sound = !save\.sound; if \(mode !== 'duel'\) store\(\);/.test(src));
});

test('same seed, same moves: the same game, tick for tick; another seed differs', () => {
  const trace = (seed) => {
    const s = make(seed), mem = {}, out = [];
    for (let k = 0; k < T(40); k++) { Duel.BOTS.nearest(s, mem, { lag: 30 }); s.step(); s.drain(); if (k % 60 === 0) out.push(s.hash()); }
    return out;
  };
  assert.deepStrictEqual(trace(9), trace(9));
  assert.notDeepStrictEqual(trace(9), trace(10));
});

test('a played game replays from its input log to the same end', () => {
  for (const seed of [2, 7, 13]) {
    const s = Duel.play({ board, seed }, 'careful', { lag: 45, notice: 60, upgrade: seed === 7 ? 'cloud' : 'speed' });
    assert.ok(s.log.some((e) => e[1] === 'route') && s.log.some((e) => e[1] === 'collect') && s.log.some((e) => e[1] === 'choose'), 'the log holds input');
    const r = Duel.replay({ board, seed }, s.log, s.tick + 60);
    assert.strictEqual(r.phase, s.phase);
    assert.strictEqual(r.tick, s.tick);
    assert.strictEqual(r.hash(), s.hash(), 'seed ' + seed);
  }
});

test('a particle: shadow, landing, three receptors, taken in, infection, burst into three', () => {
  const s = make(1, { types: PLAIN }), ev = {};
  let lesson = -1;
  // nobody moves; the first particle lands two steps from the macrophage, out of its reach
  run(s, T(60), (z, list) => {
    for (const e of list) {
      if (e.k === 'spawn' && e.lesson) lesson = e.id;
      if (e.id === lesson && !ev[e.k + (e.step || '')]) ev[e.k + (e.step || '')] = e;
      if (e.k === 'burst' && ev.infect && e.cell === ev.infect.cell && !ev.burst) ev.burst = e;
    }
    return !ev.burst;
  });
  assert.ok(lesson > 0, 'the first particle is the lesson');
  const cell = ev.land.cell;
  assert.strictEqual(s.dist[s.home][cell], 2, 'it lands two steps away');
  assert.strictEqual(ev.land.tick - ev.spawn.tick, T(TUNE.drift) - 1, 'flight time (the step it appears in is its first tick of flight)');
  assert.strictEqual(ev.land.tick - ev.shadow.tick, T(TUNE.shadow), 'shadow shows before touchdown');
  const bind = T(s.waves[0].bind);
  assert.strictEqual(ev.bind1.tick - ev.land.tick, bind - 1, 'the landing step already counts toward the first receptor');
  assert.strictEqual(ev.bind2.tick - ev.bind1.tick, bind);
  assert.strictEqual(ev.bind3.tick - ev.bind2.tick, bind);
  assert.strictEqual(ev.engulf.tick, ev.bind3.tick, 'taken in at the third receptor');
  assert.strictEqual(ev.infect.tick - ev.engulf.tick, T(TUNE.engulf));
  assert.strictEqual(ev.infect.cell, cell);
  assert.strictEqual(ev.burst.tick - ev.infect.tick, T(TUNE.infect) - 1, 'bursts after the countdown (the infecting step counts)');
  assert.strictEqual(ev.burst.ids.length, TUNE.burst, 'three particles out');
  assert.ok(ev.burst.losses >= 1);
  assert.strictEqual(s.cell[cell], LOST);
});

test('the tissue: two goblet and three stem cells from the seed, kept apart, none on the first cell', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const s = make(seed), again = make(seed);
    assert.deepStrictEqual(Array.from(s.type), Array.from(again.type), 'same seed, same tissue');
    seen.add(Array.from(s.type).join(''));
    assert.strictEqual(s.goblets.length, TUNE.goblets);
    assert.strictEqual(s.stems.length, TUNE.stems);
    assert.strictEqual(s.type[s.home], ABSORB, 'the macrophage starts on a plain cell');
    assert.ok(s.dist[s.goblets[0]][s.goblets[1]] >= 3, 'goblet cells far apart');
    for (const g of s.stems) assert.ok(board.adj[g].every((j) => s.type[j] !== GOBLET), 'no stem cell on a goblet cell\'s ring');
    // mucus: each goblet cell and its ring, nothing else
    const want = new Set();
    for (const g of s.goblets) { want.add(g); board.adj[g].forEach((j) => want.add(j)); }
    for (let i = 0; i < 32; i++) assert.strictEqual(s.mucus[i], want.has(i) ? 1 : 0);
  }
  assert.ok(seen.size > 50, 'the tissue changes from seed to seed');
  // the layout has its own random stream: the particles go where they would on plain tissue
  const first = (o) => { const s = make(3, o); run(s, T(3), () => !s.viruses.length); return s.viruses.map((v) => v.cell); };
  assert.deepStrictEqual(first(), first({ types: PLAIN }));
});

test('mucus: receptors take twice as long on a goblet cell and its ring, until the goblet cell bursts', () => {
  // where the first particle lands (the same on any tissue)
  const probe = single(2);
  run(probe, T(10), (z, list) => !list.some((e) => e.k === 'land'));
  const cell = probe.viruses[0].cell, ring = board.adj[cell][0];
  const binds = (types) => {
    const s2 = make(5, { types, waves: [{ zh: '测', en: 'TEST', bind: 1, script: [{ wait: 0.2, n: 1, ring: [2, 2] }, { wait: 60, n: 1, ring: [3, 3] }] }] });
    const ticks = [];
    run(s2, T(20), (z, list) => { for (const e of list) if (e.k === 'land' || e.k === 'bind') ticks.push([e.k, e.tick, e.mucus]); return ticks.length < 4; });
    return { s: s2, ticks };
  };
  const plain = binds(PLAIN).ticks, wet = binds(kinds([[cell, GOBLET]])).ticks, near = binds(kinds([[ring, GOBLET]])).ticks;
  assert.strictEqual(plain[2][1] - plain[1][1], T(1));
  assert.strictEqual(wet[2][1] - wet[1][1], T(1) * TUNE.mucus, 'on the goblet cell itself');
  assert.strictEqual(near[2][1] - near[1][1], T(1) * TUNE.mucus, 'on its ring');
  assert.ok(wet[1][2] && !plain[1][2], 'the event says so');
  // the cover goes when the goblet cell bursts
  const s = make(5, { types: kinds([[cell, GOBLET]]), waves: [{ zh: '测', en: 'TEST', bind: 1, script: [{ wait: 60, n: 1, ring: [3, 3] }] }] });
  assert.strictEqual(s.mucus[ring], 1);
  s.cell[cell] = INFECTED; s.infT[cell] = 1;
  s.step();
  assert.strictEqual(s.cell[cell], LOST);
  assert.ok(Array.from(s.mucus).every((x) => x === 0), 'no mucus left');
});

test('stem cells grow burst neighbours back, the oldest first, one per interval, only while healthy', () => {
  const quiet = [{ zh: '测', en: 'TEST', bind: 1, script: [{ wait: 120, n: 1, ring: [3, 3] }] }];
  const stem = board.adj[24].find((i) => i !== 24 && board.adj[i].length >= 5);
  const [a, b] = board.adj[stem].filter((j) => j !== 24);
  const s = make(9, { types: kinds([[stem, STEM]]), waves: quiet, home: 24 });
  s.step(); s.drain();
  s.cell[a] = LOST; s.lostAt[a] = 0; s.cell[b] = LOST; s.lostAt[b] = -5; s.losses = 2;
  const grown = [];
  run(s, T(TUNE.regrow) * 2 + 2, (z, list) => { for (const e of list) if (e.k === 'regrow') grown.push(e); });
  assert.deepStrictEqual(grown.map((e) => e.cell), [b, a], 'the one lost longest ago first');
  assert.strictEqual(grown[1].tick - grown[0].tick, T(TUNE.regrow));
  assert.strictEqual(grown[0].stem, stem);
  assert.strictEqual(s.losses, 0, 'each one grown back comes off the losses');
  assert.strictEqual(s.regrown, 2);
  assert.strictEqual(s.cell[a], HEALTHY);
  // an infected stem cell does not
  const t = make(9, { types: kinds([[stem, STEM]]), waves: quiet, home: 24 });
  t.cell[a] = LOST; t.losses = 1; t.cell[stem] = INFECTED; t.infT[stem] = T(100);
  let any = false;
  run(t, T(TUNE.regrow) + 5, (z, list) => { if (list.some((e) => e.k === 'regrow')) any = true; });
  assert.ok(!any && t.cell[a] === LOST && t.losses === 1);
});

test('burst particles hop to the neighbours of the burst cell', () => {
  const s = make(4);
  let burst = null;
  const hops = [];
  run(s, T(90), (z, list) => {
    for (const e of list) { if (e.k === 'burst' && !burst) burst = e; if (burst && e.k === 'hop' && burst.ids.indexOf(e.id) >= 0) hops.push(e); }
    return !burst;
  });
  assert.ok(burst, 'an idle game has a burst');
  const kids = s.viruses.filter((v) => burst.ids.indexOf(v.id) >= 0);
  assert.strictEqual(kids.length, TUNE.burst);
  for (const v of kids) {
    assert.strictEqual(v.st, 'drift');
    assert.ok(board.adj[burst.cell].indexOf(v.cell) >= 0 || s.cell[v.cell] === HEALTHY, 'lands next door (or on the nearest healthy cell)');
  }
});

test('nobody playing: the clump is lost at 8 burst cells, and stays lost', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = Duel.play({ board, seed }, 'idle', {});
    assert.strictEqual(s.phase, 'lose', 'seed ' + seed);
    assert.strictEqual(s.losses, TUNE.lossMax);
    assert.strictEqual(s.stars, 0);
    let lost = 0;
    for (let i = 0; i < 32; i++) if (s.cell[i] === LOST) lost++;
    assert.strictEqual(lost, TUNE.lossMax);
    const h = s.hash();
    assert.strictEqual(s.step(), false, 'no steps after the end');
    assert.strictEqual(s.hash(), h);
    assert.strictEqual(s.route([s.occ(), board.adj[s.occ()][0]]), false, 'no moves after the end');
  }
});

test('the macrophage eats what lands next to it, and leaves a light point', () => {
  const s = single(1);
  let land = null, eat = null;
  run(s, T(20), (z, list) => { for (const e of list) { if (e.k === 'land') land = e; if (e.k === 'eat') eat = e; } return !eat; });
  assert.ok(land && eat);
  assert.strictEqual(eat.tick - land.tick + 1, T(TUNE.eat), 'eating takes its time');
  assert.strictEqual(s.eaten, 1);
  assert.strictEqual(s.dots.length, 1);
  assert.strictEqual(s.collect(9999), false, 'no such light point');
  assert.strictEqual(s.collect(s.dots[0].id), true);
  assert.strictEqual(s.points, 1);
  assert.strictEqual(s.dots.length, 0);
});

test('light points fade when nobody sweeps them up', () => {
  const s = single(1);
  run(s, T(20), () => !s.dots.length);
  const d = s.dots[0];
  let fade = null;
  for (let k = 0; k < T(TUNE.dotLife) + 2 && !fade; k++) { s.step(); for (const e of s.drain()) if (e.k === 'fade' && e.dot === d.id) fade = e; }
  assert.ok(fade, 'it fades');
  assert.strictEqual(fade.tick - d.born, T(TUNE.dotLife));
  assert.strictEqual(s.collect(d.id), false, 'gone');
});

test('a route must start where the macrophage is and follow neighbours; it is then walked', () => {
  const s = make(3), o = s.occ(), a = board.adj[o][0];
  const far = board.adj[a].find((j) => j !== o && board.adj[o].indexOf(j) < 0);
  assert.strictEqual(s.route([]), false);
  assert.strictEqual(s.route('x'), false);
  assert.strictEqual(s.route([a, o]), false, 'must start at the macrophage');
  assert.strictEqual(s.route([o, far]), false, 'must follow neighbours');
  assert.strictEqual(s.route([o, a, far]), true);
  let arrive = null;
  run(s, T(10), (z, list) => { for (const e of list) if (e.k === 'arrive') arrive = e; return !arrive; });
  assert.ok(arrive);
  assert.strictEqual(arrive.cell, far);
  assert.strictEqual(s.mac.at, far);
  // Duel.path gives a valid route between any two cells
  for (let i = 0; i < 32; i += 5) for (let j = 0; j < 32; j += 7) {
    const p = Duel.path(board.adj, i, j);
    assert.strictEqual(p[0], i); assert.strictEqual(p[p.length - 1], j);
    for (let k = 1; k < p.length; k++) assert.ok(board.adj[p[k - 1]].indexOf(p[k]) >= 0);
    assert.strictEqual(p.length - 1, s.dist[i][j], 'shortest');
  }
});

test('turning back halfway along an edge reverses, not restarts', () => {
  const s = make(3), o = s.occ(), a = board.adj[o][0];
  s.route([o, a]);
  run(s, 10);
  assert.strictEqual(s.mac.to, a);
  const p = s.mac.p;
  assert.ok(p > 0 && p < 0.5);
  assert.strictEqual(s.route([o]), true, 'a route of one cell: stay here');
  assert.strictEqual(s.route([s.occ(), a]), true);
  assert.ok(Math.abs(s.mac.p - p) < 1e-9 && s.mac.to === a, 'going on the same way keeps its place');
  assert.strictEqual(s.route([o, board.adj[o][1]]), true);
  assert.strictEqual(s.mac.to, o, 'heads back to the cell it left');
  assert.ok(Math.abs(s.mac.p - (1 - p)) < 1e-9);
});

test('a cloud: particles cannot stick, attached ones let go, eating goes twice as fast', () => {
  // attached ones let go
  let s = single(3, 1);
  run(s, T(20), () => !s.viruses.some((v) => v.st === 'land' && v.bind >= 1));
  const v = s.viruses[0];
  assert.strictEqual(s.cloud(s.centers[v.cell]), false, 'locked before wave 2');
  s.unlocked = true; s.points = TUNE.cloudCost;
  const id = s.cloud(s.centers[v.cell]);
  assert.ok(id, 'placed');
  assert.strictEqual(s.points, 0);
  assert.strictEqual(s.cloud(s.centers[v.cell]), false, 'not enough points for another');
  const cl = s.clouds[0];
  assert.ok(cl.cells.indexOf(v.cell) >= 0);
  assert.ok(cl.cells.every((i) => dot(s.centers[i], cl.u) >= TUNE.cloudCos));
  s.step();
  const coat = s.drain().find((e) => e.k === 'coat');
  assert.ok(coat && coat.released, 'the attached particle lets go');
  assert.strictEqual(v.st, 'coat'); assert.strictEqual(v.bind, 0);
  // it never binds while the cloud lasts, then lands again
  let bound = false, uncoat = null;
  run(s, T(TUNE.cloudLife) + 5, (z, list) => { for (const e of list) { if (e.k === 'bind') bound = true; if (e.k === 'uncoat') uncoat = e; } return !uncoat; });
  assert.ok(!bound, 'no receptor while clouded');
  assert.ok(uncoat, 'when the cloud lifts it can try again');
  assert.strictEqual(uncoat.tick - cl.born, cl.life + 1, 'on the step after the cloud lifts');

  // cannot stick: a cloud placed before the landing
  s = single(3);
  run(s, T(5), () => !s.viruses.length);      // until it appears (spawn times carry a seeded jitter)
  s.unlocked = true; s.points = TUNE.cloudCost;
  s.cloud(s.centers[s.viruses[0].cell]);
  let land = null, coat2 = null;
  run(s, T(10), (z, list) => { for (const e of list) { if (e.k === 'land') land = e; if (e.k === 'coat') coat2 = e; } return !coat2; });
  assert.ok(land && coat2 && coat2.tick === land.tick && !coat2.released, 'coated the moment it lands');

  // twice as fast to eat
  s = single(1);
  run(s, T(5), () => !s.viruses.length);      // until it appears (spawn times carry a seeded jitter)
  s.unlocked = true; s.points = TUNE.cloudCost;
  s.cloud(s.centers[s.viruses[0].cell]);
  let l2 = null, eat = null;
  run(s, T(10), (z, list) => { for (const e of list) { if (e.k === 'land') l2 = e; if (e.k === 'eat') eat = e; } return !eat; });
  assert.ok(eat.coated);
  assert.strictEqual(eat.tick - l2.tick + 1, Math.ceil(T(TUNE.eat) / 2));
});

test('three waves of 3, 8 and 16; antibodies at wave 2; the third from the far side', () => {
  assert.deepStrictEqual(Duel.WAVES.map((w) => w.script.reduce((a, e) => a + e.n, 0)), [3, 8, 16]);
  assert.ok(Duel.WAVES[2].back && !Duel.WAVES[0].back && !Duel.WAVES[1].back);
  const s = make(6), mem = {}, waves = [], back = [];
  let unlock = null, chooses = 0;
  assert.deepStrictEqual(s.drain().map((e) => e.k + e.wave), ['wave1'], 'wave 1 is announced at the start');
  while (s.phase !== 'win' && s.phase !== 'lose' && s.tick < T(400)) {
    if (s.phase === 'choose') { chooses++; assert.strictEqual(s.step(), false, 'the clock stops for the pick'); s.choose('speed'); continue; }
    Duel.BOTS.careful(s, mem, { lag: 45, notice: 60 });
    s.step();
    for (const e of s.drain()) {
      if (e.k === 'wave') waves.push(e.wave);
      if (e.k === 'unlock') unlock = { wave: s.wave, points: e.points };
      if (e.k === 'spawn' && s.wave === 3) back.push(dot(s.centers[e.cell], s.anchor));
    }
  }
  assert.strictEqual(s.phase, 'win');
  assert.deepStrictEqual(waves, [2, 3], 'waves 2 and 3 announced (wave 1 at the start)');
  assert.strictEqual(unlock.wave, 2);
  assert.ok(unlock.points >= TUNE.cloudCost, 'enough for one cloud to try it');
  assert.strictEqual(chooses, 1);
  assert.strictEqual(back.length, 16);
  assert.ok(back.filter((d) => d >= 0.15).length >= 13, 'most of wave 3 lands on the side away from the macrophage');
  assert.strictEqual(s.stars, s.losses <= TUNE.stars[0] ? 3 : s.losses <= TUNE.stars[1] ? 2 : 1);
});

test('the pick after wave 2 applies at once, and only then', () => {
  const reach = () => {
    const s = make(8), mem = {};
    while (s.phase !== 'choose' && s.tick < T(200)) { Duel.BOTS.careful(s, mem, { lag: 45, notice: 60 }); s.step(); s.drain(); }
    return s;
  };
  let s = make(8);
  assert.strictEqual(s.choose('speed'), false, 'not before wave 2 is over');
  s = reach();
  assert.strictEqual(s.phase, 'choose');
  assert.strictEqual(s.choose('teleport'), false);
  assert.strictEqual(s.choose('speed'), true);
  assert.strictEqual(s.phase, 'gap');
  assert.ok(Math.abs(s.mac.speed - TUNE.speed * TUNE.upSpeed) < 1e-12);
  assert.strictEqual(s.choose('cloud'), false, 'only one');
  s = reach();
  s.choose('cloud');
  assert.strictEqual(s.cloudCos, TUNE.upCloudCos);
  assert.strictEqual(s.cloudLife, TUNE.cloudLife + TUNE.upCloudLife);
  s.points = TUNE.cloudCost;
  run(s, T(4));
  const id = s.cloud(s.centers[0]);
  const c = s.clouds.find((x) => x.id === id);
  assert.strictEqual(c.life, T(TUNE.cloudLife + TUNE.upCloudLife));
  const base = s.centers.filter((p) => dot(p, s.centers[0]) >= TUNE.cloudCos).length;
  assert.ok(c.cells.length >= base + 4, 'a wider cloud covers more cells: ' + base + ' → ' + c.cells.length);
});

test('tuning: idle always loses, chasing alone wins more often than not, chasing plus clouds nearly always', () => {
  const N = 60, rate = (bot, o) => { let w = 0; for (let seed = 1; seed <= N; seed++) if (Duel.play({ board, seed }, bot, o).phase === 'win') w++; return w / N; };
  const idle = rate('idle', {});
  const nearest = rate('nearest', { lag: 45, upgrade: 'speed' });
  const careful = rate('careful', { lag: 45, notice: 120, upgrade: 'speed' });
  assert.strictEqual(idle, 0);
  assert.ok(nearest >= 0.5 && nearest < 0.97, 'nearest wins ' + nearest);
  assert.ok(careful >= 0.85, 'careful wins ' + careful);
  // a win takes about two minutes or less of game time
  const s = Duel.play({ board, seed: 3 }, 'careful', { lag: 45, notice: 60 });
  assert.strictEqual(s.phase, 'win');
  assert.ok(s.tick / Duel.HZ > 60 && s.tick / Duel.HZ < 150, 'about ' + Math.round(s.tick / Duel.HZ) + ' s');
});
