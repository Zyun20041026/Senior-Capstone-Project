/*
 * Capsid Lockdown — boards.
 * Every virus shell is a set of cells; each cell is a polygon on a 3D surface.
 * Two cells are neighbours when they share at least one corner (so an edge or
 * a single corner both count, exactly like Minesweeper).
 *
 * Builders: spherical Voronoi (icosahedral and irregular shells), 60 kites,
 * lathe rings (rod, bullet, tail), a tube swept along a curve (filament) and a
 * head + tail composite (phage). All shapes and counts are invented for the
 * game; nothing here is a measured structure.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.CapsidBoards = factory(root.Capsid);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { dot, cross, sub, add, scale, len, norm, lerp3, mulMV, axisAngle, tangent } = C.vec;
  const ico = C.ico, TAU = Math.PI * 2;
  const mod = (a) => ((a % TAU) + TAU) % TAU;

  // ---------- welding: points closer than tol become one vertex ----------
  function weld(points, tol) {
    const t2 = tol * tol, verts = [], ids = new Array(points.length), buckets = new Map();
    const bw = Math.max(0.002, tol * 2.5);
    for (let i = 0; i < points.length; i++) {
      const p = points[i], k = Math.round(p[0] / bw);
      let id = -1;
      for (let d = -1; d <= 1 && id < 0; d++) {
        const b = buckets.get(k + d);
        if (!b) continue;
        for (const j of b) {
          const q = verts[j], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
          if (dx * dx + dy * dy + dz * dz < t2) { id = j; break; }
        }
      }
      if (id < 0) {
        id = verts.length; verts.push(p);
        let b = buckets.get(k);
        if (!b) buckets.set(k, b = []);
        b.push(id);
      }
      ids[i] = id;
    }
    return { verts, ids };
  }

  // ---------- spherical Voronoi (gnomonic clip per seed) ----------
  function clip(poly, a, b, c) {           // keep a*x + b*y <= c
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const dp = a * P[0] + b * P[1] - c, dq = a * Q[0] + b * Q[1] - c;
      if (dp <= 0) out.push(P);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
    }
    return out;
  }
  function voronoi(seeds) {
    return seeds.map((s, i) => {
      const [u, v] = tangent(s), near = [];
      for (let j = 0; j < seeds.length; j++) if (j !== i) near.push([dot(s, seeds[j]), j]);
      near.sort((a, b) => b[0] - a[0]);
      let poly = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
      for (let k = 0; k < Math.min(near.length, 26); k++) {
        const q = seeds[near[k][1]];
        poly = clip(poly, dot(u, q), dot(v, q), 1 - near[k][0]);
      }
      return poly.map(([x, y]) => norm(add(s, add(scale(u, x), scale(v, y)))));
    });
  }
  const lex = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  // split long great-circle edges so plates follow the curvature; both cells on
  // an edge get exactly the same points
  function arcSplit(poly, maxAng) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      out.push(A);
      const n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, dot(A, B)))) / maxAng - 1e-9);
      const fwd = lex(A, B) < 0, lo = fwd ? A : B, hi = fwd ? B : A;
      for (let j = 1; j < n; j++) out.push(norm(lerp3(lo, hi, fwd ? j / n : 1 - j / n)));
    }
    return out;
  }
  // seeds -> raw cells on the unit sphere. Voronoi edges shorter than `merge`
  // collapse into a corner, so "almost touching" cells really do touch.
  function sphereCells(seeds, o) {
    o = o || {};
    const polys = voronoi(seeds), flat = [];
    polys.forEach((p) => p.forEach((q) => flat.push(q)));
    const w = weld(flat, o.merge || 1e-7), warp = o.warp || ((p) => p), raw = [];
    let k = 0;
    polys.forEach((p, i) => {
      let ids = p.map(() => w.ids[k++]);
      ids = ids.filter((id, j) => id !== ids[(j + ids.length - 1) % ids.length]);
      if (o.skip === i) { raw.hole = ids.map((id) => warp(w.verts[id])); return; }
      const corners = ids.map((id) => w.verts[id]);
      let c = [0, 0, 0];
      corners.forEach((q) => { c = add(c, q); });
      c = norm(c);
      raw.push({ pts: arcSplit(corners, 0.2).map(warp), c: warp(c), out: c, tag: o.tag ? o.tag(i) : 0 });
    });
    return raw;
  }

  // ---------- seed sets ----------
  function geodesic(f) {
    const pts = [], V = ico.V;
    for (const [a, b, c] of ico.F) for (let i = 0; i <= f; i++) for (let j = 0; j <= f - i; j++) {
      pts.push(norm(add(add(scale(V[a], i), scale(V[b], j)), scale(V[c], f - i - j))));
    }
    return weld(pts, 1e-6).verts;
  }
  function soccer() {                       // 12 vertices + 20 face centres
    return ico.V.concat(ico.F.map(([a, b, c]) => norm(add(add(ico.V[a], ico.V[b]), ico.V[c]))));
  }
  function fibonacci(n, jitter, rnd) {
    const pts = [], ga = Math.PI * (3 - Math.sqrt(5)), s = jitter * Math.sqrt(4 * Math.PI / n);
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - y * y), a = i * ga;
      let p = [r * Math.cos(a), y, r * Math.sin(a)];
      if (jitter) { const [u, v] = tangent(p); p = norm(add(p, add(scale(u, (rnd() - 0.5) * s), scale(v, (rnd() - 0.5) * s)))); }
      pts.push(p);
    }
    return pts;
  }

  // ---------- warps ----------
  const WARP = {
    none: () => (p) => p,
    stretch: (o) => (p) => [p[0] * o.s[0], p[1] * o.s[1], p[2] * o.s[2]],
    brick: (o) => (p) => {                  // rounded box
      const k = Math.pow(Math.pow(Math.abs(p[0]), 4) + Math.pow(Math.abs(p[1]), 4) + Math.pow(Math.abs(p[2]), 4), -0.25);
      return [p[0] * k * o.s[0], p[1] * k * o.s[1], p[2] * k * o.s[2]];
    },
    lumpy: (o) => (p) => {                  // soft, uneven envelope
      const k = 1 + o.amp * (Math.sin(3.1 * p[0] + 1.3) * Math.sin(2.3 * p[1] + 0.4) + 0.7 * Math.sin(2.7 * p[2] + 1.9 * p[0]));
      return scale(p, k);
    },
  };

  // ---------- 60 kites: three per icosahedron face ----------
  function kiteCells() {
    const V = ico.V, raw = [], mid = new Map();
    const M = (a, b) => { const key = a < b ? a + '_' + b : b + '_' + a; if (!mid.has(key)) mid.set(key, norm(add(V[a], V[b]))); return mid.get(key); };
    for (const f of ico.F) {
      const ctr = norm(add(add(V[f[0]], V[f[1]]), V[f[2]]));
      for (let c = 0; c < 3; c++) {
        const a = f[c], b = f[(c + 1) % 3], p = f[(c + 2) % 3];
        const corners = [V[a], M(a, b), ctr, M(p, a)];
        const cc = norm(add(add(corners[0], corners[1]), add(corners[2], corners[3])));
        raw.push({ pts: arcSplit(corners, 0.2), c: cc, out: cc, tag: 0 });
      }
    }
    return raw;
  }

  // ---------- lathe: rings of cells around an axis (straight or curved) ----------
  // o.bounds: [{s, r, flat}]  o.rings: [{n, phase}]  o.frame(s) -> {P, T, N, B}
  function latheCells(o) {
    const frame = o.frame || ((s) => ({ P: [0, s, 0], T: [0, 1, 0], N: [1, 0, 0], B: [0, 0, 1] }));
    const m = o.rings.length, raw = [];
    const junc = (i) => { const r = o.rings[i], a = []; for (let j = 0; j < r.n; j++) a.push(mod(r.phase + TAU * j / r.n)); return a; };
    const ang = [];
    for (let k = 0; k <= m; k++) {
      let set = [];
      if (k > 0) set = set.concat(junc(k - 1));
      if (k < m) set = set.concat(junc(k));
      set.sort((a, b) => a - b);
      const u = [];
      for (const a of set) if (!u.length || a - u[u.length - 1] > 1e-7) u.push(a);
      if (u.length > 1 && u[0] + TAU - u[u.length - 1] < 1e-7) u.pop();
      const step = o.bounds[k].flat ? Infinity : TAU / 30, full = [];
      for (let i = 0; i < u.length; i++) {
        const a = u[i], b = i + 1 < u.length ? u[i + 1] : u[0] + TAU, d = b - a, n = Math.max(1, Math.ceil(d / step - 1e-9));
        for (let j = 0; j < n; j++) full.push(a + d * j / n);
      }
      ang.push(full);
    }
    const radial = (f, a) => add(scale(f.N, Math.cos(a)), scale(f.B, Math.sin(a)));
    const pt = (k, a) => { const b = o.bounds[k], f = frame(b.s); return add(f.P, scale(radial(f, a), b.r)); };
    const arc = (k, a0, span) => {
      const offs = [];
      for (const a of ang[k]) { let d = mod(a - a0); if (d > TAU - 1e-7) d = 0; if (d <= span + 1e-7) offs.push(d); }
      offs.sort((x, y) => x - y);
      return offs.map((d) => pt(k, a0 + d));
    };
    for (let i = 0; i < m; i++) {
      const r = o.rings[i], span = TAU / r.n, b0 = o.bounds[i], b1 = o.bounds[i + 1];
      const sm = (b0.s + b1.s) / 2, rm = (b0.r + b1.r) / 2, f = frame(sm), ds = b1.s - b0.s, dr = b1.r - b0.r;
      for (let j = 0; j < r.n; j++) {
        const a0 = r.phase + span * j, lower = arc(i, a0, span), upper = arc(i + 1, a0, span).reverse();
        const rad = radial(f, a0 + span / 2);
        raw.push({ pts: lower.concat(upper), c: add(f.P, scale(rad, rm)), out: norm(sub(scale(rad, ds), scale(f.T, dr))), tag: o.tag || 0 });
      }
    }
    const cap = (k, sign, bulge) => {
      const f = frame(o.bounds[k].s);
      raw.push({ pts: ang[k].map((a) => pt(k, a)), c: add(f.P, scale(f.T, sign * (bulge || 0))), out: scale(f.T, sign), tag: o.capTag || o.tag || 0 });
    };
    if (o.capStart !== undefined) cap(0, -1, o.capStart);
    if (o.capEnd !== undefined) cap(m, 1, o.capEnd);
    return raw;
  }
  // alternate ring phases (brick bond) or a steady drift (helix)
  function ringList(count, n, phase0, drift) {
    const out = [];
    for (let i = 0; i < count; i++) out.push({ n, phase: phase0 + drift * i * TAU / n });
    return out;
  }

  // ---------- from raw cells to a board ----------
  function finish(raw) {
    const flat = [];
    raw.forEach((c) => c.pts.forEach((p) => flat.push(p)));
    const w = weld(flat, 1e-6), verts = w.verts.map((p) => p.slice());
    let k = 0;
    const cells = raw.map((c) => {
      let poly = c.pts.map(() => w.ids[k++]);
      poly = poly.filter((id, i) => id !== poly[(i + poly.length - 1) % poly.length]);
      let n = [0, 0, 0];
      for (let i = 0; i < poly.length; i++) n = add(n, cross(verts[poly[i]], verts[poly[(i + 1) % poly.length]]));
      if (dot(n, c.out) < 0) { poly.reverse(); n = scale(n, -1); }
      return { poly, c: c.c.slice(), n: norm(n), area: len(n) / 2, tag: c.tag || 0 };
    });
    const owners = verts.map(() => []);
    cells.forEach((c, i) => c.poly.forEach((v) => owners[v].push(i)));
    const adj = cells.map((c, i) => {
      const s = new Set();
      c.poly.forEach((v) => owners[v].forEach((j) => { if (j !== i) s.add(j); }));
      return Array.from(s).sort((a, b) => a - b);
    });
    for (const c of cells) {                // inscribed radius: nearest edge to the centre
      let r = Infinity;
      for (let i = 0; i < c.poly.length; i++) {
        const a = verts[c.poly[i]], b = verts[c.poly[(i + 1) % c.poly.length]], ab = sub(b, a);
        const t = Math.max(0, Math.min(1, dot(sub(c.c, a), ab) / Math.max(1e-12, dot(ab, ab))));
        r = Math.min(r, len(sub(c.c, add(a, scale(ab, t)))));
      }
      c.rad = r;
    }
    return { verts, cells, adj, owners, deco: [], cage: [] };
  }

  // ---------- decoration: bead chains (spikes, fibres, legs) ----------
  function chain(deco, base, dir, o) {
    for (let i = 0; i < o.n; i++) deco.push({ p: add(base, scale(dir, o.len * (i + 0.7) / o.n)), r: o.r, d: dir, fade: !!o.fade, tone: o.tone || 0 });
    if (o.head) deco.push({ p: add(base, scale(dir, o.len + o.head * 0.55)), r: o.head, d: dir, fade: !!o.fade, tone: o.tone || 0 });
  }
  const SPIKE = {
    stud: { n: 1, len: 0.05, r: 0.034, head: 0 },
    pin: { n: 2, len: 0.13, r: 0.026, head: 0.04 },
    cap: { n: 2, len: 0.1, r: 0.024, head: 0.062 },
    club: { n: 3, len: 0.2, r: 0.03, head: 0.075 },
    spoke: { n: 2, len: 0.1, r: 0.036, head: 0.05 },
    fibre: { n: 6, len: 0.42, r: 0.024, head: 0.06, fade: true },
  };
  function junctionSpikes(board, o) {
    const rnd = C.rng32(o.seed || 7);
    board.owners.forEach((own, v) => {
      if (own.length < 3 || rnd() > o.share) return;
      if (o.tag !== undefined && !own.some((i) => board.cells[i].tag === o.tag)) return;
      let n = [0, 0, 0];
      own.forEach((i) => { n = add(n, board.cells[i].n); });
      const kind = o.kinds[Math.floor(rnd() * o.kinds.length)];
      chain(board.deco, board.verts[v], norm(n), Object.assign({ tone: o.tone || 0 }, SPIKE[kind]));
    });
  }


  // ---------- the cage: the overall frame of a shape, as loose polylines ----------
  // Each line: points, an outward direction per point, and for straight edges
  // of a solid the two faces it belongs to (it is in front when either is).
  function cageLine(board, p, n, f) { board.cage.push({ p, n, f: f || null }); }
  function cagePoly(board, V, edges, faceOf, k) {
    edges.forEach((e, i) => cageLine(board, [scale(V[e[0]], k), scale(V[e[1]], k)], [norm(V[e[0]]), norm(V[e[1]])], faceOf(i)));
  }
  const ICO_FACES = ico.E.map(([a, b]) => ico.F.filter((f) => f.indexOf(a) >= 0 && f.indexOf(b) >= 0).map(([i, j, k]) => norm(add(add(ico.V[i], ico.V[j]), ico.V[k]))));
  // twenty triangles: the frame of an icosahedral shell
  function cageIcosa(board, k, warp) {
    const V = ico.V.map(warp || ((p) => p));
    cagePoly(board, V, ico.E, (i) => ICO_FACES[i].map(warp ? (n) => norm(warp(n)) : (n) => n), k);
  }
  // twelve pentagons: a rounder net for soft, enveloped shells
  function cageDodeca(board, k) {
    const C = ico.F.map(([a, b, c]) => norm(add(add(ico.V[a], ico.V[b]), ico.V[c]))), E = [], faces = [];
    ico.E.forEach(([a, b]) => {
      const pair = [];
      ico.F.forEach((f, i) => { if (f.indexOf(a) >= 0 && f.indexOf(b) >= 0) pair.push(i); });
      E.push(pair); faces.push([ico.V[a], ico.V[b]]);
    });
    cagePoly(board, C, E, (i) => faces[i], k);
  }
  function cageBox(board, s) {
    const X = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let ax = 0; ax < 3; ax++) for (const u of [-1, 1]) for (const v of [-1, 1]) {
      const b = (ax + 1) % 3, c = (ax + 2) % 3, lo = [0, 0, 0], hi = [0, 0, 0];
      lo[ax] = -s[ax]; hi[ax] = s[ax]; lo[b] = hi[b] = u * s[b]; lo[c] = hi[c] = v * s[c];
      cageLine(board, [lo, hi], [norm(lo), norm(hi)], [scale(X[b], u), scale(X[c], v)]);
    }
  }
  // rings and rails around an axis; frame(s) as in latheCells, radius(s) the profile
  function cageRing(board, frame, s, r, steps) {
    const f = frame(s), p = [], n = [];
    for (let i = 0; i <= (steps || 28); i++) {
      const a = TAU * i / (steps || 28), d = add(scale(f.N, Math.cos(a)), scale(f.B, Math.sin(a)));
      p.push(add(f.P, scale(d, r))); n.push(d);
    }
    cageLine(board, p, n);
  }
  function cageRail(board, frame, stops, angle, twist) {       // stops: [[s, r], ...]
    const p = [], n = [];
    stops.forEach(([s, r], i) => {
      const f = frame(s), a = angle + (twist || 0) * i / Math.max(1, stops.length - 1), d = add(scale(f.N, Math.cos(a)), scale(f.B, Math.sin(a)));
      p.push(add(f.P, scale(d, r))); n.push(r > 1e-6 ? d : f.T);
    });
    cageLine(board, p, n);
  }
  const AXIS = (s) => ({ P: [0, s, 0], T: [0, 1, 0], N: [1, 0, 0], B: [0, 0, 1] });
  const stopsAlong = (a, b, r, step) => { const out = [], k = Math.max(1, Math.ceil((b - a) / step)); for (let i = 0; i <= k; i++) out.push([a + (b - a) * i / k, r]); return out; };

  // ---------- frame the finished model ----------
  function frameBoard(board, mode) {
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of board.verts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    if (mode === 'free') { mid[0] = mid[1] = mid[2] = 0; }
    const shift = (p) => { p[0] -= mid[0]; p[1] -= mid[1]; p[2] -= mid[2]; };
    board.verts.forEach(shift);
    board.cells.forEach((c) => shift(c.c));
    board.deco.forEach((d) => { d.p = d.p.slice(); shift(d.p); });
    board.cage.forEach((l) => { l.p = l.p.map((q) => { const c = q.slice(); shift(c); return c; }); });
    let r = 0, hw = 0, hh = 0, dr = 0, dw = 0, dh = 0;
    for (const p of board.verts) { r = Math.max(r, len(p)); hw = Math.max(hw, Math.hypot(p[0], p[2])); hh = Math.max(hh, Math.abs(p[1])); }
    for (const d of board.deco) { dr = Math.max(dr, len(d.p)); dw = Math.max(dw, Math.hypot(d.p[0], d.p[2])); dh = Math.max(dh, Math.abs(d.p[1])); }
    // decoration may poke a little past the fitted box
    const soft = (a, b) => a + Math.max(0, b - a) * 0.55;
    board.mode = mode;
    board.mid = mid;                        // how far the shape was shifted, for drawing that follows its build
    board.fit =mode === 'free' ? { hw: soft(r, dr), hh: soft(r, dr) } : { hw: soft(hw, dw), hh: soft(hh, dh) };
    let u = 0;
    board.cells.forEach((c) => { u += c.rad; });
    board.unit = u / board.cells.length;
    return board;
  }

  // ---------- the shapes ----------
  const SHAPES = {
    // icosahedral shell: seeds 'soccer' (32) or geodesic f (42, 92, 162)
    icosa(s) {
      const seeds = s.f ? geodesic(s.f) : soccer();
      const b = finish(sphereCells(seeds, { tag: (i) => (i < 12 ? 1 : 0) }));
      if (s.fibres) b.cells.forEach((c) => { if (c.tag === 1) chain(b.deco, add(c.c, scale(c.n, 0.02)), c.n, SPIKE.fibre); });
      if (s.spikes) junctionSpikes(b, s.spikes);
      cageIcosa(b, 1.175);
      return frameBoard(b, 'free');
    },
    kites(s) {
      const b = finish(kiteCells());
      // spokes on the twelve five-fold corners
      b.owners.forEach((own, v) => { if (own.length === 5) chain(b.deco, b.verts[v], norm(b.verts[v]), SPIKE.spoke); });
      cageIcosa(b, 1.175);
      return frameBoard(b, 'free');
    },
    // enveloped, irregular shell
    envelope(s) {
      const rnd = C.rng32(s.seed);
      let seeds = fibonacci(s.n, s.jitter, rnd);
      for (let it = 0; it < (s.relax === undefined ? 3 : s.relax); it++) {   // Lloyd: even out cell sizes
        seeds = voronoi(seeds).map((poly) => { let c = [0, 0, 0]; poly.forEach((q) => { c = add(c, q); }); return norm(c); });
      }
      const warp = WARP[s.warp ? s.warp.type : 'none'](s.warp || {});
      const b = finish(sphereCells(seeds, { warp, merge: (s.merge || 0.2) * Math.sqrt(4 * Math.PI / s.n) }));
      if (s.spikes) junctionSpikes(b, s.spikes);
      if (s.warp && s.warp.type === 'brick') cageBox(b, s.warp.s.map((x) => x * 0.97)); else cageDodeca(b, 1.07);
      return frameBoard(b, s.warp && s.warp.type === 'brick' ? 'spindle' : 'free');
    },
    // straight rod with a helical stagger
    rod(s) {
      const bounds = [];
      for (let i = 0; i <= s.rings; i++) bounds.push({ s: i * s.h, r: 1 });
      const b = finish(latheCells({ bounds, rings: ringList(s.rings, s.n, 0, 1 / 3), capStart: 0, capEnd: 0 }));
      // two end rings and a pair of helices
      const H = s.rings * s.h;
      cageRing(b, AXIS, 0, 1); cageRing(b, AXIS, H, 1);
      for (const a of [0, Math.PI]) cageRail(b, AXIS, stopsAlong(0, H, 1, H / 40), a, TAU * 1.5);
      return frameBoard(b, 'spindle');
    },
    // bullet: flat base, round nose
    bullet(s) {
      const bounds = [{ s: 0, r: 0.62 }, { s: 0.28, r: 1 }], rings = [{ n: 8, phase: TAU / 16 }];
      for (let i = 0; i < s.rings; i++) { bounds.push({ s: 0.28 + (i + 1) * s.h, r: 1 }); rings.push({ n: 8, phase: i % 2 ? TAU / 16 : 0 }); }
      const top = 0.28 + s.rings * s.h, ph = s.rings % 2 ? TAU / 16 : 0;
      bounds.push({ s: top + 0.62, r: 0.84 }); rings.push({ n: 8, phase: ph });
      bounds.push({ s: top + 1.08, r: 0.44 }); rings.push({ n: 4, phase: ph });
      const b = finish(latheCells({ bounds, rings, capStart: 0, capEnd: 0.16 }));
      if (s.spikes) junctionSpikes(b, s.spikes);
      // rings at the base, the shoulder and the nose; four ribs meeting at the tip
      cageRing(b, AXIS, 0, 0.62); cageRing(b, AXIS, 0.28, 1); cageRing(b, AXIS, top, 1); cageRing(b, AXIS, top + 0.62, 0.84);
      const rib = [[0, 0.62], [0.28, 1]].concat(stopsAlong(0.28, top, 1, 0.5).slice(1), [[top + 0.3, 0.96], [top + 0.62, 0.84], [top + 0.9, 0.62], [top + 1.08, 0.44], [top + 1.2, 0.22], [top + 1.24, 0]]);
      for (let k = 0; k < 4; k++) cageRail(b, AXIS, rib, TAU / 8 + k * TAU / 4);
      return frameBoard(b, 'spindle');
    },
    // long tube bent into a crook
    filament(s) {
      const R = s.r, a = s.straight, hook = s.hook, arcLen = Math.PI * hook;
      const frame = (t) => {
        let P, T;
        if (t <= a) { P = [0, t, 0]; T = [0, 1, 0]; }
        else if (t <= a + arcLen) { const ph = Math.PI - (t - a) / hook; P = [hook + hook * Math.cos(ph), a + hook * Math.sin(ph), 0]; T = [Math.sin(ph), -Math.cos(ph), 0]; }
        else { P = [2 * hook, a - (t - a - arcLen), 0]; T = [0, -1, 0]; }
        const B = [0, 0, 1];
        return { P, T, N: cross(T, B), B };
      };
      const bounds = [{ s: 0, r: R * 0.62 }], rings = [];
      for (let i = 0; i < s.rings; i++) {
        const end = i === s.rings - 1;
        bounds.push({ s: (i + 1) * s.h, r: end ? R * 0.62 : R });
        rings.push({ n: s.n, phase: i % 2 ? Math.PI / s.n : 0 });
      }
      const b = finish(latheCells({ bounds, rings, frame, capStart: 0.1, capEnd: 0.1 }));
      // four rails along the bend, a ring every third segment
      const total = s.rings * s.h, rail = [[0, R * 0.62]].concat(stopsAlong(s.h, total - s.h, R, s.h / 2), [[total, R * 0.62]]);
      for (let k = 0; k < 4; k++) cageRail(b, frame, rail, TAU / 8 + k * TAU / 4);
      for (let i = 0; i <= s.rings; i += 3) cageRing(b, frame, i * s.h, i === 0 || i === s.rings ? R * 0.62 : R, 20);
      if (s.rings % 3) cageRing(b, frame, total, R * 0.62, 20);
      return frameBoard(b, 'spindle');
    },
    // head + neck + tail + baseplate
    phage(s) {
      const v0 = ico.V[0], R = axisAngle(cross(v0, [0, -1, 0]), Math.acos(Math.max(-1, Math.min(1, -v0[1]))));
      const seeds = geodesic(2).map((p) => mulMV(R, p));
      let skip = 0;
      seeds.forEach((p, i) => { if (p[1] < seeds[skip][1]) skip = i; });
      const head = sphereCells(seeds, { warp: WARP.stretch({ s: [1, 1.2, 1] }), skip, tag: () => 0 });
      const rim = head.hole, rimY = rim[0][1], rimR = Math.hypot(rim[0][0], rim[0][2]), th = Math.atan2(rim[0][2], rim[0][0]);
      const frame = (t) => ({ P: [0, rimY - t, 0], T: [0, -1, 0], N: [1, 0, 0], B: [0, 0, 1] });
      const NECK = 0.36, bounds = [{ s: 0, r: rimR, flat: true }, { s: NECK, r: s.r }], rings = [{ n: 5, phase: th }];
      for (let i = 0; i < s.rings; i++) { bounds.push({ s: NECK + (i + 1) * s.h, r: s.r }); rings.push({ n: 5, phase: th + (i % 2 ? 0 : Math.PI / 5) }); }
      const end = NECK + s.rings * s.h, ph = th + (s.rings % 2 ? 0 : Math.PI / 5);
      bounds.push({ s: end + 0.26, r: s.r * 1.85 }); rings.push({ n: 5, phase: ph });
      const tail = latheCells({ bounds, rings, frame, capEnd: 0.02, tag: 2 });
      const b = finish(head.concat(tail));
      // five bent legs from the baseplate corners
      const by = rimY - end - 0.26;
      for (let j = 0; j < 5; j++) {
        const a = ph + j * TAU / 5, rad = [Math.cos(a), 0, Math.sin(a)], base = add([0, by, 0], scale(rad, s.r * 1.85));
        const up = norm(add(scale(rad, 0.8), [0, 0.6, 0])), knee = add(base, scale(up, 0.5)), down = norm(add(scale(rad, 0.5), [0, -0.87, 0]));
        chain(b.deco, base, up, { n: 5, len: 0.5, r: 0.03 });
        chain(b.deco, knee, down, { n: 8, len: 0.86, r: 0.028, head: 0.04 });
        cageLine(b, [base, knee, add(knee, scale(down, 0.9))], [rad, rad, rad]);
      }
      // head: a stretched icosahedron; tail: rings and three rails; baseplate ring
      const stretch = (p) => { const q = mulMV(R, p); return [q[0], q[1] * 1.2, q[2]]; };
      cageIcosa(b, 1.175, stretch);
      for (const t of [NECK, NECK + s.rings * s.h / 2, end]) cageRing(b, frame, t, s.r, 16);
      cageRing(b, frame, end + 0.26, s.r * 1.85, 20);
      for (let k = 0; k < 3; k++) cageRail(b, frame, stopsAlong(NECK, end, s.r, 0.5), ph + k * TAU / 3);
      return frameBoard(b, 'spindle');
    },
  };

  function build(spec) {
    const b = SHAPES[spec.shape](spec);
    b.spec = spec;
    return b;
  }

  // smallest gap between two cells that are NOT neighbours but share a
  // neighbour, relative to the typical cell size: the board is only readable
  // when cells that look like they touch really are neighbours
  function clearance(board) {
    const { cells, verts, adj } = board;
    const segDist = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(1e-12, dot(ab, ab)))); return len(sub(p, add(a, scale(ab, t)))); };
    let best = Infinity;
    for (let i = 0; i < cells.length; i++) {
      const near = new Set();
      adj[i].forEach((j) => adj[j].forEach((k) => { if (k > i && adj[i].indexOf(k) < 0) near.add(k); }));
      for (const k of near) {
        const A = cells[i].poly, B = cells[k].poly;
        for (const va of A) for (let e = 0; e < B.length; e++) best = Math.min(best, segDist(verts[va], verts[B[e]], verts[B[(e + 1) % B.length]]));
        for (const vb of B) for (let e = 0; e < A.length; e++) best = Math.min(best, segDist(verts[vb], verts[A[e]], verts[A[(e + 1) % A.length]]));
      }
    }
    return best / board.unit;
  }

  // The size shown in the dossier and on the scale bar is made by the game from
  // its own shell: every protein block counts as BLOCK_NM wide, and the size is
  // how many blocks span the longest side. It is not a measurement of anything.
  const BLOCK_NM = 10;
  function sizeNm(board) {
    const mean = Math.sqrt(board.cells.reduce((a, c) => a + c.area, 0) / board.cells.length);
    return Math.round(2 * Math.max(board.fit.hw, board.fit.hh) / mean * BLOCK_NM);
  }

  return { build, clearance, sizeNm, BLOCK_NM, weld, voronoi, geodesic, soccer, fibonacci, SHAPES };
});
