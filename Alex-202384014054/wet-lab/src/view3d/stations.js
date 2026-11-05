// Alex 202384014054
// Station sets: furniture, instruments, a fixed camera, the 3D position of
// every slot and tool home. build(id, level) → station object (see gl.js).

import * as THREE from 'three';
import { STATIONS } from '../game/layout.js';
import { lightRig } from './gl.js';
import { M, mesh, labelTex } from './mats.js';
import * as I from './instruments.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Unproject a stage point onto a horizontal plane with a given camera.
function unprojector(cam) {
  const c = new THREE.PerspectiveCamera(cam.fov, 1600 / 900, 0.02, 30);
  c.position.set(...cam.pos); c.lookAt(...cam.look); c.updateMatrixWorld(); c.updateProjectionMatrix();
  const rc = new THREE.Raycaster(), pl = new THREE.Plane();
  return (x, y, h = 0) => {
    rc.setFromCamera(new THREE.Vector2((x / 1600) * 2 - 1, 1 - (y / 900) * 2), c);
    pl.set(V(0, 1, 0), -h);
    return rc.ray.intersectPlane(pl, new THREE.Vector3());
  };
}

function place(group, inst, x, y, z, ry = 0) {
  inst.obj.position.set(x, y, z);
  inst.obj.rotation.y = ry;
  group.add(inst.obj);
  return inst;
}

// Gather slot world positions after the group is placed.
function collect(group, insts, extra = {}) {
  group.updateMatrixWorld(true);
  const slots = { ...extra };
  for (const it of insts) for (const [id, p] of Object.entries(it.slots || {})) {
    slots[id] = p.isObject3D ? { node: p } : it.obj.localToWorld(p.clone());
  }
  return slots;
}

// ---------------------------------------------------------------- biosafety cabinet

let outlineTex = null;
function deckOutline() {
  if (outlineTex) return outlineTex;
  const c = document.createElement('canvas'); c.width = 552; c.height = 380;
  const g = c.getContext('2d'); g.strokeStyle = 'rgba(70,80,92,.85)'; g.lineWidth = 5; g.setLineDash([26, 18]);
  g.beginPath(); g.roundRect ? g.roundRect(6, 6, 540, 368, 22) : g.rect(6, 6, 540, 368); g.stroke();
  outlineTex = new THREE.CanvasTexture(c); outlineTex.colorSpace = THREE.SRGBColorSpace;
  return outlineTex;
}

export const DECK3D = [[0.19, -0.37], [0.37, -0.37], [0.55, -0.37], [0.19, -0.2], [0.37, -0.2], [0.55, -0.2]];

function bsc() {
  // Seen as you sit at the cabinet: the whole work surface through the sash.
  // Bottles, racks and pipettes live on the left half; plates, the reservoir
  // and tip boxes stand on the right half (the deck, d1–d6). A second camera
  // leans in over the deck so single wells can be targeted (V, or automatic
  // while a pipette or plate is held over it).
  const cam = { pos: [0.0, 0.6, 0.95], look: [0.0, 0.07, -0.3], fov: 41 };
  const cams = { all: cam, deck: { pos: [0.37, 0.56, -0.04], look: [0.37, 0, -0.29], fov: 34 } };
  const g = new THREE.Group();
  const rig = lightRig(g, { key: [0.4, 2.2, 1.4], target: [-0.3, 0, -0.25], intensity: 1.5, hemi: 0.55, shadowBox: 1 });
  const cab = I.bscCabinet();
  g.add(cab.obj);
  const surround = mesh(new THREE.PlaneGeometry(6, 3), M.enamel(0xd5dbe1), { cast: false }); surround.position.set(0, 1, -0.7); g.add(surround);
  const zb = -0.27, zf = -0.05;
  const slots = {
    k1: V(-0.6, 0, zb), k2: V(-0.47, 0, zb), k3: V(-0.35, 0, zb), k4: V(-0.25, 0, zb), k5: V(-0.17, 0, zb),
    f1: V(-0.64, 0, zf), f2: V(-0.08, 0, zf),
  };
  // deck positions (SBS footprint centres): d1–d3 back row, d4–d6 front row
  DECK3D.forEach((p, i) => {
    slots[`d${i + 1}`] = V(p[0], 0, p[1]);
    // a faint etched outline, not a sheet: real cabinets have a plain steel deck
    const pad = mesh(new THREE.PlaneGeometry(0.138, 0.095), new THREE.MeshBasicMaterial({ map: deckOutline(), transparent: true, opacity: 0.32, depthWrite: false }), { cast: false });
    pad.rotation.x = -Math.PI / 2; pad.position.set(p[0], 0.0004, p[1]); pad.userData.noPick = true; g.add(pad);
    const tag = mesh(new THREE.PlaneGeometry(0.028, 0.012), new THREE.MeshBasicMaterial({ map: labelTex([`D${i + 1}`], { w: 160, h: 64, bg: '#00000000', fg: '#4b545e' }), transparent: true, depthWrite: false }), { cast: false });
    tag.rotation.x = -Math.PI / 2; tag.position.set(p[0] - 0.052, 0.0008, p[1] + 0.056); tag.userData.noPick = true; g.add(tag);
  });
  const insts = [cab];
  const rack = (ids, x, pitch, ep) => {
    const r = I.tubeRack(ids, { pitch, hole: ep ? 0.0062 : 0.0095, h: ep ? 0.032 : 0.075, ep });
    place(g, r, x, 0, zf);
    insts.push(r);
  };
  rack(['r1', 'r2', 'r3', 'r4'], -0.45, 0.042, false);
  rack(['e1', 'e2', 'e3', 'e4', 'e5'], -0.25, 0.026, true);
  const waste = I.tipWaste(true);
  place(g, waste, -0.05, 0, -0.33);
  // pipette stand at the back left, tools hanging tip-down
  const xs = [-0.08, -0.035, 0.01, 0.06, 0.115];
  const st = I.pipetteStand(xs, { h: 0.36 });
  place(g, st, -0.6, 0, -0.47);
  const toolHome = {};
  ['p20', 'p200', 'p1000', 'mc20', 'mc200'].forEach((id, i) => { toolHome[id] = { pos: V(-0.6 + xs[i] + (id.startsWith('mc') ? 0.012 : 0), 0.06, -0.455), rot: 0 }; });
  toolHome.vac = { pos: V(-0.71, 0.03, -0.2), rot: 0.2 };
  toolHome.aid = { pos: V(-0.14, 0.02, -0.45), rot: -0.2 };
  const all = collect(g, insts, slots);
  return {
    id: 'bsc', group: g, cam, cams, slots: all, toolHome, rig, deck3d: true, cab,
    fxRoots: [cab.obj, waste.obj, st.obj],
    update(w, dt) {
      for (const i of insts) i.update(w, dt);
      const k = 1 - 0.93 * (cab.obj.userData.uvK || 0);
      rig.key.intensity = (w.bsc.light ? 1.5 : 0.5) * k; rig.hemi.intensity = (w.bsc.light ? 0.55 : 0.25) * k;
    },
    uvGlow: () => cab.obj.userData.uvK || 0,
  };
}

// ---------------------------------------------------------------- bench

const BX = (x2d) => (x2d - 800) * 0.00112;
function bench(level) {
  // aimed at the instruments on the bench top rather than the cabinets below
  const cam = { pos: [0, 0.8, 1.72], look: [0, 0.1, -0.1], fov: 34 };
  const g = new THREE.Group();
  const rig = lightRig(g, { key: [0.8, 2.6, 1.8], target: [0, 0, -0.15], intensity: 2.0, hemi: 0.6, shadowBox: 1.3 });
  g.add(I.benchRoom({ width: 2.8 }));
  const has = (k) => !level?.benchFixtures || level.benchFixtures.includes(k);
  const insts = [], fxRoots = [];
  const add = (inst, x, z, ry = 0) => { place(g, inst, x, 0, z, ry); insts.push(inst); fxRoots.push(inst.obj); return inst; };
  if (has('balance')) add(I.balance(), -0.76, -0.17);
  if (has('centrifuge')) add(I.centrifuge(), -0.37, -0.2);
  if (has('scope')) add(I.microscope(), 0.06, -0.15);
  if (has('bath')) add(I.waterBath(), 0.47, -0.16);
  if (has('vortex')) add(I.vortex(), 0.77, -0.05);
  if (has('rack')) add(I.tubeRack(['b1', 'b2', 'b3', 'b4'], { pitch: 34 * 0.00112 }), 0.95, -0.02);
  add(I.tipWaste(false), has('balance') ? -0.97 : -0.84, -0.2);
  const toolHome = {};
  if (has('stand')) {
    const xs = [1430, 1470, 1510].map((x) => BX(x) - BX(1470));
    add(I.pipetteStand(xs, { h: 0.34 }), BX(1470), -0.3);
    ['p20', 'p200', 'p1000'].forEach((id, i) => { toolHome[id] = { pos: V(BX(1470) + xs[i], 0.05, -0.285), rot: 0 }; });
  }
  const slots = {};
  for (const s of STATIONS.bench.slots) {
    if (s.inst || s.env === 'bath' || s.kind === 'rack15' || s.off) continue;
    slots[s.id] = V(BX(s.x), 0, 0.02);
  }
  // a free spot must not sit inside an instrument: slide it sideways into the nearest gap
  g.updateMatrixWorld(true);
  const boxes = insts.map((i) => new THREE.Box3().setFromObject(i.obj));
  const hit = (x, z) => boxes.some((b) => x > b.min.x - 0.05 && x < b.max.x + 0.05 && z > b.min.z - 0.04 && z < b.max.z + 0.04);
  for (const v of Object.values(slots)) {
    if (!hit(v.x, v.z)) continue;
    let best = null;
    for (let d = 0.01; d < 0.6 && !best; d += 0.01) for (const x of [v.x + d, v.x - d]) if (!best && !hit(x, v.z) && Math.abs(x) < 1.2 && !Object.values(slots).some((o) => o !== v && Math.abs(o.x - x) < 0.09)) best = x;
    if (best != null) v.x = best; else v.z = Math.max(...boxes.map((b) => b.max.z)) + 0.06;
  }
  return {
    id: 'bench', group: g, cam, slots: collect(g, insts, slots), toolHome, rig, fxRoots,
    update(w, dt) { for (const i of insts) i.update(w, dt); },
  };
}

// ---------------------------------------------------------------- incubator

function incubator() {
  // framed so the door and the front display (°C / CO₂ / RH) both clear the top bar
  const cam = { pos: [0.02, 0.62, 1.78], look: [0.02, 0.5, -0.1], fov: 34 };
  const g = new THREE.Group();
  const rig = lightRig(g, { key: [0.9, 2.4, 1.8], target: [0, 0.3, -0.2], intensity: 1.8, hemi: 0.6 });
  const room = I.benchRoom({ width: 3, shelf: false });
  g.add(room);
  const ids = [0, 1, 2].map((s) => [0, 1, 2, 3].map((i) => `i${(2 - s) * 4 + i + 1}`));
  const inc = I.incubator(ids, 4);
  place(g, inc, 0, 0, 0.1);
  return { id: 'incubator', group: g, cam, slots: collect(g, [inc]), toolHome: {}, rig, fxRoots: [inc.obj], update(w, dt) { inc.update(w, dt); } };
}

// ---------------------------------------------------------------- fridge & freezer

function fridges() {
  const cam = { pos: [0.0, 0.6, 2.2], look: [0.0, 0.5, -0.1], fov: 34 };
  const g = new THREE.Group();
  const rig = lightRig(g, { key: [0.4, 2.6, 2.2], target: [0, 0.4, -0.2], intensity: 1.8, hemi: 0.6 });
  g.add(I.benchRoom({ width: 3.4, shelf: false }));
  const fr = I.fridge('fridge', [0, 1, 2].map((s) => [0, 1, 2].map((i) => `c${(2 - s) * 3 + i + 1}`)), 3);
  const fz = I.fridge('freezer', [0, 1].map((s) => [0, 1, 2, 3].map((i) => `z${(1 - s) * 4 + i + 1}`)), 4);
  place(g, fr, -0.42, 0, 0.12);
  place(g, fz, 0.4, 0, 0.12);
  return { id: 'fridge', group: g, cam, slots: collect(g, [fr, fz]), toolHome: {}, rig, fxRoots: [fr.obj, fz.obj], update(w, dt) { fr.update(w, dt); fz.update(w, dt); } };
}

// ---------------------------------------------------------------- reader

function reader(level, opts = {}) {
  const drawAnalysis = opts.drawAnalysis || idleAnalysis;
  const cam = { pos: [0, 0.58, 1.5], look: [0, 0.2, -0.1], fov: 34 };
  const g = new THREE.Group();
  const rig = lightRig(g, { key: [0.8, 2.6, 1.8], target: [0, 0, -0.15], intensity: 2.0, hemi: 0.6 });
  g.add(I.benchRoom({ width: 2.8 }));
  const rd = I.plateReader();
  place(g, rd, -0.35, 0, -0.18);
  const pc = I.monitor('computer', '数据分析电脑', drawAnalysis);
  place(g, pc, 0.36, 0, -0.2);
  const slots = { rf1: V(BX(200) - 0.05, 0, 0.05), rf2: V(BX(640) + 0.12, 0, 0.08) };
  return { id: 'reader', group: g, cam, slots: collect(g, [rd, pc], slots), toolHome: {}, rig, fxRoots: [rd.obj, pc.obj], screens: { computer: pc.scr }, update(w, dt) { rd.update(w, dt); } };
}

function idleAnalysis(g, W, H) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#162030'); bg.addColorStop(1, '#0d131c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1c2633'; g.fillRect(0, 0, W, 54);
  g.fillStyle = '#dfe6ee'; g.font = '600 26px "PingFang SC","Noto Sans SC",sans-serif'; g.fillText('Dose–Response Studio · 剂量反应分析', 24, 36);
  ['#ff6262', '#f3b64a', '#3fd18f'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(W - 30 - i * 30, 27, 8, 0, 7); g.fill(); });
  g.strokeStyle = '#3a4552'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 120); g.lineTo(120, 620); g.lineTo(1180, 620); g.stroke();
  const curve = (col, x0) => { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= 1060; x += 10) { const u = (x - x0) / 120; g.lineTo(120 + x, 160 + 440 / (1 + Math.exp(-u))); } g.stroke(); };
  curve('#8b84ff', 430); curve('#e06478', 720);
  g.fillStyle = '#e9edf3'; g.font = '600 30px "PingFang SC","Noto Sans SC",sans-serif'; g.textAlign = 'center'; g.fillText('点击打开分析软件', W / 2, 700);
}

const BUILDERS = { bsc, bench, incubator, fridge: fridges, reader };
export function registerStation(id, fn) { BUILDERS[id] = fn; }

export function buildStation(id, level, opts = {}) {
  const f = BUILDERS[id];
  return f(level, opts);
}

export { V, unprojector, place, collect, BX };
