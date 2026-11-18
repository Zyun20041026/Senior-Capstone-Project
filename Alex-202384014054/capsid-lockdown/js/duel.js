/*
 * Capsid Lockdown — 交锋 · 守住这团细胞 (rules only).
 *
 * A ball of 32 cells (the norovirus shell's 32 cells and their neighbours,
 * reused as tissue) is attacked by drifting virus particles. A particle lands,
 * gathers three receptors, is taken in, the cell is infected and bursts some
 * seconds later, releasing new particles at its neighbours. The player moves
 * one macrophage along the surface (it eats particles on its own cell and the
 * ring around it) and, from the second wave, spends light points on antibody
 * clouds (particles inside one cannot stick, and are eaten twice as fast).
 *
 * The tissue has three kinds of cell, placed from the seed: most are plain
 * (absorptive) cells; goblet cells cover themselves and the ring round them
 * with mucus, where a particle gathers its receptors half as fast (until the
 * goblet cell bursts); stem cells, while healthy, grow one burst neighbour
 * back every so often, and each one grown back takes one off the losses.
 *
 * Pure and replayable: fixed 60 Hz steps, integer tick timers, a seeded RNG,
 * no Math.random, no Date, no trigonometry in the state. Every number below is
 * invented for play; none is a measured biological quantity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.CapsidDuel = factory(root.Capsid);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { dot, sub, add, scale, len, norm, tangent } = C.vec;

  const HZ = 60, STEP = 1 / HZ;
  const T = (s) => Math.round(s * HZ);

  // all in seconds unless noted; invented for play
  const TUNE = {
    drift: 3.4,        // a new particle's flight before it lands
    shadow: 2.0,       // its landing shadow shows this long before touchdown
    hop: 1.1,          // flight of a burst particle (or one that slips) to a nearby cell
    engulf: 0.7,       // membrane folding in after the third receptor
    infect: 12,        // infected cell until it bursts
    burst: 3,          // particles released by a burst (count)
    lossMax: 8,        // burst cells that end the round (count)
    speed: 0.85,       // macrophage crawl, sphere radii per second
    eat: 0.55,         // time to eat one particle in range (half inside a cloud)
    combo: 1.3,        // eats closer than this chain into ×2, ×3 …
    dotLife: 10,       // a light point waits this long to be swept up
    cloudCost: 4,      // light points per cloud (count)
    cloudCos: 0.72,    // cloud reach: within acos(0.72) ≈ 44°; on a cell, that is it and its ring (6–7 cells; the ring sits at cos 0.75–0.80)
    cloudLife: 5,
    upSpeed: 1.45,     // upgrade 'speed': crawl ×1.45
    upCloudCos: 0.3,   // upgrade 'cloud': reach acos(0.3) ≈ 73°, about 12 cells (the second ring sits at cos 0.19–0.45)
    upCloudLife: 2,    // … and this many seconds longer
    gap: 2.6,          // pause between waves
    jit: 1.2,          // each spawn wait moves by up to ± this, from the seed
    tail: 26,          // a wave that is not cleared this long after its last spawn moves on anyway
    stars: [1, 4],     // ≤1 loss: 3 stars, ≤4: 2 stars, otherwise 1
    goblets: 2,        // goblet cells (count); each covers itself and its ring, about 6–7 cells
    stems: 3,          // stem cells (count)
    mucus: 2,          // under mucus, each receptor takes this many times as long
    regrow: 15,        // a healthy stem cell grows one burst neighbour back after this long
  };

  const UPGRADES = [
    { id: 'speed', zh: '巨噬细胞爬得更快', en: 'FASTER CRAWL', sub: '爬行速度 +45%' },
    { id: 'cloud', zh: '抗体云更大', en: 'WIDER CLOUD', sub: '一团盖住的细胞约翻倍，停留 5 → 7 秒' },
  ];

  // bind: seconds per receptor on a plain cell (twice that under mucus). Waves 2 and 3 bind faster than
  // they did before the tissue had kinds, so that mucus makes some places safer, not the whole ball easier.
  // script entries run in order; each waits `wait` seconds after the previous
  // spawn (and, with gate, until no particle is left on the ball)
  //   ring [a, b]  graph distance from the macrophage
  //   apart k      at least k steps from the previous entry's cells
  //   cluster      one cell and its neighbours, otherwise spread out
  //   back         on the side facing away from the macrophage at wave start
  const WAVES = [
    { zh: '第一波', en: 'WAVE 1', bind: 2.2, script: [
      { wait: 1.2, n: 1, ring: [2, 2], lesson: true },
      { wait: 8, gate: true, n: 1, ring: [2, 3] },
      { wait: 4, n: 1, ring: [2, 4], apart: 2 },
    ] },
    { zh: '第二波', en: 'WAVE 2', bind: 0.9, script: [
      { wait: 2.5, n: 2, ring: [3, 4], cluster: true },
      { wait: 2.5, n: 2, ring: [3, 5], cluster: true, apart: 3 },
      { wait: 9, n: 2, ring: [2, 5] },
      { wait: 8, n: 2, ring: [3, 5], cluster: true, apart: 3 },
    ] },
    { zh: '第三波', en: 'WAVE 3', bind: 0.86, back: true, script: [
      { wait: 1.5, n: 3, cluster: true, back: true },
      { wait: 5, n: 3, cluster: true, back: true, apart: 2 },
      { wait: 7, n: 4, back: true },
      { wait: 7, n: 3, cluster: true, back: true, apart: 3 },
      { wait: 7, n: 3, back: true },
    ] },
  ];

  const HEALTHY = 0, INFECTED = 1, LOST = 2;
  const ABSORB = 0, GOBLET = 1, STEM = 2;

  // where the goblet and stem cells go: from the seed, but on a stream of its own, so the particles'
  // draws are not moved. Goblet cells as far apart as the ball allows, stem cells apart from each other
  // and off the goblets' rings, none on the macrophage's first cell.
  function cellTypes(adj, dist, seed, home, tune) {
    const n = adj.length, type = new Int8Array(n), r = C.rng32(((seed ^ 0x5bd1e995) >>> 0) || 7);
    const order = C.shuffle(Array.from({ length: n }, (_, i) => i), r);
    const place = (kind, count, minD, ok) => {
      for (let d = minD; d >= 1; d--) {
        const got = [];
        for (const i of order) if (got.length < count && i !== home && type[i] === ABSORB && ok(i) && got.every((j) => dist[i][j] >= d)) got.push(i);
        if (got.length === count || d === 1) { got.forEach((i) => { type[i] = kind; }); return; }
      }
    };
    place(GOBLET, tune.goblets, 4, () => true);
    place(STEM, tune.stems, 3, (i) => adj[i].every((j) => type[j] !== GOBLET));
    return type;
  }

  // breadth-first distances and a shortest path on the cell graph
  function distances(adj) {
    return adj.map((_, s) => {
      const d = new Array(adj.length).fill(-1), q = [s];
      d[s] = 0;
      for (let h = 0; h < q.length; h++) for (const j of adj[q[h]]) if (d[j] < 0) { d[j] = d[q[h]] + 1; q.push(j); }
      return d;
    });
  }
  function path(adj, a, b) {
    if (a === b) return [a];
    const prev = new Array(adj.length).fill(-1), q = [a];
    prev[a] = a;
    for (let h = 0; h < q.length && prev[b] < 0; h++) for (const j of adj[q[h]]) if (prev[j] < 0) { prev[j] = q[h]; q.push(j); }
    if (prev[b] < 0) return null;
    const out = [b];
    while (out[out.length - 1] !== a) out.push(prev[out[out.length - 1]]);
    return out.reverse();
  }

  function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }

  // opts: { board (cells[].c, adj) | centers + adj, seed, home?, tune? }
  function create(opts) {
    const tune = Object.assign({}, TUNE, opts.tune || {});
    const waves = opts.waves || WAVES;
    const centers = opts.centers || opts.board.cells.map((c) => c.c);
    const adj = opts.adj || opts.board.adj;
    const n = centers.length;
    const rnd = C.rng32((opts.seed >>> 0) || 1);
    const dist = distances(adj);
    const chord = adj.map((list, i) => list.map((j) => len(sub(centers[i], centers[j]))));

    // macrophage starts on the cell nearest a fixed direction (a hexagon on
    // the noro board), so the opening is the same for everyone
    let home = opts.home;
    if (home == null) {
      const want = norm([0.35, 0.25, 1]);
      home = 0;
      for (let i = 1; i < n; i++) if (dot(centers[i], want) > dot(centers[home], want)) home = i;
    }

    const type = opts.types ? Int8Array.from(opts.types) : cellTypes(adj, dist, (opts.seed >>> 0) || 1, home, tune);
    const goblets = [], stems = [];
    type.forEach((t, i) => { if (t === GOBLET) goblets.push(i); else if (t === STEM) stems.push(i); });

    const s = {
      tune, waves, centers, adj, dist, n, home, seed: opts.seed >>> 0, type, goblets, stems,
      tick: 0, phase: 'wave', wave: 0, waveTick: 0, gapT: 0,
      script: 0, lastSpawn: 0, waitT: -1, lastCells: [], anchor: null,
      cell: new Int8Array(n), infT: new Int32Array(n), lostAt: new Int32Array(n), clouded: new Int16Array(n),
      mucus: new Int8Array(n), regT: new Int32Array(n), regrown: 0,
      viruses: [], clouds: [], dots: [],
      mac: { at: home, to: -1, p: 0, path: [], speed: tune.speed, eatId: -1, eatT: 0, lastEat: -9999, combo: 0 },
      points: 0, eaten: 0, losses: 0, stars: 0, unlocked: false, upgrade: null,
      cloudCos: tune.cloudCos, cloudLife: tune.cloudLife,
      events: [], log: [], nextId: 1,
    };

    const emit = (k, o) => { const e = Object.assign({ k, tick: s.tick }, o || {}); s.events.push(e); return e; };
    const occ = () => (s.mac.to >= 0 && s.mac.p >= 0.5 ? s.mac.to : s.mac.at);
    const live = () => s.phase === 'wave' || s.phase === 'gap';
    const bindTicks = () => T(waves[Math.max(0, s.wave - 1)].bind);
    const bindTicksAt = (cell) => (s.mucus[cell] ? Math.round(bindTicks() * tune.mucus) : bindTicks());
    // mucus: every goblet cell that has not burst covers itself and its ring
    function wetten() {
      s.mucus.fill(0);
      for (const g of goblets) if (s.cell[g] !== LOST) { s.mucus[g] = 1; for (const j of adj[g]) s.mucus[j] = 1; }
    }
    const taken = () => { const t = new Set(); s.viruses.forEach((v) => t.add(v.cell)); return t; };

    function macPos() {
      const m = s.mac;
      if (m.to < 0) return centers[m.at].slice();
      const a = centers[m.at], b = centers[m.to];
      return norm(add(scale(a, 1 - m.p), scale(b, m.p)));
    }

    // ---------- choosing where particles go ----------
    function pickCells(e) {
      const o = occ(), busy = taken();
      const ok = (i) => s.cell[i] === HEALTHY && !busy.has(i);
      const tests = [
        (i) => !e.ring || (dist[o][i] >= e.ring[0] && dist[o][i] <= e.ring[1]),
        (i) => !e.back || dot(centers[i], s.anchor) >= 0.15,
        (i) => !e.apart || s.lastCells.every((c) => dist[c][i] >= e.apart),
        (i) => e.ring || e.back || dist[o][i] >= 2,
      ];
      // relax the constraints from the last one backwards until something fits
      let pool = [];
      for (let keep = tests.length; keep >= 0 && !pool.length; keep--) {
        for (let i = 0; i < n; i++) if (ok(i) && tests.slice(0, keep).every((f) => f(i))) pool.push(i);
      }
      if (!pool.length) for (let i = 0; i < n; i++) if (s.cell[i] === HEALTHY) pool.push(i);
      if (!pool.length) return [];
      C.shuffle(pool, rnd);
      const out = [];
      if (e.cluster) {
        const c0 = pool[0];
        out.push(c0);
        const ring = C.shuffle(adj[c0].filter((j) => ok(j)), rnd);
        for (const j of ring) if (out.length < e.n) out.push(j);
      } else {
        // spread: prefer cells at least two steps from the ones already picked
        for (const i of pool) if (out.length < e.n && out.every((j) => dist[i][j] >= 2)) out.push(i);
      }
      for (const i of pool) if (out.length < e.n && out.indexOf(i) < 0) out.push(i);
      while (out.length < e.n) out.push(out[out.length % Math.max(1, out.length)]);
      return out;
    }

    function spawnFar(cell, extra) {
      const c = centers[cell], [u, w] = tangent(c);
      const a = rnd() * 2 - 1, b = rnd() * 2 - 1;
      const dir = norm(add(c, add(scale(u, a * 0.95), scale(w, b * 0.95))));
      const v = Object.assign({ id: s.nextId++, st: 'drift', cell, from: scale(dir, 2.8), dur: T(tune.drift), t: 0,
        bind: 0, bt: 0, wave: s.wave, kid: false, shadowed: false }, extra || {});
      s.viruses.push(v);
      emit('spawn', { id: v.id, cell, lesson: !!v.lesson });
      return v;
    }

    // a particle leaves `src` (its own cell, or a burst cell) for a healthy cell nearby
    function hop(v, src, target) {
      if (target == null) {
        const near = adj[src].filter((j) => s.cell[j] === HEALTHY);
        if (near.length) target = near[Math.floor(rnd() * near.length)];
        else {
          let best = -1;
          for (let i = 0; i < n; i++) if (s.cell[i] === HEALTHY && (best < 0 || dist[src][i] < dist[src][best])) best = i;
          target = best;
        }
      }
      if (target < 0) return false;
      v.st = 'drift'; v.from = scale(centers[src], 1.04); v.cell = target;
      v.dur = T(tune.hop); v.t = 0; v.bind = 0; v.bt = 0; v.kid = true; v.shadowed = true;
      emit('hop', { id: v.id, from: src, cell: target });
      return true;
    }

    function burst(cell) {
      s.cell[cell] = LOST; s.lostAt[cell] = s.tick; s.losses++;
      if (type[cell] === GOBLET) wetten();
      const near = C.shuffle(adj[cell].filter((j) => s.cell[j] === HEALTHY), rnd);
      const ids = [];
      for (let k = 0; k < tune.burst; k++) {
        const v = { id: s.nextId++, st: 'drift', cell, from: null, dur: 0, t: 0, bind: 0, bt: 0, wave: s.wave, kid: true, shadowed: true };
        if (hop(v, cell, near.length ? near[k % near.length] : null)) { s.viruses.push(v); ids.push(v.id); }
      }
      emit('burst', { cell, ids, losses: s.losses });
    }

    // ---------- waves ----------
    function startWave(k) {
      s.wave = k; s.waveTick = 0; s.script = 0; s.lastSpawn = 0; s.waitT = -1; s.lastCells = []; s.phase = 'wave';
      s.anchor = scale(macPos(), -1);
      if (k >= 2 && !s.unlocked) {
        s.unlocked = true;
        if (s.points < tune.cloudCost) s.points = tune.cloudCost;   // enough for one try
        emit('unlock', { points: s.points });
      }
      emit('wave', { wave: k });
    }

    function runScript() {
      const W = waves[s.wave - 1];
      if (s.script >= W.script.length) return;
      const e = W.script[s.script];
      if (s.waitT < 0) s.waitT = Math.max(0, T(e.wait + (e.lesson ? 0 : (rnd() * 2 - 1) * tune.jit)));
      if (s.waveTick - s.lastSpawn < s.waitT) return;
      if (e.gate && s.viruses.length) return;
      const cells = pickCells(e);
      cells.forEach((c) => spawnFar(c, e.lesson ? { lesson: true } : null));
      s.lastCells = cells; s.lastSpawn = s.waveTick; s.script++; s.waitT = -1;
    }

    function waveDone() {
      const W = waves[s.wave - 1];
      if (s.script < W.script.length) return false;
      let infected = false;
      for (let i = 0; i < n; i++) if (s.cell[i] === INFECTED) infected = true;
      const clear = !s.viruses.length && !infected;
      if (clear) return true;
      return s.wave < waves.length && s.waveTick - s.lastSpawn > T(tune.tail);
    }

    // ---------- the macrophage ----------
    function moveMac() {
      const m = s.mac;
      if (m.to < 0 && m.path.length) { m.to = m.path.shift(); m.p = 0; }
      if (m.to < 0) return;
      const k = adj[m.at].indexOf(m.to);
      m.p += m.speed * STEP / chord[m.at][k];
      if (m.p >= 1) {
        m.at = m.to; m.to = -1; m.p = 0;
        if (m.path.length) { m.to = m.path.shift(); m.p = 0; } else emit('arrive', { cell: m.at });
      }
    }

    function eat() {
      const m = s.mac, o = occ();
      const reach = [o].concat(adj[o]);
      let best = null;
      for (const v of s.viruses) {
        if ((v.st !== 'land' && v.st !== 'coat') || reach.indexOf(v.cell) < 0) continue;
        if (v.id === m.eatId) { best = v; break; }
        // the one closest to getting in goes first
        if (!best || v.bind * 1e4 + v.bt > best.bind * 1e4 + best.bt) best = v;
      }
      if (!best) { m.eatId = -1; m.eatT = 0; return; }
      if (best.id !== m.eatId) { m.eatId = best.id; m.eatT = 0; }
      m.eatT += best.st === 'coat' ? 2 : 1;
      if (m.eatT < T(tune.eat)) return;
      s.viruses.splice(s.viruses.indexOf(best), 1);
      m.combo = s.tick - m.lastEat <= T(tune.combo) ? m.combo + 1 : 1;
      m.lastEat = s.tick; m.eatId = -1; m.eatT = 0;
      s.eaten++;
      const d = { id: s.nextId++, cell: best.cell, born: s.tick, j: rnd() };
      s.dots.push(d);
      emit('eat', { id: best.id, cell: best.cell, from: o, combo: m.combo, coated: best.st === 'coat', dot: d.id });
    }

    // ---------- particles ----------
    // stem cells: a healthy one with a burst neighbour grows it back (the one lost longest ago)
    function regrow() {
      const need = T(tune.regrow);
      for (const g of stems) {
        let pick = -1;
        if (s.cell[g] === HEALTHY) for (const j of adj[g]) if (s.cell[j] === LOST && (pick < 0 || s.lostAt[j] < s.lostAt[pick])) pick = j;
        if (pick < 0) { s.regT[g] = 0; continue; }
        if (++s.regT[g] < need) continue;
        s.regT[g] = 0;
        s.cell[pick] = HEALTHY; s.losses--; s.regrown++;
        if (type[pick] === GOBLET) wetten();
        emit('regrow', { cell: pick, stem: g, losses: s.losses });
      }
    }

    function updateViruses() {
      for (let i = s.viruses.length - 1; i >= 0; i--) {
        const v = s.viruses[i];
        if (v.st === 'drift') {
          v.t++;
          if (!v.shadowed && v.dur - v.t <= T(tune.shadow)) { v.shadowed = true; emit('shadow', { id: v.id, cell: v.cell }); }
          if (v.t < v.dur) continue;
          if (s.cell[v.cell] !== HEALTHY) { if (!hop(v, v.cell)) s.viruses.splice(i, 1); continue; }
          v.st = 'land'; v.t = 0; v.bind = 0; v.bt = 0;
          emit('land', { id: v.id, cell: v.cell, lesson: !!v.lesson });
        }
        if (v.st === 'land') {
          if (s.clouded[v.cell]) { emit('coat', { id: v.id, cell: v.cell, released: v.bind > 0 }); v.st = 'coat'; v.bind = 0; v.bt = 0; continue; }
          if (s.cell[v.cell] !== HEALTHY) { if (!hop(v, v.cell)) s.viruses.splice(i, 1); continue; }
          v.t++;
          if (++v.bt < bindTicksAt(v.cell)) continue;
          v.bt = 0; v.bind++;
          emit('bind', { id: v.id, cell: v.cell, step: v.bind, mucus: !!s.mucus[v.cell] });
          if (v.bind >= 3) { v.st = 'engulf'; v.t = 0; emit('engulf', { id: v.id, cell: v.cell }); }
        } else if (v.st === 'coat') {
          v.t++;
          if (s.clouded[v.cell]) continue;
          if (s.cell[v.cell] !== HEALTHY) { if (!hop(v, v.cell)) s.viruses.splice(i, 1); continue; }
          v.st = 'land'; v.t = 0; v.bind = 0; v.bt = 0;
          emit('uncoat', { id: v.id, cell: v.cell });
        } else if (v.st === 'engulf') {
          if (++v.t < T(tune.engulf)) continue;
          s.viruses.splice(i, 1);
          if (s.cell[v.cell] === HEALTHY) {
            s.cell[v.cell] = INFECTED; s.infT[v.cell] = T(tune.infect);
            emit('infect', { cell: v.cell, id: v.id });
          }
        }
      }
    }

    function step() {
      if (!live()) return false;
      s.tick++;
      if (s.phase === 'gap') {
        if (--s.gapT <= 0) startWave(s.wave + 1);
      } else {
        s.waveTick++;
        runScript();
      }
      moveMac();
      updateViruses();
      eat();
      for (let i = 0; i < n; i++) {
        if (s.cell[i] !== INFECTED || --s.infT[i] > 0) continue;
        burst(i);
        if (s.losses >= tune.lossMax) { s.phase = 'lose'; s.stars = 0; emit('lose', { losses: s.losses }); return true; }
      }
      regrow();
      for (let i = s.clouds.length - 1; i >= 0; i--) {
        const c = s.clouds[i];
        if (s.tick - c.born < c.life) continue;
        c.cells.forEach((j) => { s.clouded[j]--; });
        s.clouds.splice(i, 1);
        emit('cloudEnd', { id: c.id });
      }
      for (let i = s.dots.length - 1; i >= 0; i--) if (s.tick - s.dots[i].born >= T(tune.dotLife)) { emit('fade', { dot: s.dots[i].id }); s.dots.splice(i, 1); }
      if (s.phase === 'wave' && waveDone()) {
        emit('clear', { wave: s.wave, clean: !s.viruses.length });
        if (s.wave >= waves.length) {
          s.phase = 'win';
          s.stars = s.losses <= tune.stars[0] ? 3 : s.losses <= tune.stars[1] ? 2 : 1;
          emit('win', { losses: s.losses, stars: s.stars });
        } else if (s.wave === 2 && !s.upgrade) {
          s.phase = 'choose';
          emit('choose', { options: UPGRADES.map((u) => u.id) });
        } else { s.phase = 'gap'; s.gapT = T(tune.gap); }
      }
      return true;
    }

    // ---------- player input ----------
    // list: cells from the macrophage's current cell, each next to the last
    function route(list) {
      if (!live() || !Array.isArray(list) || !list.length) return false;
      const m = s.mac, o = occ();
      if (list[0] !== o) return false;
      for (let i = 1; i < list.length; i++) if (adj[list[i - 1]].indexOf(list[i]) < 0) return false;
      const p = list.slice(1);
      if (m.to >= 0) {
        if (o === m.to) {
          if (p[0] === m.at) { const a = m.at; m.at = m.to; m.to = a; m.p = 1 - m.p; p.shift(); }
        } else if (p[0] === m.to) p.shift();
        else { const a = m.at; m.at = m.to; m.to = a; m.p = 1 - m.p; }
      }
      m.path = p;
      s.log.push([s.tick, 'route', list.slice()]);
      emit('route', { cells: list.slice() });
      return true;
    }

    function cloud(u) {
      if (!live() || !s.unlocked || s.points < tune.cloudCost) return false;
      const dir = norm(u), cells = [];
      for (let i = 0; i < n; i++) if (dot(centers[i], dir) >= s.cloudCos) cells.push(i);
      if (!cells.length) return false;
      s.points -= tune.cloudCost;
      const c = { id: s.nextId++, u: dir, cos: s.cloudCos, cells, born: s.tick, life: T(s.cloudLife) };
      cells.forEach((j) => { s.clouded[j]++; });
      s.clouds.push(c);
      s.log.push([s.tick, 'cloud', dir.slice()]);
      emit('cloud', { id: c.id, cells: cells.slice(), points: s.points });
      return c.id;
    }

    function collect(id) {
      const i = s.dots.findIndex((d) => d.id === id);
      if (i < 0 || s.phase === 'lose') return false;
      const d = s.dots[i];
      s.dots.splice(i, 1);
      s.points++;
      s.log.push([s.tick, 'collect', id]);
      emit('collect', { dot: id, cell: d.cell, points: s.points });
      return true;
    }

    function choose(id) {
      if (s.phase !== 'choose' || !UPGRADES.some((u) => u.id === id)) return false;
      s.upgrade = id;
      if (id === 'speed') s.mac.speed = tune.speed * tune.upSpeed;
      if (id === 'cloud') { s.cloudCos = tune.upCloudCos; s.cloudLife = tune.cloudLife + tune.upCloudLife; }
      s.phase = 'gap'; s.gapT = T(tune.gap);
      s.log.push([s.tick, 'choose', id]);
      emit('chosen', { id });
      return true;
    }

    function drain() { const e = s.events; s.events = []; return e; }

    function hash() {
      const v = s.viruses.map((x) => [x.id, x.st, x.cell, x.bind, x.bt, x.t].join(':')).join(',');
      const m = s.mac;
      return hashStr([s.tick, s.phase, s.wave, s.losses, s.points, s.eaten, Array.from(s.cell).join(''), Array.from(s.type).join(''), Array.from(s.regT).join('.'), v,
        m.at, m.to, m.p.toFixed(9), m.path.join('.'), s.clouds.map((c) => c.id + '@' + c.born).join(','), s.dots.map((d) => d.id).join(',')].join('|'));
    }

    wetten();
    Object.assign(s, { step, route, cloud, collect, choose, drain, hash, macPos, occ, bindTicksAt,
      reach: () => { const o = occ(); return [o].concat(adj[o]); } });
    startWave(1);
    return s;
  }

  // replay a log of [tick, kind, arg] against a fresh session
  function replay(opts, log, maxTicks) {
    const s = create(opts);
    let k = 0;
    const apply = () => {
      while (k < log.length && log[k][0] === s.tick) {
        const [, kind, arg] = log[k++];
        if (kind === 'route') s.route(arg);
        else if (kind === 'cloud') s.cloud(arg);
        else if (kind === 'collect') s.collect(arg);
        else if (kind === 'choose') s.choose(arg);
      }
    };
    for (let i = 0; i < maxTicks; i++) {
      apply();
      if (s.phase === 'choose') { apply(); if (s.phase === 'choose') break; continue; }
      if (!s.step()) break;
      s.drain();
    }
    return s;
  }

  // ---------- reference players for the simulator and the tests ----------
  // `lag` ticks between decisions stands in for a person's reaction time
  function nearestTarget(s) {
    const o = s.occ();
    let best = null, bd = 1e9;
    for (const v of s.viruses) {
      if (v.st !== 'land' && v.st !== 'coat') continue;
      const d = s.dist[o][v.cell] * 100 - v.bind * 10;
      if (d < bd) { bd = d; best = v; }
    }
    if (best) return best;
    for (const v of s.viruses) {   // nothing down yet: head for the nearest shadow
      if (v.st !== 'drift' || !v.shadowed) continue;
      const d = s.dist[o][v.cell];
      if (d < bd) { bd = d; best = v; }
    }
    if (best) return best;
    // nothing coming: wait beside the infected cell that bursts first
    let soon = -1;
    for (let i = 0; i < s.n; i++) if (s.cell[i] === INFECTED && (soon < 0 || s.infT[i] < s.infT[soon])) soon = i;
    return soon >= 0 ? { cell: soon } : null;
  }
  const BOTS = {
    idle: () => null,
    nearest(s, mem, o) {
      if (s.tick % (o.lag || 1)) return;
      s.dots.slice().forEach((d) => s.collect(d.id));
      const v = nearestTarget(s);
      if (!v) return;
      const goal = s.mac.path.length ? s.mac.path[s.mac.path.length - 1] : (s.mac.to >= 0 ? s.mac.to : s.mac.at);
      if (goal === v.cell) return;
      const p = path(s.adj, s.occ(), v.cell);
      if (p) s.route(p);
    },
    // nearest, plus a cloud on any particle that is down far away
    careful(s, mem, o) {
      if (s.tick % (o.lag || 1)) return;
      BOTS.nearest(s, mem, { lag: 1 });
      if (!s.unlocked || s.points < s.tune.cloudCost) return;
      const o2 = s.occ();
      for (const v of s.viruses) {
        // a person needs a moment to notice a landing, turn the ball and aim
        if (v.st !== 'land' || v.t < (o.notice == null ? 60 : o.notice) || s.clouded[v.cell] || s.dist[o2][v.cell] < 3) continue;
        s.cloud(s.centers[v.cell]);
        break;
      }
    },
  };

  function play(opts, bot, o) {
    o = o || {};
    const s = create(opts), mem = {};
    const limit = T(o.limit || 600);
    while (s.tick < limit) {
      if (s.phase === 'choose') { s.choose(o.upgrade || 'speed'); continue; }
      if (s.phase === 'win' || s.phase === 'lose') break;
      BOTS[bot](s, mem, o);
      s.step();
      s.drain();
    }
    return s;
  }

  return { HZ, STEP, T, TUNE, UPGRADES, WAVES, HEALTHY, INFECTED, LOST, ABSORB, GOBLET, STEM, cellTypes, create, replay, play, path, distances, BOTS, hashStr };
});
