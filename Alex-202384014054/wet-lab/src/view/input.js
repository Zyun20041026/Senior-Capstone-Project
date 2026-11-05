// Alex 202384014054
// Trackpad and keyboard. The trackpad only points and taps; everything held
// (plunger, serological pipette triggers, aspirator) lives on the keyboard.

import * as A from '../game/actions.js';
import { STATION_ORDER } from '../game/layout.js';
import { pick as scenePick, wellScreen } from './scene.js';
import { closePanel, centrifugePanel, readerPanel } from '../ui/panels.js';
import { scopePanel } from '../ui/microscope.js';
import { freeAnalysisPanel } from '../ui/freeanalysis.js';


const HELD_KEYS = ['KeyW', 'KeyS'];

export function bindInput(app) {
  const game = document.getElementById('game');
  const scene = document.getElementById('scene');
  const screen = document.getElementById('screen');
  const I = { ptr: { x: 800, y: 450 }, client: null, nudge: null, wheel: 0 };

  const toGame = (e) => { const r = game.getBoundingClientRect(); return { x: (e.clientX - r.left) / app.scale, y: (e.clientY - r.top) / app.scale }; };

  // Multichannel pipettes address a whole column (or row), so the other
  // coordinate must not count as a change of target.
  function normalise(w, t) {
    const tool = A.heldTool(w);
    if (!t || t.kind !== 'item' || !t.deck || t.col == null || !tool || tool.kind !== 'pip' || tool.spec.ch === 1) return t;
    if (w.orient === 'col') { t.row = 0; t.well = t.col; t.tip = t.col; }
    else { t.col = Math.min(t.col, 4); t.well = t.row * 12 + t.col; t.tip = t.well; }
    return t;
  }

  I.repick = (domTarget) => {
    const w = app.w;
    if (!w || !app.S) return;
    const target = domTarget || (I.client ? document.elementFromPoint(I.client.x, I.client.y) : null);
    const t = normalise(w, scenePick(app.S, w, I.ptr.x, I.ptr.y, target));
    app.target = t;
    if (t && t.kind === 'item') A.hover(w, t);
    else if (t && t.kind === 'fx' && t.id === 'bsc-surface') A.hover(w, { fixture: 'bsc-surface' });
    else if (t && t.kind === 'tool') A.hover(w, { tool: t.tool });
    else A.hover(w, null);
  };

  window.addEventListener('pointermove', (e) => {
    if (!app.w || !app.running) return;
    const p = toGame(e);
    I.client = { x: e.clientX, y: e.clientY };
    if (I.nudge && Math.hypot(e.clientX - I.nudge.x, e.clientY - I.nudge.y) < 12) return;
    I.nudge = null;
    I.ptr = p;
    I.repick(e.target);
  });

  scene.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !app.w || !app.running) return;
    app.audio.unlock();
    I.ptr = toGame(e); I.nudge = null;
    I.repick(e.target);
    click(app.target);
    I.repick(e.target);
  });

  game.addEventListener('wheel', (e) => {
    if (!app.w || !app.running) return;
    const t = A.heldTool(app.w);
    if (!t || t.kind !== 'pip' || e.target.closest('.panel,#notebook,#sop')) return;
    e.preventDefault();
    I.wheel += e.deltaY;
    while (Math.abs(I.wheel) >= 28) { const s = Math.sign(I.wheel); A.setVol(app.w, -s, e.shiftKey); I.wheel -= s * 28; }
  }, { passive: false });

  function click(t) {
    const w = app.w;
    const tool = A.heldTool(w), item = A.heldItem(w);
    // A tap on empty bench puts the held tool down on its stand.
    if (!t) { if (tool && A.putBack(w) === true) app.audio.click(); return; }
    let ok;
    if (item) {
      if (t.kind === 'slot') ok = A.place(w, t.st, t.slot);
      else if (t.kind === 'fx') ok = fixture(t.id, true);
    } else if (tool) {
      if (t.kind === 'fx' && (t.id === 'stand' || t.id === 'bsc-surface')) ok = A.putBack(w);
      else if (t.kind === 'fx' && t.id === 'waste') ok = A.tipOff(w);
      else if (t.kind === 'fx') ok = fixture(t.id, false);
      else if (t.kind === 'item') {
        const it = w.items[t.id];
        if (it && ['tipbox', 'tipboxSide', 'seropack', 'pasteur'].includes(it.type)) { ok = A.tipOn(w); if (ok === true) app.audio.tip(); }
      }
    } else if (t.kind === 'tool') ok = A.take(w, t.tool);
    else if (t.kind === 'item') ok = A.pick(w, t.id);
    else if (t.kind === 'fx') ok = fixture(t.id, false);
    if (ok === true) app.audio.click();
  }

  function fixture(id, holdingItem) {
    const w = app.w;
    switch (id) {
      case 'bsc-fan': return A.bsc(w, 'fan');
      case 'bsc-uv': return A.bsc(w, 'uv');
      case 'bal-tare': return A.balance(w, 'tare');
      case 'bal-print': { const r = A.balance(w, 'print'); if (r != null) app.toast(w.inst.balance.doors ? 'ok' : 'warn', `打印：${r.toFixed(4)} g${w.inst.balance.doors ? '' : '（防风罩开着，读数不稳）'}`); return r != null; }
      case 'bal-doors': return A.balance(w, 'doors');
      case 'centrifuge': centrifugePanel(app); return true;
      case 'scope': if (holdingItem) return false; scopePanel(app); return true;
      case 'vortex': return A.vortex(w);
      case 'inc-door': return A.door(w, 'incubator');
      case 'fridge-door': return A.door(w, 'fridge');
      case 'freezer-door': return A.door(w, 'freezer');
      case 'reader': readerPanel(app); return true;
      case 'computer': freeAnalysisPanel(app); return true;
      default:
        return false;
    }
  }

  // ←/→ move the targeted column on a deck item without moving the hand.
  function nudge(d) {
    const w = app.w, h = w.hover;
    if (!h || !h.deck || h.col == null) return;
    const it = w.items[h.id];
    if (!it) return;
    const tool = A.heldTool(w);
    const maxCol = tool && tool.kind === 'pip' && tool.spec.ch > 1 && w.orient === 'row' ? 4 : 11;
    const col = Math.max(0, Math.min(maxCol, h.col + d));
    if (col === h.col) return;
    const row = h.row ?? 0;
    const p = wellScreen(app.S, h.id, row, col);
    if (!p) return;
    I.ptr = { x: p.x, y: p.y };
    if (I.client) I.nudge = { ...I.client };
    I.repick(null);
    // elementFromPoint above saw the real pointer; the deck has no fixtures, so
    // the pick depends on I.ptr alone.
  }

  const typing = (e) => e.target && e.target.closest && e.target.closest('input,select,textarea');

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    app.audio.unlock();
    if (!screen.hidden) { if (screen._key && screen._key(e)) e.preventDefault(); return; }
    const w = app.w;
    if (!w || !app.running) return;
    if (typing(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    const panel = document.querySelector('#panelhost .panel');
    if (panel) {
      // The open panel gets every key first (Esc may mean "back" inside it);
      // only an Esc it does not use closes it.
      if (panel._key && panel._key(e)) { e.preventDefault(); return; }
      if (e.key === 'Escape') { closePanel(); e.preventDefault(); return; }
      if (panel.id === 'pause') return;
      if (!['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyS', 'KeyN', 'KeyZ', 'KeyP', 'KeyJ', 'KeyU'].includes(e.code)) return;
    }
    const code = e.code;
    const stop = () => e.preventDefault();
    if (code === 'Space') { stop(); if (!e.repeat) { A.press(w); app.audio.pip(true); } return; }
    if (code === 'ShiftLeft' || code === 'ShiftRight') { if (!e.repeat) A.shift(w, true); return; }
    if (HELD_KEYS.includes(code)) { stop(); w.keys[code] = true; return; }
    if (e.repeat && !['ArrowLeft', 'ArrowRight', 'BracketLeft', 'BracketRight'].includes(code)) return;
    switch (code) {
      case 'ArrowDown': stop(); A.depthBy(w, 1); break;
      case 'ArrowUp': stop(); A.depthBy(w, -1); break;
      case 'ArrowLeft': stop(); nudge(-1); break;
      case 'ArrowRight': stop(); nudge(1); break;
      case 'BracketLeft': stop(); A.setVol(w, -1, e.shiftKey); break;
      case 'BracketRight': stop(); A.setVol(w, 1, e.shiftKey); break;
      case 'KeyT': if (A.tipOn(w) === true) app.audio.tip(); I.repick(); break;
      case 'KeyE': if (A.tipOff(w) === true) app.audio.click(); break;
      case 'KeyO': if (w.hover && w.hover.id) { if (A.toggleCap(w, w.hover.id)) app.audio.click(); } else { const k = w.hover?.fixture; if (!k) app.toast('hint', '把指针移到要开关的瓶子、管子或盒子上再按 O'); } break;
      case 'KeyA': {
        const h = w.hover;
        if (h && h.id) A.spray(w, h.id);
        else if (A.heldItem(w)) A.spray(w, A.heldItem(w).id);
        else if (h && h.fixture === 'bsc-surface') A.spray(w, 'bsc');
        else if (w.station === 'bsc') A.spray(w, 'bsc');
        app.audio.pip(false);
        break;
      }
      case 'KeyR': A.orient(w); I.repick(); break;
      case 'KeyZ': stop(); if (panel) closePanel(); app.openWait(); break;
      case 'KeyN': stop(); app.toggleNotebook(); break;
      case 'KeyL': app.hud.toggleSop(); break;
      case 'KeyH': app.toggleCoach(); break;
      case 'KeyU': stop(); if (panel) closePanel(); app.openSupply(); break;
      case 'KeyP': if (panel) closePanel(); app.pause(); break;
      case 'KeyF': app.fullscreen(); break;
      case 'KeyV': { const v = app.S.toggleView?.(); if (v) app.toast('hint', v === 'deck' ? '台面近景（V 切回全景）' : '安全柜全景'); else app.toast('hint', '只有生物安全柜有近景视角'); I.repick(); break; }
      case 'Slash': if (e.shiftKey) app.pause(); break;
      case 'Escape':
        if (app.nb.isOpen()) app.nb.close();
        else if (!document.getElementById('sop').hidden) app.hud.toggleSop(false);
        else { A.cancel(w); I.repick(); }
        break;
      default:
        if (/^Digit[1-5]$/.test(code)) { app.go(STATION_ORDER[+code.slice(5) - 1]); }
    }
  });

  window.addEventListener('keyup', (e) => {
    const w = app.w;
    if (!w) return;
    if (e.code === 'Space') { if (w.plunger.down) { A.release(w); app.audio.pip(false); } e.preventDefault(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') A.shift(w, false);
    else if (HELD_KEYS.includes(e.code)) w.keys[e.code] = false;
  });

  // Losing focus must not leave the plunger pressed or a trigger held.
  // The game pauses while hidden, so a stroke in progress is aborted, not completed.
  const letGo = () => { const w = app.w; if (!w) return; A.abortStroke(w); A.shift(w, false); HELD_KEYS.forEach((k) => (w.keys[k] = false)); };
  window.addEventListener('blur', letGo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });

  return I;
}
