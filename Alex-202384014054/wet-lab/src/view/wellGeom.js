// Alex 202384014054
// 96-well geometry shared by the plate models and the pipette poses: the one
// volume → liquid-height curve, and where a tip stops at each depth step.
// Flat bottom: a cylinder of Ø 6.4 mm (≈ 32.2 mm² cross-section). U bottom:
// the same cylinder over a hemispherical floor of r = 3.2 mm (≈ 68.6 µL).
// Model units are metres (1 mm = 0.001); volumes are µL (= mm³).

export const SBS_H = 14.4;       // plate height, mm
export const WELL_DEPTH = 10.6;  // rim to floor, mm
const R = 3.2, AREA = Math.PI * R * R, CAP = (2 / 3) * Math.PI * R ** 3;
const FLOOR = SBS_H - 0.3 - WELL_DEPTH; // well floor above the plate's base, mm
const mm = (x) => x / 1000;

// Liquid height above the well floor, mm.
export function levelOf(type, uL) {
  const v = Math.max(0, uL || 0);
  let h;
  if (type === 'uplate' && v <= CAP) {
    // spherical cap of height h holds π h² (3R − h) / 3
    let lo = 0, hi = R;
    for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if ((Math.PI * m * m * (3 * R - m)) / 3 < v) lo = m; else hi = m; }
    h = (lo + hi) / 2;
  } else if (type === 'uplate') h = R + (v - CAP) / AREA;
  else h = v / AREA;
  return Math.min(WELL_DEPTH, h);
}

// Model meta for a plate of this type (heights in metres).
export function plateMeta(type) {
  return {
    sbs: true, mouth: mm(SBS_H), floor: mm(FLOOR), bottom: mm(FLOOR), top: mm(SBS_H + 4),
    level: (uL) => mm(FLOOR + levelOf(type, uL)),
  };
}

// Tip heights for depth steps 0–3: above the item, at the mouth, below the
// liquid surface, on the floor. In a well "below the surface" is 2.5 mm under
// it (pipetting guides give 2–3 mm for a 200 µL tip) but never through the
// floor, so a small volume puts the tip just above the bottom.
export function depthStops(meta, uL) {
  const lev = meta.level(uL);
  if (meta.tipbox || meta.holder) return [meta.top + 0.004, meta.mouth, meta.mouth - 0.003, meta.mouth - 0.004];
  if (meta.flask) return [meta.mouth + 0.012, meta.mouth - 0.012, Math.max(meta.bottom + 0.001, lev - 0.002), meta.bottom];
  // A well: step 1 hangs just inside the mouth but always clear of the liquid,
  // even in a nearly full well, so dispensing there never dips the tip.
  if (meta.floor != null) return [meta.top + 0.014, Math.min(meta.mouth - 0.0005, Math.max(meta.mouth - 0.008, lev + 0.001)), Math.max(meta.floor + 0.0003, lev - 0.0025), meta.floor];
  return [meta.top + 0.014, meta.mouth - 0.008, Math.max(meta.bottom + 0.002, Math.min(meta.mouth - 0.01, lev - 0.005)), meta.bottom];
}
