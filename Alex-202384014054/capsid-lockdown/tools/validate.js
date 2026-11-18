/*
 * Check every layout of every strain and print one table.
 *   node tools/validate.js            table, exit code 1 if anything fails
 *   node tools/validate.js --json     also write .qa/lockdown-validation.json
 * For each layout it checks, independently of the generator:
 *   - the shell the browser builds has the neighbour table the layout was proven on
 *   - the first dose lands on a reading of 0
 *   - prove() solves it with no guess, and gives the stats stored in js/levels.js
 *   - a player who only follows hints wins with no mistake
 * Node built-ins only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Boards = require('../js/boards.js');
const Rules = require('../js/rules.js');
const Viruses = require('../js/viruses.js');
const Levels = require('../js/levels.js');

const problems = [], rows = [];
const fail = (msg) => { problems.push(msg); };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sortNum = (a) => a.slice().sort((x, y) => x - y);

function playByHints(level, k) {
  const s = Rules.Session(level, k);
  s.dose(s.start);
  let steps = 0, deepest = 1;
  while (s.status === 'playing') {
    if (++steps > level.cells * 3) return { ok: false, why: 'no end' };
    const h = s.hint({ peek: true });
    if (!h) return { ok: false, why: 'no certain move after ' + steps + ' steps' };
    if (s.isMine(h.cell) !== h.mine) return { ok: false, why: 'hint is wrong about protein ' + h.cell };
    deepest = Math.max(deepest, h.tier || 1);
    if (h.kind === 'flag') s.toggleFlag(h.cell); else if (h.kind === 'dose') s.dose(h.cell); else return { ok: false, why: 'unexpected hint ' + h.kind };
  }
  return { ok: s.status === 'won' && s.mistakes === 0, why: s.status + ', ' + s.mistakes + ' mistakes', steps, deepest };
}

if (Levels.length !== Viruses.LIST.length) fail('levels.js has ' + Levels.length + ' strains, the catalogue has ' + Viruses.LIST.length);

Viruses.LIST.forEach((v, li) => {
  const L = Levels[li];
  if (!L || L.id !== v.id) { fail(v.id + ': missing from js/levels.js'); return; }
  const board = Boards.build(v.board), adj = board.adj, n = adj.length;
  if (n !== L.cells || !adj.every((a, i) => same(sortNum(a), sortNum(L.adj[i])))) fail(v.id + ': the built shell differs from the proven neighbour table');
  if (L.variants.length !== Viruses.VARIANTS) fail(v.id + ': ' + L.variants.length + ' layouts, expected ' + Viruses.VARIANTS);
  const deg = adj.reduce((a, x) => a + x.length, 0) / n;
  const row = { id: v.id, name: v.zh, shape: v.board.shape, cells: n, resistant: v.mines, density: v.mines / n, neighbours: deg, perReading: v.mines / n * deg, layouts: [], proven: 0 };
  L.variants.forEach((x, k) => {
    const name = v.id + ' layout ' + (k + 1);
    if (x.mines.length !== v.mines || new Set(x.mines).size !== v.mines) fail(name + ': wrong number of resistant proteins');
    const isMine = new Uint8Array(n);
    x.mines.forEach((m) => { isMine[m] = 1; });
    if (isMine[x.start] || Rules.numbers(L.adj, isMine)[x.start] !== 0) fail(name + ': the first dose is not on a reading of 0');
    const res = Rules.prove(L.adj, x.mines, x.start);
    if (!res.solved) { fail(name + ': needs a guess (' + res.reason + ')'); return; }
    for (const key of ['open', 't1', 't2', 't3', 'core', 'rounds']) if (res.stats[key] !== x.stats[key]) fail(name + ': stored ' + key + ' = ' + x.stats[key] + ', proof gives ' + res.stats[key]);
    const run = playByHints(L, k);
    if (!run.ok) { fail(name + ': following hints fails (' + run.why + ')'); return; }
    row.proven++;
    row.layouts.push({ start: x.start, open: res.stats.open / (n - v.mines), rounds: res.stats.rounds, t1: res.stats.t1, t2: res.stats.t2, t3: res.stats.t3, core: res.stats.core, hintSteps: run.steps });
  });
  rows.push(row);
});

const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
const col = (s, w) => String(s).padEnd(w);
const num = (x, w, d) => (d === undefined ? String(x) : x.toFixed(d)).padStart(w);

console.log('Capsid Lockdown — ' + rows.length + ' strains, ' + rows.reduce((a, r) => a + r.layouts.length, 0) + ' layouts\n');
console.log(col('strain', 8) + col('shape', 10) + 'cells  res  dens  nbrs  res/read  proven  open  rounds   t1    t2    t3  core');
rows.forEach((r) => {
  const l = r.layouts;
  console.log(col(r.id, 8) + col(r.shape, 10) + num(r.cells, 5) + num(r.resistant, 5) + '  ' + pct(r.density) + num(r.neighbours, 6, 1) + num(r.perReading, 10, 2) +
    num(r.proven + '/' + Viruses.VARIANTS, 8) + '  ' + pct(avg(l, (x) => x.open)) + num(avg(l, (x) => x.rounds), 8, 1) + num(avg(l, (x) => x.t1), 5, 1) + num(avg(l, (x) => x.t2), 6, 1) + num(avg(l, (x) => x.t3), 6, 1) + num(Math.max(0, ...l.map((x) => x.core)), 6));
});
console.log('\ndens      resistant proteins / proteins');
console.log('nbrs      mean number of neighbours of a protein (a square grid has 8)');
console.log('res/read  dens x nbrs: resistant neighbours an average reading sees (classic 12-21% on 8 neighbours = 0.96-1.68)');
console.log('open      share of the normal proteins the first dose locks (mean of the layouts)');
console.log('t1 t2 t3  proof rounds that needed one reading / two readings or the counter / three or more readings together');
console.log('core      the largest number of readings one deduction ever needs\n');

if (process.argv.includes('--json')) {
  const out = path.join(__dirname, '..', '.qa', 'lockdown-validation.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ ok: problems.length === 0, strains: rows, problems }, null, 2) + '\n');
  console.log('wrote .qa/lockdown-validation.json');
}

if (problems.length) {
  console.log('FAILED');
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('OK: every layout is solvable from its first dose by reasoning alone, and hint-following wins all of them.');
