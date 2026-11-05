// Alex 202384014054
// How forgiving the game is. One place for every knob, so the lab can be made
// stricter again without hunting through graders. BASE is the main-line
// setting; every run starts from it (applyEase), so nothing a hard case set
// leaks into the next mode.
export const BASE = Object.freeze({
  penalty: 0.5,  // SOP deductions are halved (the rule and its card still show)
  tol: 2.5,      // notebook answers: relative tolerance × 2.5
  abs: 2,        // notebook answers: absolute tolerance × 2
  band: 1.6,     // data-quality metrics: an error counts as 1/1.6 of its size
  par: 1.5,      // reference time × 1.5 before the time score drops
  stars: Object.freeze([82, 64, 42]), // totals for 3, 2 and 1 star
});
export const EASE = { ...BASE, stars: BASE.stars.slice() };

export function applyEase(overrides = {}) {
  for (const k of Object.keys(EASE)) delete EASE[k];
  Object.assign(EASE, { ...BASE, stars: BASE.stars.slice() }, overrides);
  return EASE;
}
