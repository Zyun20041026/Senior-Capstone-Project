// Alex 202384014054
/*
 * Capsid Lockdown — core maths shared by everything else.
 * Vector helpers, a small seeded RNG and the icosahedron (kept from the first
 * version of the game; the icosahedral viruses are still built on it).
 * No DOM: runs in the browser (window.Capsid) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Capsid = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => { const l = len(a); return l > 1e-12 ? scale(a, 1 / l) : [0, 1, 0]; };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulMV = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  const mulMM = (a, b) => {
    const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    return r;
  };
  function axisAngle(axis, ang) {
    const [x, y, z] = norm(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [
      [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
      [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
      [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
    ];
  }
  // any unit vector perpendicular to d, and the third axis
  function tangent(d) {
    const u = norm(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    return [u, cross(d, u)];
  }

  // deterministic RNG (integer maths only, identical in every engine)
  function rng32(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }

  // icosahedron: 12 vertices on the unit sphere, 30 edges, 20 outward faces
  function icosahedron() {
    const PHI = (1 + Math.sqrt(5)) / 2, raw = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) { raw.push([0, a, b * PHI]); raw.push([a, b * PHI, 0]); raw.push([b * PHI, 0, a]); }
    const V = raw.map(norm);
    const adj = (i, j) => i !== j && dot(V[i], V[j]) > 0.4;
    const E = [], F = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (adj(i, j)) E.push([i, j]);
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
      if (adj(i, j) && adj(j, k) && adj(i, k)) {
        const c = add(add(V[i], V[j]), V[k]), nrm = cross(sub(V[j], V[i]), sub(V[k], V[i]));
        F.push(dot(nrm, c) > 0 ? [i, j, k] : [i, k, j]);
      }
    }
    return { V, E, F };
  }
  const ico = icosahedron();

  return { ico, rng32, shuffle, vec: { dot, cross, sub, add, scale, len, norm, lerp3, mulMV, mulMM, axisAngle, tangent } };
});
