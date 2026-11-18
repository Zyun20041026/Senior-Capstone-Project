/*
 * Capsid Lockdown — rules, solver and hints. No DOM.
 *
 * The rules are Minesweeper on a graph:
 *   dose a cell  -> a normal protein locks and shows its reading (how many of
 *                   its neighbours are resistant); a reading of 0 spreads on
 *   dose a resistant protein -> one mistake, the protein is exposed
 *   three mistakes -> the virus escapes; every normal protein locked -> win
 *
 * The solver only ever uses what a player can see: locked readings and
 * exposed resistant proteins. It reasons in tiers, from what a beginner does
 * to what an expert does, and every deduction carries the readings it rests
 * on, so the same code proves a level, writes hints and explains mistakes.
 *   tier 1  one reading on its own
 *   tier 2  two readings side by side, or the resistant-protein counter
 *   tier 3  three or more readings that only work out one way
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CapsidRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_MISTAKES = 3;

  function numbers(adj, isMine) {
    const out = new Int8Array(adj.length);
    for (let i = 0; i < adj.length; i++) { let k = 0; for (const j of adj[i]) k += isMine[j]; out[i] = k; }
    return out;
  }

  // ---------- what is known ----------
  // num[i] >= 0  locked, with that reading      mine[i]  known resistant
  // safe[i]      known normal, reading not seen yet (only used while chaining)
  function knowledge(adj, total) {
    const n = adj.length;
    return { n, adj, total, num: new Int8Array(n).fill(-1), mine: new Uint8Array(n), safe: new Uint8Array(n) };
  }
  const open = (K, i) => K.num[i] < 0 && !K.mine[i] && !K.safe[i];

  // one constraint per reading that still has undecided neighbours:
  // exactly `need` of `cells` are resistant
  function constraints(K) {
    const out = [];
    for (let i = 0; i < K.n; i++) {
      if (K.num[i] < 0) continue;
      let need = K.num[i];
      const cells = [];
      for (const j of K.adj[i]) { if (K.mine[j]) need--; else if (open(K, j)) cells.push(j); }
      if (cells.length) out.push({ src: i, cells, need });
    }
    return out;
  }

  // ---------- tier 1: a single reading ----------
  function tier1(cons) {
    const out = new Map();
    for (const c of cons) {
      const mine = c.need === c.cells.length;
      if (c.need !== 0 && !mine) continue;
      for (const x of c.cells) if (!out.has(x)) out.set(x, { cell: x, mine, why: [c.src], rule: 'single', need: c.need, count: c.cells.length });
    }
    return Array.from(out.values());
  }

  // ---------- tier 2: two readings that share cells ----------
  // Split the cells into shared / only-A / only-B. If the number of resistant
  // proteins in the shared part can only be one value, each part may be settled.
  function tier2(cons) {
    const out = new Map(), byCell = new Map(), done = new Set();
    cons.forEach((c, i) => c.cells.forEach((x) => { if (!byCell.has(x)) byCell.set(x, []); byCell.get(x).push(i); }));
    for (const list of byCell.values()) for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
      const key = list[p] * 4096 + list[q];
      if (done.has(key)) continue;
      done.add(key);
      const A = cons[list[p]], B = cons[list[q]], inB = new Set(B.cells);
      const X = A.cells.filter((x) => inB.has(x)), inX = new Set(X);
      const A1 = A.cells.filter((x) => !inX.has(x)), B1 = B.cells.filter((x) => !inX.has(x));
      const lo = Math.max(0, A.need - A1.length, B.need - B1.length), hi = Math.min(X.length, A.need, B.need);
      if (lo !== hi) continue;
      const put = (cells, rest, owner, other) => {
        if (!cells.length || (rest !== 0 && rest !== cells.length)) return;
        // needs / owns follow the order of why: what each reading still lacks, and how many cells it has to itself
        const swap = owner === B.src && other === A.src;
        for (const x of cells) if (!out.has(x)) out.set(x, {
          cell: x, mine: rest !== 0, why: swap ? [B.src, A.src] : [A.src, B.src], rule: 'pair', shared: X.length, sharedMines: lo,
          needs: swap ? [B.need, A.need] : [A.need, B.need], owns: swap ? [B1.length, A1.length] : [A1.length, B1.length],
          part: owner === other ? 'shared' : 'own', count: cells.length,
        });
      };
      put(X, lo, A.src, A.src);
      put(A1, A.need - lo, A.src, B.src);
      put(B1, B.need - lo, B.src, A.src);
    }
    return Array.from(out.values());
  }

  // ---------- the resistant-protein counter ----------
  function countRule(K) {
    let known = 0;
    const U = [];
    for (let i = 0; i < K.n; i++) { if (K.mine[i]) known++; else if (open(K, i)) U.push(i); }
    const left = K.total - known;
    if (!U.length || (left !== 0 && left !== U.length)) return [];
    return U.map((cell) => ({ cell, mine: left !== 0, why: [], rule: 'count', left, count: U.length }));
  }

  // ---------- tier 3: exhaustive but local ----------
  // Is there any way to fill the cells of these constraints? Optionally with one
  // cell forced to a value. Plain backtracking with unit propagation.
  function fill(cons, cell, value) {
    const idx = new Map();
    cons.forEach((c) => c.cells.forEach((x) => { if (!idx.has(x)) idx.set(x, idx.size); }));
    const nv = idx.size, val = new Int8Array(nv).fill(-1), trail = [];
    const cc = cons.map((c) => ({ v: c.cells.map((x) => idx.get(x)), need: c.need, un: c.cells.length, got: 0 }));
    const of = [];
    for (let v = 0; v < nv; v++) of.push([]);
    cc.forEach((c, i) => c.v.forEach((v) => of[v].push(i)));
    const set = (v, b) => {
      if (val[v] !== -1) return val[v] === b;
      val[v] = b; trail.push(v);
      let ok = true;
      for (const i of of[v]) { const c = cc[i]; c.un--; c.got += b; if (c.got > c.need || c.got + c.un < c.need) ok = false; }
      return ok;
    };
    const undo = (to) => { while (trail.length > to) { const v = trail.pop(), b = val[v]; val[v] = -1; for (const i of of[v]) { cc[i].un++; cc[i].got -= b; } } };
    const propagate = () => {
      for (let changed = true; changed;) {
        changed = false;
        for (const c of cc) {
          if (!c.un) continue;
          const b = c.got === c.need ? 0 : c.got + c.un === c.need ? 1 : -1;
          if (b < 0) continue;
          for (const v of c.v) if (val[v] === -1) { if (!set(v, b)) return false; changed = true; }
        }
      }
      return true;
    };
    const search = () => {
      if (!propagate()) return false;
      let pick = -1;
      for (let v = 0; v < nv; v++) if (val[v] === -1) { pick = v; break; }
      if (pick < 0) return true;
      for (let b = 1; b >= 0; b--) { const mark = trail.length; if (set(pick, b) && search()) return true; undo(mark); }
      return false;
    };
    for (const c of cc) if (c.need < 0 || c.need > c.un) return null;
    if (cell !== undefined && idx.has(cell) && !set(idx.get(cell), value)) return null;
    if (!search()) return null;
    const sol = new Map();
    idx.forEach((v, x) => sol.set(x, val[v]));
    return sol;
  }

  function components(cons) {
    const parent = cons.map((_, i) => i), find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    const first = new Map();
    cons.forEach((c, i) => c.cells.forEach((x) => { if (first.has(x)) parent[find(i)] = find(first.get(x)); else first.set(x, i); }));
    const groups = new Map();
    cons.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
    return Array.from(groups.values());
  }

  // the readings that are enough to settle `cell`: grow outwards from the cell
  // until the opposite value is impossible, then drop every reading not needed
  function core(comp, cell, value) {
    const order = [], seen = new Set();
    let frontier = comp.filter((c) => c.cells.indexOf(cell) >= 0);
    frontier.forEach((c) => seen.add(c));
    while (frontier.length) {
      frontier.forEach((c) => order.push(c));
      const cells = new Set();
      frontier.forEach((c) => c.cells.forEach((x) => cells.add(x)));
      frontier = comp.filter((c) => !seen.has(c) && c.cells.some((x) => cells.has(x)));
      frontier.forEach((c) => seen.add(c));
    }
    let k = 1;
    while (k <= order.length && fill(order.slice(0, k), cell, 1 - value)) k++;
    if (k > order.length) return null;
    let set = order.slice(0, k);
    for (let i = set.length - 1; i >= 0 && set.length > 1; i--) {
      const less = set.slice(0, i).concat(set.slice(i + 1));
      if (!fill(less, cell, 1 - value)) set = less;
    }
    return set.map((c) => c.src);
  }

  function tier3(cons) {
    const out = [];
    for (const comp of components(cons)) {
      if (comp.length < 2) continue;
      const sol = fill(comp);
      if (!sol) continue;
      const both = new Set();
      for (const [x, v] of sol) {
        if (both.has(x)) continue;
        const alt = fill(comp, x, 1 - v);
        if (alt) { for (const [y, w] of alt) if (w !== sol.get(y)) both.add(y); continue; }
        const why = core(comp, x, v);
        if (why) out.push({ cell: x, mine: v === 1, why, rule: why.length <= 2 ? 'pair' : 'multi' });
      }
    }
    return out;
  }

  // the simplest deductions available right now
  function step(K) {
    const cons = constraints(K);
    let list = tier1(cons);
    if (list.length) return { tier: 1, list };
    list = tier2(cons);
    if (list.length) return { tier: 2, list };
    list = countRule(K);
    if (list.length) return { tier: 2, list };
    list = tier3(cons);
    if (list.length) {
      const m = Math.min.apply(null, list.map((d) => d.why.length));
      return { tier: 3, list: list.filter((d) => d.why.length === m), core: m };
    }
    return null;
  }

  // everything that follows from K without seeing any new reading
  function closure(K) {
    for (let s = step(K); s; s = step(K)) for (const d of s.list) { if (d.mine) K.mine[d.cell] = 1; else K.safe[d.cell] = 1; }
    return K;
  }

  // why is `cell` resistant / normal? (null when K does not settle it locally)
  function proofOf(K, cell, mine) {
    const cons = constraints(K), hit = (list) => list.find((d) => d.cell === cell && d.mine === mine);
    let d = hit(tier1(cons)) || hit(tier2(cons)) || hit(countRule(K));
    if (d) return d;
    const comp = components(cons).find((g) => g.some((c) => c.cells.indexOf(cell) >= 0));
    if (!comp) return null;
    const why = core(comp, cell, mine ? 1 : 0);
    return why ? { cell, mine, why, rule: why.length <= 2 ? 'pair' : 'multi' } : null;
  }

  // ---------- proving a layout ----------
  // Play the layout from its first dose using only the deductions above,
  // always the simplest first. solved === true means no guess was ever needed.
  function prove(adj, mines, start) {
    const n = adj.length, isMine = new Uint8Array(n);
    mines.forEach((m) => { isMine[m] = 1; });
    const nums = numbers(adj, isMine), K = knowledge(adj, mines.length);
    const stats = { open: 0, t1: 0, t2: 0, t3: 0, core: 1, rounds: 0 };
    let opened = 0;
    const reveal = (i) => {
      const stack = [i];
      while (stack.length) {
        const x = stack.pop();
        if (K.num[x] >= 0) continue;
        K.num[x] = nums[x]; K.safe[x] = 0; opened++;
        if (nums[x] === 0) for (const y of adj[x]) if (K.num[y] < 0) stack.push(y);
      }
    };
    if (isMine[start] || nums[start] !== 0) return { solved: false, stats, reason: 'start' };
    reveal(start);
    stats.open = opened;
    while (opened < n - mines.length) {
      const s = step(K);
      if (!s) return { solved: false, stats, opened, reason: 'stuck' };
      stats.rounds++;
      stats['t' + s.tier]++;
      if (s.tier === 3) stats.core = Math.max(stats.core, s.core);
      else if (s.tier === 2) stats.core = Math.max(stats.core, 2);
      for (const d of s.list) {
        if ((isMine[d.cell] === 1) !== d.mine) throw new Error('unsound deduction at cell ' + d.cell);
        if (d.mine) K.mine[d.cell] = 1; else reveal(d.cell);
      }
    }
    return { solved: true, stats };
  }

  // ---------- a game in progress ----------
  // level: { adj, variants: [{ start, mines }] }
  function Session(level, variant) {
    const adj = level.adj, n = adj.length, lay = level.variants[variant || 0];
    const isMine = new Uint8Array(n);
    lay.mines.forEach((m) => { isMine[m] = 1; });
    const nums = numbers(adj, isMine);
    const S = {
      n, adj, total: lay.mines.length, start: lay.start, variant: variant || 0,
      status: 'ready', mistakes: 0, max: MAX_MISTAKES, hints: 0, doses: 0, locked: 0, safeTotal: n - lay.mines.length,
      state: new Uint8Array(n),            // 0 hidden, 1 locked, 2 exposed resistant
      flag: new Uint8Array(n),
    };
    S.reading = (i) => (S.state[i] === 1 ? nums[i] : -1);
    S.isMine = (i) => isMine[i] === 1;     // for the end-of-game reveal only
    S.flags = () => { let k = 0; for (let i = 0; i < n; i++) k += S.flag[i]; return k; };
    S.left = () => { let k = S.total; for (let i = 0; i < n; i++) if (S.flag[i] || S.state[i] === 2) k--; return k; };
    S.canDose = (i) => (S.status === 'ready' ? i === S.start : S.status === 'playing' && S.state[i] === 0 && !S.flag[i]);
    S.canChord = (i) => {
      if (S.status !== 'playing' || S.state[i] !== 1 || nums[i] === 0) return false;
      let marked = 0, free = 0;
      for (const j of adj[i]) { if (S.flag[j] || S.state[j] === 2) marked++; else if (S.state[j] === 0) free++; }
      return marked === nums[i] && free > 0;
    };

    // what the player can see; `trusted` flags count as known resistant
    function view(trusted) {
      const K = knowledge(adj, S.total);
      for (let i = 0; i < n; i++) { if (S.state[i] === 1) K.num[i] = nums[i]; else if (S.state[i] === 2) K.mine[i] = 1; }
      if (trusted) trusted.forEach((i) => { K.mine[i] = 1; });
      return K;
    }
    // sort the flags: provably right, provably wrong, or not settled yet
    function audit() {
      const all = closure(view()), bad = [], trusted = [];
      for (let i = 0; i < n; i++) if (S.flag[i] && S.state[i] === 0) { if (all.safe[i]) bad.push(i); else if (all.mine[i]) trusted.push(i); }
      return { all, bad, trusted };
    }
    const flagsNear = (why, trusted) => {
      const out = [];
      why.forEach((r) => adj[r].forEach((j) => { if (trusted.indexOf(j) >= 0 && out.indexOf(j) < 0) out.push(j); }));
      return out;
    };

    // The simplest certain move. prefer: 'mine' | 'safe' picks that kind when both exist.
    S.hint = function (opts) {
      opts = opts || {};
      if (S.status === 'ready') return { kind: 'start', cell: S.start, why: [], flags: [] };
      if (S.status !== 'playing') return null;
      const a = audit();
      let h = null;
      if (a.bad.length) {
        const d = proofOf(view(), a.bad[0], false) || { why: [], rule: 'chain' };
        h = Object.assign({}, d, { kind: 'badflag', cell: a.bad[0], mine: false, flags: [] });
      } else {
        const s = step(view(a.trusted));
        if (!s) return null;
        const pick = s.list.find((d) => d.mine === (opts.prefer === 'mine')) || s.list[0];
        const same = s.list.filter((d) => d.mine === pick.mine && d.rule === pick.rule && d.why.join() === pick.why.join()).map((d) => d.cell);
        h = Object.assign({}, pick, { kind: pick.mine ? 'flag' : 'dose', tier: s.tier, cells: same, flags: flagsNear(pick.why, a.trusted) });
      }
      if (!opts.peek) S.hints++;
      return h;
    };

    // Called before a mistake is applied: could the player have known?
    function explain(cell) {
      const a = audit();
      if (a.all.mine[cell]) {
        const d = proofOf(view(a.trusted), cell, true) || proofOf(view(), cell, true) || { why: [], rule: 'chain' };
        return Object.assign({}, d, { known: true, cell, flags: flagsNear(d.why, a.trusted) });
      }
      return { known: false, cell, why: [], flags: [], alt: S.hint({ peek: true }) };
    }

    // dose a list of hidden cells at once (one click, or a chord)
    function apply(targets) {
      const ev = { misses: [], waves: [], won: false, lost: false };
      const safe = [];
      for (const i of targets) {
        if (S.state[i] !== 0 || S.flag[i]) continue;
        if (isMine[i]) { if (S.mistakes < S.max) ev.misses.push({ cell: i, proof: ev.misses.length ? null : explain(i) }); } else safe.push(i);
      }
      for (const m of ev.misses) { S.state[m.cell] = 2; S.mistakes++; }
      // spread in rings so the animation can follow the drug outwards
      let wave = safe.filter((i, k) => safe.indexOf(i) === k);
      wave.forEach((i) => { S.state[i] = 1; });
      while (wave.length) {
        ev.waves.push(wave);
        S.locked += wave.length;
        const next = [];
        for (const i of wave) if (nums[i] === 0) for (const j of adj[i]) if (S.state[j] === 0 && !S.flag[j]) { S.state[j] = 1; next.push(j); }
        wave = next;
      }
      if (ev.misses.length || ev.waves.length) S.doses++;
      if (S.mistakes >= S.max) { S.status = 'lost'; ev.lost = true; }
      else if (S.locked === S.safeTotal) { S.status = 'won'; ev.won = true; }
      return ev;
    }

    S.dose = function (i) {
      if (!S.canDose(i)) return null;
      if (S.status === 'ready') S.status = 'playing';
      return apply([i]);
    };
    S.chord = function (i) {
      if (!S.canChord(i)) return null;
      return apply(adj[i].filter((j) => S.state[j] === 0 && !S.flag[j]));
    };
    S.toggleFlag = function (i) {
      if (S.status !== 'playing' || S.state[i] !== 0) return false;
      S.flag[i] = S.flag[i] ? 0 : 1;
      return true;
    };
    S.stars = function () {
      if (S.status !== 'won') return 0;
      const slips = S.mistakes + (S.hints > 0 ? 1 : 0);
      return slips === 0 ? 3 : slips === 1 ? 2 : 1;
    };
    return S;
  }

  return { MAX_MISTAKES, Session, prove, numbers, knowledge, constraints, tier1, tier2, tier3, countRule, step, closure, proofOf, fill };
});
