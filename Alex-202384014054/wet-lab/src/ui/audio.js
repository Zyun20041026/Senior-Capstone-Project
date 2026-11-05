// Alex 202384014054
// A few synthesized cues. The context starts on the first key or click.

export function createAudio(on = true) {
  let ctx = null, master = null;
  const A = { on };
  const ensure = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
    return ctx;
  };
  A.unlock = () => { if (A.on) ensure(); };
  const tone = (f, dur, { type = 'sine', at = 0, vol = 1, to = null } = {}) => {
    if (!A.on || !ensure()) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, { at = 0, vol = 0.5, f = 1200, q = 0.8, to = null } = {}) => {
    if (!A.on || !ensure()) return;
    const t = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f, t);
    if (to) bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t);
  };
  A.cue = (kind) => {
    if (kind === 'ok') { tone(880, 0.12, { vol: 0.5 }); tone(1320, 0.18, { at: 0.07, vol: 0.4 }); }
    else if (kind === 'step') { tone(660, 0.1, { vol: 0.35 }); tone(990, 0.16, { at: 0.06, vol: 0.3 }); }
    else if (kind === 'warn') tone(330, 0.2, { type: 'triangle', vol: 0.5 });
    else if (kind === 'error') { tone(220, 0.28, { type: 'square', vol: 0.18 }); tone(233, 0.28, { type: 'square', vol: 0.18 }); }
    else if (kind === 'hint') tone(520, 0.08, { vol: 0.22 });
  };
  A.click = () => tone(1800, 0.025, { type: 'square', vol: 0.12 });
  A.tip = () => { tone(2400, 0.02, { type: 'square', vol: 0.15 }); tone(900, 0.04, { at: 0.02, vol: 0.18 }); };
  A.pip = (down) => noise(0.09, { f: down ? 900 : 1600, vol: 0.18, q: 2 });
  A.spin = () => { noise(1.6, { f: 300, to: 2400, vol: 0.35, q: 1.2 }); tone(90, 1.5, { type: 'sawtooth', vol: 0.05, to: 420 }); };
  // Mains hum of a UV ballast while the lamp is on (with a click as it strikes).
  let hum = null;
  A.hum = (on) => {
    on = on && A.on;
    if (!!hum === on) return;
    if (!on) { const h = hum; hum = null; h.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12); setTimeout(() => h.o.forEach((o) => o.stop()), 600); return; }
    if (!ensure()) return;
    tone(2600, 0.03, { type: 'square', vol: 0.2 }); tone(140, 0.08, { type: 'square', vol: 0.15, at: 0.04 });
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(master);
    const o = [100, 200, 300].map((f, i) => { const x = ctx.createOscillator(); x.type = i ? 'sine' : 'triangle'; x.frequency.value = f; const k = ctx.createGain(); k.gain.value = [0.5, 0.25, 0.08][i]; x.connect(k); k.connect(g); x.start(); return x; });
    g.gain.setTargetAtTime(0.09, ctx.currentTime + 0.1, 0.3);
    hum = { g, o };
  };
  A.toggle = () => { A.on = !A.on; if (A.on) ensure(); return A.on; };
  return A;
}
