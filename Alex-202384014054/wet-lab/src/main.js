// Alex 202384014054
// Boot, the frame loop, saving, and the test interface.
// Sandbox build: the title screen leads straight into the free lab.

import { migrateSave } from './data/legacy.js';
import { applyRealParams } from './sim/params.js';
import { rng } from './sim/rng.js';
import { createWorld, tick, items, emit, clock } from './game/world.js';
import * as A from './game/actions.js';
import { EASE, applyEase } from './game/difficulty.js';
import { createScene } from './view/scene.js';
import { bindInput } from './view/input.js';
import { createHUD } from './ui/hud.js';
import { createNotebook } from './ui/notebook.js';
import { createCoach } from './ui/coach.js';
import { waitPanel, pausePanel, closePanel, panelId } from './ui/panels.js';
import { createAudio } from './ui/audio.js';
import { titleScreen } from './ui/screens.js';
import { sandboxMode } from './modes/sandbox.js';
import { supplyPanel } from './ui/supply.js';
import { benchLayout, STATION_ORDER } from './game/layout.js';

const KEY = 'wetlab-sandbox-v1';
const $ = (id) => document.getElementById(id);

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return migrateSave(s); } catch (e) { /* storage unavailable */ }
  return { v: 1, levels: {}, ach: {}, sound: true, carry: {}, coach: true };
}

const app = { save: load(), w: null, level: null, prog: [], running: false, ready: false, scale: 1 };
// Reduced motion: the player's switch (pause menu) or the system setting.
app.setReduceMotion = (on) => { app.save.reduceMotion = !!on; document.documentElement.classList.toggle('reduce-motion', !!on); app.persist(); };
document.documentElement.classList.toggle('reduce-motion', !!app.save.reduceMotion);
app.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(app.save)); } catch (e) { /* quota or privacy mode: play on */ } };
app.audio = createAudio(app.save.sound !== false);
const audioToggle = app.audio.toggle;
app.audio.toggle = () => { const on = audioToggle(); app.save.sound = on; app.persist(); return on; };

app.S = createScene($('scene'), $('gl'));
app.hud = createHUD(app);
app.nb = createNotebook(app);
app.coach = createCoach(app);
if (app.save.coach == null) app.save.coach = true;
// No guided steps in the sandbox yet; these stay so the HUD and keys work.
app.currentStep = () => -1;
app.requestSkip = () => {};
app.toggleCoach = () => {
  app.save.coach = !app.save.coach; app.persist();
  if (!app.save.coach) app.coach.hide();
  return app.save.coach;
};
app.input = bindInput(app);

// ---------------------------------------------------------------- layout

function fit() {
  const W = window.innerWidth, H = window.innerHeight;
  const s = Math.min(W / 1600, H / 900);
  app.scale = s;
  const x = (W - 1600 * s) / 2, y = (H - 900 * s) / 2;
  $('game').style.transform = `translate(${x}px,${y}px) scale(${s})`;
  $('game').style.borderRadius = x < 4 && y < 4 ? '0' : '14px';
  app.S?.resize(s);
}
window.addEventListener('resize', fit);
fit();

app.fullscreen = () => {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  } catch (e) { /* not allowed here */ }
};

// ---------------------------------------------------------------- app verbs used by the UI

app.toast = (kind, text) => { if (app.w) emit(app.w, kind, text); };
app.go = (st) => { if (!app.w) return; A.goStation(app.w, st); app.input.repick(); };
app.wait = (m) => { if (!app.w) return; A.wait(app.w, m); app.w.flags.waited = (app.w.flags.waited || 0) + m; };
app.note = (id, v) => { if (app.w) A.note(app.w, id, v); };
app.toggleNotebook = () => app.nb.toggle();
app.openNotebook = () => app.nb.open();
app.openWait = () => waitPanel(app);
app.pause = () => { if (app.w) A.abortStroke(app.w); pausePanel(app); };

function showScreen() { app.audio.hum?.(false); app.coach.hide(); $('hud').hidden = true; app.running = false; closePanel(); app.nb.close(); }
app.showTitle = () => { showScreen(); titleScreen($('screen'), app); };

app.startMode = (kind = 'sandbox', opts = {}) => {
  const run = sandboxMode(opts);
  applyEase(run.ease || {});
  startRun({ kind, ...run, opts });
};
app.startSandbox = () => app.startMode('sandbox');
app.restart = () => app.startSandbox();
app.endRun = () => app.showTitle();
app.back = () => app.showTitle();
app.submit = () => {};
app.openCase = () => {};
app.openSupply = () => { if (app.w) supplyPanel(app); };

function startRun(level) {
  closePanel(); app.nb.close();
  benchLayout(level);
  $('toasts').replaceChildren();
  const w = createWorld((Date.now() % 2147483647) | 0);
  w.params = applyRealParams(rng((w.seed ^ 0x5eed) >>> 0)); // this run's real-world values, own stream (w.r untouched)
  w.level = level; w.kind = level.kind;
  w.stations = STATION_ORDER.slice();
  w.station = level.start;
  level.setup(w, app.save.carry || {});
  w.flags.waited = 0;
  app.w = w; app.level = level; app.prog = []; app.ready = false;
  app.S.reset();
  $('screen').hidden = true; $('screen').innerHTML = ''; $('screen')._key = null;
  $('hud').hidden = false;
  app.hud.toggleSop(false);
  app.hud.lastStepSig = null;
  app.running = true;
  app.S.render(w);
  app.input.repick();
  emit(w, 'hint', `${level.title}：${level.intro || 'P 查看按键说明。'}`);
  level.started?.(w, app);
}

// ---------------------------------------------------------------- frame loop

let last = performance.now(), tickAcc = 0, nbAcc = 0, nbLog = -1;

function step(dt) {
  const w = app.w;
  A.flow(w, dt);
  tick(w, dt);
  if (w.jobEvents?.length) for (const e of w.jobEvents.splice(0)) emit(w, e.failed ? 'warn' : 'ok', e.failed ? `${e.label}：${e.failed}` : `${e.label} 完成`);
  app.level.watch?.(w);
  return true;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const w = app.w;
  if (w && app.running) {
    const paused = panelId() === 'pause' || document.hidden;
    if (!paused) step(dt);
    app.S.render(w);
    app.audio.hum?.(w.station === 'bsc' && w.bsc.uv && !paused);
    app.hud.render(w, app.level, app.prog);
    app.coach.update(w, app.level, app.prog);
    app.hud.flush(w);
    app.hud.tooltip(w, app.input.ptr.x, app.input.ptr.y, true);
    tickAcc += dt;
    if (tickAcc > 0.25) { tickAcc = 0; const p = document.querySelector('#panelhost .panel'); if (p && p._tick) p._tick(); }
    nbAcc += dt;
    if (nbAcc > 1 && app.nb.isOpen()) { nbAcc = 0; if (w.log.length !== nbLog && !$('notebook').contains(document.activeElement)) { nbLog = w.log.length; app.nb.render(); } }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- test interface

import('./ui/os/desktop.js').then((D) => D.setOsClock(() => (app.w ? clock(app.w) : { hh: 9, mm: 0, day: 1 })));

window.__lab = {
  app, A, EASE,
  get w() { return app.w; },
  sandbox: () => app.startSandbox(),
  hover: (tgt) => A.hover(app.w, tgt),
  act: (name, ...args) => A[name](app.w, ...args),
  run: (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) step(dt); return true; },
  wait: (m) => { app.wait(m); app.level.watch?.(app.w); },
  byTag: (tag) => items(app.w).find((it) => it.tag === tag),
  screen: () => $('screen').className,
  render: () => { app.S.render(app.w); app.hud.render(app.w, app.level, app.prog); app.hud.flush(app.w); },
};

// ---------------------------------------------------------------- boot

if (new URLSearchParams(location.search).has('go')) app.startSandbox();
else app.showTitle();
