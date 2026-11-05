// Alex 202384014054
// Statistics for the analysis software.

export const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
export const cv = (a) => { const m = mean(a); return m ? (100 * sd(a)) / Math.abs(m) : 0; };
export const zPrime = (pos, neg) => 1 - (3 * (sd(pos) + sd(neg))) / Math.abs(mean(pos) - mean(neg));

// Four-parameter logistic on log10 concentration:
//   y = bottom + (top - bottom) / (1 + (x / ic50)^hill)
// For a fixed (logIC50, hill) the model is linear in bottom/top, so those are
// solved exactly; the two nonlinear parameters are found by a grid search and
// refined with Nelder–Mead.
export function fit4pl(x, y) {
  const lx = x.map(Math.log10);
  const solve = (lic, h) => {
    const g = lx.map((v) => 1 / (1 + 10 ** ((v - lic) * h)));
    const mg = mean(g), my = mean(y);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < g.length; i++) { sxy += (g[i] - mg) * (y[i] - my); sxx += (g[i] - mg) ** 2; }
    const s = sxx > 1e-12 ? sxy / sxx : 0;
    const b = my - s * mg;
    let sse = 0;
    for (let i = 0; i < g.length; i++) sse += (y[i] - b - s * g[i]) ** 2;
    return { bottom: b, top: b + s, sse };
  };
  const lo = Math.min(...lx) - 1.5, hi = Math.max(...lx) + 1.5;
  let best = { sse: Infinity };
  for (let lic = lo; lic <= hi; lic += 0.05) {
    for (let h = 0.4; h <= 4.01; h += 0.1) {
      const s = solve(lic, h);
      if (s.top < s.bottom) continue;
      if (s.sse < best.sse) best = { ...s, lic, h };
    }
  }
  if (!isFinite(best.sse)) best = { ...solve(hi, 1), lic: hi, h: 1 };
  // Nelder–Mead on (lic, h)
  const f = ([a, b]) => { if (b < 0.3 || b > 5) return 1e12; const s = solve(a, b); return s.top < s.bottom ? 1e12 : s.sse; };
  let simplex = [[best.lic, best.h], [best.lic + 0.05, best.h], [best.lic, best.h + 0.1]].map((p) => ({ p, v: f(p) }));
  for (let it = 0; it < 120; it++) {
    simplex.sort((a, b) => a.v - b.v);
    const [bst, mid, worst] = simplex;
    const c = [(bst.p[0] + mid.p[0]) / 2, (bst.p[1] + mid.p[1]) / 2];
    const refl = [2 * c[0] - worst.p[0], 2 * c[1] - worst.p[1]];
    const vr = f(refl);
    if (vr < bst.v) {
      const exp = [3 * c[0] - 2 * worst.p[0], 3 * c[1] - 2 * worst.p[1]];
      const ve = f(exp);
      simplex[2] = ve < vr ? { p: exp, v: ve } : { p: refl, v: vr };
    } else if (vr < mid.v) simplex[2] = { p: refl, v: vr };
    else {
      const con = [(c[0] + worst.p[0]) / 2, (c[1] + worst.p[1]) / 2];
      const vc = f(con);
      if (vc < worst.v) simplex[2] = { p: con, v: vc };
      else simplex = simplex.map((s, i) => (i === 0 ? s : { p: [(s.p[0] + bst.p[0]) / 2, (s.p[1] + bst.p[1]) / 2], v: f([(s.p[0] + bst.p[0]) / 2, (s.p[1] + bst.p[1]) / 2]) }));
    }
  }
  simplex.sort((a, b) => a.v - b.v);
  const [lic, h] = simplex[0].p;
  const s = solve(lic, h);
  const my = mean(y);
  const sst = y.reduce((a, v) => a + (v - my) ** 2, 0);
  const ic50 = 10 ** lic;
  return {
    bottom: s.bottom, top: s.top, ic50, hill: h,
    r2: sst > 1e-12 ? 1 - s.sse / sst : 0,
    beyond: ic50 > Math.max(...x) ? 'high' : ic50 < Math.min(...x) ? 'low' : null,
  };
}

export const curve = (p, c) => p.bottom + (p.top - p.bottom) / (1 + (c / p.ic50) ** p.hill);
