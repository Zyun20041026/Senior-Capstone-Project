// Alex 202384014054
// The WebGL layer: one renderer, three scenes (the station, the cabinet deck
// seen from above, the cart), projection helpers and fixture ray-picking.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const STAGE = { w: 1600, h: 900 };

export function createGL(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setSize(STAGE.w, STAGE.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  const mk = () => { const s = new THREE.Scene(); s.environment = env; return s; };
  const G = {
    renderer, env,
    main: mk(), deck: mk(), tray: mk(),
    cam: new THREE.PerspectiveCamera(36, STAGE.w / STAGE.h, 0.02, 30),
    deckCam: new THREE.OrthographicCamera(0, 1, 0, -1, -1, 2),
    trayCam: new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10),
    deckRect: null, trayRect: null,
    camGoal: null, camT: 1,
  };
  G.main.environmentIntensity = 0.55;
  G.main.background = new THREE.Color(0xc9d0d7);
  G.deck.environmentIntensity = 0.45;
  G.tray.environmentIntensity = 0.8;

  // Deck: top-down, world metres = screen px / pxPerM, A1 corner at the slot.
  G.setDeck = (rect, pxPerM) => {
    G.deckRect = rect;
    if (!rect) return;
    const c = G.deckCam;
    // Looking down with up = −z: camera x is world x, camera y is world −z,
    // and screen y (down) is world +z.
    c.position.set(0, 1, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0);
    c.left = rect.x / pxPerM; c.right = (rect.x + rect.w) / pxPerM;
    c.top = -rect.y / pxPerM; c.bottom = -(rect.y + rect.h) / pxPerM;
    c.updateProjectionMatrix();
  };
  // Cart: screen px as world units (y flipped), seen from the front.
  G.setTray = (rect) => {
    G.trayRect = rect;
    const c = G.trayCam;
    c.left = rect.x; c.right = rect.x + rect.w; c.top = -rect.y; c.bottom = -(rect.y + rect.h);
    c.position.set(0, 0, 5); c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
  };

  // Smooth camera moves between stations and into instruments.
  G.setCamera = (pos, look, fov, instant = false) => {
    const goal = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov };
    if (instant || !G.camGoal) {
      G.cam.position.copy(goal.pos); G.cam.fov = fov; G.cam.lookAt(goal.look); G.cam.updateProjectionMatrix();
      G.camFrom = { pos: goal.pos.clone(), look: goal.look.clone(), fov }; G.camGoal = goal; G.camT = 1;
      G.camLook = goal.look.clone();
      return;
    }
    G.camFrom = { pos: G.cam.position.clone(), look: G.camLook.clone(), fov: G.cam.fov };
    G.camGoal = goal; G.camT = 0;
  };
  G.stepCamera = (dt) => {
    if (G.camT >= 1) return false;
    G.camT = Math.min(1, G.camT + dt / 0.55);
    const k = G.camT < 0.5 ? 4 * G.camT ** 3 : 1 - (-2 * G.camT + 2) ** 3 / 2;
    G.cam.position.lerpVectors(G.camFrom.pos, G.camGoal.pos, k);
    G.camLook = G.camFrom.look.clone().lerp(G.camGoal.look, k);
    G.cam.fov = G.camFrom.fov + (G.camGoal.fov - G.camFrom.fov) * k;
    G.cam.lookAt(G.camLook); G.cam.updateProjectionMatrix();
    return true;
  };

  // Live GPU resource counts (geometries, textures), for leak checks.
  G.memory = () => ({ ...renderer.info.memory });
  G.resize = (scale) => {
    const pr = Math.max(0.75, Math.min(1.75, (window.devicePixelRatio || 1) * scale));
    if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) { renderer.setPixelRatio(pr); renderer.setSize(STAGE.w, STAGE.h, false); }
  };

  const vp = (r) => [r.x, STAGE.h - r.y - r.h, r.w, r.h];
  // Bloom only while something glows (the cabinet's UV lamp): the room goes
  // dark, the environment light drops and bright emitters bleed.
  let fx = null;
  const bg0 = G.main.background.clone(), bgUV = new THREE.Color(0x07050f);
  const bloom = () => {
    if (fx && fx.pr === renderer.getPixelRatio()) return fx;
    if (fx) { fx.b.dispose(); fx.c.dispose(); } // a new resolution: free the old render targets
    const c = new EffectComposer(renderer);
    c.setPixelRatio(renderer.getPixelRatio()); c.setSize(STAGE.w, STAGE.h);
    c.addPass(new RenderPass(G.main, G.cam));
    const b = new UnrealBloomPass(new THREE.Vector2(STAGE.w, STAGE.h), 0.8, 0.6, 0.78);
    c.addPass(b); c.addPass(new OutputPass());
    fx = { c, b, pr: renderer.getPixelRatio() };
    return fx;
  };
  G.render = (opts = {}) => {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, STAGE.w, STAGE.h);
    renderer.clear();
    const uv = opts.uv || 0;
    G.main.environmentIntensity = 0.55 * (1 - 0.88 * uv);
    G.main.background.copy(bg0).lerp(bgUV, uv);
    if (uv > 0.01) {
      const f = bloom();
      f.b.strength = 0.85 * uv;
      f.c.render();
      renderer.setRenderTarget(null);
    } else renderer.render(G.main, G.cam);
    if (G.trayRect) {
      renderer.setScissorTest(true);
      renderer.setViewport(...vp(G.trayRect)); renderer.setScissor(...vp(G.trayRect));
      renderer.setClearColor(0x141a22, 1); renderer.clear();
      renderer.render(G.tray, G.trayCam);
      renderer.setClearColor(0x000000, 1);
    }
    renderer.setScissorTest(false);
  };

  // ------------------------------------------------------------ projection

  const v = new THREE.Vector3();
  G.toScreen = (p, cam = G.cam, rect = null) => {
    v.copy(p).project(cam);
    if (!rect) return { x: (v.x + 1) * 0.5 * STAGE.w, y: (1 - v.y) * 0.5 * STAGE.h, z: v.z };
    return { x: rect.x + (v.x + 1) * 0.5 * rect.w, y: rect.y + (1 - v.y) * 0.5 * rect.h, z: v.z };
  };
  const box = new THREE.Box3();
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  G.rectOf = (obj, cam = G.cam, rect = null) => {
    box.setFromObject(obj);
    if (box.isEmpty()) return null;
    const { min, max } = box;
    let i = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners[i++].set(x, y, z);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of corners) { const s = G.toScreen(c, cam, rect); x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
    return { x0, y0, x1, y1 };
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  G.ray = (x, y) => { ndc.set((x / STAGE.w) * 2 - 1, 1 - (y / STAGE.h) * 2); ray.setFromCamera(ndc, G.cam); return ray; };
  // First fixture under the pointer (meshes tagged userData.fx).
  G.pickFx = (x, y, roots) => {
    const r = G.ray(x, y);
    const hits = r.intersectObjects(roots, true);
    for (const h of hits) {
      if (!h.object.visible || h.object.userData.noPick) continue;
      let o = h.object;
      while (o && !o.userData.fx && o.userData.item == null) o = o.parent;
      if (o && o.userData.fx) return { id: o.userData.fx, label: o.userData.label, point: h.point };
      if (o && o.userData.item != null) return null; // an item is in front
      if (!h.object.material?.transparent) return null; // solid wall in front
    }
    return null;
  };
  // Where the pointer ray meets a horizontal plane.
  const plane = new THREE.Plane();
  G.onPlaneY = (x, y, h, out = new THREE.Vector3()) => {
    plane.set(new THREE.Vector3(0, 1, 0), -h);
    return G.ray(x, y).ray.intersectPlane(plane, out);
  };
  G.onPlaneZ = (x, y, z, out = new THREE.Vector3()) => {
    plane.set(new THREE.Vector3(0, 0, 1), -z);
    return G.ray(x, y).ray.intersectPlane(plane, out);
  };

  return G;
}

// Default light rig for a station; returns the key light for tweaks.
export function lightRig(scene, { key = [1.2, 2.4, 1.6], target = [0, 0, -0.2], intensity = 2.2, hemi = 0.55, color = 0xffffff, shadowBox = 1.4 } = {}) {
  const h = new THREE.HemisphereLight(0xf2f6ff, 0x4a4f57, hemi);
  const d = new THREE.DirectionalLight(color, intensity);
  d.position.set(...key);
  d.target.position.set(...target);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  const s = d.shadow.camera;
  s.left = -shadowBox; s.right = shadowBox; s.top = shadowBox; s.bottom = -shadowBox; s.near = 0.1; s.far = 8;
  d.shadow.bias = -0.0004;
  d.shadow.normalBias = 0.012;
  d.shadow.radius = 4;
  scene.add(h, d, d.target);
  return { hemi: h, key: d };
}
