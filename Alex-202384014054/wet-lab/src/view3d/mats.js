// Alex 202384014054
// Shared materials and procedural textures for the 3D lab. Units are metres.

import * as THREE from 'three';

const cache = new Map();
// Materials and textures made through once() are shared by many models and
// stations; disposal must leave them alone (see dispose.js).
const SHARED = new WeakSet();
const once = (k, f) => { if (!cache.has(k)) { const v = f(); cache.set(k, v); SHARED.add(v); } return cache.get(k); };
export const isShared = (x) => SHARED.has(x);

export const FONT = '"PingFang SC","Noto Sans SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
export const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- textures

export const brushedTex = () => once('brushed', () => {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rand(7);
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const y = r() * 512, l = 40 + r() * 300, x = r() * 512, v = 110 + r() * 60;
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 1.2); g.stroke();
  }
  return tex(c, { srgb: false });
});

export const perfTex = (pitch = 12) => once(`perf${pitch}`, () => {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1a1d21';
  for (let y = 0; y < 256; y += pitch) for (let x = (y / pitch) % 2 ? pitch / 2 : 0; x < 256; x += pitch) { g.beginPath(); g.arc(x + 2, y + 2, pitch * 0.22, 0, 7); g.fill(); }
  return tex(c);
});

export const tileTex = () => once('tile', () => {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rand(3);
  g.fillStyle = '#c9cfd5'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 236 + (r() - 0.5) * 8;
    g.fillStyle = `rgb(${v},${v + 1},${v + 3})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    const gr = g.createLinearGradient(x * 128, y * 128, x * 128 + 128, y * 128 + 128);
    gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.04)');
    g.fillStyle = gr; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
  }
  return tex(c);
});

export const epoxyTex = () => once('epoxy', () => {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rand(11);
  g.fillStyle = '#2b2f35'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 40 + r() * 40; g.fillStyle = `rgba(${v},${v + 2},${v + 5},.5)`; g.fillRect(r() * 512, r() * 512, 1.2, 1.2); }
  return tex(c);
});

export const noiseTex = (seed = 1) => once(`noise${seed}`, () => {
  const c = canvas(256, 256), g = c.getContext('2d'), d = g.createImageData(256, 256), r = rand(seed);
  for (let i = 0; i < d.data.length; i += 4) { const v = 120 + r() * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return tex(c, { srgb: false });
});

// Graduation marks for tubes and serological pipettes: a strip wrapped on the
// front of the tube. `marks` = [[uFrom0to1, major, label]].
export function gradTex(marks, { w = 128, h = 1024, color = '#1d2530', frost = true } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  if (frost) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(w * 0.08, h * 0.08, w * 0.5, h * 0.12); }
  g.strokeStyle = color; g.fillStyle = color;
  g.font = `600 ${Math.round(w * 0.16)}px ${MONO}`;
  for (const [u, major, label] of marks) {
    const y = h * (1 - u);
    g.lineWidth = major ? 3 : 1.6;
    g.beginPath(); g.moveTo(w * 0.62, y); g.lineTo(w * (major ? 0.95 : 0.8), y); g.stroke();
    if (label) g.fillText(label, w * 0.18, y + w * 0.06);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A printed label (white sticker) with text lines.
export function labelTex(lines, { w = 512, h = 160, bg = '#f7f8fa', fg = '#1d2530', band = null } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (band) { g.fillStyle = band; g.fillRect(0, 0, w, h * 0.22); }
  g.fillStyle = fg; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((s, i) => {
    const size = i === 0 ? h * (n > 1 ? 0.3 : 0.42) : h * 0.2;
    g.font = `${i === 0 ? 700 : 500} ${size}px ${FONT}`;
    let txt = String(s);
    while (g.measureText(txt).width > w * 0.92 && txt.length > 2) txt = txt.slice(0, -1);
    g.fillText(txt, w * 0.04, (band ? h * 0.22 : 0) + ((i + 0.5) * (h - (band ? h * 0.22 : 0))) / n);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A live instrument display. draw(g, w, h) is called on refresh().
export function screen(w, h, draw) {
  const c = canvas(w, h), g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  let sig = null;
  return {
    mat, tex: t, canvas: c,
    refresh(key, ...args) { if (key === sig) return; sig = key; g.save(); draw(g, w, h, ...args); g.restore(); t.needsUpdate = true; },
  };
}

// Seven-segment-ish digits drawn as a font with a ghost of unlit segments.
export function lcdText(g, text, x, y, size, color, { align = 'left', ghost = true } = {}) {
  g.font = `600 ${size}px ${MONO}`;
  g.textAlign = align; g.textBaseline = 'alphabetic';
  if (ghost) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillText(String(text).replace(/[0-9]/g, '8'), x, y); }
  g.shadowColor = color; g.shadowBlur = size * 0.35;
  g.fillStyle = color; g.fillText(text, x, y);
  g.shadowBlur = 0;
}

// Soft contact shadow: a blurred rounded footprint, stretched to an item's base.
export const contactTex = () => once('contact', () => {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.filter = 'blur(18px)'; g.fillStyle = '#000';
  const r = 40; g.beginPath(); g.roundRect ? g.roundRect(52, 52, 152, 152, r) : g.rect(52, 52, 152, 152); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
});
export function contactShadow(w, d, opacity = 0.42) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: contactTex(), transparent: true, opacity, depthWrite: false, color: 0x000000, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1; m.userData.noPick = true;
  return m;
}

// ---------------------------------------------------------------- materials

export const M = {
  steel: () => once('m-steel', () => new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 1, roughness: 0.32, roughnessMap: brushedTex() })),
  steelDark: () => once('m-steelD', () => new THREE.MeshStandardMaterial({ color: 0x8b9198, metalness: 1, roughness: 0.42, roughnessMap: brushedTex() })),
  chrome: () => once('m-chrome', () => new THREE.MeshStandardMaterial({ color: 0xe8ebee, metalness: 1, roughness: 0.12 })),
  enamel: (c = 0xeef0f2) => once(`m-enamel${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3 })),
  plastic: (c = 0x2b3038, r = 0.5) => once(`m-plastic${c}-${r}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 })),
  rubber: () => once('m-rubber', () => new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.85 })),
  glass: () => once('m-glass', () => new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1 })),
  glassTint: () => once('m-glassT', () => new THREE.MeshPhysicalMaterial({ color: 0xdfeef5, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.18, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 })),
  // Clear polypropylene/polystyrene: cheaper than transmission and reads well small.
  clearPP: () => once('m-pp', () => new THREE.MeshPhysicalMaterial({ color: 0xf4f7fa, roughness: 0.18, transparent: true, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 })),
  frostPP: () => once('m-frost', () => new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, roughness: 0.55, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })),
  white: () => once('m-white', () => new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.5 })),
  black: () => once('m-black', () => new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.55 })),
  graphite: () => once('m-graph', () => new THREE.MeshStandardMaterial({ color: 0x2c3137, roughness: 0.45, metalness: 0.2 })),
  screenOff: () => once('m-scroff', () => new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.15, metalness: 0.2 })),
  epoxy: () => once('m-epoxy', () => new THREE.MeshStandardMaterial({ map: epoxyTex(), roughness: 0.35, metalness: 0 })),
  tile: () => once('m-tile', () => { const t = tileTex().clone(); t.needsUpdate = true; t.repeat.set(10, 3); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }); }),
  perf: () => once('m-perf', () => { const t = perfTex().clone(); t.needsUpdate = true; t.repeat.set(30, 12); return new THREE.MeshStandardMaterial({ color: 0xd2d6db, map: t, metalness: 0.85, roughness: 0.38 }); }),
};

export function liquidMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
}

// Liquid colour from sim/liquid.js color(): 'rgb(r,g,b)' + alpha + haze.
export function setLiquid(mat, c) {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.fill);
  if (m) mat.color.setRGB(m[1] / 255, m[2] / 255, m[3] / 255, THREE.SRGBColorSpace);
  mat.opacity = Math.min(0.94, 0.28 + c.alpha * 0.7 + (c.haze || 0) * 0.4);
  mat.roughness = 0.08 + (c.haze || 0) * 0.6;
}

// ---------------------------------------------------------------- geometry helpers

export function rbox(w, h, d, r = 0.004, seg = 3) {
  // Rounded box from an extruded rounded rectangle (front face along +z).
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(r * 0.6, d * 0.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, d - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: seg, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * bev) / 2);
  g.computeVertexNormals();
  return g;
}

export function mesh(geo, mat, { cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

// Lathe from [radius, y] pairs in millimetres.
export function lathe(pts, seg = 40) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r / 1000, y / 1000)), seg);
}

export function fx(obj, id, label) {
  obj.traverse((o) => { if (o.isMesh) { o.userData.fx = id; o.userData.label = label; } });
  obj.userData.fx = id; obj.userData.label = label;
  return obj;
}
