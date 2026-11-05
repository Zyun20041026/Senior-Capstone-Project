// Alex 202384014054
// 3D models for every item type. Each builder returns
//   { obj, meta, update(it, w) }
// obj: a THREE.Group with its origin at the base centre (SBS-footprint items:
// at the A1 corner, see SBS below); meta (local metres): mouth (y of the
// opening), bottom (inner floor), level(v µL) → y of the liquid surface,
// mouthAt: [x, z] of the opening, tilt (rad) for how a tool enters.

import * as THREE from 'three';
import { M, lathe, mesh, liquidMat, setLiquid, labelTex, gradTex, rbox, contactShadow } from './mats.js';
import { vol, color } from '../sim/liquid.js';
import { formazanOf } from '../view/art.js';
import { wellSig } from '../view/liquidSig.js';
import { SBS_H, WELL_DEPTH, levelOf, plateMeta } from '../view/wellGeom.js';

const mm = (v) => v / 1000;
export const PLATE = { w: 127.76, h: 85.48, a1x: 14.38, a1y: 11.24, pitch: 9 };
// Small things keep their real size; this factor enlarges their hit area
// (scene.js) so they stay easy to tap.
export const DISPLAY_SCALE = { ep: 1.7, vial: 1.55, kit: 1.35, hemo: 1.25, boat: 1.35, pcrtube: 2.4, column: 1.7, biopsy: 1.7 };

const CAP = { blue: 0x2f6fd6, orange: 0xf08a2c, white: 0xf3f4f5, red: 0xd93a43, green: 0x2fa36b, purple: 0x7a5cf0, yellow: 0xf2c94c, black: 0x23262b };
const capMat = (c) => M.plastic(CAP[c] ?? CAP.blue, 0.42);

// ---------------------------------------------------------------- volume profiles

// Inner profile [[r, y]] in mm (ascending y) → level(vµL) in metres.
function levelFn(inner) {
  const cum = [0];
  for (let i = 1; i < inner.length; i++) {
    const [r0, y0] = inner[i - 1], [r1, y1] = inner[i];
    cum.push(cum[i - 1] + (Math.PI * (y1 - y0) * (r0 * r0 + r0 * r1 + r1 * r1)) / 3);
  }
  return (v) => {
    if (v <= 0) return mm(inner[0][1]);
    for (let i = 1; i < inner.length; i++) {
      if (v <= cum[i] || i === inner.length - 1) {
        const [r0, y0] = inner[i - 1], [r1, y1] = inner[i];
        let lo = 0, hi = 1;
        for (let k = 0; k < 24; k++) {
          const m = (lo + hi) / 2, r = r0 + (r1 - r0) * m, h = (y1 - y0) * m;
          const part = (Math.PI * h * (r0 * r0 + r0 * r + r * r)) / 3;
          if (cum[i - 1] + part < v) lo = m; else hi = m;
        }
        return mm(y0 + (y1 - y0) * Math.min(1, lo));
      }
    }
    return mm(inner[inner.length - 1][1]);
  };
}
function radiusAt(inner, ymm) {
  for (let i = 1; i < inner.length; i++) {
    const [r0, y0] = inner[i - 1], [r1, y1] = inner[i];
    if (ymm <= y1) return r0 + ((r1 - r0) * (ymm - y0)) / Math.max(1e-6, y1 - y0);
  }
  return inner[inner.length - 1][0];
}

// A liquid body that refills the inner profile up to the level.
function liquidBody(inner, seg = 32) {
  const mat = liquidMat();
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  m.renderOrder = 2;
  let lastY = -1;
  return {
    mesh: m, mat,
    set(ymm, c) {
      setLiquid(mat, c);
      m.visible = ymm > inner[0][1] + 0.05;
      if (!m.visible || Math.abs(ymm - lastY) < 0.08) return;
      lastY = ymm;
      const pts = [[0, inner[0][1]]];
      for (const p of inner) { if (p[1] >= ymm) break; pts.push([Math.max(0.01, p[0] - 0.15), p[1]]); }
      pts.push([Math.max(0.01, radiusAt(inner, ymm) - 0.15), ymm], [0, ymm]);
      m.geometry.dispose();
      m.geometry = lathe(pts, seg);
    },
  };
}

// A sticker on the front of a cylinder.
function sticker(r, y0, y1, theta = 1.7) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, transparent: true });
  const g = new THREE.CylinderGeometry(mm(r), mm(r), mm(y1 - y0), 24, 1, true, -theta / 2, theta);
  const m = mesh(g, mat, { cast: false });
  m.position.y = mm((y0 + y1) / 2);
  let sig = null;
  return {
    mesh: m,
    set(lines, opts = {}) {
      const k = lines.join('|') + JSON.stringify(opts);
      if (k === sig) return;
      sig = k;
      if (mat.map) mat.map.dispose();
      mat.map = labelTex(lines, { w: 384, h: Math.round((384 * (y1 - y0)) / (r * theta)), ...opts });
      mat.needsUpdate = true;
    },
  };
}

function screwCap(r, h, color, ribs = 24) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(mm(r), mm(r), mm(h), ribs * 2, 1), capMat(color));
  body.position.y = mm(h / 2);
  const top = mesh(new THREE.CylinderGeometry(mm(r * 0.94), mm(r), mm(0.8), 40), capMat(color));
  top.position.y = mm(h + 0.2);
  g.add(body, top);
  return g;
}

// ---------------------------------------------------------------- vessels (lathe)

function vessel(it, { outer, inner, wall = M.clearPP(), cap, capColor = 'blue', label, grad, pellet = false, frost = false }) {
  const obj = new THREE.Group();
  const shell = mesh(lathe(outer, 48), wall, { cast: true });
  shell.renderOrder = 3;
  obj.add(shell);
  const liq = liquidBody(inner);
  obj.add(liq.mesh);
  const top = outer[outer.length - 1][1];
  let capG = null;
  if (cap) {
    capG = cap.make(capColor);
    obj.add(capG);
  }
  const st = label ? sticker(outer.find((p) => p[1] >= label[0])?.[0] + 0.25 || outer[1][0] + 0.25, label[0], label[1], label[2] || 1.6) : null;
  if (st) obj.add(st.mesh);
  if (grad) {
    const gm = new THREE.MeshBasicMaterial({ map: gradTex(grad.marks), transparent: true, depthWrite: false });
    const r = grad.r + 0.15;
    const gmesh = new THREE.Mesh(new THREE.CylinderGeometry(mm(r), mm(r), mm(grad.y1 - grad.y0), 16, 1, true, 0.25, 0.7), gm);
    gmesh.position.y = mm((grad.y0 + grad.y1) / 2);
    gmesh.renderOrder = 4;
    obj.add(gmesh);
  }
  let pel = null;
  if (pellet) {
    pel = mesh(new THREE.SphereGeometry(mm(1.6), 16, 10), new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.8, transparent: true }));
    pel.scale.y = 0.6;
    pel.position.y = mm(inner[0][1] + 1);
    obj.add(pel);
  }
  const lev = levelFn(inner);
  return {
    obj,
    meta: { mouth: mm(top), bottom: mm(inner[0][1] + 0.4), level: lev, top: mm(top + (cap ? cap.h : 0)), r: mm(inner[inner.length - 1][0]), mouthAt: [0, 0] },
    update(it2) {
      const v = vol(it2.liq);
      const c = color(it2.liq);
      liq.set(lev(v) * 1000, c);
      if (frost && it2.frozen) { liq.mat.color.set(0xf2f6fa); liq.mat.opacity = 0.9; liq.mat.roughness = 0.8; }
      if (capG) {
        if (it2.open) cap.aside(capG); else { capG.position.set(0, mm(cap.y ?? top - 1), 0); capG.rotation.set(0, 0, 0); }
      }
      if (st) st.set([it2.short || '', it2.short2 || ''].filter(Boolean).length ? [it2.short || '', it2.short2 || ''].filter(Boolean) : [' '], label[3] || {});
      if (pel) { const n = it2.pellet ? it2.pellet.n + it2.pellet.d : 0; pel.visible = n > 2e4; pel.material.opacity = Math.min(0.95, 0.4 + n / 4e6); pel.scale.setScalar(0.6 + Math.min(1, n / 3e6)); pel.scale.y *= 0.6; }
    },
  };
}

const conical = (R, H, cone, wall = 0.8, tipR = 1.3) => ({
  outer: [[0.01, 0], [tipR, 0.4], [R, cone], [R, H]],
  inner: [[0.01, 1.4], [tipR - 0.5, 1.8], [R - wall, cone + 0.4], [R - wall, H - 0.5]],
});

function tube(it, { R, H, cone, capR, capH, gradMax, step, skirt }) {
  const p = conical(R, H, cone);
  if (skirt) p.outer = [[0.01, 0], [R * 0.75, 0], [R * 0.75, 3], [R * 0.4, 3.2], [R, cone], [R, H]];
  const marks = [];
  const lev = levelFn(p.inner);
  for (let m = step; m <= gradMax + 1e-6; m += step) {
    const y = lev(m * 1000) * 1000;
    marks.push([(y - cone) / (H - cone - 2), Math.round(m) === m && (m % (step * 2) === 0 || gradMax <= 15), Math.round(m) === m && m % (gradMax > 20 ? 10 : 5) === 0 ? String(m) : '']);
  }
  const cap = { h: capH, y: H - 2, make: (c) => screwCap(capR, capH, c), aside: null };
  const v = vessel(it, {
    ...p, cap, capColor: it.cap || 'blue', pellet: true,
    label: [H * 0.52, H * 0.82, 1.5],
    grad: { r: R, y0: cone, y1: H - 2, marks: marks.filter((m) => m[0] >= 0 && m[0] <= 1) },
  });
  cap.aside = (g) => { g.position.set(mm(R + capR + 5), mm(capH), 0); g.rotation.set(Math.PI, 0, 0); };
  return v;
}

function ep(it, { R = 5.4, H = 39, cone = 18 } = {}) {
  const p = conical(R, H, cone, 0.6, 0.9);
  p.outer.push([R + 0.9, H], [R + 0.9, H + 1.6], [R - 0.6, H + 1.6]);
  const obj = vessel(it, { ...p, wall: M.clearPP(), label: [cone + 4, H - 6, 1.6] });
  // hinged lid
  const lidMat = it.cap ? capMat(it.cap) : M.frostPP();
  const lid = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(mm(R + 0.6), mm(R + 0.6), mm(2.4), 32), lidMat);
  disc.position.set(mm(R + 0.6), mm(1.2), 0);
  const plug = mesh(new THREE.CylinderGeometry(mm(R - 0.7), mm(R - 0.9), mm(3), 24), lidMat);
  plug.position.set(mm(R + 0.6), mm(-1.2), 0);
  lid.add(disc, plug);
  const hinge = new THREE.Group();
  hinge.position.set(mm(-R - 0.6), mm(H + 1.6), 0);
  lid.position.x = 0;
  hinge.add(lid);
  lid.position.set(0, 0, 0);
  obj.obj.add(hinge);
  const up = obj.update;
  obj.update = (it2) => { up(it2); hinge.rotation.z = it2.open ? 1.9 : 0; };
  obj.meta.top = mm(H + 4);
  return obj;
}

function bottle(it, { R, H, shoulder, neckR, capR, capH }) {
  const outer = [[0.01, 0], [R - 3, 0], [R, 3], [R, shoulder], [R * 0.82, shoulder + (H - shoulder) * 0.4], [neckR + 1.5, H - 12], [neckR, H - 10], [neckR, H]];
  const inner = [[0.01, 3], [R - 4, 3], [R - 1.6, 5], [R - 1.6, shoulder], [R * 0.82 - 1.6, shoulder + (H - shoulder) * 0.4], [neckR - 0.5, H - 12], [neckR - 1.5, H - 10], [neckR - 1.5, H - 0.5]];
  const cap = { h: capH, y: H - 8, make: (c) => screwCap(capR, capH, c, 36) };
  const v = vessel(it, { outer, inner, wall: M.glass(), cap, capColor: it.cap || 'blue', label: [shoulder * 0.18, shoulder * 0.86, 1.9, { band: it.band || '#2e5fb8' }] });
  cap.aside = (g) => { g.position.set(mm(R + capR + 6), mm(capH), 0); g.rotation.set(Math.PI, 0, 0); };
  // pouring ring
  const ring = mesh(new THREE.TorusGeometry(mm(capR + 0.6), mm(1.6), 10, 40), M.plastic(CAP[it.cap || 'blue'], 0.45));
  ring.rotation.x = Math.PI / 2; ring.position.y = mm(H - 12);
  v.obj.add(ring);
  // condensation drops when wet
  const drops = new THREE.Group();
  const dm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2.5 });
  for (let i = 0; i < 26; i++) {
    const a = -0.9 + (i * 0.37) % 1.8, y = 8 + ((i * 53) % Math.round(shoulder - 12));
    const d = mesh(new THREE.SphereGeometry(mm(1 + (i % 3) * 0.5), 8, 6), dm, { cast: false });
    d.position.set(Math.sin(a) * mm(R + 0.4), mm(y), Math.cos(a) * mm(R + 0.4));
    d.scale.z = 0.4;
    d.lookAt(0, mm(y), 0);
    drops.add(d);
  }
  v.obj.add(drops);
  const up = v.update;
  v.update = (it2) => { up(it2); drops.visible = !!it2.wet; };
  return v;
}

function vial(it, { R = 6.2, H = 44, amber = true, capColor }) {
  const outer = [[0.01, 0], [R - 1, 0], [R, 1], [R, H]];
  const inner = [[0.01, 1.2], [R - 1.6, 1.2], [R - 0.8, 2], [R - 0.8, H - 0.5]];
  const wall = amber ? new THREE.MeshPhysicalMaterial({ color: 0x8a4a12, roughness: 0.15, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false }) : M.clearPP();
  const cap = { h: 8, y: H - 1, make: (c) => screwCap(R + 0.7, 8, c, 18) };
  const v = vessel(it, { outer, inner, wall, cap, capColor: capColor || it.cap || 'white', label: [H * 0.3, H * 0.78, 1.8], frost: true });
  cap.aside = (g) => { g.position.set(mm(R * 2 + 5), mm(8), 0); g.rotation.set(Math.PI, 0, 0); };
  return v;
}

function beaker(it) {
  const R = 25, H = 70;
  const outer = [[0.01, 0], [R - 2, 0], [R, 2], [R, H], [R + 1.2, H + 1.2]];
  const inner = [[0.01, 2], [R - 3, 2], [R - 1, 4], [R - 1, H - 1]];
  return vessel(it, { outer, inner, wall: M.glass(), grad: { r: R, y0: 4, y1: H - 6, marks: [1, 2, 3, 4].map((k) => [k / 4.2, true, `${k * 20}`]) } });
}

// ---------------------------------------------------------------- flask (T25, lying flat)

function flask(it) {
  const L = 104, Wd = 58, Ht = 26; // body length (x), width (z), height (y)
  const obj = new THREE.Group();
  const body = mesh(rbox(mm(L), mm(Ht), mm(Wd), mm(3)), M.clearPP());
  body.position.set(mm(-12), mm(Ht / 2), 0);
  body.renderOrder = 3;
  obj.add(body);
  // canted neck rising towards +x
  const neck = new THREE.Group();
  neck.position.set(mm(-12 + L / 2 - 2), mm(Ht * 0.62), 0);
  neck.rotation.z = -0.62;
  const nk = mesh(new THREE.CylinderGeometry(mm(10), mm(12), mm(22), 32, 1, true), M.clearPP());
  nk.rotation.z = Math.PI / 2; nk.position.x = mm(10);
  nk.renderOrder = 3;
  neck.add(nk);
  obj.add(neck);
  const capG = screwCap(12.5, 11, it.cap || 'blue', 20);
  const capHome = () => { neck.add(capG); capG.position.set(mm(20), 0, 0); capG.rotation.set(0, 0, -Math.PI / 2); };
  capHome();
  // filter dot on vented caps
  const vent = mesh(new THREE.CylinderGeometry(mm(6), mm(6), mm(0.6), 24), M.white());
  vent.position.y = mm(11.6); capG.add(vent);
  // medium pool and cell sheet on the growth surface
  const pool = mesh(new THREE.BoxGeometry(mm(L - 6), 1, mm(Wd - 6)), liquidMat(), { cast: false });
  pool.renderOrder = 2;
  obj.add(pool);
  const sheet = mesh(new THREE.PlaneGeometry(mm(L - 10), mm(Wd - 10)), new THREE.MeshStandardMaterial({ color: 0xf5ece4, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false }), { cast: false });
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(mm(-12), mm(1.3), 0);
  obj.add(sheet);
  // label on the top face
  const labMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const lab = mesh(new THREE.PlaneGeometry(mm(54), mm(18)), labMat, { cast: false });
  lab.rotation.x = -Math.PI / 2; lab.position.set(mm(-26), mm(Ht + 0.2), mm(6));
  obj.add(lab);
  let sig = null;
  const mouth = new THREE.Vector3(mm(-12 + L / 2 - 2 + Math.cos(0.62) * 30), mm(Ht * 0.62 + Math.sin(0.62) * 30), 0);
  return {
    obj,
    meta: { mouth: mouth.y, mouthAt: [mouth.x, 0], bottom: mm(1.6), level: (v) => mm(1.4 + Math.min(14, v / 2900)), top: mouth.y + mm(10), tilt: 0.55, flask: true },
    update(it2) {
      const v = vol(it2.liq);
      const c = color(it2.liq);
      const d = Math.min(14, v / 2900);
      pool.visible = v > 30;
      setLiquid(pool.material, c);
      pool.scale.y = mm(Math.max(0.3, d));
      pool.position.set(mm(-12), mm(1.3 + Math.max(0.3, d) / 2), 0);
      const cells = it2.layer ? it2.layer.n : 0;
      sheet.material.opacity = Math.min(0.55, cells / 5e6);
      if (it2.open) { obj.add(capG); capG.position.set(mm(40), mm(11), mm(-44)); capG.rotation.set(Math.PI, 0, 0); } else capHome();
      const k = `${it2.short}|${it2.short2}`;
      if (k !== sig) { sig = k; if (labMat.map) labMat.map.dispose(); labMat.map = labelTex([it2.short || 'T25', it2.short2 || ''].filter(Boolean), { w: 384, h: 128 }); labMat.needsUpdate = true; }
    },
  };
}

// ---------------------------------------------------------------- SBS footprint (plates, reservoirs, tip boxes)
// Origin at the plate's top-left (A1) corner on the base; +x along columns,
// +z along rows (so a top-down camera with up = −z shows A1 top-left).

export const wellXZ = (r, c) => [mm(PLATE.a1x + c * PLATE.pitch), mm(PLATE.a1y + r * PLATE.pitch)];
// Plate height and the shared well geometry live in view/wellGeom.js.

// A real 96-well plate: a deck pierced by 96 wells (Ø 6.4 mm, 10.6 mm deep)
// over a solid base, in clear polystyrene. U-bottom plates get a
// hemispherical floor in each well. Geometry is shared per plate type.
const WR = 3.2, TOP = SBS_H - 0.3, FLOOR_MM = TOP - WELL_DEPTH;
const plateGeo = {};
function plateGeometry(u) {
  const k = u ? 'u' : 'f';
  if (plateGeo[k]) return plateGeo[k];
  const W = PLATE.w, H = PLATE.h, r = 3;
  const sh = new THREE.Shape();
  sh.moveTo(r, 0); sh.lineTo(W - r, 0); sh.quadraticCurveTo(W, 0, W, -r); sh.lineTo(W, -H + r); sh.quadraticCurveTo(W, -H, W - r, -H);
  sh.lineTo(r, -H); sh.quadraticCurveTo(0, -H, 0, -H + r); sh.lineTo(0, -r); sh.quadraticCurveTo(0, 0, r, 0);
  for (let i = 0; i < 96; i++) {
    const x = PLATE.a1x + (i % 12) * PLATE.pitch, y = -(PLATE.a1y + Math.floor(i / 12) * PLATE.pitch);
    const h = new THREE.Path(); h.absarc(x, y, WR, 0, Math.PI * 2, true); sh.holes.push(h);
  }
  const deck = new THREE.ExtrudeGeometry(sh, { depth: WELL_DEPTH, bevelEnabled: false, curveSegments: 18 });
  deck.scale(0.001, 0.001, 0.001); deck.rotateX(-Math.PI / 2); deck.translate(0, mm(FLOOR_MM), 0);
  const base = rbox(mm(W), mm(H), mm(FLOOR_MM), mm(r));
  base.rotateX(-Math.PI / 2); base.translate(mm(W / 2), mm(FLOOR_MM / 2), mm(H / 2));
  plateGeo[k] = { deck, base };
  return plateGeo[k];
}
// Clear tissue-culture polystyrene: glossy, slightly bluish, see-through.
const psMat = () => new THREE.MeshPhysicalMaterial({ color: 0xeef3f8, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4, specularIntensity: 0.9 });

function plateBody(white = false) {
  const g = new THREE.Group();
  const body = mesh(rbox(mm(PLATE.w), mm(PLATE.h), mm(SBS_H), mm(3)), white ? M.white() : psMat());
  body.rotation.x = -Math.PI / 2;
  body.position.set(mm(PLATE.w / 2), mm(SBS_H / 2), mm(PLATE.h / 2));
  g.add(body);
  return g;
}

function plate(it) {
  const u = it.type === 'uplate';
  const obj = new THREE.Group();
  const geo = plateGeometry(u);
  const ps = psMat();
  const deck = mesh(geo.deck, ps), base = mesh(geo.base, ps);
  obj.add(deck, base);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  // U floors: the lower half of a sphere in each well, seen from inside
  if (u) {
    const bowl = new THREE.InstancedMesh(new THREE.SphereGeometry(mm(WR), 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xe9eef3, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide }), 96);
    for (let i = 0; i < 96; i++) { const [x, z] = wellXZ(Math.floor(i / 12), i % 12); m4.compose(p.set(x, mm(FLOOR_MM + WR), z), q.identity(), s.set(1, 1, 1)); bowl.setMatrixAt(i, m4); }
    bowl.receiveShadow = true; obj.add(bowl);
  }
  // liquid: the column (open tube), a lens-shaped bottom in U wells, and a
  // meniscus that climbs ~0.5 mm up the wall (water wets polystyrene)
  const LR = WR - 0.05;
  const lm = new THREE.MeshPhysicalMaterial({ roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide });
  const col = new THREE.InstancedMesh(new THREE.CylinderGeometry(mm(LR), mm(LR), 1, 28, 1, true), lm, 96);
  const men = new THREE.InstancedMesh(lathe(Array.from({ length: 9 }, (_, k) => { const rr = (LR * k) / 8; return [rr, 0.5 * (rr / LR) ** 4]; }), 28), lm, 96);
  const lens = u ? new THREE.InstancedMesh(new THREE.SphereGeometry(mm(LR), 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lm, 96) : null;
  const cellsM = new THREE.InstancedMesh(new THREE.CircleGeometry(mm(2.9), 24), new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }), 96);
  col.renderOrder = men.renderOrder = 3; if (lens) lens.renderOrder = 3; cellsM.renderOrder = 2;
  col.name = 'liquid'; men.name = 'meniscus';
  obj.add(col, men, cellsM); if (lens) obj.add(lens);
  const lid = mesh(rbox(mm(PLATE.w + 3), mm(PLATE.h + 3), mm(1.4), mm(3)), M.glassTint(), { cast: false });
  lid.rotation.x = -Math.PI / 2; lid.position.set(mm(PLATE.w / 2), mm(SBS_H + 3), mm(PLATE.h / 2));
  lid.renderOrder = 5;
  obj.add(lid);
  const cc = new THREE.Color();
  const hide = (im, i) => { m4.compose(p.set(0, 0, 0), q.identity(), s.set(1e-6, 1e-6, 1e-6)); im.setMatrixAt(i, m4); };
  let sig = '';
  return {
    obj,
    meta: plateMeta(it.type),
    update(it2) {
      lid.visible = !it2.open;
      let k = '';
      for (let i = 0; i < 96; i++) k += wellSig(it2.wells[i]);
      if (k === sig) return;
      sig = k;
      for (let i = 0; i < 96; i++) {
        const wl = it2.wells[i];
        const v = vol(wl.liq);
        const [x, z] = wellXZ(Math.floor(i / 12), i % 12);
        const h = levelOf(it2.type, v); // mm above the floor, the shared curve
        const c = color(wl.liq, { formazan: formazanOf(wl) });
        const mt = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.fill);
        cc.setRGB(mt[1] / 255, mt[2] / 255, mt[3] / 255, THREE.SRGBColorSpace);
        if (!(v > 0.5)) { hide(col, i); hide(men, i); if (lens) hide(lens, i); }
        else {
          const lensH = u ? Math.min(h, WR) : 0, colH = Math.max(0, h - lensH);
          if (lens) { m4.compose(p.set(x, mm(FLOOR_MM + WR), z), q.identity(), s.set(1, Math.max(1e-3, lensH / WR), 1)); lens.setMatrixAt(i, m4); lens.setColorAt(i, cc); }
          const y0 = FLOOR_MM + (u ? WR : 0);
          if (colH > 0.01) { m4.compose(p.set(x, mm(y0 + colH / 2), z), q.identity(), s.set(1, mm(colH), 1)); col.setMatrixAt(i, m4); } else hide(col, i);
          col.setColorAt(i, cc);
          const mr = u && h < WR ? Math.sqrt(Math.max(0, WR * WR - (WR - h) ** 2)) / LR : 1; // meniscus shrinks in the U bowl
          m4.compose(p.set(x, mm(FLOOR_MM + h - 0.25 * mr), z), q.identity(), s.set(mr, 1, mr)); men.setMatrixAt(i, m4); men.setColorAt(i, cc);
        }
        const n = wl.n + (wl.liq.c.cells || 0);
        m4.compose(p.set(x, mm(FLOOR_MM + 0.05), z), qx, s.setScalar(n > 200 ? Math.min(1, 0.4 + n / 30000) : 0.0001));
        cellsM.setMatrixAt(i, m4);
      }
      for (const im of [col, men, lens, cellsM]) if (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    },
  };
}

function reservoir(it) {
  const obj = plateBody(true);
  const lw = (PLATE.w - 13) / 4;
  const lanes = [];
  for (let k = 0; k < 4; k++) {
    const x = 5.2 + k * (lw + 0.87) + lw / 2;
    const trough = mesh(rbox(mm(lw - 1.7), mm(PLATE.h - 10.4), mm(0.8), mm(3)), M.plastic(0xdfe5eb, 0.3), { cast: false });
    trough.rotation.x = -Math.PI / 2; trough.position.set(mm(x), mm(SBS_H + 0.1), mm(PLATE.h / 2));
    const lq = mesh(rbox(mm(lw - 3), mm(PLATE.h - 13), 1, mm(2.6)), liquidMat(), { cast: false });
    lq.rotation.x = -Math.PI / 2; lq.renderOrder = 2;
    obj.add(trough, lq);
    lanes.push({ lq, x });
  }
  return {
    obj,
    meta: { sbs: true, mouth: mm(SBS_H), bottom: mm(2), level: () => mm(SBS_H - 4), top: mm(SBS_H + 2) },
    update(it2) {
      it2.lanes.forEach((l, k) => {
        const v = vol(l), L = lanes[k];
        L.lq.visible = v > 1;
        setLiquid(L.lq.material, color(l));
        const h = Math.min(0.5, 0.15 + v / 60000) * SBS_H;
        L.lq.scale.z = mm(h);
        L.lq.position.set(mm(L.x), mm(SBS_H + 0.3 + h / 2), mm(PLATE.h / 2));
      });
    },
  };
}

const TIP_COL = { white: 0xf4f6f8, yellow: 0xf7cf3a, blue: 0x4f86f0 };
function tipbox(it) {
  const obj = new THREE.Group();
  // Real tip racks: a moulded polypropylene box (opaque, colour-coded), a
  // perforated rack plate the tips hang in, and a hinged clear lid.
  const tint = { white: 0xdfe4ea, yellow: 0xe9c25a, blue: 0x5f8fe6 }[it.color];
  const base = mesh(rbox(mm(PLATE.w), mm(PLATE.h), mm(40), mm(4)), new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }));
  base.rotation.x = -Math.PI / 2; base.position.set(mm(PLATE.w / 2), mm(20), mm(PLATE.h / 2));
  const rack = mesh(rbox(mm(PLATE.w - 4), mm(PLATE.h - 4), mm(2), mm(2)), M.plastic(0x2a3038, 0.5));
  rack.rotation.x = -Math.PI / 2; rack.position.set(mm(PLATE.w / 2), mm(40.4), mm(PLATE.h / 2)); // sits on the box rim, not coplanar with it
  obj.add(base, rack);
  const tipG = lathe([[0.01, 0], [0.5, 0.3], [2.6, 26], [3.4, 27], [3.6, 34], [3.2, 34]], 14);
  const tips = new THREE.InstancedMesh(tipG, new THREE.MeshPhysicalMaterial({ color: TIP_COL[it.color], roughness: 0.32, transparent: true, opacity: 0.94, clearcoat: 0.6 }), 96);
  tips.castShadow = true;
  obj.add(tips);
  const lid = mesh(rbox(mm(PLATE.w + 2), mm(PLATE.h + 2), mm(14), mm(4)), new THREE.MeshPhysicalMaterial({ color: 0xf2f6fa, roughness: 0.18, transparent: true, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false }), { cast: false, receive: false });
  lid.rotation.x = -Math.PI / 2; lid.position.set(mm(PLATE.w / 2), mm(41 + 7 + 6), mm(PLATE.h / 2));
  lid.renderOrder = 5;
  obj.add(lid);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let sig = '';
  return {
    obj,
    meta: { sbs: true, tipbox: true, mouth: mm(41 + 6), bottom: mm(41), level: () => mm(41 + 4), top: mm(62) },
    update(it2) {
      lid.visible = !it2.open;
      const k = it2.present.map((x) => (x ? 1 : 0)).join('');
      if (k === sig) return;
      sig = k;
      for (let i = 0; i < 96; i++) {
        const [x, z] = wellXZ(Math.floor(i / 12), i % 12);
        m4.compose(p.set(x, mm(13), z), q, s.setScalar(it2.present[i] ? 1 : 0.0001));
        tips.setMatrixAt(i, m4);
      }
      tips.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- holders and small things

function seropack(it) {
  const obj = new THREE.Group();
  const band = it.size === 5 ? 0x2f6fd6 : it.size === 10 ? 0xf08a2c : 0xd93a43;
  const can = mesh(new THREE.CylinderGeometry(mm(17), mm(17), mm(70), 40), M.steel());
  can.position.y = mm(35);
  obj.add(can);
  const lab = mesh(new THREE.CylinderGeometry(mm(17.2), mm(17.2), mm(18), 40, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: labelTex([`${it.size} mL`], { w: 256, h: 96, bg: `#${band.toString(16).padStart(6, '0')}`, fg: '#fff' }), roughness: 0.5 }));
  lab.position.y = mm(46);
  obj.add(lab);
  const paper = new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: 0.85 });
  const bandM = M.plastic(band, 0.5);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = i ? 9 : 0;
    const h = 150 + (i % 3) * 6;
    const pp = mesh(new THREE.CylinderGeometry(mm(2.6), mm(2.6), mm(h), 10), paper);
    pp.position.set(Math.cos(a) * mm(r), mm(h / 2), Math.sin(a) * mm(r));
    pp.rotation.z = (i % 2 ? 0.04 : -0.03);
    const b = mesh(new THREE.CylinderGeometry(mm(2.7), mm(2.7), mm(6), 10), bandM);
    b.position.y = mm(h / 2 - 4);
    pp.add(b);
    obj.add(pp);
  }
  return { obj, meta: { holder: true, mouth: mm(156), bottom: mm(150), level: () => mm(150), top: mm(160) }, update() {} };
}

function pasteur(it) {
  const obj = new THREE.Group();
  const can = mesh(new THREE.CylinderGeometry(mm(14), mm(14), mm(118), 40), M.steel());
  can.position.y = mm(59);
  const lid = mesh(new THREE.CylinderGeometry(mm(15.2), mm(15.2), mm(18), 40), M.steel());
  lid.position.y = mm(118 + 6);
  const lab = mesh(new THREE.CylinderGeometry(mm(14.2), mm(14.2), mm(24), 30, 1, true, -0.8, 1.6), new THREE.MeshStandardMaterial({ map: labelTex(['巴氏吸管', '已灭菌'], { w: 256, h: 160 }), roughness: 0.6 }));
  lab.position.y = mm(60);
  const pipes = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const g = mesh(new THREE.CylinderGeometry(mm(3.5), mm(3.5), mm(60), 10, 1, true), M.glass(), { cast: false });
    g.position.set(mm(-6 + i * 3), mm(118 + 22), mm((i % 2) * 3 - 1));
    pipes.add(g);
  }
  obj.add(can, lid, lab, pipes);
  return { obj, meta: { holder: true, mouth: mm(130), bottom: mm(125), level: () => mm(125), top: mm(160) }, update(it2) { lid.visible = !it2.open; pipes.visible = !!it2.open; } };
}

function boat(it) {
  const obj = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(mm(34), mm(24), mm(10), 4, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xe9eef4, roughness: 0.5, side: THREE.DoubleSide }));
  shell.rotation.y = Math.PI / 4; shell.position.y = mm(5);
  const floor = mesh(new THREE.PlaneGeometry(mm(33), mm(33)), shell.material);
  floor.rotation.x = -Math.PI / 2; floor.position.y = mm(0.3);
  const puddle = mesh(new THREE.CircleGeometry(1, 32), liquidMat(), { cast: false });
  puddle.rotation.x = -Math.PI / 2; puddle.position.y = mm(0.9);
  obj.add(shell, floor, puddle);
  return {
    obj, meta: { mouth: mm(10), bottom: mm(0.6), level: (v) => mm(0.8 + Math.min(4, v / 300)), top: mm(12) },
    update(it2) { const v = vol(it2.liq); puddle.visible = v > 0.5; puddle.scale.setScalar(mm(Math.min(14, 2 + Math.sqrt(v) * 0.4))); setLiquid(puddle.material, color(it2.liq)); },
  };
}

function hemo(it) {
  const obj = new THREE.Group();
  const slide = mesh(rbox(mm(76), mm(32), mm(4), mm(1.5)), new THREE.MeshPhysicalMaterial({ color: 0xd8ecf6, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false }));
  slide.rotation.x = -Math.PI / 2; slide.position.y = mm(2);
  const grid = mesh(new THREE.PlaneGeometry(mm(10), mm(10)), new THREE.MeshStandardMaterial({ color: 0x9aa8b6, metalness: 0.6, roughness: 0.3 }), { cast: false });
  grid.rotation.x = -Math.PI / 2; grid.position.set(mm(-12), mm(4.05), 0);
  const grid2 = grid.clone(); grid2.position.x = mm(12);
  const cover = mesh(new THREE.BoxGeometry(mm(24), mm(0.4), mm(22)), M.glassTint(), { cast: false });
  cover.position.y = mm(4.5);
  const stain = mesh(new THREE.PlaneGeometry(mm(22), mm(20)), new THREE.MeshStandardMaterial({ color: 0x3a5aa8, transparent: true, opacity: 0, depthWrite: false }), { cast: false });
  stain.rotation.x = -Math.PI / 2; stain.position.y = mm(4.3);
  const lab = mesh(new THREE.PlaneGeometry(mm(14), mm(26)), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.9 }), { cast: false });
  lab.rotation.x = -Math.PI / 2; lab.position.set(mm(-31), mm(4.02), 0);
  obj.add(slide, grid, grid2, cover, stain, lab);
  return { obj, meta: { mouth: mm(5), mouthAt: [mm(-12), mm(12)], bottom: mm(4.4), level: () => mm(4.5), top: mm(8) }, update(it2) { stain.material.opacity = vol(it2.liq) > 0 ? 0.45 : 0; } };
}

// ---------------------------------------------------------------- registry

const BUILD = {
  tube15: (it) => tube(it, { R: 8.5, H: 118, cone: 22, capR: 9.6, capH: 13, gradMax: 15, step: 0.5 }),
  tube50: (it) => tube(it, { R: 14.6, H: 112, cone: 18, capR: 16, capH: 14, gradMax: 50, step: 2.5, skirt: true }),
  ep: (it) => ep(it),
  vial: (it) => vial(it, { R: 6.2, H: 44, amber: true }),
  kit: (it) => vial(it, { R: 9.5, H: 38, amber: true, capColor: 'white' }),
  bottle500: (it) => bottle(it, { R: 43, H: 178, shoulder: 132, neckR: 21, capR: 25, capH: 20 }),
  bottle100: (it) => bottle(it, { R: 28, H: 108, shoulder: 74, neckR: 15, capR: 18, capH: 15 }),
  beaker,
  flask,
  plate, uplate: plate,
  res4: reservoir,
  tipbox, tipboxSide: tipbox,
  seropack, pasteur, boat, hemo,
};

export function registerModel(type, fn) { BUILD[type] = fn; }

export function buildItem(it) {
  const f = BUILD[it.type];
  if (!f) throw new Error(`no 3D model for ${it.type}`);
  const m = f(it);
  const k = DISPLAY_SCALE[it.type] || 1;
  m.scale = k; // hit-area factor only; the model stays life-size
  // a soft contact shadow under the footprint grounds the item on its surface
  m.obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(m.obj);
  if (!b.isEmpty()) {
    const sz = b.getSize(new THREE.Vector3());
    m.shadow = contactShadow(sz.x * 1.12, sz.z * 1.12);
    m.shadow.position.set((b.min.x + b.max.x) / 2, b.min.y + 0.0006, (b.min.z + b.max.z) / 2);
    m.obj.add(m.shadow);
  }
  m.obj.userData.item = it.id;
  m.obj.traverse((o) => { o.userData.item = it.id; });
  return m;
}

export { mm, SBS_H, CAP, capMat, screwCap, vessel, conical, levelFn, liquidBody, sticker };
