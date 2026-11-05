// Alex 202384014054
// 3D hand tools. Each builder returns { obj, update(t, w, held) } with the
// origin at the working end (tip end, or the bare nozzle when no tip is on),
// tool axis along +y.

import * as THREE from 'three';
import { M, mesh, lathe, liquidMat, setLiquid, screen, lcdText, MONO, rbox } from './mats.js';
import { vol, color } from '../sim/liquid.js';

const mm = (v) => v / 1000;
const BTN = { p20: 0xbfc6ce, p200: 0xf2c94c, p1000: 0x4f86f0, mc20: 0xbfc6ce, mc200: 0x8b6cf0 };
const TIP = { white: { len: 46, r: 3.2, col: 0xf4f6f8 }, yellow: { len: 51, r: 3.6, col: 0xf7cf3a }, blue: { len: 72, r: 4.6, col: 0x4f86f0 } };

function tipModel(kind) {
  const s = TIP[kind];
  const outer = [[0.35, 0], [0.7, 0.4], [s.r * 0.72, s.len * 0.82], [s.r, s.len * 0.86], [s.r * 1.05, s.len]];
  const inner = [[0.01, 0.3], [0.45, 0.6], [s.r * 0.72 - 0.35, s.len * 0.82], [s.r - 0.35, s.len * 0.86], [s.r * 1.05 - 0.4, s.len - 0.4]];
  const g = new THREE.Group();
  const shell = mesh(lathe(outer, 20), new THREE.MeshPhysicalMaterial({ color: s.col, roughness: 0.25, transparent: true, opacity: kind === 'white' ? 0.55 : 0.62, clearcoat: 0.8, depthWrite: false }), { cast: false });
  shell.renderOrder = 4;
  g.add(shell);
  // liquid column from the orifice up
  const lm = liquidMat();
  const liq = mesh(new THREE.BufferGeometry(), lm, { cast: false });
  liq.renderOrder = 3;
  g.add(liq);
  // µL per mm of height near the bottom of the cone (rough, for the visual)
  let last = -1;
  return {
    g, len: mm(s.len),
    set(tipObj) {
      const v = tipObj ? vol(tipObj.liq) : 0;
      g.visible = !!tipObj;
      if (!tipObj) return;
      liq.visible = v > 0.2;
      if (!liq.visible) return;
      setLiquid(lm, color(tipObj.liq));
      // height of a cone frustum holding v µL
      let h = 0, acc = 0;
      while (acc < v && h < s.len * 0.86) { const r = 0.45 + ((s.r * 0.72 - 0.35 - 0.45) * h) / (s.len * 0.82); acc += Math.PI * r * r * 0.25; h += 0.25; }
      if (Math.abs(h - last) < 0.2) return;
      last = h;
      const pts = [[0.01, 0.3]];
      for (let y = 0.6; y < h; y += 2) pts.push([0.45 + ((s.r * 0.72 - 0.8) * y) / (s.len * 0.82), y]);
      const rt = 0.45 + ((s.r * 0.72 - 0.8) * h) / (s.len * 0.82);
      pts.push([rt, h], [0.01, h]);
      liq.geometry.dispose();
      liq.geometry = lathe(pts, 14);
    },
  };
}

// Volume counter on the handle: four digit wheels drawn on a little screen.
function counter(t) {
  return screen(128, 160, (g, W, H, v) => {
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#20262d'; g.fillRect(12, 8, W - 24, H - 16);
    const digits = t.spec.max >= 1000 ? String(Math.round(v)).padStart(4, '0') : t.spec.max >= 200 ? String(Math.round(v)).padStart(3, '0') + ' ' : (Math.round(v * 10)).toString().padStart(3, '0') + ' ';
    g.font = `700 30px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const y = 22 + i * 34;
      g.fillStyle = '#f7f8f9'; g.fillRect(22, y - 14, W - 44, 28);
      g.fillStyle = t.spec.max <= 20 && i === 2 ? '#d93a43' : '#14181d';
      g.fillText(digits[i] === ' ' ? '' : digits[i], W / 2, y + 1);
    }
  });
}

function pipette(t) {
  const obj = new THREE.Group();
  const body = new THREE.Group(); // everything above the nozzle
  obj.add(body);
  const multi = t.spec.ch > 1;
  const shell = M.plastic(0xf2f3f5, 0.38);
  const dark = M.plastic(0x30353c, 0.45);
  if (!multi) {
    const nose = mesh(lathe([[1.6, 0], [2.4, 8], [3.4, 34], [4.2, 44], [5.6, 46], [6.4, 80], [7.4, 92], [9.6, 108]], 28), shell);
    body.add(nose);
    const ej = mesh(lathe([[4.6, 30], [5.6, 34], [5.8, 72], [6.6, 76]], 24), dark);
    body.add(ej);
  } else {
    const man = mesh(rbox(mm(72), mm(26), mm(14), mm(4)), shell);
    man.position.y = mm(44);
    body.add(man);
    for (let k = 0; k < 8; k++) {
      const n = mesh(lathe([[1.6, 0], [2.2, 8], [3.2, 30]], 14), dark);
      n.position.x = mm((k - 3.5) * 9);
      body.add(n);
    }
    const neck = mesh(new THREE.CylinderGeometry(mm(8), mm(10), mm(40), 24), shell);
    neck.position.y = mm(76);
    body.add(neck);
  }
  // grip
  const grip = mesh(rbox(mm(30), mm(118), mm(26), mm(10)), shell);
  grip.position.y = mm(108 + 59);
  body.add(grip);
  const hook = mesh(rbox(mm(16), mm(30), mm(22), mm(6)), dark);
  hook.position.set(mm(-18), mm(206), mm(-2));
  hook.rotation.z = 0.35;
  body.add(hook);
  // volume window
  const cnt = counter(t);
  const win = mesh(new THREE.PlaneGeometry(mm(15), mm(19)), cnt.mat, { cast: false });
  win.position.set(0, mm(150), mm(13.7));
  body.add(win);
  const lab = mesh(new THREE.PlaneGeometry(mm(20), mm(9)), new THREE.MeshStandardMaterial({ color: BTN[t.id], roughness: 0.4 }), { cast: false });
  lab.position.set(0, mm(192), mm(13.7));
  body.add(lab);
  // plunger + colour-coded button
  const plunger = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(mm(4), mm(4), mm(26), 16), dark);
  rod.position.y = mm(13);
  const btn = mesh(new THREE.CylinderGeometry(mm(8.5), mm(7.5), mm(10), 28), M.plastic(BTN[t.id], 0.35));
  btn.position.y = mm(28);
  plunger.add(rod, btn);
  plunger.position.y = mm(226);
  body.add(plunger);
  // tip ejector button
  const ejB = mesh(rbox(mm(10), mm(14), mm(10), mm(3)), dark);
  ejB.position.set(mm(14), mm(230), 0);
  body.add(ejB);
  // tips
  const tips = [];
  for (let k = 0; k < t.spec.ch; k++) {
    const tp = tipModel(t.spec.tip);
    tp.g.position.x = multi ? mm((k - 3.5) * 9) : 0;
    obj.add(tp.g);
    tips.push(tp);
  }
  const tipLen = tips[0].len;
  let ejectT = 0;
  return {
    obj, tipLen,
    update(tool, w, held) {
      const has = tool.tips.some(Boolean);
      body.position.y = has ? tipLen - mm(2) : 0;
      tips.forEach((tp, k) => { tp.set(tool.tips[k]); tp.g.position.y = 0; });
      cnt.refresh(`${tool.vol}`, tool.vol);
      const p = held ? w.plunger : null;
      const travel = p && p.down ? (p.stop === 2 ? 7.5 : 5) : 0;
      plunger.position.y += (mm(226 - travel) - plunger.position.y) * 0.45;
      // little kick when tips come off
      if (tool._had && !has) ejectT = 1;
      tool._had = has;
      ejB.position.y = mm(230 - ejectT * 5);
      ejectT *= 0.85;
    },
  };
}

// Electronic pipette aid (pistol grip) with a serological pipette pointing
// down. The blue trigger (upper) draws, the red one (lower) dispenses; both
// stand proud of the grip and light up while pressed.
const BAND = {};
const bandMat = (c) => BAND[c] || (BAND[c] = M.plastic(c, 0.5));
function aid(t) {
  const obj = new THREE.Group();
  const head = new THREE.Group();
  obj.add(head);
  const nose = mesh(lathe([[3.2, -6], [5, 0], [9, 14], [12, 22]], 24), M.plastic(0xdde3e8, 0.35));
  const housing = mesh(rbox(mm(38), mm(62), mm(40), mm(7)), M.plastic(0x3a4552, 0.4));
  housing.position.y = mm(52);
  const cap = mesh(rbox(mm(40), mm(8), mm(42), mm(4)), M.plastic(0x2f6fd6, 0.45));
  cap.position.y = mm(86);
  const grip = new THREE.Group();
  grip.position.set(mm(30), mm(66), 0); grip.rotation.z = -0.42;
  const gripBody = mesh(rbox(mm(24), mm(92), mm(28), mm(9)), M.plastic(0x2a3139, 0.6));
  grip.add(gripBody);
  const trig = (col, y) => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0 });
    const b = mesh(rbox(mm(13), mm(15), mm(9), mm(3)), m);
    b.position.set(0, mm(y), mm(17.5));
    grip.add(b);
    return b;
  };
  const trigU = trig(0x2f78ff, 26), trigD = trig(0xe5343f, 6);
  const disp = screen(160, 80, (g, W, H, s) => {
    g.fillStyle = '#0b1216'; g.fillRect(0, 0, W, H);
    g.fillStyle = s.dir === 'up' ? '#3a8bff' : s.dir === 'down' ? '#ff4b55' : '#24323a';
    g.fillRect(0, 0, W, 8);
    lcdText(g, s.txt, W / 2, 46, 26, '#7ee0ff', { align: 'center', ghost: false });
    g.fillStyle = '#5c7a86'; g.font = `600 14px ${MONO}`; g.textAlign = 'center';
    g.fillText(s.dir === 'up' ? '▲ ASPIRATE' : s.dir === 'down' ? '▼ DISPENSE' : s.slow ? 'SPEED 1' : 'SPEED 3', W / 2, 72);
  });
  const lcd = mesh(new THREE.PlaneGeometry(mm(26), mm(13)), disp.mat, { cast: false });
  lcd.position.set(0, mm(60), mm(20.9));
  const led = mesh(new THREE.SphereGeometry(mm(1.8), 10, 8), new THREE.MeshBasicMaterial({ color: 0x2d3a42, toneMapped: false }), { cast: false });
  led.position.set(mm(13), mm(46), mm(20.4));
  head.add(nose, housing, cap, grip, lcd, led);
  // serological pipette
  const sp = new THREE.Group();
  const spLen = 300;
  const tube = mesh(new THREE.CylinderGeometry(mm(3.6), mm(3.6), mm(spLen - 20), 16, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, roughness: 0.15, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false }), { cast: false });
  tube.position.y = mm(20 + (spLen - 20) / 2);
  tube.renderOrder = 4;
  const cone = mesh(lathe([[0.6, 0], [1.2, 2], [3.6, 20]], 14), tube.material, { cast: false });
  const band = mesh(new THREE.CylinderGeometry(mm(3.8), mm(3.8), mm(8), 16), bandMat(0xf08a2c));
  band.position.y = mm(spLen - 12);
  const plug = mesh(new THREE.CylinderGeometry(mm(3.4), mm(3.4), mm(8), 12), M.white()); plug.position.y = mm(spLen - 4);
  const lm = liquidMat();
  const col = mesh(new THREE.CylinderGeometry(mm(3.1), mm(3.1), 1, 16), lm, { cast: false });
  col.renderOrder = 3;
  sp.add(tube, cone, band, plug, col);
  obj.add(sp);
  const press = (b, on) => {
    b.position.z += (mm(on ? 14.5 : 17.5) - b.position.z) * 0.5;
    b.material.emissiveIntensity += ((on ? 0.9 : 0) - b.material.emissiveIntensity) * 0.5;
  };
  return {
    obj, tipLen: mm(spLen),
    update(tool, w, held) {
      const s = tool.sp;
      sp.visible = !!s;
      head.position.y = s ? mm(spLen + 6) : 0;
      if (s) {
        band.material = bandMat(s.size === 5 ? 0x2f6fd6 : s.size === 10 ? 0xf08a2c : 0xd93a43);
        const v = vol(s.liq);
        // a 10 mL pipette holds ~ 0.042 mL per mm
        const h = Math.min(spLen - 30, (v / 1000) / (s.size === 5 ? 0.024 : s.size === 10 ? 0.042 : 0.085));
        col.visible = v > 5;
        col.scale.y = mm(Math.max(0.5, h));
        col.position.y = mm(4 + h / 2);
        setLiquid(lm, color(s.liq));
      }
      const k = (held && w.keys) || {};
      const up = !!k.KeyW && !k.KeyS, down = !!k.KeyS && !k.KeyW, slow = !!(k.ShiftLeft || k.ShiftRight);
      press(trigU, up); press(trigD, down);
      led.material.color.setHex(up ? 0x3a8bff : down ? 0xff4b55 : s ? 0x49d17a : 0x2d3a42);
      const dir = up ? 'up' : down ? 'down' : '';
      disp.refresh(`${dir}${slow}${s ? Math.round(vol(s.liq) / 50) : 'x'}`, { dir, slow, txt: s ? `${(vol(s.liq) / 1000).toFixed(2)} mL` : 'READY' });
    },
  };
}

// Vacuum aspirator wand with a glass Pasteur pipette.
function vac(t) {
  const obj = new THREE.Group();
  const wand = new THREE.Group();
  obj.add(wand);
  const handle = mesh(lathe([[5, 0], [7, 10], [9, 30], [9, 110], [7, 120]], 24), M.plastic(0xe9edf1, 0.4));
  const valve = mesh(rbox(mm(12), mm(26), mm(10), mm(3)), M.plastic(0xd93a43, 0.4)); valve.position.set(mm(11), mm(70), 0);
  const hose = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, mm(120), 0), new THREE.Vector3(mm(-10), mm(180), mm(-20)), new THREE.Vector3(mm(-60), mm(220), mm(-80)), new THREE.Vector3(mm(-140), mm(160), mm(-160))]), 24, mm(3.2), 8), new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.2, transparent: true, opacity: 0.6 }));
  wand.add(handle, valve, hose);
  const pas = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false });
  const g1 = mesh(lathe([[0.5, 0], [0.7, 2], [0.9, 80], [3.4, 96], [3.6, 146]], 14), glass, { cast: false });
  g1.renderOrder = 4;
  pas.add(g1);
  obj.add(pas);
  return {
    obj, tipLen: mm(146),
    update(tool, w) {
      pas.visible = !!tool.pasteur;
      wand.position.y = tool.pasteur ? mm(140) : 0;
      valve.position.x = mm(w.keys?.KeyW ? 9.5 : 11);
    },
  };
}

export function buildTool(t) {
  const m = t.kind === 'pip' ? pipette(t) : t.kind === 'aid' ? aid(t) : vac(t);
  m.obj.userData.tool = t.id;
  m.obj.traverse((o) => { o.userData.tool = t.id; });
  return m;
}
