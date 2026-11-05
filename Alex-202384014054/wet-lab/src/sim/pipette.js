// Alex 202384014054
// Air-displacement pipettes. Error figures follow the shape of ISO 8655 /
// manufacturer specs: systematic (sys) and random (cv) error in % of the set
// volume, at the bottom and top of the range, interpolated on log volume.

export const SPECS = {
  p20:   { id: 'p20', label: 'P20', min: 2, max: 20, step: 0.1, coarse: 1, tip: 'white', ch: 1, sys: [5, 1], cv: [1.5, 0.3] },
  p200:  { id: 'p200', label: 'P200', min: 20, max: 200, step: 1, coarse: 10, tip: 'yellow', ch: 1, sys: [2.5, 0.8], cv: [1, 0.15] },
  p1000: { id: 'p1000', label: 'P1000', min: 100, max: 1000, step: 1, coarse: 10, tip: 'blue', ch: 1, sys: [3, 0.8], cv: [0.6, 0.15] },
  mc20:  { id: 'mc20', label: '8 道 P20', min: 2, max: 20, step: 0.1, coarse: 1, tip: 'white', ch: 8, sys: [8, 1.5], cv: [3, 0.6] },
  mc200: { id: 'mc200', label: '8 道 P200', min: 20, max: 200, step: 1, coarse: 10, tip: 'yellow', ch: 8, sys: [4, 1], cv: [1.5, 0.3] },
};

export function accuracy(spec, v) {
  const lo = Math.log(spec.min), hi = Math.log(spec.max);
  const u = Math.min(1, Math.max(0, (Math.log(v) - lo) / (hi - lo)));
  let sys = spec.sys[0] + (spec.sys[1] - spec.sys[0]) * u;
  let cv = spec.cv[0] + (spec.cv[1] - spec.cv[0]) * u;
  if (v < spec.min) { const k = (spec.min / v) ** 1.6; sys *= k; cv *= k; }
  return { sys, cv };
}

// Volume drawn into the tip. `bias` in [-1,1] is the instrument's own
// calibration offset (a fraction of its spec), fixed per pipette per run.
export function aspirateVol(spec, set, stop, r, bias = 0) {
  const { sys, cv } = accuracy(spec, set);
  let v = set * (1 + (bias * sys) / 100);
  // gaussian without importing: Box–Muller on the given rng
  let u = 0; while (u === 0) u = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  v += (z * cv * set) / 100;
  // Pressing through to the blow-out stop before immersion pulls in the
  // blow-out stroke as extra liquid on release.
  if (stop >= 2) v += 0.04 * spec.max + 0.06 * set;
  return Math.max(0, v);
}

// Liquid left in the tip when the plunger only reaches the first stop.
export const residual = (v) => 0.03 * v;
// Wetted film that clings to an emptied tip and carries over to the next liquid.
export const film = (v) => Math.min(0.6, 0.0025 * v + 0.02);
