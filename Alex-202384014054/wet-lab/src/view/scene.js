// Alex 202384014054
// The scene controller. The station, items and tools are drawn in 3D
// (view3d/); this file places them every frame, keeps screen-space hit boxes
// for the input layer, and draws the 2D overlays (highlights, the depth
// gauge, deck labels and pipette rings, the serological magnifier) in the SVG
// that sits over the canvas.

import * as THREE from 'three';
import { el, setA, txt, rr } from './svg.js';
import { wellCenter, PLATE as PLATE2D } from './art.js';
import { depthStops } from './wellGeom.js';
import { disposeTree } from '../view3d/dispose.js';
import { createGL } from '../view3d/gl.js';
import { buildStation } from '../view3d/stations.js';
import { buildItem } from '../view3d/models.js';
import { buildTool } from '../view3d/tools.js';
import { M, mesh } from '../view3d/mats.js';
import { STATIONS, TRAY, DECK, slotDef, slotActive } from '../game/layout.js';
import { heldTool, heldItem, channelSlots } from '../game/actions.js';
import { vol, color } from '../sim/liquid.js';

const TRAY_RECT = { x: 1092, y: 834, w: 500, h: 60 };

export function createScene(svg, canvas, opts = {}) {
  const G = createGL(canvas);
  G.setTray(TRAY_RECT);
  trayLights(G);
  const L = {};
  for (const k of ['deckUI', 'trayUI', 'ghost', 'over']) L[k] = el('g', { id: `L-${k}` }, svg);
  for (const k of Object.values(L)) k.setAttribute('pointer-events', 'none');
  // tray frame (the 3D cart renders inside it)
  el('path', { d: rr(TRAY_RECT.x, TRAY_RECT.y, TRAY_RECT.w, TRAY_RECT.h, 12), fill: 'none', stroke: 'rgba(255,255,255,.12)' }, L.trayUI);
  txt(L.trayUI, '托盘', { x: 1104, y: 852, 'font-size': 11, fill: '#7d8794', 'font-weight': 600 });
  for (const s of TRAY) el('path', { d: rr(s.x - 34, 840, 68, 50, 8), fill: 'none', stroke: 'rgba(255,255,255,.07)' }, L.trayUI);

  const S = {
    svg, G, L, station: null, levelKey: null, st: null, stations: new Map(), models: new Map(), tools: new Map(), boxes: [],
    pointer: { x: 800, y: 450 }, ghost: null, pose: null, fxHover: null, opts, view: 'all', viewManual: false,
    hl: el('path', { d: '', fill: 'none', stroke: '#8b84ff', 'stroke-width': 2.4, 'stroke-dasharray': '7 5', opacity: 0.95 }, L.ghost),
    ring: el('g', null, L.over), depthG: el('g', null, L.over), mag: el('g', null, L.over),
    last: performance.now(),
  };
  S.deckLabels = buildDeckUI(L.deckUI);

  S.setStation = (w) => {
    if (S.station === w.station && S.levelKey === w.level?.id && S.st) return;
    const first = !S.st;
    if (S.st) G.main.remove(S.st.group);
    // Stations are built once per level and reused when you walk back; a
    // new level frees the old level's stations.
    if (S.levelKey !== w.level?.id) dropStations(S);
    S.station = w.station; S.levelKey = w.level?.id;
    S.st = S.stations.get(w.station) || buildStation(w.station, w.level, S.opts);
    S.stations.set(w.station, S.st);
    G.main.add(S.st.group);
    const c = S.st.cam;
    const o = new URLSearchParams(location.search).get('cam');
    if (o) { const v = o.split(',').map(Number); c.pos = v.slice(0, 3); c.look = v.slice(3, 6); if (v[6]) c.fov = v[6]; }
    G.setCamera(c.pos, c.look, c.fov, first);
    S.view = 'all'; S.viewManual = false;
    L.deckUI.style.display = S.st.deck3d ? '' : 'none';
  };
  // V: switch between the cabinet overview and the deck close-up by hand
  // (until the next station change); otherwise the view follows the work.
  S.toggleView = () => {
    if (!S.st?.cams) return false;
    S.viewManual = true;
    setView(S, S.view === 'all' ? 'deck' : 'all');
    return S.view;
  };

  S.render = (w) => {
    const now = performance.now();
    const real = Math.min(0.5, (now - S.last) / 1000);
    const dt = Math.min(0.1, real);
    S.last = now;
    S.setStation(w);
    G.stepCamera(real);
    S.st.update(w, dt);
    autoView(S, w);
    S.boxes = [];
    placeItems(S, w);
    placeTools(S, w, dt);
    G.render({ uv: S.st.uvGlow?.(w) });
    overlays(S, w);
  };

  S.resize = (scale) => G.resize(scale);
  // New level: forget item and tool models and rebuild the station.
  S.reset = () => {
    for (const m of [...S.models.values(), ...S.tools.values()]) { if (m.obj.parent) m.obj.parent.remove(m.obj); disposeTree(m.obj); }
    S.models.clear(); S.tools.clear(); S.station = null; S.toolPos = null;
    if (S.st) G.main.remove(S.st.group);
    dropStations(S); S.st = null; S.levelKey = undefined;
  };

  // Screen rectangle of a coach/tutorial target.
  S.rectOf = (t) => {
    if (!t) return null;
    if (t.item) { const b = S.boxes.find((x) => x.id === t.item); return b && [b.x0, b.y0, b.x1, b.y1]; }
    if (t.tool) { const b = S.boxes.find((x) => x.tool === t.tool); return b && [b.x0, b.y0, b.x1, b.y1]; }
    if (t.slot) { const r = slotRect(S, t.slot.st, t.slot.id); return r && [r.x0, r.y0, r.x1, r.y1]; }
    if (t.fx) { const r = fxRect(S, t.fx); return r && [r.x0, r.y0, r.x1, r.y1]; }
    if (t.rect) return t.rect;
    return null;
  };
  return S;
}

// ---------------------------------------------------------------- static parts

function trayLights(G) {
  const s = G.tray;
  s.add(new THREE.HemisphereLight(0xffffff, 0x3a4048, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-0.3, 1, 1.2); s.add(d);
}

function buildDeckUI(g) {
  return { items: el('g', null, g), cache: new Map() };
}

function setView(S, v) {
  if (S.view === v || !S.st?.cams) return;
  S.view = v;
  const c = S.st.cams[v];
  S.G.setCamera(c.pos, c.look, c.fov);
}

// The deck close-up follows the work: holding a pipette or an SBS item and
// pointing at the right half of the cabinet leans in; pointing back at the
// left half (or putting things down) sits back.
function autoView(S, w) {
  if (!S.st.cams || S.viewManual || S.G.camT < 1) return;
  const ht = heldTool(w), hi = heldItem(w);
  const busy = (ht && ht.kind === 'pip') || (hi && SBS_TYPES.has(hi.type));
  if (!busy) { setView(S, 'all'); return; }
  if (S.pointer.y > 828) return;
  const p = S.G.onPlaneY(S.pointer.x, S.pointer.y, 0, tmpV);
  if (!p) return;
  if (S.view === 'all' && p.x > 0.09 && p.z > -0.55 && p.z < 0.06) setView(S, 'deck');
  else if (S.view === 'deck' && (p.x < 0.05 || S.pointer.x < 70)) setView(S, 'all');
}

// ---------------------------------------------------------------- items

const SBS_TYPES = new Set(['plate', 'uplate', 'res4', 'tipbox', 'tipboxSide']);
const tmpV = new THREE.Vector3();

function slotPos(S, st, id) {
  const p = S.st?.slots?.[id];
  if (!p) return null;
  if (p.node) return p.node.getWorldPosition(new THREE.Vector3());
  return p;
}

function modelOf(S, it) {
  let m = S.models.get(it.id);
  if (!m) { m = buildItem(it); S.models.set(it.id, m); }
  return m;
}

// Pick-up and put-down are short eased moves (≈200 ms) from where the item
// was to where it now belongs, with a slight lift; off under reduced motion.
export const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
function glide(m, key, o) {
  const now = performance.now();
  if (m.key !== key) {
    if (m.key && m.last && !reducedMotion()) m.anim = { from: m.last.clone(), t0: now };
    m.key = key;
  }
  const target = o.position.clone();
  if (m.anim) {
    const k = Math.min(1, (now - m.anim.t0) / 200), e = 1 - (1 - k) ** 3;
    o.position.lerpVectors(m.anim.from, target, e);
    o.position.y += Math.sin(Math.PI * k) * 0.025;
    if (k >= 1) m.anim = null;
  }
  m.last = target;
}

function placeItems(S, w) {
  const G = S.G;
  const seen = new Set();
  const labels = [];
  for (const it of Object.values(w.items)) {
    const at = it.at;
    if (!at) continue;
    const m = modelOf(S, it);
    const o = m.obj;
    seen.add(it.id);
    m.update(it, w);
    const sbs = SBS_TYPES.has(it.type);
    if (at.st === 'hand') {
      if (o.parent !== G.main) G.main.add(o);
      // The tray shrinks models to fit its slots; in the hand they are their
      // physical size again, exactly as on a bench slot.
      o.scale.setScalar(m.scale || 1);
      const p = handPoint(S, 0.62);
      o.position.copy(p);
      o.rotation.set(0, 0, 0);
      if (sbs) sbsTurn(o, it);
      o.position.y -= m.meta.top * 0.35 * (m.scale || 1);
      glide(m, 'hand', o);
      o.visible = true;
      continue;
    }
    if (at.st === 'tray') {
      const s = TRAY.find((x) => x.id === at.slot);
      if (o.parent !== G.tray) G.tray.add(o);
      m.key = null; m.last = null;
      if (m.shadow) m.shadow.visible = false;
      fitTray(o, m, s);
      const r = G.rectOf(o, G.trayCam, TRAY_RECT);
      if (r) S.boxes.push({ id: it.id, ...pad(r, 4), it, slot: s, tray: true, x: s.x, y: 886 });
      continue;
    }
    if (at.st !== w.station) { if (o.parent) o.parent.remove(o); m.key = null; m.last = null; continue; }
    const sd = slotDef(at.st, at.slot);
    const onDeck = sd && sd.kind === 'deck';
    const p = slotPos(S, at.st, at.slot);
    if (!p) { if (o.parent) o.parent.remove(o); continue; }
    if (o.parent !== G.main) G.main.add(o);
    o.scale.setScalar(1); // models are life-size; small things get a larger hit area instead
    if (m.shadow) m.shadow.visible = !(it.type === 'flask' && sd?.kind === 'shelf');
    o.rotation.set(0, 0, 0);
    o.position.copy(p);
    if (sbs) sbsTurn(o, it);
    if (it.type === 'flask' && at.st !== 'bsc') o.rotation.y = 0;
    glide(m, `${at.st}:${at.slot}`, o);
    o.visible = true;
    const r = G.rectOf(o);
    if (r) S.boxes.push({ id: it.id, ...pad(grow(r, m.scale || 1), 5), it, slot: sd, model: m, x: (r.x0 + r.x1) / 2, y: r.y1, deck: onDeck });
    if (onDeck) labels.push([it, m]);
  }
  for (const [id, m] of S.models) if (!seen.has(id) && m.obj.parent) m.obj.parent.remove(m.obj);
  deckLabels(S, labels);
}

const pad = (r, k) => ({ x0: r.x0 - k, y0: r.y0 - k, x1: r.x1 + k, y1: r.y1 + k });
// A screen box scaled about its centre: the hit area a small item had when it
// was drawn larger than life.
const grow = (r, k) => { const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, hw = ((r.x1 - r.x0) / 2) * k, hh = ((r.y1 - r.y0) / 2) * k; return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh }; };

function dropStations(S) {
  for (const st of S.stations.values()) { if (st.group.parent) st.group.parent.remove(st.group); disposeTree(st.group); }
  S.stations.clear();
}

// SBS models (plates, tip boxes, reservoirs) have their origin at the A1
// corner. Centre one on its point; a plate turned 180° (it.rot, key R) spins
// about that centre, so its A1 corner, the row/column labels, well picking
// (all in plate-local mm) and the reader's H12-as-A1 mapping agree.
const halfSBS = new THREE.Vector3(PLATE2D.w / 2000, 0, PLATE2D.h / 2000);
function sbsTurn(o, it) {
  if (it.rot) { o.rotation.y = Math.PI; o.position.add(halfSBS); }
  else o.position.sub(halfSBS);
}

// A point under the pointer, `k` of the way from the camera to the station's
// focus — where held things float.
function handPoint(S, k) {
  const G = S.G;
  const r = G.ray(S.pointer.x, S.pointer.y).ray;
  const d = G.cam.position.distanceTo(G.camLook || new THREE.Vector3()) * k;
  return r.origin.clone().addScaledVector(r.direction, d);
}

function fitTray(o, m, s) {
  if (!m.trayFit) {
    o.scale.setScalar(1); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    const size = b.getSize(new THREE.Vector3());
    m.trayFit = { k: Math.min(42 / size.y, 58 / Math.max(size.x, 0.001)), cx: (b.min.x + b.max.x) / 2, by: b.min.y, cz: (b.min.z + b.max.z) / 2 };
  }
  const f = m.trayFit;
  o.scale.setScalar(f.k);
  o.rotation.set(0.32, -0.35, 0);
  o.position.set(s.x - f.cx * f.k, -886 - f.by * f.k, -f.cz * f.k);
}

// SBS item local (mm across, mm deep, metres up) → world, and → screen.
const sbsWorld = (m, xmm, zmm, y) => m.obj.localToWorld(new THREE.Vector3(xmm / 1000, y, zmm / 1000));
const RES_LANE = (k) => (12 + k * ((DECK.w - 30) / 4 + 2) + ((DECK.w - 30) / 4 - 4) / 2) / DECK.px; // lane centre, mm
const wellMM = (r, c) => [PLATE2D.a1x + c * PLATE2D.pitch, PLATE2D.a1y + r * PLATE2D.pitch];

// Names under each deck item; in the close-up, row letters and column
// numbers along the plate edges and the volume in each reservoir lane.
function deckLabels(S, labels) {
  const D = S.deckLabels, G = S.G;
  const keep = new Set();
  const near = S.view === 'deck' && S.G.camT >= 1;
  for (const [it, m] of labels) {
    keep.add(it.id);
    let e = D.cache.get(it.id);
    if (!e) {
      const g = el('g', null, D.items);
      const tag = el('g', null, g);
      const bg = el('rect', { x: -150, y: 2, width: 150, height: 17, rx: 4, fill: '#1e2b45', opacity: 0.9 }, tag);
      const t = txt(tag, '', { x: -75, y: 14, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600, fill: '#fff' });
      const grid = el('g', { 'font-size': 10, fill: '#2a333d', 'font-weight': 700, 'font-family': 'var(--num)', 'text-anchor': 'middle' }, g);
      e = { g, tag, bg, t, grid, gridFor: null, cells: [] };
      D.cache.set(it.id, e);
    }
    const meta = m.meta;
    const c = G.toScreen(sbsWorld(m, PLATE2D.w, PLATE2D.h, meta.mouth));
    setA(e.tag, 'transform', `translate(${c.x.toFixed(1)},${(c.y + 2).toFixed(1)})`);
    const label = it.short || it.label;
    if (e.t.textContent !== label) { e.t.textContent = label; const wd = Math.min(220, 22 + label.length * 10.5); setA(e.bg, 'x', -wd); setA(e.bg, 'width', wd); setA(e.t, 'x', -wd / 2); }
    const kind = near ? (it.wells ? 'wells' : it.lanes ? 'lanes' : '') : '';
    if (e.gridFor !== kind) {
      e.gridFor = kind; e.grid.replaceChildren(); e.cells = [];
      if (kind === 'wells') {
        for (let c2 = 0; c2 < 12; c2++) e.cells.push([txt(e.grid, String(c2 + 1), {}), wellMM(0, c2)[0], -1.5]);
        for (let r = 0; r < 8; r++) e.cells.push([txt(e.grid, 'ABCDEFGH'[r], {}), 6, wellMM(r, 0)[1]]);
      } else if (kind === 'lanes') {
        for (let k = 0; k < 4; k++) e.cells.push([txt(e.grid, '', { 'font-size': 11, fill: '#13203a' }), RES_LANE(k), PLATE2D.h / 2, k]);
      }
    }
    for (const [node, xm, zm, k] of e.cells) {
      const p = G.toScreen(sbsWorld(m, xm, zm, meta.top));
      setA(node, 'x', p.x.toFixed(1)); setA(node, 'y', (p.y + 3.5).toFixed(1));
      if (k != null) { const v = vol(it.lanes[k]); const s2 = v > 1 ? (v >= 1000 ? `${(v / 1000).toFixed(1)} mL` : `${Math.round(v)} µL`) : ''; if (node.textContent !== s2) node.textContent = s2; }
    }
  }
  for (const [id, e] of D.cache) if (!keep.has(id)) { e.g.remove(); D.cache.delete(id); }
}

// World positions of the wells (or lane points) a tool would enter.
function deckPoints(S, w, t, box) {
  const it = box.it, h = w.hover, m = box.model;
  if (!m || !h) return [];
  const ch = t.kind === 'pip' ? t.spec.ch : 1;
  const y = m.meta.mouth;
  const pts = [];
  if (it.type === 'res4') {
    if (h.lane == null) return [];
    for (let k = 0; k < ch; k++) pts.push([sbsWorld(m, RES_LANE(h.lane), PLATE2D.a1y + (ch === 1 ? 3.5 : k) * PLATE2D.pitch, y), k]);
  } else if (h.row != null && h.col != null) {
    if (ch === 1) pts.push([sbsWorld(m, ...wellMM(h.row, h.col), y), 0]);
    else for (let k = 0; k < 8; k++) {
      const [r, c] = w.orient === 'col' ? [k, h.col] : [h.row, Math.min(h.col, 4) + k];
      pts.push([sbsWorld(m, ...wellMM(r, c), y), k]);
    }
  }
  return pts;
}

// ---------------------------------------------------------------- tools

function placeTools(S, w, dt) {
  const G = S.G;
  const held = heldTool(w);
  const homes = S.st.toolHome || {};
  for (const t of Object.values(w.tools)) {
    let m = S.tools.get(t.id);
    const isHeld = held === t;
    const home = t.home === w.station && homes[t.id];
    if (!isHeld && !home) { if (m && m.obj.parent) m.obj.parent.remove(m.obj); continue; }
    if (!m) { m = buildTool(t); S.tools.set(t.id, m); }
    if (m.obj.parent !== G.main) G.main.add(m.obj);
    m.update(t, w, isHeld);
    if (isHeld) continue;
    m.obj.visible = true;
    m.obj.position.copy(home.pos);
    m.obj.rotation.set(0, home.rot || 0, 0);
    const r = G.rectOf(m.obj);
    if (r) S.boxes.push({ tool: t.id, ...pad(r, 2) });
  }
  S.pose = null;
  if (held) poseTool(S, w, held, dt);
}

// Depth stops for a tool over a container: above, in the mouth, under the
// surface, on the bottom (container-local metres).
// Volume a tip would meet over a deck item: the fullest-to-emptiest wells the
// channels enter, taking the emptiest so every tip ends up in liquid or on the floor.
function deckVol(it, h, t, orient) {
  if (!it.wells || h.row == null || h.col == null) return it.lanes && h.lane != null ? vol(it.lanes[h.lane]) : 0;
  const ch = t.kind === 'pip' ? t.spec.ch : 1;
  const idx = ch === 1 ? [h.row * 12 + h.col] : Array.from({ length: 8 }, (_, k) => (orient === 'col' ? k * 12 + h.col : h.row * 12 + Math.min(h.col, 4) + k));
  return Math.min(...idx.map((i) => vol(it.wells[i].liq)));
}

function poseTool(S, w, t, dt) {
  const G = S.G;
  const m = S.tools.get(t.id);
  const o = m.obj;
  const hov = w.hover && w.hover.id ? S.boxes.find((b) => b.id === w.hover.id) : null;
  let target, snapped = false, tilt = 0.06;
  let yaw = null, pts = null;
  if (hov && hov.deck && (pts = deckPoints(S, w, t, hov)).length) {
    const meta = hov.model.meta;
    const ys = depthStops(meta, deckVol(hov.it, w.hover, t, w.orient));
    const a = pts[0][0], b = pts[pts.length - 1][0];
    target = a.clone().add(b).multiplyScalar(0.5);
    target.y = hov.model.obj.localToWorld(tmpV.set(0, ys[w.depth] ?? ys[0], 0)).y;
    snapped = true; tilt = 0;
    if (pts.length > 1) yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
  } else if (hov && hov.model && !hov.tray && !hov.deck) {
    const meta = hov.model.meta;
    const it = hov.it;
    const ys = depthStops(meta, it.liq ? vol(it.liq) : 0);
    const mo = hov.model.obj;
    const [mx, mz] = meta.mouthAt || [0, 0];
    const sbsOff = meta.sbs ? [PLATE2D.w / 2000, PLATE2D.h / 2000] : [0, 0];
    target = mo.localToWorld(new THREE.Vector3(mx + sbsOff[0], ys[w.depth] ?? ys[0], mz + sbsOff[1]));
    snapped = true;
    if (meta.tilt) tilt = meta.tilt;
  } else {
    target = handPoint(S, 0.8);
  }
  o.visible = true;
  const cur = S.toolPos && S.toolPos.id === t.id ? S.toolPos : { id: t.id, p: target.clone() };
  const k = snapped ? 1 - Math.exp(-dt * 22) : 1;
  cur.p.lerp(target, k);
  S.toolPos = cur;
  o.position.copy(cur.p);
  const cam = G.cam.position;
  o.rotation.set(0, yaw ?? Math.atan2(cam.x - cur.p.x, cam.z - cur.p.z), 0);
  o.rotateZ(-tilt);
  const s = G.toScreen(cur.p);
  S.pose = { x: s.x, y: s.y, snapped, box: hov, pts };
}

// ---------------------------------------------------------------- overlays

function slotRect(S, st, id) {
  const sd = slotDef(st, id);
  if (!sd) return null;
  if (sd.kind === 'tray') return { x0: sd.x - 34, y0: 840, x1: sd.x + 34, y1: 890 };
  if (st !== S.station) return null;
  const p = slotPos(S, st, id);
  if (!p) return null;
  const deck = sd.kind === 'deck';
  const b = new THREE.Mesh(deck ? new THREE.BoxGeometry(0.13, 0.016, 0.088) : new THREE.BoxGeometry(0.07, 0.12, 0.07));
  b.position.copy(p).add(tmpV.set(0, deck ? 0.008 : 0.06, 0));
  b.updateMatrixWorld();
  return S.G.rectOf(b);
}

function fxRect(S, id) {
  let found = null;
  for (const r of S.st?.fxRoots || []) r.traverse((o) => { if (!found && o.userData.fx === id && o.isMesh === false) found = o; });
  if (!found) for (const r of S.st?.fxRoots || []) r.traverse((o) => { if (!found && o.userData.fx === id) found = o; });
  return found ? S.G.rectOf(found) : null;
}

function overlays(S, w) {
  const t = heldTool(w);
  const pose = S.pose;
  S.ring.replaceChildren();
  S.depthG.replaceChildren();
  if (t && pose && pose.pts?.length) deckRings(S, w, t, pose.pts);
  if (t && w.hover && w.hover.id && pose?.snapped) depthGauge(S, w, pose);
  let d = '';
  const h = w.hover;
  if (heldItem(w) && S.ghost) {
    const g = S.ghost;
    d = rr(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 10);
  } else if (h && h.id) {
    const b = S.boxes.find((x) => x.id === h.id);
    if (b && !(b.deck && t)) d = rr(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 10);
  } else if (h && h.tool) {
    const b = S.boxes.find((x) => x.tool === h.tool);
    if (b) d = rr(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 10);
  } else if (S.fxHover && !t) {
    const r = fxRect(S, S.fxHover);
    if (r && r.x1 - r.x0 < 900) d = rr(r.x0 - 4, r.y0 - 4, r.x1 - r.x0 + 8, r.y1 - r.y0 + 8, 12);
  }
  setA(S.hl, 'd', d);
  magnifier(S, w, t);
}

// Soft rings on the plate surface under each tip (projected ellipses).
function deckRings(S, w, t, pts) {
  const G = S.G;
  const tips = t.kind === 'pip' ? t.tips : [t.sp || t.pasteur];
  const scr = [];
  for (const [p, k] of pts) {
    const c = G.toScreen(p), ex = G.toScreen(tmpV.copy(p).add(new THREE.Vector3(0.0039, 0, 0))), ez = G.toScreen(tmpV.copy(p).add(new THREE.Vector3(0, 0, 0.0039)));
    const rx = Math.max(3, Math.hypot(ex.x - c.x, ex.y - c.y)), ry = Math.max(2, Math.hypot(ez.x - c.x, ez.y - c.y));
    const tp = tips[k], lv = tp ? vol(tp.liq) : 0;
    el('ellipse', { cx: c.x, cy: c.y, rx: rx * 1.15, ry: ry * 1.15, fill: lv > 0.5 ? color(tp.liq).fill : '#8b84ff', 'fill-opacity': lv > 0.5 ? 0.55 : 0.16, stroke: tp ? '#8b84ff' : '#98a2b1', 'stroke-width': tp ? 2.2 : 1.3, 'stroke-dasharray': tp ? '' : '3 3' }, S.ring);
    scr.push(c);
  }
  if (scr.length > 1) {
    const a = scr[0], b = scr[scr.length - 1];
    el('path', { d: `M${a.x},${a.y}L${b.x},${b.y}`, stroke: '#8b84ff', 'stroke-width': 1.2, opacity: 0.45 }, S.ring);
  }
}

const DEPTHS = ['在上方', '进入容器', '液面下', '触底'];
function depthGauge(S, w, pose) {
  const x = pose.x - 136, y = pose.y - 56;
  const g = el('g', { transform: `translate(${x.toFixed(0)},${y.toFixed(0)})` }, S.depthG);
  el('path', { d: rr(-6, -8, 92, 84, 9), fill: 'rgba(14,18,24,.86)', stroke: 'rgba(255,255,255,.1)' }, g);
  el('path', { d: 'M8,6V63', stroke: '#4a5361', 'stroke-width': 1 }, g);
  for (let i = 0; i < 4; i++) {
    const on = i === w.depth;
    el('circle', { cx: 8, cy: 6 + i * 19, r: on ? 5 : 3.4, fill: on ? '#8b84ff' : '#4a5361' }, g);
    txt(g, DEPTHS[i], { x: 20, y: 10 + i * 19, 'font-size': 11.5, fill: on ? '#fff' : '#7f8896', 'font-weight': on ? 600 : 400 });
  }
}

// Magnified graduations next to a serological pipette, so volumes can be read.
function magnifier(S, w, t) {
  S.mag.replaceChildren();
  if (!t || t.kind !== 'aid' || !t.sp || !S.pose) return;
  const v = vol(t.sp.liq) / 1000;
  const cx = Math.min(1500, S.pose.x + 110), cy = Math.max(150, S.pose.y - 190);
  const g = el('g', null, S.mag);
  el('circle', { cx, cy, r: 62, fill: '#f2f6f9', stroke: '#2b3540', 'stroke-width': 3 }, g);
  const id = 'magclip';
  const cp = el('clipPath', { id }, g);
  el('circle', { cx, cy, r: 59 }, cp);
  const inner = el('g', { 'clip-path': `url(#${id})` }, g);
  const pxPerMl = 90;
  el('rect', { x: cx - 20, y: cy, width: 40, height: 80, fill: color(t.sp.liq).fill, opacity: v > 0 ? 0.75 : 0 }, inner);
  el('path', { d: `M${cx - 20},${cy}Q${cx},${cy + 7} ${cx + 20},${cy}`, fill: 'none', stroke: '#2b3540', 'stroke-width': 1.6, opacity: v > 0 ? 0.8 : 0 }, inner);
  for (let mm = Math.floor((v - 0.8) * 10) / 10; mm <= v + 0.8; mm += 0.1) {
    const m = Math.round(mm * 10) / 10;
    if (m < 0) continue;
    const y = cy - (m - v) * pxPerMl;
    const major = Math.abs(m - Math.round(m)) < 1e-6, half = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
    el('path', { d: `M${cx - 20},${y.toFixed(1)}h${major ? 24 : half ? 16 : 10}`, stroke: '#1d2530', 'stroke-width': major ? 1.8 : 1.1 }, inner);
    if (major) txt(inner, String(m), { x: cx + 9, y: y + 5, 'font-size': 15, 'font-weight': 700, fill: '#1d2530' });
  }
  txt(g, `${t.sp.size} mL 移液管`, { x: cx, y: cy + 80, 'text-anchor': 'middle', 'font-size': 11, fill: '#2b3540', 'font-weight': 600 });
}

// ---------------------------------------------------------------- hit testing

export function pick(S, w, x, y) {
  S.pointer = { x, y };
  S.ghost = null;
  S.fxHover = null;
  if (!S.st) return null;
  const G = S.G;
  const hi = heldItem(w), ht = heldTool(w);
  const overHud = y > 828 && x < 1080;
  const fxHit = overHud ? null : G.pickFx(x, y, S.st.fxRoots || []);
  if (hi) {
    let best = null, bd = Infinity, bestRect = null;
    const cands = [...(STATIONS[w.station].slots || []), ...TRAY];
    for (const s of cands) {
      if (!s.accepts.includes(hi.cat) || !slotActive(w.level, s)) continue;
      const occ = Object.values(w.items).some((o) => o.at && o.at.slot === s.id && (o.at.st === w.station || (s.kind === 'tray' && o.at.st === 'tray')));
      if (occ) continue;
      let d, rect = null;
      if (s.kind === 'deck' && !S.st.deck3d) continue;
      if (s.kind === 'tray') d = Math.abs(x - s.x) < 36 && y > 836 ? Math.abs(x - s.x) : Infinity;
      else {
        rect = slotRect(S, w.station, s.id);
        if (!rect) continue;
        const cx = (rect.x0 + rect.x1) / 2, w2 = Math.max(40, (rect.x1 - rect.x0) * 0.9);
        d = Math.abs(x - cx) < w2 && y > rect.y0 - 110 && y < rect.y1 + 40 ? Math.abs(x - cx) + Math.abs(y - (rect.y0 + rect.y1) / 2) * 0.3 : Infinity;
      }
      if (d < bd) { bd = d; best = s; bestRect = rect; }
    }
    if (best) {
      const st = best.kind === 'tray' ? 'tray' : w.station;
      S.ghost = best.kind === 'tray' ? { x0: best.x - 34, y0: 840, x1: best.x + 34, y1: 890 } : bestRect;
      return { kind: 'slot', st, slot: best.id };
    }
    if (fxHit) return { kind: 'fx', id: fxHit.id };
    // Nowhere obvious: the nearest free plain spot of this station (never a
    // bath, an instrument or behind a closed door).
    for (const s of STATIONS[w.station].slots || []) {
      if (!s.accepts.includes(hi.cat) || !slotActive(w.level, s) || s.inst || s.env === 'bath' || (s.door && !w.inst[s.door]?.door)) continue;
      if (s.kind === 'deck' && !S.st.deck3d) continue;
      if (Object.values(w.items).some((o) => o.at && o.at.st === w.station && o.at.slot === s.id)) continue;
      const rect = slotRect(S, w.station, s.id);
      if (!rect) continue;
      const d = Math.hypot(x - (rect.x0 + rect.x1) / 2, y - (rect.y0 + rect.y1) / 2);
      if (d < bd) { bd = d; best = s; bestRect = rect; }
    }
    if (best) { S.ghost = bestRect; return { kind: 'slot', st: w.station, slot: best.id }; }
    return null;
  }
  // deck targets: the pointer ray meets the item's top plane; plate-local mm
  for (const b of S.boxes) {
    if (!b.deck || !b.model || x < b.x0 - 20 || x > b.x1 + 20 || y < b.y0 - 20 || y > b.y1 + 20) continue;
    const m = b.model, o = m.obj;
    const hit = G.onPlaneY(x, y, o.localToWorld(tmpV.set(0, m.meta.mouth, 0)).y);
    if (!hit) continue;
    const loc = o.worldToLocal(hit);
    const lmm = loc.x * 1000, dmm = loc.z * 1000;
    if (lmm < -3 || lmm > PLATE2D.w + 3 || dmm < -3 || dmm > PLATE2D.h + 3) continue;
    const it = b.it;
    const tgt = { kind: 'item', id: it.id, deck: true };
    if (it.type === 'res4') {
      const lw = (DECK.w - 30) / 4;
      tgt.lane = Math.max(0, Math.min(3, Math.floor((lmm * DECK.px - 12) / (lw + 2))));
    } else {
      const c = Math.round((lmm - PLATE2D.a1x) / PLATE2D.pitch), r = Math.round((dmm - PLATE2D.a1y) / PLATE2D.pitch);
      tgt.col = Math.max(0, Math.min(11, c)); tgt.row = Math.max(0, Math.min(7, r));
      if (it.wells) tgt.well = tgt.row * 12 + tgt.col;
      if (it.type === 'tipbox') tgt.tip = tgt.row * 12 + tgt.col;
    }
    return tgt;
  }
  if (!ht) for (const b of S.boxes) if (b.tool && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return { kind: 'tool', tool: b.tool };
  if (ht && fxHit && (fxHit.id === 'stand' || fxHit.id === 'waste')) return { kind: 'fx', id: fxHit.id };
  // items: prefer the nearest horizontally among overlapping boxes
  let best = null, bd = Infinity;
  for (const b of S.boxes) {
    if ((b.deck && ht) || b.tool || x < b.x0 || x > b.x1 || y < b.y0 - (ht ? 60 : 0) || y > b.y1) continue;
    const d = Math.abs(x - (b.x0 + b.x1) / 2);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) return { kind: 'item', id: best.id };
  if (fxHit) { S.fxHover = fxHit.id; S.fxLabel = fxHit.label; return { kind: 'fx', id: fxHit.id }; }
  return null;
}

export { channelSlots };

// Screen point of a well on a deck item (for keyboard column nudges).
export function wellScreen(S, id, row, col) {
  const b = S.boxes.find((x) => x.id === id && x.deck);
  if (!b || !b.model) return null;
  return S.G.toScreen(sbsWorld(b.model, ...wellMM(row, col), b.model.meta.mouth));
}
