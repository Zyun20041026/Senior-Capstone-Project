// Alex 202384014054
// Instrument runs that take game time (extraction, PCR, gel, sequencing,
// cloning, plate reads). A job lives in w.jobs and settles itself when the
// world clock passes its end, whoever is or isn't looking at the panel.
// Panels only read progress; closing them never stops a run.

const SETTLE = {};
// kind → (w, job) => result. Registered by the modules that own each kind.
export function onSettle(kind, fn) { SETTLE[kind] = fn; }

// Optional hook run before a job starts (billing). Returns false to refuse.
let gate = null;
export function setJobGate(fn) { gate = fn; }

export function startJob(w, { kind, dur, input = {}, key = null, label = '' }) {
  w.jobs ||= {}; w.jobSeq = (w.jobSeq || 0) + 1;
  const id = `J${w.jobSeq}`;
  const job = { id, kind, key, label, start: w.t, dur: Math.max(0.01, dur), input, done: false, result: null };
  if (gate && gate(w, job) === false) return null;
  w.jobs[id] = job;
  return job;
}

export function tickJobs(w) {
  if (!w.jobs) return;
  for (const j of Object.values(w.jobs)) {
    if (j.done || w.t < j.start + j.dur - 1e-9) continue;
    j.done = true; j.end = j.start + j.dur;
    // A run whose inputs vanished (e.g. a cancelled biopsy) fails visibly; it
    // never stops the clock and never counts as a result.
    try { j.result = SETTLE[j.kind] ? SETTLE[j.kind](w, j) : null; }
    catch (e) { j.result = null; j.failed = e.message || String(e); }
    (w.jobEvents ||= []).push({ id: j.id, kind: j.kind, label: j.label, t: w.t, failed: j.failed || null });
  }
}

export const progress = (w, j) => (!j ? 0 : j.done ? 1 : Math.max(0, Math.min(1, (w.t - j.start) / j.dur)));
export const remaining = (w, j) => (!j || j.done ? 0 : Math.max(0, j.start + j.dur - w.t));
// The newest job of a kind (optionally for one key, e.g. a run id).
export function jobOf(w, kind, key = undefined) {
  const js = Object.values(w.jobs || {}).filter((j) => j.kind === kind && (key === undefined || j.key === key));
  return js.length ? js[js.length - 1] : null;
}
export const running = (w, kind, key) => { const j = jobOf(w, kind, key); return !!j && !j.done; };
