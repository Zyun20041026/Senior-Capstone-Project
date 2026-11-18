// Alex 202384014054
/* The twelve strains: shells, layouts, proofs, hints all the way through, content. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Rules, viewOf, evidenceForces } = require('./helpers.js');
const Boards = require('../js/boards.js');
const Viruses = require('../js/viruses.js');
const Levels = require('../js/levels.js');

const ROOT = path.join(__dirname, '..');
const boards = Viruses.LIST.map((v) => Boards.build(v.board));
const sorted = (a) => a.slice().sort((x, y) => x - y);

test('twelve strains, in the order of the catalogue, five layouts each', () => {
  assert.strictEqual(Viruses.LIST.length, 12);
  assert.strictEqual(Levels.length, 12);
  Viruses.LIST.forEach((v, i) => {
    assert.strictEqual(Levels[i].id, v.id);
    assert.strictEqual(Levels[i].mines, v.mines);
    assert.strictEqual(Levels[i].variants.length, Viruses.VARIANTS);
    assert.strictEqual(Levels[i].cells, boards[i].cells.length);
  });
  assert.strictEqual(new Set(Viruses.LIST.map((v) => v.id)).size, 12);
});

test('the shells are different shapes, not twelve spheres', () => {
  const shapes = new Set(Viruses.LIST.map((v) => v.board.shape));
  assert.ok(shapes.size >= 6, 'shapes: ' + Array.from(shapes).join(', '));
  for (const s of ['icosa', 'rod', 'bullet', 'filament', 'phage', 'envelope']) assert.ok(shapes.has(s), s);
  const counts = new Set(boards.map((b) => b.cells.length));
  assert.ok(counts.size >= 10, 'cell counts differ from strain to strain');
  const long = boards.filter((b) => b.mode === 'spindle' && b.fit.hh / b.fit.hw > 1.6).length;
  assert.ok(long >= 4, 'at least four elongated shells');
});

test('neighbours are exactly the proteins that share a corner; shells are closed and connected', () => {
  boards.forEach((b, k) => {
    const n = b.cells.length, id = Viruses.LIST[k].id;
    const byVertex = new Map();
    b.cells.forEach((c, i) => c.poly.forEach((v) => { if (!byVertex.has(v)) byVertex.set(v, []); byVertex.get(v).push(i); }));
    const want = Array.from({ length: n }, () => new Set());
    for (const list of byVertex.values()) for (const i of list) for (const j of list) if (i !== j) want[i].add(j);
    for (let i = 0; i < n; i++) {
      assert.deepStrictEqual(sorted(b.adj[i]), sorted(Array.from(want[i])), id + ' cell ' + i);
      assert.ok(!b.adj[i].includes(i));
      assert.ok(b.adj[i].length >= 3 && b.adj[i].length <= 10, id + ' cell ' + i + ' has ' + b.adj[i].length + ' neighbours');
      for (const j of b.adj[i]) assert.ok(b.adj[j].includes(i), 'symmetric');
      assert.ok(b.cells[i].poly.length >= 3 && b.cells[i].rad > 0);
    }
    const seen = new Uint8Array(n), stack = [0];
    seen[0] = 1;
    let reached = 1;
    while (stack.length) for (const j of b.adj[stack.pop()]) if (!seen[j]) { seen[j] = 1; reached++; stack.push(j); }
    assert.strictEqual(reached, n, id + ' is connected');
    // proteins that merely come close without touching would be misread as neighbours
    assert.ok(Boards.clearance(b) > 0.35, id + ' clearance ' + Boards.clearance(b).toFixed(2));
  });
});

test('the shells the browser builds are the shells the layouts were proven on', () => {
  boards.forEach((b, k) => {
    assert.strictEqual(Levels[k].adj.length, b.adj.length);
    b.adj.forEach((a, i) => assert.deepStrictEqual(sorted(Levels[k].adj[i]), sorted(a), Viruses.LIST[k].id + ' cell ' + i));
  });
});

test('every layout of every strain can be solved from its first dose by reasoning alone', () => {
  Levels.forEach((L, k) => {
    const seen = new Set();
    L.variants.forEach((lay, j) => {
      const name = L.id + ' layout ' + j;
      assert.strictEqual(lay.mines.length, L.mines, name);
      assert.strictEqual(new Set(lay.mines).size, L.mines, name);
      assert.ok(!lay.mines.includes(lay.start), name);
      const res = Rules.prove(L.adj, lay.mines, lay.start);     // throws on any unsound step
      assert.strictEqual(res.solved, true, name + ' needs a guess: ' + res.reason);
      assert.deepStrictEqual(res.stats, lay.stats, name + ' stats are stale');
      seen.add(sorted(lay.mines).join());
    });
    assert.strictEqual(seen.size, L.variants.length, L.id + ' layouts are all different');
    assert.ok(new Set(L.variants.map((v) => v.start)).size >= 3, L.id + ' does not always start in the same place');
  });
});

test('difficulty: density follows the neighbour count, and the reasoning gets deeper', () => {
  Levels.forEach((L, k) => {
    const deg = L.adj.reduce((a, x) => a + x.length, 0) / L.cells, density = L.mines / L.cells;
    // classic Minesweeper: 12-21 % of squares with 8 neighbours, i.e. 0.96 - 1.68 resistant neighbours per reading
    const perReading = density * deg;
    assert.ok(perReading >= 0.85 && perReading <= 1.75, L.id + ': ' + perReading.toFixed(2) + ' resistant neighbours per reading');
    assert.ok(density >= 0.12 && density <= 0.26, L.id + ' density ' + density.toFixed(3));
    for (const lay of L.variants) {
      const open = lay.stats.open / (L.cells - L.mines);
      assert.ok(open <= 0.48, L.id + ' first dose opens ' + (open * 100).toFixed(0) + ' %');
      assert.ok(lay.stats.open >= 4, L.id + ' first dose opens something to reason from');
    }
  });
  const depth = Levels.map((L) => L.variants.reduce((a, v) => a + v.stats.t2 + 2 * v.stats.t3, 0) / L.variants.length);
  assert.strictEqual(depth[0], 0, 'the first strain only needs one reading at a time');
  for (let k = 3; k < depth.length; k++) assert.ok(depth[k] >= depth[k - 3], 'strain ' + (k + 1) + ' is not easier than strain ' + (k - 2));
  for (let k = 6; k < 12; k++) assert.ok(Levels[k].variants.every((v) => v.stats.t3 >= 1), Levels[k].id + ' asks for three or more readings at least once');
  for (let k = 0; k < 4; k++) assert.ok(Levels[k].variants.every((v) => v.stats.t3 === 0), Levels[k].id + ' never does');
});

test('following the hints wins every strain with no mistake, and every hint is backed by its readings', () => {
  let hints = 0;
  const rules = {};
  Levels.forEach((L, k) => {
    for (const variant of [0, (k % 4) + 1]) {
      const s = Rules.Session(L, variant), name = L.id + ' layout ' + variant;
      for (let guard = 0; s.status !== 'won'; guard++) {
        assert.ok(guard < 400, name + ' does not finish');
        const h = s.hint();
        assert.ok(h, name + ': no certain move although the layout is proven');
        hints++;
        if (h.kind === 'start') { assert.strictEqual(h.cell, s.start); s.dose(h.cell); continue; }
        assert.notStrictEqual(h.kind, 'badflag', name);
        rules[h.rule] = (rules[h.rule] || 0) + 1;
        assert.notStrictEqual(h.rule, 'chain', name + ': a hint must name its evidence');
        // the counter looks at every flag the readings prove; other rules only at the flags beside their readings
        const proven = [];
        if (h.rule === 'count') for (let i = 0; i < s.n; i++) { if (s.flag[i]) proven.push(i); }
        const K = viewOf(s, h.rule === 'count' ? proven : h.flags);
        for (const f of h.flags) assert.ok(s.isMine(f), name + ': a trusted flag is wrong');
        for (const cell of h.cells) {
          assert.strictEqual(s.isMine(cell), h.mine, name + ': hint about ' + cell + ' is false');
          assert.ok(evidenceForces(K, Object.assign({}, h, { cell })), name + ': the highlighted readings do not settle cell ' + cell);
        }
        for (const w of h.why) assert.ok(s.reading(w) >= 0, 'evidence is a visible reading');
        // act on every protein the hint settles, as a player would
        for (const cell of h.cells) {
          if (s.status !== 'playing' || s.state[cell] !== 0) continue;
          if (h.mine) { if (!s.flag[cell]) s.toggleFlag(cell); } else assert.strictEqual(s.dose(cell).misses.length, 0);
        }
      }
      assert.strictEqual(s.mistakes, 0, name);
      assert.strictEqual(s.locked, s.safeTotal, name);
    }
  });
  assert.ok(rules.single > 100 && rules.pair > 20 && rules.multi > 5, 'all kinds of hint appeared: ' + JSON.stringify(rules));
  assert.ok(hints > 400);
});

test('a hint never relies on a flag the readings do not prove, and catches a wrong one', () => {
  const L = Levels[4], s = Rules.Session(L, 0);
  s.dose(s.start);
  // put a flag on a protein the readings prove normal
  const K = Rules.closure(viewOf(s));
  const safe = Array.from({ length: s.n }, (_, i) => i).find((i) => K.safe[i] && s.state[i] === 0);
  assert.notStrictEqual(safe, undefined);
  s.toggleFlag(safe);
  const h = s.hint();
  assert.strictEqual(h.kind, 'badflag');
  assert.strictEqual(h.cell, safe);
  assert.strictEqual(s.isMine(safe), false);
  // a flag on an unproven protein is simply ignored by the reasoning
  s.toggleFlag(safe);
  const loose = Array.from({ length: s.n }, (_, i) => i).find((i) => !K.safe[i] && !K.mine[i] && s.state[i] === 0);
  if (loose !== undefined) { s.toggleFlag(loose); const h2 = s.hint(); assert.ok(h2 && h2.flags.indexOf(loose) < 0); assert.strictEqual(s.isMine(h2.cell), h2.mine); }
});

test('dossiers: a real kind of virus each, two plain sentences, and the fiction notice', () => {
  for (const v of Viruses.LIST) {
    for (const key of ['zh', 'en', 'form', 'formEn', 'where']) assert.ok(typeof v[key] === 'string' && v[key].length > 1, v.id + '.' + key);
    assert.strictEqual(v.facts.length, 2, v.id);
    for (const f of v.facts) assert.ok(f.length >= 12 && f.length <= 60, v.id + ': ' + f);
    assert.strictEqual(v.size, undefined, v.id + ': sizes are made from the shell, not written down');
    // content floor: no mutation sites, sequences, drug names or lab procedure in the dossier
    assert.ok(!/突变|位点|序列|基因组|[ACGU]{6,}|韦$|那韦|培养|扩增|受体/.test(v.facts.join('')), v.id);
  }
  // the size in the dossier is counted from the game's own shell: blocks across x BLOCK_NM
  boards.forEach((b, i) => {
    const nm = Boards.sizeNm(b), across = 2 * Math.max(b.fit.hw, b.fit.hh) / Math.sqrt(b.cells.reduce((a, c) => a + c.area, 0) / b.cells.length);
    assert.strictEqual(nm, Math.round(across * Boards.BLOCK_NM), Viruses.LIST[i].id);
    assert.ok(nm >= 20 && nm <= 200, Viruses.LIST[i].id + ': ' + nm + ' nm');
  });
  const game = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(game.includes('游戏数据为虚构'));
  assert.ok(game.includes("'capsid-lockdown-v1'"));
  assert.ok(!game.includes('capsid-cascade-v1'));
  for (const word of ['正常蛋白', '耐药蛋白', '下药', '读数', '规则和扫雷一样']) assert.ok(game.includes(word), word);
  assert.ok(html.includes('游戏数据') || game.includes('GAME DATA IS FICTIONAL'));
});

test('no network, no libraries, no assets: only the files in this folder', () => {
  const files = ['index.html', 'css/style.css'].concat(fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f));
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/https?:\/\//.test(text), f + ' mentions a URL');
    assert.ok(!/@import|url\((?!\$|'?\s*\+|"?\s*\+)[^)]*\.(png|jpg|webp|svg|woff|mp3|ogg|wav)/.test(text), f + ' loads an asset');
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|import\s*\(|require\(['"](?!\.)/.test(text.replace(/require\('node:[a-z]+'\)/g, '')), f + ' reaches outside');
  }
  const scripts = Array.from(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)).map((m) => m[1]);
  assert.deepStrictEqual(scripts, ['js/core.js', 'js/boards.js', 'js/rules.js', 'js/viruses.js', 'js/levels.js', 'js/duel.js', 'js/render.js', 'js/audio.js', 'js/game.js']);
  for (const s of scripts) assert.ok(fs.existsSync(path.join(ROOT, s)), s);
});
