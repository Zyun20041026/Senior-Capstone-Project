// Alex 202384014054
// Bench instruments and furniture, modelled at real size (metres). Each
// returns { obj, slots: {id: Vector3 local}, update(w, dt) }. Clickable parts
// are tagged with fx(id, label) for ray picking.

import * as THREE from 'three';
import { M, mesh, rbox, lathe, screen, lcdText, fx, FONT, MONO, labelTex } from './mats.js';
import { balanceReading } from '../game/actions.js';
import { scopeState } from '../ui/microscope.js';

const mm = (v) => v / 1000;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A display panel: plane with a live canvas, slightly inset in a bezel.
export function display(w, h, pxW, pxH, draw, { bezel = 0.006, depth = 0.004 } = {}) {
  const g = new THREE.Group();
  const scr = screen(pxW, pxH, draw);
  const b = mesh(rbox(w + bezel * 2, h + bezel * 2, depth, Math.min(w, h) * 0.08), M.black(), { cast: false });
  const p = mesh(new THREE.PlaneGeometry(w, h), scr.mat, { cast: false, receive: false });
  p.position.z = depth / 2 + 0.0003;
  g.add(b, p);
  return { g, scr };
}

// A labelled push button.
function button(w, h, color, label, id, fxLabel) {
  const g = new THREE.Group();
  const b = mesh(rbox(w, h, 0.006, Math.min(w, h) * 0.3), M.plastic(color, 0.35));
  g.add(b);
  if (label) {
    const t = mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.6), new THREE.MeshBasicMaterial({ map: labelTex([label], { w: 256, h: 128, bg: '#00000000', fg: '#f2f4f6' }), transparent: true, toneMapped: false }), { cast: false });
    t.position.z = 0.0032;
    g.add(t);
  }
  if (id) fx(g, id, fxLabel || label);
  return g;
}

// ---------------------------------------------------------------- room

export function benchRoom({ width = 2.6, depth = 0.75, wall = -0.5, shelf = true } = {}) {
  const g = new THREE.Group();
  // epoxy bench top with a rounded front edge
  const top = mesh(rbox(width, 0.03, depth, 0.008), M.epoxy());
  top.position.set(0, -0.015, wall + depth / 2);
  g.add(top);
  const under = mesh(new THREE.BoxGeometry(width, 0.8, depth - 0.06), M.enamel(0x4a525c));
  under.position.set(0, -0.43, wall + depth / 2 - 0.04);
  g.add(under);
  // cabinet doors and handles under the bench
  for (let i = 0; i < Math.round(width / 0.5); i++) {
    const x = -width / 2 + 0.25 + i * 0.5;
    const d = mesh(rbox(0.48, 0.7, 0.02, 0.008), M.enamel(0x56606b)); d.position.set(x, -0.42, wall + depth - 0.06);
    const h = mesh(rbox(0.12, 0.012, 0.02, 0.005), M.chrome()); h.position.set(x, -0.1, wall + depth - 0.04);
    g.add(d, h);
  }
  // wall: tiles + a backsplash
  const w = mesh(new THREE.PlaneGeometry(width + 2, 2.4), M.tile());
  w.position.set(0, 0.9, wall);
  g.add(w);
  const sp = mesh(new THREE.BoxGeometry(width, 0.08, 0.012), M.epoxy());
  sp.position.set(0, 0.04, wall + 0.006);
  g.add(sp);
  // service panel with sockets and gas taps
  for (let i = -3; i <= 3; i++) {
    const s = mesh(rbox(0.07, 0.06, 0.012, 0.006), M.enamel(0xf3f4f5));
    s.position.set(i * 0.38, 0.2, wall + 0.008);
    g.add(s);
  }
  if (shelf) {
    const sh = mesh(new THREE.BoxGeometry(width, 0.018, 0.26), M.enamel(0xe8ebee));
    sh.position.set(0, 0.62, wall + 0.13);
    g.add(sh);
    const cols = [0x2f6fd6, 0xf08a2c, 0x3a9a6a, 0x7469e6, 0xd93a43, 0xf3f4f5];
    for (let i = 0; i < 22; i++) {
      const h = 0.09 + ((i * 37) % 7) * 0.012, r = 0.022 + (i % 3) * 0.006;
      const b = mesh(new THREE.CylinderGeometry(r, r, h, 20), i % 3 ? M.glass() : M.enamel(0xf1f2f3));
      b.position.set(-width / 2 + 0.12 + i * 0.112, 0.63 + h / 2, wall + 0.1 + (i % 2) * 0.05);
      const c = mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.02, 16), M.plastic(cols[i % cols.length], 0.45));
      c.position.y = h / 2 + 0.01;
      b.add(c);
      g.add(b);
    }
  }
  return g;
}

// ---------------------------------------------------------------- analytical balance

export function balance() {
  const obj = new THREE.Group();
  const base = mesh(rbox(0.21, 0.07, 0.34, 0.014), M.enamel(0xf0f1f3));
  base.position.set(0, 0.035, 0);
  obj.add(base);
  const cons = mesh(rbox(0.21, 0.05, 0.08, 0.01), M.graphite());
  cons.position.set(0, 0.05, 0.15); cons.rotation.x = -0.5;
  obj.add(cons);
  const { g: lcd, scr } = display(0.1, 0.028, 400, 112, (g, W, H, txt, open) => {
    g.fillStyle = '#0b1a1f'; g.fillRect(0, 0, W, H);
    lcdText(g, txt, W - 50, 84, 66, open ? '#ffcf6b' : '#a8f0ff', { align: 'right' });
    g.fillStyle = open ? '#ffcf6b' : '#7fb7c4'; g.font = `600 30px ${MONO}`; g.textAlign = 'left'; g.fillText('g', W - 40, 84);
    if (!open) { g.fillStyle = '#7fb7c4'; g.font = `500 18px ${FONT}`; g.fillText('○ 稳定', 14, 26); } else { g.font = `500 18px ${FONT}`; g.fillText('~ 不稳定', 14, 26); }
  });
  lcd.position.set(-0.035, 0.06, 0.176); lcd.rotation.x = -0.5;
  obj.add(lcd);
  const tare = button(0.03, 0.016, 0x3c4550, '去皮', 'bal-tare'); tare.position.set(0.055, 0.058, 0.178); tare.rotation.x = -0.5;
  const prt = button(0.03, 0.016, 0x3c4550, '打印', 'bal-print'); prt.position.set(0.09, 0.058, 0.178); prt.rotation.x = -0.5;
  obj.add(tare, prt);
  // weighing chamber
  const ch = new THREE.Group();
  ch.position.set(0, 0.07, -0.03);
  const frame = M.graphite();
  const roof = mesh(rbox(0.2, 0.012, 0.22, 0.004), frame); roof.position.y = 0.21;
  const back = mesh(new THREE.BoxGeometry(0.2, 0.21, 0.01), M.enamel(0xe9ecef)); back.position.set(0, 0.105, -0.11);
  const glassL = mesh(new THREE.BoxGeometry(0.004, 0.2, 0.21), M.glassTint(), { cast: false }); glassL.position.set(-0.098, 0.1, 0);
  const glassR = glassL.clone(); glassR.position.x = 0.098;
  const front = mesh(new THREE.BoxGeometry(0.19, 0.2, 0.004), M.glassTint(), { cast: false }); front.position.set(0, 0.1, 0.106);
  const door = new THREE.Group(); door.add(glassR);
  ch.add(roof, back, glassL, front, door);
  fx(door, 'bal-doors', '防风罩门');
  fx(front, 'bal-doors', '防风罩门');
  const pan = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.003, 48), M.chrome());
  pan.position.y = 0.022;
  const post = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.02, 12), M.steelDark()); post.position.y = 0.01;
  ch.add(pan, post);
  obj.add(ch);
  return {
    obj, slots: { pan: V(0, 0.07 + 0.024, -0.03) },
    update(w) {
      const r = balanceReading(w);
      const open = !w.inst.balance.doors;
      scr.refresh(`${r.toFixed(4)}${open}`, r.toFixed(4), open);
      door.position.z += ((open ? -0.15 : 0) - door.position.z) * 0.3;
    },
  };
}

// ---------------------------------------------------------------- centrifuge

export function centrifuge() {
  const obj = new THREE.Group();
  const body = mesh(rbox(0.4, 0.26, 0.5, 0.05), M.enamel(0xeef0f2));
  body.position.y = 0.13;
  obj.add(body);
  const band = mesh(rbox(0.402, 0.03, 0.502, 0.05), M.plastic(0x3b6fb6, 0.4)); band.position.y = 0.035;
  obj.add(band);
  const panel = mesh(rbox(0.3, 0.09, 0.03, 0.012), M.graphite());
  panel.position.set(0, 0.17, 0.255); panel.rotation.x = -0.25;
  obj.add(panel);
  const { g: lcd, scr } = display(0.17, 0.05, 640, 188, (g, W, H, c) => {
    g.fillStyle = '#081018'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5c6b7a'; g.font = `500 22px ${FONT}`; g.textAlign = 'left';
    g.fillText('转速 rpm', 18, 30); g.fillText('时间 min', 380, 30);
    lcdText(g, c.rpm ? String(Math.round(c.rpm)).padStart(4, ' ') : '----', 330, 150, 96, c.running ? '#ffb35c' : '#ff8a5c', { align: 'right' });
    lcdText(g, String(c.min || 0).padStart(2, ' '), 560, 150, 96, '#ff8a5c', { align: 'right' });
    if (c.alarm) { g.fillStyle = '#ff4d5a'; g.font = `700 30px ${FONT}`; g.fillText('不平衡', 470, 182); }
    if (c.running) { g.fillStyle = '#5dffb0'; g.font = `600 22px ${FONT}`; g.fillText('● 运行', 18, 182); }
  });
  lcd.position.set(-0.03, 0.172, 0.27); lcd.rotation.x = -0.25;
  obj.add(lcd);
  const start = button(0.04, 0.022, 0x2fa36b, '启动'); start.position.set(0.11, 0.18, 0.272); start.rotation.x = -0.25;
  const stop = button(0.04, 0.022, 0xd93a43, '停止'); stop.position.set(0.11, 0.152, 0.278); stop.rotation.x = -0.25;
  obj.add(start, stop);
  // lid hinged at the back
  const hinge = new THREE.Group(); hinge.position.set(0, 0.26, -0.22);
  const lid = mesh(rbox(0.38, 0.04, 0.42, 0.04), M.enamel(0xf4f5f6)); lid.position.set(0, 0.02, 0.2);
  const win = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 40), M.glassTint(), { cast: false }); win.position.set(0, 0.041, 0.2);
  hinge.add(lid, win);
  obj.add(hinge);
  // rotor (seen when the lid is open)
  const rotor = new THREE.Group(); rotor.position.set(0, 0.24, 0);
  const hub = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24), M.steelDark()); rotor.add(hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const arm = mesh(new THREE.BoxGeometry(0.11, 0.012, 0.02), M.steelDark()); arm.position.set(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055); arm.rotation.y = -a; rotor.add(arm);
    const bk = mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.05, 16, 1, true), M.steel()); bk.position.set(Math.cos(a) * 0.11, -0.01, Math.sin(a) * 0.11); rotor.add(bk);
  }
  obj.add(rotor);
  fx(obj, 'centrifuge', '离心机');
  // A run is instant on the game clock; the model replays it: spin up,
  // hold, spin down (≈3 s), with the display counting the speed.
  let spin = 0, last = null, run = null;
  return {
    obj, slots: {},
    update(w, dt) {
      const c = w.inst.centrifuge;
      if (c.last && c.last !== last) { if (last !== null || c.last) run = { t: 0, rpm: c.last.rpm }; last = c.last; }
      let shown = c, omega = 0;
      if (run) {
        run.t += dt;
        const T = 3, u = run.t;
        const k = u < 0.8 ? u / 0.8 : u < T - 0.9 ? 1 : Math.max(0, (T - u) / 0.9);
        omega = 40 * k * k;
        shown = { ...c, running: k > 0.02, rpm: Math.round(run.rpm * k) };
        if (u >= T) run = null;
      }
      scr.refresh(`${shown.rpm}|${c.min}|${c.alarm}|${!!shown.running}`, shown);
      hinge.rotation.x += ((c.lid ? -1.25 : 0) - hinge.rotation.x) * 0.25;
      spin += dt * omega;
      rotor.rotation.y = spin;
    },
  };
}

// ---------------------------------------------------------------- inverted microscope

export function microscope() {
  // An inverted research microscope with phase contrast, an LED epi-fluorescence
  // illuminator, a filter-cube turret and a camera on the side port.
  const obj = new THREE.Group();
  const white = M.enamel(0xeef0f2), grey = M.enamel(0x9aa1a9), dark = M.graphite(), black = M.black(), chrome = M.chrome();
  const add = (m, x, y, z) => { m.position.set(x, y, z); obj.add(m); return m; };
  const knob = (r, w, mat, x, y, z, ridges = 24) => {
    const g = new THREE.Group();
    const k = mesh(new THREE.CylinderGeometry(r, r, w, ridges * 2), mat); k.rotation.z = Math.PI / 2; g.add(k);
    for (let i = 0; i < ridges; i++) { const a = (i / ridges) * Math.PI * 2; const rib = mesh(new THREE.BoxGeometry(w * 0.96, 0.0016, 0.0016), M.rubber(), { cast: false }); rib.position.set(0, Math.cos(a) * r, Math.sin(a) * r); g.add(rib); }
    g.position.set(x, y, z); obj.add(g); return g;
  };
  // frame: deep base, rear pillar and the illumination arm
  add(mesh(rbox(0.3, 0.1, 0.5, 0.03), white), 0, 0.05, -0.03);
  add(mesh(rbox(0.31, 0.012, 0.51, 0.006), grey), 0, 0.006, -0.03);
  add(mesh(rbox(0.22, 0.09, 0.3, 0.03), white), 0, 0.14, -0.08);
  add(mesh(rbox(0.07, 0.5, 0.07, 0.02), white), 0, 0.4, -0.25);
  add(mesh(rbox(0.07, 0.05, 0.28, 0.02), white), 0, 0.64, -0.12);
  const lampH = add(mesh(rbox(0.11, 0.08, 0.12, 0.025), dark), 0, 0.665, -0.27);
  for (let i = 0; i < 5; i++) add(mesh(new THREE.BoxGeometry(0.112, 0.004, 0.008), black, { cast: false }), 0, 0.64 + i * 0.012, -0.21);
  void lampH;
  // condenser with the phase turret (coloured annulus marks) and aperture lever
  add(mesh(lathe([[22, 0], [24, 8], [24, 70], [20, 82]], 40), dark), 0, 0.5, 0.02);
  const ct = add(mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.022, 48), dark), 0, 0.49, 0.02);
  ['#e8e8e8', '#d93a43', '#2fa36b', '#2f6fd6'].forEach((c, i) => { const a = i * Math.PI / 2 + 0.4; const d = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.003, 16), M.plastic(new THREE.Color(c).getHex(), 0.4), { cast: false }); d.rotation.z = Math.PI / 2; d.position.set(Math.cos(a) * 0.047, 0, Math.sin(a) * 0.047); d.rotation.y = -a; ct.add(d); });
  add(mesh(lathe([[16, 0], [20, 6], [20, 34], [12, 44]], 32), black), 0, 0.42, 0.02);
  add(mesh(new THREE.BoxGeometry(0.05, 0.004, 0.008), chrome), 0.04, 0.455, 0.02);
  add(mesh(new THREE.TorusGeometry(0.021, 0.0035, 8, 32), chrome), 0, 0.425, 0.02).rotation.x = Math.PI / 2;
  // mechanical stage with specimen holder and the hanging X–Y knob
  add(mesh(rbox(0.28, 0.016, 0.24, 0.006), M.plastic(0x23272c, 0.3)), 0, 0.199, 0.02);
  add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 32), black), 0, 0.2, 0.02);
  add(mesh(rbox(0.16, 0.006, 0.012, 0.002), chrome), 0, 0.209, -0.05);
  add(mesh(rbox(0.012, 0.006, 0.1, 0.002), chrome), -0.085, 0.209, 0.0);
  add(mesh(rbox(0.03, 0.03, 0.03, 0.006), dark), 0.12, 0.18, 0.12);
  knob(0.012, 0.016, dark, 0.12, 0.15, 0.12, 14).rotation.z = Math.PI / 2;
  knob(0.009, 0.012, dark, 0.12, 0.128, 0.12, 12).rotation.z = Math.PI / 2;
  // UV shield in front of the stage
  const shield = add(mesh(new THREE.PlaneGeometry(0.18, 0.1), new THREE.MeshPhysicalMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false })), 0, 0.27, 0.15);
  shield.rotation.x = -0.25; shield.userData.noPick = true;
  // nosepiece and four objectives with colour bands
  const tur = new THREE.Group(); tur.position.set(0, 0.17, 0.02); obj.add(tur);
  tur.add(mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.02, 40), chrome));
  const ringCols = [0xd93a43, 0xf2c94c, 0x2fa36b, 0x2f6fd6];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ob = mesh(lathe([[6, 0], [9, 4], [10, 26], [8, 32]], 18), chrome);
    ob.rotation.x = Math.PI; ob.position.set(Math.cos(a) * 0.022, 0.042, Math.sin(a) * 0.022);
    const band = mesh(new THREE.CylinderGeometry(0.0102, 0.0102, 0.003, 18), M.plastic(ringCols[i], 0.4)); band.position.y = mm(10); ob.add(band);
    tur.add(ob);
  }
  // filter-cube turret slider and the LED fluorescence illuminator on the back
  const cube = add(mesh(rbox(0.12, 0.03, 0.05, 0.008), dark), 0, 0.125, 0.09);
  ['DAPI', 'FITC', 'TRITC'].forEach((t, i) => { const l = mesh(new THREE.PlaneGeometry(0.03, 0.012), new THREE.MeshBasicMaterial({ map: labelTex([t], { w: 160, h: 64, bg: ['#2b3a8f', '#1f8f4a', '#b33a2a'][i], fg: '#ffffff' }) }), { cast: false }); l.position.set(-0.035 + i * 0.035, 0, 0.0255); cube.add(l); });
  add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 32), dark), 0, 0.14, -0.29).rotation.x = Math.PI / 2;
  const led = add(mesh(rbox(0.1, 0.1, 0.08, 0.02), black), 0, 0.14, -0.36);
  for (let i = 0; i < 6; i++) add(mesh(new THREE.BoxGeometry(0.102, 0.003, 0.07), M.graphite(), { cast: false }), 0, 0.105 + i * 0.013, -0.36);
  void led;
  const cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.05, 0.12, -0.39), V(0.1, 0.04, -0.4), V(0.13, 0.01, -0.3)]), 24, 0.004, 8), black); obj.add(cable);
  // binocular head, eyepieces with rubber cups, side camera port
  const head = add(mesh(rbox(0.13, 0.07, 0.15, 0.025), white), 0, 0.2, 0.17); head.rotation.x = 0.35;
  add(mesh(rbox(0.06, 0.03, 0.05, 0.01), white), 0, 0.235, 0.22).rotation.x = 0.35;
  const eyes = new THREE.Group(); eyes.position.set(0, 0.245, 0.235); eyes.rotation.x = 0.75; obj.add(eyes);
  for (const x of [-0.033, 0.033]) {
    const t = mesh(lathe([[12, 0], [12, 38], [14, 44], [14, 64]], 24), dark); t.position.x = x; eyes.add(t);
    const cup = mesh(lathe([[14, 64], [17, 66], [18, 80], [12, 82]], 24), M.rubber()); cup.position.x = x; eyes.add(cup);
  }
  // camera on the rear side port, clear of neighbours
  add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 24), dark), -0.12, 0.2, -0.2);
  add(mesh(rbox(0.06, 0.05, 0.06, 0.008), black), -0.12, 0.25, -0.2);
  add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 24), M.glassTint()), -0.12, 0.25, -0.168).rotation.x = Math.PI / 2;
  // coaxial focus knobs both sides, LED dial with a power light
  for (const sx of [-1, 1]) { knob(0.034, 0.022, dark, sx * 0.165, 0.09, 0.02, 30); knob(0.021, 0.014, M.plastic(0x3a4048, 0.4), sx * 0.184, 0.09, 0.02, 20); }
  knob(0.016, 0.012, grey, 0.16, 0.05, 0.16, 16);
  const pwr = add(mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3cff9a, toneMapped: false })), 0.12, 0.07, 0.221);
  pwr.userData.noPick = true;
  // light: warm transmitted beam, or green emission in fluorescence mode
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
  const beam = add(mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.2, 24, 1, true), beamMat, { cast: false }), 0, 0.31, 0.02);
  beam.userData.noPick = true;
  const glow = add(mesh(new THREE.CircleGeometry(0.026, 32), new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), { cast: false }), 0, 0.2095, 0.02);
  glow.rotation.x = -Math.PI / 2; glow.userData.noPick = true;
  obj.scale.setScalar(0.85);
  fx(obj, 'scope', '倒置荧光显微镜');
  return {
    obj, slots: { scope: V(0, 0.207, 0.02) },
    update() {
      const f = scopeState.mode === 2;
      beamMat.opacity = f ? 0.02 : 0.12;
      glow.material.opacity = f ? 0.55 : 0;
    },
  };
}

// ---------------------------------------------------------------- water bath

export function waterBath() {
  const obj = new THREE.Group();
  // open-topped stainless tank
  const walls = [[0.38, 0.17, 0.012, 0, 0.085, 0.144], [0.38, 0.17, 0.012, 0, 0.085, -0.144], [0.012, 0.17, 0.3, -0.184, 0.085, 0], [0.012, 0.17, 0.3, 0.184, 0.085, 0], [0.38, 0.012, 0.3, 0, 0.006, 0]];
  for (const [a, b, c, x, y, z] of walls) { const m = mesh(new THREE.BoxGeometry(a, b, c), M.steel()); m.position.set(x, y, z); obj.add(m); }
  const floorRack = mesh(new THREE.BoxGeometry(0.34, 0.006, 0.25), M.perf()); floorRack.position.y = 0.016; obj.add(floorRack);
  const water = mesh(new THREE.BoxGeometry(0.348, 0.1, 0.258), new THREE.MeshPhysicalMaterial({ color: 0x7fb6d8, roughness: 0.02, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false, envMapIntensity: 2 }), { cast: false });
  water.position.y = 0.07; water.renderOrder = 6; water.userData.noPick = true;
  obj.add(water);
  const ctl = mesh(rbox(0.38, 0.07, 0.05, 0.01), M.graphite()); ctl.position.set(0, 0.035, 0.17);
  obj.add(ctl);
  const { g: lcd, scr } = display(0.09, 0.03, 300, 100, (g, W, H) => { g.fillStyle = '#120b06'; g.fillRect(0, 0, W, H); lcdText(g, '37.0', 220, 80, 70, '#ffb35c', { align: 'right' }); g.fillStyle = '#c9a17a'; g.font = `600 26px ${MONO}`; g.fillText('°C', 232, 80); });
  lcd.position.set(-0.11, 0.037, 0.196);
  obj.add(lcd);
  scr.refresh('x');
  const tag = mesh(new THREE.PlaneGeometry(0.14, 0.03), new THREE.MeshBasicMaterial({ map: labelTex(['恒温水浴锅 37 °C'], { w: 512, h: 110, bg: '#2c3137', fg: '#dfe4ea' }), toneMapped: false }), { cast: false });
  tag.position.set(0.08, 0.037, 0.1955);
  obj.add(tag);
  return { obj, slots: { bath1: V(-0.11, 0.022, 0), bath2: V(0, 0.022, 0), bath3: V(0.11, 0.022, 0) }, update(w, dt) { water.position.y = 0.07 + Math.sin(performance.now() / 700) * 0.0004; } };
}

export function vortex() {
  const obj = new THREE.Group();
  const base = mesh(lathe([[60, 0], [62, 4], [55, 60], [45, 70]], 40), M.enamel(0xeceef0));
  const cup = mesh(lathe([[1, 0], [22, 0], [24, 8], [20, 16]], 32), M.rubber()); cup.position.y = mm(70);
  const knob = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 24), M.plastic(0xd93a43, 0.4)); knob.rotation.x = Math.PI / 2; knob.position.set(0, 0.03, 0.058);
  obj.add(base, cup, knob);
  fx(obj, 'vortex', '涡旋混匀仪');
  return { obj, slots: { vortex: V(0, mm(78), 0) }, update() {} };
}

// Rack for 15 mL tubes; holes along x at `pitch`.
export function tubeRack(ids, { pitch = 0.04, hole = 0.0095, h = 0.075, ep = false } = {}) {
  const obj = new THREE.Group();
  const n = ids.length, W = n * pitch + 0.02;
  const mat = M.plastic(ep ? 0x5fa8e8 : 0xf1f3f5, 0.45);
  const top = new THREE.Shape();
  top.moveTo(-W / 2, -0.025); top.lineTo(W / 2, -0.025); top.lineTo(W / 2, 0.025); top.lineTo(-W / 2, 0.025); top.lineTo(-W / 2, -0.025);
  ids.forEach((_, i) => { const p = new THREE.Path(); p.absarc(-W / 2 + 0.01 + pitch * (i + 0.5), 0, hole, 0, Math.PI * 2, true); top.holes.push(p); });
  const plate = mesh(new THREE.ExtrudeGeometry(top, { depth: 0.004, bevelEnabled: false }), mat);
  plate.rotation.x = -Math.PI / 2; plate.position.y = h;
  const plate2 = plate.clone(); plate2.position.y = h * 0.45;
  const legL = mesh(new THREE.BoxGeometry(0.006, h, 0.05), mat); legL.position.set(-W / 2 + 0.003, h / 2, 0);
  const legR = legL.clone(); legR.position.x = W / 2 - 0.003;
  const foot = mesh(new THREE.BoxGeometry(W, 0.004, 0.05), mat); foot.position.y = 0.002;
  obj.add(plate, plate2, legL, legR, foot);
  const slots = {};
  ids.forEach((id, i) => { slots[id] = V(-W / 2 + 0.01 + pitch * (i + 0.5), 0.004, 0); });
  return { obj, slots, update() {} };
}

export function tipWaste(bsc = false) {
  const obj = new THREE.Group();
  if (bsc) {
    const can = mesh(lathe([[44, 0], [48, 4], [52, 120], [55, 124]], 40), M.steel());
    const bag = mesh(lathe([[50, 110], [57, 120], [58, 128], [50, 132]], 40), M.plastic(0xf08a2c, 0.6));
    const sym = mesh(new THREE.CylinderGeometry(0.0515, 0.0515, 0.04, 40, 1, true, -0.5, 1), new THREE.MeshBasicMaterial({ map: labelTex(['☣ 生物废弃'], { w: 256, h: 96, bg: '#f08a2c', fg: '#2a1404' }), toneMapped: false }), { cast: false });
    sym.position.y = 0.06;
    obj.add(can, bag, sym);
  } else {
    const box = mesh(rbox(0.12, 0.13, 0.12, 0.01), M.white()); box.position.y = 0.065;
    const band = mesh(new THREE.BoxGeometry(0.122, 0.018, 0.122), M.plastic(0xf08a2c, 0.5)); band.position.y = 0.11;
    const hole = mesh(new THREE.BoxGeometry(0.08, 0.004, 0.08), M.black()); hole.position.y = 0.131;
    obj.add(box, band, hole);
  }
  fx(obj, 'waste', bsc ? '废弃物缸（退枪头、丢弃物）' : '废枪头盒');
  return { obj, slots: {}, update() {} };
}

// Linear pipette stand: hooks at the given local x positions.
export function pipetteStand(xs, { h = 0.33 } = {}) {
  const obj = new THREE.Group();
  const span = Math.max(...xs) - Math.min(...xs) + 0.07;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const base = mesh(rbox(span, 0.016, 0.1, 0.006), M.graphite()); base.position.set(cx, 0.008, 0);
  const pole = mesh(new THREE.CylinderGeometry(0.007, 0.007, h, 16), M.chrome()); pole.position.set(cx, h / 2, -0.03);
  const bar = mesh(rbox(span, 0.018, 0.03, 0.006), M.graphite()); bar.position.set(cx, h, -0.02);
  obj.add(base, pole, bar);
  for (const x of xs) { const hk = mesh(new THREE.BoxGeometry(0.008, 0.02, 0.03), M.graphite()); hk.position.set(x, h - 0.02, 0.005); obj.add(hk); }
  fx(obj, 'stand', '移液器支架（放回工具）');
  return { obj, slots: {}, update() {}, hookY: h - 0.03 };
}

// A cabinet body open at the front: side, top, bottom and back panels plus a
// front frame around the opening (ox, oy, ow, oh in body coordinates).
function openBody(W, H, D, mat, o) {
  const g = new THREE.Group();
  const t = 0.03;
  const panels = [[W, t, D, 0, H - t / 2, -D / 2], [W, t, D, 0, t / 2, -D / 2], [t, H, D, -W / 2 + t / 2, H / 2, -D / 2], [t, H, D, W / 2 - t / 2, H / 2, -D / 2], [W, H, t, 0, H / 2, -D + t / 2]];
  for (const [a, b, c, x, y, z] of panels) { const m = mesh(new THREE.BoxGeometry(a, b, c), mat); m.position.set(x, y, z); g.add(m); }
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, H); sh.lineTo(-W / 2, H); sh.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(o.x - o.w / 2, o.y); hole.lineTo(o.x + o.w / 2, o.y); hole.lineTo(o.x + o.w / 2, o.y + o.h); hole.lineTo(o.x - o.w / 2, o.y + o.h); hole.lineTo(o.x - o.w / 2, o.y);
  sh.holes.push(hole);
  const f = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }), mat);
  f.position.z = -0.04;
  g.add(f);
  return g;
}

// ---------------------------------------------------------------- CO2 incubator

export function incubator(shelves, cols) {
  const obj = new THREE.Group();
  const W = 0.78, H = 0.92, D = 0.7;
  const iw = 0.64, ih = 0.66, iy = 0.1;
  obj.add(openBody(W, H, D, M.enamel(0xf2f3f5), { x: 0, y: iy, w: iw, h: ih }));
  const cav = mesh(new THREE.BoxGeometry(iw, ih, 0.6), new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.35, roughness: 0.45, side: THREE.BackSide }));
  const glow = new THREE.PointLight(0xfff4e6, 0, 1.6); glow.position.set(0, iy + ih - 0.06, -0.15); obj.add(glow);
  cav.position.set(0, iy + ih / 2, -0.3 + 0.002);
  obj.add(cav);
  const lip = mesh(new THREE.TorusGeometry(1, 0.01, 6, 4), M.rubber()); lip.visible = false;
  obj.add(lip);
  const slots = {};
  const ys = [0.1, 0.32, 0.54].map((y) => iy + y - 0.08);
  ys.forEach((y, s) => {
    const sh = mesh(new THREE.BoxGeometry(iw - 0.01, 0.006, 0.5), M.perf()); sh.position.set(0, y, -0.28);
    obj.add(sh);
    for (let i = 0; i < cols; i++) slots[shelves[s][i]] = V(-iw / 2 + (iw / cols) * (i + 0.5), y + 0.003, -0.2);
  });
  // water pan
  const pan = mesh(new THREE.BoxGeometry(0.4, 0.03, 0.3), M.steel()); pan.position.set(0, iy + 0.015, -0.3); obj.add(pan);
  // control band
  const band = mesh(rbox(W - 0.04, 0.1, 0.02, 0.01), M.graphite()); band.position.set(0, H - 0.07, 0.006);
  obj.add(band);
  const { g: lcd, scr } = display(0.3, 0.06, 720, 144, (g, Wd, Hd) => {
    g.fillStyle = '#071410'; g.fillRect(0, 0, Wd, Hd);
    g.fillStyle = '#7fa597'; g.font = `500 22px ${FONT}`; g.textAlign = 'left';
    g.fillText('温度 °C', 20, 30); g.fillText('CO₂ %', 270, 30); g.fillText('湿度 %', 500, 30);
    lcdText(g, '37.0', 200, 120, 78, '#5dffb0', { align: 'right' });
    lcdText(g, '5.0', 430, 120, 78, '#5dffb0', { align: 'right' });
    lcdText(g, '95', 640, 120, 78, '#5dffb0', { align: 'right' });
  });
  lcd.position.set(-0.12, H - 0.07, 0.018);
  scr.refresh('x');
  const name = mesh(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshBasicMaterial({ map: labelTex(['CO₂ 培养箱'], { w: 512, h: 96, bg: '#2c3137', fg: '#e6eaee' }), toneMapped: false }), { cast: false });
  name.position.set(0.22, H - 0.07, 0.0175);
  obj.add(lcd, name);
  // door hinged on the left
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, 0.012);
  const door = mesh(rbox(W - 0.02, H - 0.16, 0.05, 0.03), M.enamel(0xf4f5f6)); door.position.set(W / 2, (H - 0.16) / 2 + 0.01, 0.0);
  const inset = mesh(rbox(W - 0.16, H - 0.32, 0.01, 0.02), M.enamel(0xe7eaed)); inset.position.set(W / 2, (H - 0.16) / 2 + 0.01, 0.028);
  const handle = mesh(rbox(0.024, 0.2, 0.03, 0.01), M.graphite()); handle.position.set(W - 0.06, (H - 0.16) / 2, 0.04);
  hinge.add(door, inset, handle);
  obj.add(hinge);
  fx(hinge, 'inc-door', '培养箱门');
  fx(lip, 'inc-door', '培养箱门');
  return {
    obj, slots,
    update(w) {
      const open = w.inst.incubator.door;
      hinge.rotation.y += ((open ? -1.85 : 0) - hinge.rotation.y) * 0.22;
      glow.intensity = open ? 1.2 : 0;
    },
  };
}

// ---------------------------------------------------------------- fridge & freezer

export function fridge(kind, shelves, cols) {
  const obj = new THREE.Group();
  const freezer = kind === 'freezer';
  const W = freezer ? 0.6 : 0.72, H = freezer ? 0.86 : 1.02, D = 0.6;
  const iw = W - 0.08, ih = H - (freezer ? 0.26 : 0.12), iy = 0.06;
  obj.add(openBody(W, H, D, M.enamel(0xf2f3f5), { x: 0, y: iy, w: iw, h: ih }));
  const cav = mesh(new THREE.BoxGeometry(iw, ih, 0.52), new THREE.MeshStandardMaterial({ color: freezer ? 0xdde6ee : 0xeef2f5, roughness: 0.6, side: THREE.BackSide }));
  cav.position.set(0, iy + ih / 2, -0.27);
  obj.add(cav);
  const light = new THREE.PointLight(freezer ? 0xdfefff : 0xfff8ee, 0, 1.2);
  light.position.set(0, iy + ih - 0.05, -0.1);
  obj.add(light);
  const slots = {};
  const n = shelves.length;
  for (let s = 0; s < n; s++) {
    const y = iy + 0.02 + (s * (ih - 0.08)) / n;
    const sh = mesh(new THREE.BoxGeometry(iw - 0.01, 0.006, 0.46), freezer ? M.perf() : M.glassTint()); sh.position.set(0, y, -0.27);
    if (!freezer) sh.material = new THREE.MeshPhysicalMaterial({ color: 0xe6f1f6, roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 });
    obj.add(sh);
    for (let i = 0; i < cols; i++) slots[shelves[s][i]] = V(-iw / 2 + (iw / cols) * (i + 0.5), y + 0.003, -0.17);
  }
  let lcdScr = null;
  if (freezer) {
    const { g: lcd, scr } = display(0.16, 0.05, 400, 125, (g, Wd, Hd) => { g.fillStyle = '#06101a'; g.fillRect(0, 0, Wd, Hd); lcdText(g, '-20.0', 300, 96, 76, '#7ec8ff', { align: 'right' }); g.fillStyle = '#7ea6c8'; g.font = `600 26px ${MONO}`; g.fillText('°C', 312, 96); });
    lcd.position.set(0, H - 0.1, 0.006);
    scr.refresh('x');
    lcdScr = scr;
    obj.add(lcd);
  }
  const hinge = new THREE.Group(); hinge.position.set(freezer ? W / 2 : -W / 2, 0, 0.012);
  const dH = freezer ? H - 0.2 : H - 0.04;
  const sgn = freezer ? -1 : 1;
  const frame = mesh(rbox(W - 0.02, dH, 0.045, 0.025), freezer ? M.enamel(0xf4f5f6) : M.graphite()); frame.position.set(sgn * (W / 2), dH / 2 + 0.02, 0);
  hinge.add(frame);
  frame.material = M.enamel(0xf4f5f6);
  const tag = mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: labelTex([freezer ? '−20 °C 低温冰箱' : '4 °C 试剂冰箱'], { w: 512, h: 128, bg: '#f4f5f6', fg: '#3a4450' }), toneMapped: false }), { cast: false });
  tag.position.set(sgn * (W / 2), dH - 0.06, 0.024); hinge.add(tag);
  const handle = mesh(rbox(0.022, 0.24, 0.03, 0.01), M.chrome()); handle.position.set(sgn * (W - 0.06), dH / 2, 0.04);
  hinge.add(handle);
  obj.add(hinge);
  const id = freezer ? 'freezer-door' : 'fridge-door';
  fx(hinge, id, freezer ? '−20 °C 冰箱门' : '4 °C 冰箱门');
  return {
    obj, slots, lcd: lcdScr,
    update(w) {
      const open = w.inst[kind].door;
      hinge.rotation.y += ((open ? sgn * -1.9 : 0) - hinge.rotation.y) * 0.22;
      light.intensity = open ? 0.9 : 0;
    },
  };
}

// ---------------------------------------------------------------- plate reader & workstation

export function plateReader() {
  const obj = new THREE.Group();
  const body = mesh(rbox(0.44, 0.22, 0.44, 0.025), M.enamel(0xf0f1f3)); body.position.set(0, 0.11, 0);
  const top = mesh(rbox(0.442, 0.05, 0.442, 0.025), M.graphite()); top.position.set(0, 0.205, 0);
  obj.add(body, top);
  const { g: lcd, scr } = display(0.13, 0.04, 400, 124, (g, W, H, wl, drawer) => {
    g.fillStyle = '#071410'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7fa597'; g.font = `500 20px ${FONT}`; g.textAlign = 'left'; g.fillText('吸光度 · 波长', 14, 26);
    lcdText(g, String(wl), 250, 108, 72, '#5dffb0', { align: 'right' });
    g.fillStyle = '#7fa597'; g.font = `600 24px ${MONO}`; g.fillText('nm', 262, 108);
    g.font = `500 18px ${FONT}`; g.fillText(typeof drawer === 'string' ? drawer : drawer ? '托盘已弹出' : '就绪', 330, 30);
  });
  lcd.position.set(0.12, 0.17, 0.222);
  obj.add(lcd);
  const brand = mesh(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshBasicMaterial({ map: labelTex(['多功能酶标仪'], { w: 512, h: 96, bg: '#f0f1f3', fg: '#3a4450' }), toneMapped: false }), { cast: false });
  brand.position.set(-0.11, 0.18, 0.2215);
  obj.add(brand);
  const slotFrame = mesh(rbox(0.2, 0.024, 0.01, 0.006), M.black()); slotFrame.position.set(-0.07, 0.09, 0.222); obj.add(slotFrame);
  const drawer = new THREE.Group();
  const tray = mesh(rbox(0.16, 0.012, 0.11, 0.004), M.graphite()); tray.position.set(0, 0, 0);
  drawer.add(tray);
  drawer.position.set(-0.07, 0.09, 0.16);
  obj.add(drawer);
  fx(obj, 'reader', '酶标仪');
  const slot = new THREE.Object3D(); slot.position.set(-0.064, 0.0065, -0.043); drawer.add(slot);
  // Scan light: after each read a bead of light steps across the 12 columns
  // along the drawer slot (≈1.6 s), mirroring the optics moving over the plate.
  const beam = mesh(new THREE.PlaneGeometry(0.012, 0.016), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0, toneMapped: false }), { cast: false });
  beam.position.set(-0.07, 0.09, 0.2285); beam.userData.noPick = true; obj.add(beam);
  let seen = null, scan = null;
  return {
    obj, slots: { drawer: slot },
    update(w, dt = 1 / 60) {
      const r = w.inst.reader;
      if (w.readSeq !== seen) { if (seen != null || w.readSeq) scan = { t: 0 }; seen = w.readSeq; }
      let label = r.drawer;
      if (scan) {
        scan.t += dt;
        const col = Math.min(11, Math.floor(scan.t / 0.13));
        beam.position.x = -0.07 - 0.088 + col * 0.016;
        beam.material.opacity = scan.t < 1.6 ? 0.95 : Math.max(0, 1 - (scan.t - 1.6) * 4);
        label = scan.t < 1.6 ? `读板 ${col + 1}/12` : r.drawer;
        if (scan.t > 1.9) { scan = null; beam.material.opacity = 0; }
      }
      scr.refresh(`${r.wl}${label}`, r.wl, label);
      drawer.position.z += ((r.drawer ? 0.32 : 0.16) - drawer.position.z) * 0.25;
    },
  };
}

export function monitor(id, label, drawScreen) {
  const obj = new THREE.Group();
  const foot = mesh(rbox(0.22, 0.012, 0.16, 0.006), M.chrome()); foot.position.set(0, 0.006, -0.05);
  const neck = mesh(rbox(0.05, 0.26, 0.02, 0.008), M.chrome()); neck.position.set(0, 0.14, -0.08);
  const bez = mesh(rbox(0.62, 0.38, 0.024, 0.012), M.black()); bez.position.set(0, 0.34, -0.06);
  const scr = screen(1280, 768, drawScreen);
  const panel = mesh(new THREE.PlaneGeometry(0.6, 0.36), scr.mat, { cast: false }); panel.position.set(0, 0.345, -0.047);
  const kb = mesh(rbox(0.36, 0.014, 0.12, 0.006), M.enamel(0xe8ebee)); kb.position.set(0, 0.007, 0.17);
  const mouse = mesh(new THREE.SphereGeometry(0.03, 20, 12), M.enamel(0xeef0f2)); mouse.scale.set(0.7, 0.35, 1.1); mouse.position.set(0.27, 0.01, 0.17);
  obj.add(foot, neck, bez, panel, kb, mouse);
  fx(obj, id, label);
  scr.refresh('idle');
  return { obj, slots: {}, scr, update() {} };
}

// ---------------------------------------------------------------- biosafety cabinet

export function bscCabinet() {
  const obj = new THREE.Group();
  const W = 1.5, D = 0.62, Hin = 0.72;
  const surf = mesh(new THREE.BoxGeometry(W, 0.012, D), M.perf());
  surf.material = M.steel();
  surf.position.set(0, -0.006, -D / 2 + 0.04);
  const grille = mesh(new THREE.BoxGeometry(W, 0.012, 0.06), M.perf()); grille.position.set(0, -0.004, 0.04);
  const back = mesh(new THREE.BoxGeometry(W, Hin, 0.01), M.perf()); back.position.set(0, Hin / 2, -D + 0.04);
  back.material = (() => { const m = M.perf().clone(); m.map = M.perf().map.clone(); m.map.repeat.set(30, 14); m.map.needsUpdate = true; return m; })();
  const sideL = mesh(new THREE.BoxGeometry(0.01, Hin, D), M.steel()); sideL.position.set(-W / 2, Hin / 2, -D / 2 + 0.04);
  const sideR = sideL.clone(); sideR.position.x = W / 2;
  const ceil = mesh(new THREE.BoxGeometry(W, 0.02, D), M.enamel(0xe9ecef)); ceil.position.set(0, Hin, -D / 2 + 0.04);
  const lightBar = mesh(new THREE.BoxGeometry(W - 0.1, 0.012, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); lightBar.position.set(0, Hin - 0.016, -0.12);
  lightBar.userData.noPick = true;
  const uvTube = mesh(new THREE.CylinderGeometry(0.008, 0.008, W - 0.2, 12), new THREE.MeshBasicMaterial({ color: 0x9b7bff, toneMapped: false })); uvTube.rotation.z = Math.PI / 2; uvTube.position.set(0, Hin - 0.03, -D + 0.12);
  uvTube.userData.noPick = true;
  // UV look: a halo around the tube, light shafts falling to the surface, a
  // violet spot that throws shadows, and the lower sash pane that closes.
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g2 = c.getContext('2d'); const gr = g2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(c); return t; })();
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 128; const g2 = c.getContext('2d'); const gr = g2.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 16, 128); return new THREE.CanvasTexture(c); })();
  const addMat = (map, op) => new THREE.MeshBasicMaterial({ color: 0x9a6bff, map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const halo = mesh(new THREE.PlaneGeometry(W - 0.16, 0.09), addMat(haloTex), { cast: false });
  halo.position.set(0, Hin - 0.03, -D + 0.125); halo.userData.noPick = true;
  const shafts = [];
  for (let i = 0; i < 4; i++) {
    const sh = mesh(new THREE.PlaneGeometry(W * (0.22 + 0.06 * (i % 2)), Hin - 0.04), addMat(glowTex), { cast: false });
    sh.position.set(-0.5 + i * 0.33, (Hin - 0.04) / 2, -D + 0.2 + 0.07 * i);
    sh.rotation.x = -0.32 - 0.05 * i; sh.userData.noPick = true; sh.renderOrder = 6;
    shafts.push(sh);
  }
  const shutter = mesh(new THREE.BoxGeometry(W, 0.44, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xc9b8ff, roughness: 0.05, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false }), { cast: false });
  shutter.userData.noPick = true;
  const signTex = (on) => labelTex(['紫外灯工作中 · 请勿操作'], { w: 640, h: 96, bg: on ? '#2a0f5c' : '#1b1f26', fg: on ? '#e9ddff' : '#59606b' });
  const signMats = [new THREE.MeshBasicMaterial({ map: signTex(false), toneMapped: false }), new THREE.MeshBasicMaterial({ map: signTex(true), toneMapped: false })];
  const sign = mesh(new THREE.PlaneGeometry(0.3, 0.045), signMats[0], { cast: false });
  sign.position.set(-0.45, Hin + 0.2, 0.101); sign.userData.noPick = true;
  // front: sash frame + glass above the opening
  const sashY = 0.45;
  const frame = mesh(rbox(W + 0.06, 0.05, 0.04, 0.01), M.enamel(0xeef0f2)); frame.position.set(0, sashY, 0.08);
  const sash = mesh(new THREE.BoxGeometry(W, 0.5, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xe4f0f6, roughness: 0.02, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false, envMapIntensity: 2.4 }), { cast: false });
  sash.position.set(0, sashY + 0.27, 0.07); sash.rotation.x = -0.08; sash.userData.noPick = true;
  const header = mesh(new THREE.BoxGeometry(W + 0.1, 0.3, 0.1), M.enamel(0xf0f2f4)); header.position.set(0, Hin + 0.2, 0.05);
  const arm = mesh(rbox(W + 0.06, 0.035, 0.07, 0.016), M.enamel(0xe6e9ec)); arm.position.set(0, -0.012, 0.1);
  const front = mesh(new THREE.BoxGeometry(W + 0.1, 0.9, 0.04), M.enamel(0xdde1e5)); front.position.set(0, -0.48, 0.1);
  obj.add(surf, grille, back, sideL, sideR, ceil, lightBar, uvTube, halo, ...shafts, shutter, sign, frame, sash, header, arm, front);
  // control display on the sash frame
  const panel = new THREE.Group(); panel.position.set(0.04, sashY + 0.004, 0.102); panel.rotation.x = -0.25;
  const { g: lcd, scr } = display(0.2, 0.036, 800, 144, (g, Wd, Hd, b, t) => {
    g.fillStyle = '#06120d'; g.fillRect(0, 0, Wd, Hd);
    g.fillStyle = '#7fa597'; g.font = `500 22px ${FONT}`; g.textAlign = 'left'; g.fillText('下降气流 m/s', 16, 30);
    const warm = b.fan ? Math.min(1, (t - b.fanSince) / 5) : 0;
    const v = !b.fan ? ' --' : warm < 1 ? (0.3 + 0.15 * warm).toFixed(2) : '0.45';
    lcdText(g, v, 210, 124, 82, !b.fan ? '#3f5a50' : warm < 1 ? '#f3b64a' : '#5dffb0', { align: 'right' });
    g.textAlign = 'left'; // lcdText leaves it right-aligned
    g.font = `700 44px ${FONT}`; g.fillStyle = b.uv ? '#c9b6ff' : '#cfe9df';
    if (b.uv) {
      const left = b.uvSince != null ? Math.max(0, (b.uvMin || 15) - (t - b.uvSince)) : null;
      g.fillStyle = '#c9b6ff'; g.fillText('紫外灭菌', 250, 70);
      g.font = `500 28px ${FONT}`; g.fillStyle = '#9d8ad0';
      g.fillText(left == null ? '点「紫外」关闭后才能操作' : `剩余 ${String(Math.floor(left)).padStart(2, '0')}:${String(Math.floor((left % 1) * 60)).padStart(2, '0')} · Z 等待`, 250, 120);
      return;
    }
    const st = !b.fan ? '风机关闭' : warm < 1 ? '气流稳定中' : '气流正常';
    g.fillText(st, 250, 70);
    g.font = `500 28px ${FONT}`; g.fillStyle = '#9cc2b4';
    g.fillText(!b.fan ? '点「风机」启动层流' : warm < 1 ? `还需约 ${Math.ceil(5 - (t - b.fanSince))} 分钟（Z 等待）` : b.wiped ? '台面已用 75% 酒精擦拭' : '台面未擦拭（悬停台面按 A）', 250, 120);
  });
  panel.add(lcd);
  const bFan = button(0.05, 0.03, 0x1b2530, '风机', 'bsc-fan'); bFan.position.set(0.15, 0, 0);
  const bUV = button(0.05, 0.03, 0x1b2530, '紫外', 'bsc-uv'); bUV.position.set(0.21, 0, 0);
  const ledF = mesh(new THREE.SphereGeometry(0.003, 10, 8), new THREE.MeshBasicMaterial({ color: 0x35414c, toneMapped: false })); ledF.position.set(0.17, 0.011, 0.004);
  const ledU = ledF.clone(); ledU.material = ledF.material.clone(); ledU.position.x = 0.23;
  panel.add(bFan, bUV, ledF, ledU);
  obj.add(panel);
  // the work surface itself (for wiping)
  fx(surf, 'bsc-surface', '安全柜台面');
  const lights = {
    work: new THREE.RectAreaLight ? null : null,
    spot: new THREE.SpotLight(0xffffff, 0, 3, 1.1, 0.6, 1.2),
    uv: new THREE.PointLight(0x8f6bff, 0, 2.2),
    uvSpot: new THREE.SpotLight(0x6a46ff, 0, 1.6, 0.95, 0.9, 1.4),
  };
  lights.uvSpot.position.set(0, Hin - 0.05, -D + 0.16);
  lights.uvSpot.target.position.set(0.05, 0, -0.26);
  lights.uvSpot.castShadow = true; lights.uvSpot.shadow.mapSize.set(1024, 1024); lights.uvSpot.shadow.bias = -0.0006;
  obj.add(lights.uvSpot, lights.uvSpot.target);
  let uvK = 0, tPhase = 0;
  lights.spot.position.set(0, Hin - 0.03, -0.12);
  lights.spot.target.position.set(0, 0, -0.25);
  lights.spot.castShadow = true;
  lights.spot.shadow.mapSize.set(1024, 1024);
  lights.spot.shadow.bias = -0.0005;
  lights.uv.position.set(0, Hin - 0.05, -D + 0.15);
  obj.add(lights.spot, lights.spot.target, lights.uv);
  return {
    obj, slots: {}, sashY,
    update(w) {
      const b = w.bsc;
      scr.refresh(`${b.fan}|${b.uv}|${b.wiped}|${b.fan ? Math.floor((w.t - b.fanSince) * 4) : 0}|${b.uv && b.uvSince != null ? Math.floor((w.t - b.uvSince) * 60) : 0}`, b, w.t);
      // UV fades in and out over ~0.6 s; the shafts breathe slowly
      uvK += ((b.uv ? 1 : 0) - uvK) * 0.08;
      if (Math.abs(uvK - (b.uv ? 1 : 0)) < 0.002) uvK = b.uv ? 1 : 0;
      tPhase += 0.016;
      const still = document.documentElement.classList.contains('reduce-motion');
      halo.material.opacity = 0.9 * uvK;
      shafts.forEach((sh, i) => { sh.material.opacity = uvK * (0.2 + (still ? 0 : 0.06 * Math.sin(tPhase * 0.9 + i * 1.7))); sh.visible = uvK > 0.01; });
      halo.visible = uvK > 0.01;
      lights.uvSpot.intensity = 3.2 * uvK;
      shutter.position.set(0, sashY + 0.27 - 0.47 * uvK, 0.062);
      shutter.visible = uvK > 0.01;
      sign.material = signMats[b.uv ? 1 : 0];
      obj.userData.uvK = uvK;
      ledF.material.color.set(b.fan ? 0x5dffb0 : 0x35414c);
      ledU.material.color.set(b.uv ? 0xa98bff : 0x35414c);
      lightBar.material.color.set(b.light ? 0xffffff : 0x6d737a);
      lights.spot.intensity = b.light ? 6 : 0;
      lights.uv.intensity = 0.5 * uvK;
      uvTube.material.color.setRGB(0.29 + 2.6 * uvK, 0.25 + 1.7 * uvK, 0.42 + 3.8 * uvK);
    },
  };
}
