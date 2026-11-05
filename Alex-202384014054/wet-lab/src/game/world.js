// Alex 202384014054
// World state and the passage of time. Pure data plus functions; no DOM.

import { rng } from '../sim/rng.js';
import { L, vol, add, split, mixed } from '../sim/liquid.js';
import { LINES, grow } from '../sim/cells.js';
import { COMPOUNDS, hill, dmsoTox, drugFactor } from '../sim/pharm.js';
import { evapRate } from '../sim/plate.js';
import { STATIONS, slotDef } from './layout.js';
import { tickJobs } from './jobs.js';
import { tagCells, takeSrc, composition } from '../sim/lineage.js';
import { TYPES } from './catalog.js';
import { violate } from './sop.js';
import { val } from '../data/index.js';

// How often a sterility slip becomes contamination: one rule for every tier.
const RISK_SCALE = val('constants', 'contam-risk-scale');

export const TIME_SCALE = 2; // game seconds per real second while you work
const ENV_T = { room: 22, bsc: 22, bath: 37, inc: 37, fridge: 4, freezer: -20, reader: 25, rotor: 22, deck: 22 }; // deck: the robot's dark enclosure

export function createWorld(seed = 1) {
  return {
    seed, r: rng(seed), t: 0, clock0: 9 * 60, day: 1,
    station: 'bsc', stations: ['bsc'],
    items: {}, tools: {}, held: null, hover: null, depth: 0, orient: 'col',
    bsc: { fan: false, fanSince: null, light: false, uv: false, wiped: false },
    inst: {
      incubator: { door: false, openMin: 0, warned: false },
      fridge: { door: false, openMin: 0, warned: false },
      freezer: { door: false, openMin: 0, warned: false },
      centrifuge: { lid: false, rotor: [null, null, null, null, null, null], rpm: 0, min: 5, running: 0, last: null, alarm: false },
      balance: { doors: true, tare: 0, prints: [] },
      reader: { drawer: false, wl: 450, last: null },
    },
    plunger: { down: false, stop: 0, mode: null, peak: 0, key: null, disp: null },
    keys: {},
    sop: { list: [], counts: {} },
    log: [], notes: {}, flags: { scoped: {}, maxOut: 0, outMin: 0 }, events: [], reads: {}, hemo: null,
    gene: {}, ct: {},
    level: null, done: false, failed: null,
  };
}

// ---------------------------------------------------------------- items & places

export const items = (w) => Object.values(w.items);
export function itemsAt(w, st) { return items(w).filter((it) => it.at && it.at.st === st); }
export function occupant(w, st, slot) { return items(w).find((it) => it.at && it.at.st === st && it.at.slot === slot); }
export function put(w, it, st, slot) { it.at = { st, slot }; w.items[it.id] = it; return it; }

export function envOf(w, it) {
  const at = it.at;
  if (!at) return 'room';
  if (at.st === 'tray') return 'room';
  if (at.st === 'hand') return w.station === 'bsc' ? 'bsc' : 'room';
  if (at.st === 'rotor') return 'rotor';
  const s = slotDef(at.st, at.slot);
  return (s && s.env) || STATIONS[at.st]?.env || 'room';
}
export const inBSC = (w, it) => !!it.at && it.at.st === 'bsc';

export function clock(w) {
  const m = w.clock0 + w.t;
  const day = w.day + Math.floor(m / 1440);
  const mm = ((m % 1440) + 1440) % 1440;
  return { day, hh: Math.floor(mm / 60), mm: Math.floor(mm % 60), label: `第 ${day} 天 ${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(Math.floor(mm % 60)).padStart(2, '0')}` };
}

export function log(w, text) {
  const last = w.log[w.log.length - 1];
  if (last && last.text === text && w.t - last.t < 3) { last.n = (last.n || 1) + 1; return; }
  w.log.push({ t: w.t, text });
}

export const emit = (w, kind, text, extra = {}) => w.events.push({ kind, text, ...extra });

// Every liquid an item holds, for growth/contamination bookkeeping.
export function liquidsOf(it) {
  if (it.wells) return it.wells.map((wl) => wl.liq);
  if (it.lanes) return it.lanes;
  return [it.liq];
}
export function totalVol(it) { return liquidsOf(it).reduce((s, l) => s + vol(l), 0); }

// ---------------------------------------------------------------- time

export function advance(w, minutes) {
  let left = minutes;
  while (left > 1e-9) {
    const dt = Math.min(left, left > 120 ? 10 : left > 10 ? 2 : 0.5);
    for (const it of items(w)) stepItem(w, it, dt);
    stepPlaces(w, dt);
    w.t += dt;
    left -= dt;
    tickJobs(w);
  }
}

function stepPlaces(w, dt) {
  const b = w.bsc;
  if (b.uv && b.uvSince != null && w.t + dt - b.uvSince >= (b.uvMin || 15) - 1e-9) {
    b.uv = false; b.uvSince = null; b.light = b.fan;
    w.log.push({ t: w.t, text: '紫外灭菌结束，紫外灯自动关闭' });
    (w.jobEvents ||= []).push({ id: 'uv', kind: 'uv', label: '紫外灭菌', t: w.t });
  }
  for (const k of ['incubator', 'fridge', 'freezer']) {
    const d = w.inst[k];
    if (d.door) {
      d.openMin += dt;
      const lim = k === 'incubator' ? 3 : 4;
      if (d.openMin > lim && !d.warned) { d.warned = true; violate(w, k === 'incubator' ? 'incubator_door' : 'fridge_door'); }
    } else d.openMin = 0;
  }
}

function stepItem(w, it, dt) {
  const env = envOf(w, it);
  const T = ENV_T[env] ?? 22;
  const tau = TYPES[it.type]?.tau || 4;
  it.temp += (T - it.temp) * (1 - Math.exp(-dt / tau));
  // DMSO stocks freeze below 18.5 °C and stratify on thawing.
  if (it.liq && it.liq.c.dmso && it.liq.c.dmso / Math.max(1e-9, vol(it.liq)) > 0.5) {
    const wasFrozen = it.frozen;
    it.frozen = it.temp < 18.5;
    if (wasFrozen && !it.frozen) it.liq = { ...it.liq, mix: Math.min(it.liq.mix, 0.35) };
  }
  // Contamination: random seeding from accumulated risk on entering warmth,
  // then exponential growth.
  const warm = env === 'inc' || env === 'bath';
  if (warm && it.risk > 0) {
    if (w.r() < 1 - Math.exp(-it.risk * RISK_SCALE)) seedBug(w, it, 0.4);
    it.risk = 0;
  }
  const dbl = T >= 30 ? 150 : T >= 15 ? 480 : 0;
  if (dbl) for (const l of liquidsOf(it)) if (l.c.bug) l.c.bug = Math.min(60, l.c.bug * 2 ** (dt / dbl));

  if (it.type === 'flask') stepFlask(w, it, dt, env);
  else if (it.wells) stepPlate(w, it, dt, env);
  else if (it.liq && (it.liq.c.cells || it.liq.c.dead)) stepSuspension(w, it, dt, env);
}

export function seedBug(w, it, amt) {
  if (it.wells) {
    for (const wl of it.wells) if (vol(wl.liq) > 0 && w.r() < 0.5) wl.liq.c.bug = (wl.liq.c.bug || 0) + amt;
  } else if (it.lanes) it.lanes.forEach((l) => { if (vol(l) > 0) l.c.bug = (l.c.bug || 0) + amt; });
  else if (vol(it.liq) > 0 || it.layer) it.liq.c.bug = (it.liq.c.bug || 0) + amt;
}

const trypsinActive = (l) => (l.c.trypsin || 0) > 0 && (l.c.medium || 0) < 2 * l.c.trypsin;

function trypsinStep(w, it, l, dt, tempC) {
  if (!trypsinActive(l)) return 0;
  const act = tempC >= 34 ? 1 : 0.22;
  it.tryMin = (it.tryMin || 0) + dt * act;
  if (it.tryMin > 10 && !it.overTry) { it.overTry = true; violate(w, 'over_trypsin'); }
  if (it.tryMin > 8 && l.c.cells) {
    const f = Math.exp(-0.022 * dt * act);
    const lost = l.c.cells * (1 - f);
    l.c.cells -= lost; l.c.dead = (l.c.dead || 0) + lost;
  }
  return act;
}

function stepFlask(w, it, dt, env) {
  const lay = it.layer;
  if (!lay) return;
  const line = LINES[it.line];
  const l = it.liq;
  const v = vol(l);
  // Detachment by trypsin moves cells from the layer into suspension.
  const act = trypsinStep(w, it, l, dt, it.temp);
  if (act > 0) {
    const k = 0.55 * act;
    const mv = lay.n * (1 - Math.exp(-k * dt)), md = lay.d * (1 - Math.exp(-k * dt));
    lay.n -= mv; lay.d -= md;
    l.c.cells = (l.c.cells || 0) + mv; l.c.dead = (l.c.dead || 0) + md;
    tagCells(l, it.line, mv + md);
    if (it.tryMin > 8) lay.n *= Math.exp(-0.022 * dt * act);
  }
  if (env === 'inc' && (l.c.medium || 0) > 1000 && (l.c.bug || 0) < 3) {
    lay.n = grow(lay.n, dt / 60, line.td, line.capT25);
    // Overconfluent cultures start to die.
    if (lay.n > 0.95 * line.capT25) lay.n *= Math.exp(-0.0004 * dt);
  }
  if (env !== 'inc') {
    // Without liquid the layer dries within minutes.
    if (v < 150 && lay.n > 1000) {
      it.dryMin = (it.dryMin || 0) + dt;
      if (it.dryMin > 4) { if (!it.dryWarned) { it.dryWarned = true; violate(w, 'cells_dry'); } const f = Math.exp(-0.06 * dt); lay.d += lay.n * (1 - f); lay.n *= f; }
    } else it.dryMin = 0;
  }
  if ((l.c.bug || 0) >= 3) { const f = Math.exp(-0.01 * dt); lay.d += lay.n * (1 - f); lay.n *= f; }
  if (l.c.cells) stepSuspension(w, it, dt, env, true);
}

function stepSuspension(w, it, dt, env, skipTrypsin = false) {
  const l = it.liq;
  if (!skipTrypsin) trypsinStep(w, it, l, dt, it.temp);
  if (l.c.cells > 0 || l.c.dead > 0) it.liq = { ...l, mix: Math.max(0.25, l.mix - dt / 7) };
}

function stepPlate(w, it, dt, env) {
  const line = it.line && LINES[it.line];
  const vols = it.wells.map((wl) => vol(wl.liq));
  const h = dt / 60;
  for (let i = 0; i < 96; i++) {
    const wl = it.wells[i];
    const l = wl.liq;
    const v = vols[i];
    if (v < 1e-6 && !wl.n) continue;
    if (env === 'inc') {
      // Settle and attach: suspended cells become an attached layer within ~2 h.
      if (l.c.cells || l.c.dead) {
        wl.settle = (wl.settle || 0) + dt;
        if (wl.settle >= 120) {
          // the attached layer remembers which lines it came from
          if (Object.keys(l.c).some((k) => k.startsWith('src:'))) { if (!wl.src && wl.n > 0) wl.src = { [it.line]: wl.n }; wl.src ||= {}; takeSrc(l, wl.src, 1); }
          wl.n += l.c.cells || 0; wl.dead += l.c.dead || 0; delete l.c.cells; delete l.c.dead;
        }
      }
      // Evaporation concentrates everything and stresses cells.
      const loss = evapRate(i, vols) * (dt / 1440);
      if (v > 0) for (const k of ['medium', 'pbs', 'water']) if (l.c[k]) l.c[k] *= 1 - loss;
      wl.evap = (wl.evap || 0) + loss;
      if (wl.n > 0 && (line || wl.src) && v > 20) {
        // each line in the well grows and answers drugs on its own terms
        const comp = composition(wl.src, it.line);
        let shared = 1;
        const dm = (l.c.dmso || 0) / v * 100;
        shared *= dmsoTox(dm) ** (h / 72);
        shared *= Math.exp(-1.2 * loss);
        if ((l.c.bug || 0) >= 3) shared *= Math.exp(-0.02 * dt);
        const before = wl.n;
        let next = 0; const src2 = {};
        for (const ln in comp) {
          const L0 = LINES[ln]; if (!L0) continue;
          const drugs = {};
          for (const k in l.c) if (k.startsWith('drug:') && COMPOUNDS[k.slice(5)]) drugs[k.slice(5)] = l.c[k] / v;
          const f = shared * drugFactor(ln, drugs) ** (h / 72);
          const n1 = grow(wl.n * comp[ln], h, L0.td, L0.capWell * comp[ln]) * f;
          next += n1; src2[ln] = n1;
        }
        wl.n = next;
        if (wl.src) wl.src = src2;
        wl.dead += Math.max(0, before - wl.n) * 0.3;
      }
    } else if (v < 1 && wl.n > 0) {
      wl.dry = (wl.dry || 0) + dt;
      if (wl.dry > 5) wl.n *= Math.exp(-0.06 * dt);
    }
    if (l.c.cck8) {
      wl.cck += dt * (env === 'inc' ? 1 : 0.45);
      if (env === 'bsc' || env === 'room') wl.light = (wl.light || 0) + (env === 'bsc' && w.bsc.light ? 2 : 1) * dt / 60;
    }
  }
}

// ---------------------------------------------------------------- per-frame tick

export function tick(w, dtReal) {
  advance(w, (dtReal * TIME_SCALE) / 60);
  // Track how long the level's live cells have been out of the incubator.
  const crit = items(w).filter((it) => it.critical);
  if (crit.length && crit.some((it) => envOf(w, it) !== 'inc' && cellsIn(it) > 0)) {
    w.flags.outMin += (dtReal * TIME_SCALE) / 60;
    if (w.flags.outMin > 60 && !w.flags.outWarned) { w.flags.outWarned = true; violate(w, 'out_too_long'); }
  }
}

export function cellsIn(it) {
  if (it.layer) return it.layer.n + (it.liq.c.cells || 0);
  if (it.wells) return it.wells.reduce((s, wl) => s + wl.n + (wl.liq.c.cells || 0), 0);
  return (it.liq?.c.cells || 0) + (it.pellet?.n || 0);
}

export { L, vol, add, split, mixed };
