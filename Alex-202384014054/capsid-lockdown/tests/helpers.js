// Alex 202384014054
/* Shared helpers for the tests. Node built-ins only. */
'use strict';
const Rules = require('../js/rules.js');

// a w x h grid where every square touches its 8 surrounding squares
function grid(w, h) {
  const adj = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const list = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h) list.push(Y * w + X);
    }
    adj.push(list);
  }
  return adj;
}
const level = (adj, mines, start) => ({ adj, variants: [{ start, mines }] });

// what a player can see in a session, as solver knowledge; `trusted` flags count as known
function viewOf(sess, trusted) {
  const K = Rules.knowledge(sess.adj, sess.total);
  for (let i = 0; i < sess.n; i++) { const r = sess.reading(i); if (r >= 0) K.num[i] = r; else if (sess.state[i] === 2) K.mine[i] = 1; }
  (trusted || []).forEach((i) => { K.mine[i] = 1; });
  return K;
}
// do the readings a deduction names really force its conclusion, on their own?
function evidenceForces(K, d) {
  if (d.rule === 'count') {
    let known = 0, open = 0;
    for (let i = 0; i < K.n; i++) { if (K.mine[i]) known++; else if (K.num[i] < 0) open++; }
    const left = K.total - known;
    return d.mine ? left === open : left === 0;
  }
  const cons = Rules.constraints(K).filter((c) => d.why.indexOf(c.src) >= 0);
  return cons.length === d.why.length && Rules.fill(cons, d.cell, d.mine ? 0 : 1) === null;
}
// every way to place `total` resistant proteins that agrees with K (small boards only)
function worlds(K) {
  const n = K.n, out = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    let bits = 0, ok = true;
    for (let i = 0; i < n && ok; i++) {
      const m = (mask >> i) & 1;
      bits += m;
      if (K.mine[i] && !m) ok = false;
      if (K.num[i] >= 0) {
        if (m) { ok = false; break; }
        let k = 0;
        for (const j of K.adj[i]) k += (mask >> j) & 1;
        if (k !== K.num[i]) ok = false;
      }
    }
    if (ok && bits === K.total) out.push(mask);
  }
  return out;
}
module.exports = { Rules, grid, level, viewOf, evidenceForces, worlds };
