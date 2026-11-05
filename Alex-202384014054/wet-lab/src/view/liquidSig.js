// Alex 202384014054
// Everything about a well that changes how it is drawn, as a short string, so
// a model can skip redrawing until it really changes: every component's amount
// (so a 90/10 → 10/90 swap at equal volume shows), contamination, the cells
// and the colour reaction.
export function wellSig(wl) {
  const c = wl.liq.c;
  let s = '';
  for (const k of Object.keys(c).sort()) s += `${k}${(+c[k]).toPrecision(3)};`;
  const cells = wl.n + (c.cells || 0);
  return `${s}|${Math.round(cells / 500)}|${Math.round((wl.dead || 0) / 500)}|${wl.cck ? Math.round(wl.cck) : 0}`;
}
