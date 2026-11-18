// Alex 202384014054
/*
 * Capsid Lockdown — sound. Everything is synthesized with Web Audio:
 * a low thump for a dose, soft plucks on a pentatonic ladder as the drug
 * spreads ring by ring, a dull knock when it bounces off a resistant protein.
 * In the 交锋 every sound is panned towards where it happened on screen.
 * No samples.
 *
 * Phones need three extra things, all handled in unlock():
 *   - sound may only start inside a tap that has ended (touchend / click),
 *     not on the touch going down, so every such event on the page unlocks;
 *   - iPhone's ring/silent switch mutes Web Audio unless the page counts as
 *     media playback: the audio session is set to "playback" where the browser
 *     allows it, otherwise a silent clip generated here loops in an <audio> tag;
 *   - after a call or a switch to another app the context is left
 *     "interrupted"; it is resumed on the next tap.
 */
(function (root) {
  'use strict';
  function CapsidAudio() {
    let ctx = null, master = null, send = null, enabled = true, gesture = false, primed = false, carrier = null;
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const iOS = /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    const LADDER = [0, 2, 4, 7, 9];

    function ensure() {
      // browsers only let sound start from a user gesture, so nothing is created before one
      if (!enabled || !gesture) return false;
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      // a small room: two feedback delays through a low-pass
      send = ctx.createGain(); send.gain.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const wet = ctx.createGain(); wet.gain.value = 0.42;
      for (const [time, fb] of [[0.173, 0.36], [0.287, 0.28]]) {
        const d = ctx.createDelay(1); d.delayTime.value = time;
        const g = ctx.createGain(); g.gain.value = fb;
        send.connect(d); d.connect(lp); lp.connect(g); g.connect(d);
      }
      lp.connect(wet); wet.connect(master);
      return true;
    }
    // half a second of silence as a WAV file, built here
    function silence() {
      const rate = 8000, n = rate / 2, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
      const put = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
      put(0, 'RIFF'); v.setUint32(4, 36 + n, true); put(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); put(36, 'data'); v.setUint32(40, n, true);
      b.fill(128, 44);
      let bin = '';
      for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
      return 'data:audio/wav;base64,' + btoa(bin);
    }
    // make the page count as media playback, so the silent switch does not mute it
    function carry(on) {
      try {
        if (nav.audioSession) { if (on) nav.audioSession.type = 'playback'; return; }
        if (!iOS) return;
        if (!carrier && on) {
          carrier = document.createElement('audio');
          carrier.loop = true; carrier.preload = 'auto'; carrier.controls = false; carrier.disableRemotePlayback = true;
          carrier.setAttribute('playsinline', ''); carrier.setAttribute('x-webkit-airplay', 'deny');
          carrier.src = silence();
        }
        if (!carrier) return;
        if (on) { if (carrier.paused) { const p = carrier.play(); if (p && p.catch) p.catch(() => {}); } }
        else carrier.pause();
      } catch (err) { /* sound stays as it was */ }
    }
    function unlock() {
      gesture = true;
      if (!ensure()) return;
      carry(true);
      if (ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* next tap */ } }
      if (!primed) {
        // one silent sample started inside the tap opens the output on older phones
        try { const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); src.connect(ctx.destination); src.start(0); primed = true; } catch (err) { /* not needed here */ }
      }
    }
    if (typeof document !== 'undefined') {
      for (const type of ['touchend', 'pointerup', 'mouseup', 'click', 'keydown']) document.addEventListener(type, unlock, { capture: true, passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) carry(false);
        else if (ctx && enabled && gesture) { carry(true); if (ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* next tap */ } } }
      });
    }
    // where the next sounds come from: pan -1 (left) .. 1 (right); `far` (the back of the cell clump) is a little quieter
    let curPan = 0, curVol = 1;
    function out(node, wetAmt) {
      let n = node;
      if (curVol !== 1) { const g = ctx.createGain(); g.gain.value = curVol; n.connect(g); n = g; }
      if (curPan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, curPan)); n.connect(p); n = p; }
      n.connect(master);
      if (wetAmt) { const g = ctx.createGain(); g.gain.value = wetAmt; n.connect(g); g.connect(send); }
    }
    function at(pan, far, fn) { curPan = pan || 0; curVol = far ? 0.65 : 1; try { fn(); } finally { curPan = 0; curVol = 1; } }
    // a short tone that slides from one pitch to another
    function slide(f0, f1, delay, vol, dur, type) {
      if (!ensure()) return;
      const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); out(g, 0.15); o.start(t); o.stop(t + dur + 0.05);
    }

    function pluck(freq, delay, vol, dur, type) {
      if (!ensure()) return;
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      o2.type = 'sine'; o2.frequency.value = freq * 2.003;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g2); g2.connect(g); out(g, 0.6);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function noise(delay, dur, vol, freq, q) {
      if (!ensure()) return;
      const t = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); out(g, 0.3);
      src.start(t);
    }
    const note = (step, base) => (base || 196) * Math.pow(2, (Math.floor(step / 5) * 12 + LADDER[((step % 5) + 5) % 5]) / 12);

    return {
      unlock,
      get enabled() { return enabled; },
      setEnabled(v, quiet) { enabled = v; if (master) master.gain.value = v ? 0.55 : 0; if (!v) carry(false); else if (!quiet) unlock(); },
      get state() { return ctx ? ctx.state : 'none'; },
      hover() { pluck(1568, 0, 0.012, 0.05, 'sine'); },
      ui() { pluck(784, 0, 0.03, 0.09, 'sine'); },
      dose() {
        if (!ensure()) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); out(g, 0.15); o.start(t); o.stop(t + 0.3);
        noise(0, 0.05, 0.12, 3200, 0.8);
      },
      // wave i of a cascade; more chains falling at once = a fuller note
      wave(i, chains) {
        const f = note(i + 2);
        pluck(f, 0, 0.11, 0.7);
        if (chains > 1) pluck(note(i + 4), 0.03, 0.06, 0.6);
        if (chains > 3) pluck(note(i + 7), 0.06, 0.04, 0.6, 'sine');
      },
      flag(on) { pluck(note(on ? 9 : 6), 0, 0.045, 0.16, 'sine'); },
      antibody(i) { pluck(note(7 + (i % 5)), 0, 0.05, 0.5, 'sine'); },
      // the drug bounces off: a knock, a sour pair of notes, a breath of noise
      miss() {
        if (!ensure()) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); out(g, 0.2); o.start(t); o.stop(t + 0.32);
        pluck(233.1, 0.02, 0.07, 0.5, 'square'); pluck(246.9, 0.02, 0.05, 0.5, 'square');
        noise(0, 0.25, 0.1, 900, 1.2);
      },
      shatter() { noise(0, 0.9, 0.16, 2600, 0.6); noise(0.05, 1.4, 0.06, 6400, 0.9); for (let i = 0; i < 9; i++) pluck(note(12 - i), i * 0.045, 0.04, 0.5, 'sine'); },
      silent() { pluck(note(0, 98), 0, 0.07, 0.35, 'sine'); },
      spread() { noise(0, 0.5, 0.07, 620, 2.5); pluck(note(-3, 98), 0.02, 0.06, 0.6, 'sine'); },
      denied() { pluck(110, 0, 0.07, 0.12, 'square'); },
      undo() { pluck(note(4), 0, 0.05, 0.2, 'sine'); pluck(note(2), 0.06, 0.05, 0.25, 'sine'); },
      build() { for (let i = 0; i < 6; i++) pluck(note(i * 2, 98), i * 0.09, 0.035, 0.9, 'sine'); },
      win() { [0, 2, 4, 5, 7, 9, 12].forEach((s, i) => pluck(note(s + 5), i * 0.085, 0.085, 1.4)); noise(0.1, 1.2, 0.03, 5200, 0.7); },
      fail() { pluck(note(1, 98), 0, 0.1, 0.8, 'triangle'); pluck(note(0, 92.5), 0.22, 0.1, 1.1, 'triangle'); },

      // ---- 交锋 · 守住这团细胞 (pan: where on screen it happened; far: on the back of the clump)
      shadow(pan, far) { at(pan, far, () => { noise(0, 0.6, 0.02, 1500, 4); pluck(note(1, 392), 0.1, 0.01, 0.25, 'sine'); }); },
      land(pan, far) { at(pan, far, () => pluck(note(0, 392), 0, 0.03, 0.12, 'sine')); },
      // a receptor takes hold: each one a step higher
      bind(step, pan, far) { at(pan, far, () => { pluck(note(2 + step * 2, 262), 0, 0.07, 0.3, 'triangle'); if (step >= 3) pluck(note(9, 262), 0.04, 0.04, 0.3, 'sine'); }); },
      // the membrane folds in: one low note
      engulf(pan, far) { at(pan, far, () => { slide(130, 42, 0, 0.5, 0.42); noise(0, 0.25, 0.05, 280, 1.5); }); },
      infect(pan, far) { at(pan, far, () => { pluck(233.1, 0, 0.05, 0.45, 'square'); pluck(220, 0.05, 0.04, 0.5, 'square'); }); },
      burst(pan, far) { at(pan, far, () => { noise(0, 0.4, 0.2, 1300, 0.7); slide(110, 36, 0, 0.45, 0.4); noise(0.04, 0.6, 0.06, 5200, 0.8); }); },
      // eaten: a pop, higher with every link of a combo
      eat(combo, pan, far) {
        const up = Math.pow(2, Math.min(6, combo - 1) * 2 / 12);
        at(pan, far, () => { slide(620 * up, 190 * up, 0, 0.32, 0.09); noise(0, 0.04, 0.06, 2600, 1); if (combo > 1) pluck(note(5 + combo * 2), 0.04, 0.05, 0.3, 'sine'); });
      },
      collect(k) { pluck(note(10 + (k % 6), 262), 0, 0.05, 0.35, 'sine'); pluck(note(12 + (k % 6), 262), 0.03, 0.025, 0.3, 'sine'); },
      cloud(pan, far) { at(pan, far, () => { noise(0, 0.7, 0.06, 4200, 0.8); [0, 2, 4].forEach((s, i) => pluck(note(7 + s), 0.04 + i * 0.05, 0.04, 0.7, 'sine')); }); },
      // a stem cell grows a neighbour back: a soft rising chord
      regrow(pan, far) { at(pan, far, () => { [0, 4, 7, 12].forEach((s, i) => pluck(note(s, 262), i * 0.07, 0.045, 0.9, 'sine')); noise(0.05, 0.5, 0.015, 3600, 1); }); },
      coat(pan, far) { at(pan, far, () => { pluck(note(6), 0, 0.04, 0.2, 'sine'); pluck(note(3), 0.06, 0.035, 0.25, 'sine'); }); },
      route() { pluck(note(7), 0, 0.03, 0.08, 'sine'); },
      tick() { pluck(note(9, 392), 0, 0.008, 0.04, 'sine'); },
      banner(k) { for (let i = 0; i < 3 + k; i++) pluck(note(i * 2 + 1, 196), i * 0.08, 0.05, 0.8, 'triangle'); },
      pause(on) { pluck(note(on ? 4 : 7), 0, 0.04, 0.15, 'sine'); pluck(note(on ? 2 : 9), 0.05, 0.035, 0.2, 'sine'); },
    };
  }
  root.CapsidAudio = CapsidAudio;
})(typeof self !== 'undefined' ? self : this);
