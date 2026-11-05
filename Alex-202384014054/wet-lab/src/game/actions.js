// Alex 202384014054
// Everything the player can do. The UI and the test scripts both call these.

import { SPECS, aspirateVol, residual, film } from '../sim/pipette.js';
import { L, vol, add, split, mixed } from '../sim/liquid.js';
import { gauss } from '../sim/rng.js';
import { pellet as pelletFrac, spinDamage, rcf, hemoSquare } from '../sim/cells.js';
import { absorbance } from '../sim/plate.js';
import { slotDef, slotActive, TOOL_HOME, R_CM } from './layout.js';
import { TYPES, TIP_FOR } from './catalog.js';
import { violate } from './sop.js';
import { tagCells, takeSrc, giveSrc, wellComposition } from '../sim/lineage.js';
import { advance, emit, log, inBSC, occupant, items, seedBug, totalVol } from './world.js';
import { val } from '../data/index.js';
import { mentorStop } from './mentor.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const once = (w, key) => { w.flags.once = w.flags.once || {}; if (w.flags.once[key]) return false; w.flags.once[key] = true; return true; };
const fmtV = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} mL` : `${v < 10 ? v.toFixed(1) : Math.round(v)} µL`);

export function makeTool(id, home) {
  if (SPECS[id]) {
    const s = SPECS[id];
    return { id, kind: 'pip', spec: s, vol: s.id === 'p1000' ? 1000 : s.max / 2, tips: Array(s.ch).fill(null), bias: 0, home };
  }
  if (id === 'aid') return { id, kind: 'aid', sp: null, home, cyc: null };
  if (id === 'vac') return { id, kind: 'vac', pasteur: null, home };
  throw new Error(`unknown tool ${id}`);
}

export const heldTool = (w) => (w.held && w.held.type === 'tool' ? w.tools[w.held.id] : null);
export const heldItem = (w) => (w.held && w.held.type === 'item' ? w.items[w.held.id] : null);
const needsAsepsis = (it) => it.sterile && !['tipbox', 'tipboxSide', 'seropack', 'pasteur'].includes(it.type);

// ---------------------------------------------------------------- liquid slots

function bodySlot(it) { return { key: it.id, it, kind: 'body', get: () => it.liq, set: (l) => { it.liq = l; } }; }
function wellSlot(it, i) { return { key: `${it.id}:${i}`, it, kind: 'well', well: i, get: () => it.wells[i].liq, set: (l) => { it.wells[i].liq = l; } }; }
function laneSlot(it, k) { return { key: `${it.id}:L${k}`, it, kind: 'lane', lane: k, get: () => it.lanes[k], set: (l) => { it.lanes[k] = l; } }; }

// One slot per channel (null where a channel has nothing under it), or a
// string explaining why the tool cannot go there.
export function channelSlots(w, tool, tgt) {
  if (!tgt || !tgt.id) return null;
  const it = w.items[tgt.id];
  if (!it) return null;
  if (['tipbox', 'tipboxSide', 'seropack', 'pasteur'].includes(it.type)) return null;
  const ch = tool.kind === 'pip' ? tool.spec.ch : 1;
  if (it.wells) {
    if (tool.kind === 'aid') return '血清移液管伸不进 96 孔板的孔';
    if (ch === 1) return tgt.well == null ? null : [wellSlot(it, tgt.well)];
    if (w.orient === 'col') return tgt.col == null ? null : Array.from({ length: 8 }, (_, r) => wellSlot(it, r * 12 + tgt.col));
    if (tgt.row == null) return null;
    const start = Math.min(tgt.col ?? 0, 4);
    return Array.from({ length: 8 }, (_, k) => wellSlot(it, tgt.row * 12 + start + k));
  }
  if (it.lanes) {
    if (tgt.lane == null) return null;
    if (ch > 1 && w.orient === 'row') return '加样槽的槽是竖向的，多道枪要竖着用（R 切换方向）';
    return Array(ch).fill(laneSlot(it, tgt.lane));
  }
  if (ch > 1) return '多道移液器伸不进这个容器，只能用于孔板和加样槽';
  if (tool.kind === 'aid' && ['ep', 'vial', 'hemo', 'kit'].includes(it.type)) return '这个容器太小，血清移液管伸不进去';
  if (it.type === 'hemo' && tool.kind !== 'pip') return null;
  return [bodySlot(it)];
}

// ---------------------------------------------------------------- holding things

export function pick(w, id) {
  if (w.held) return emit(w, 'hint', '手上已经拿着东西了，先放下（Esc 放回原处）');
  const it = w.items[id];
  if (!it || it.fixed) return;
  if (it.at?.st === 'bsc' && uvBlocked(w)) return;
  const s = it.at && slotDef(it.at.st, it.at.slot);
  if (s && s.door && !w.inst[s.door].door) return emit(w, 'hint', '门关着，先打开');
  if (s && s.robot) return emit(w, 'hint', '这块板由机械臂搬运：在 AI 助手终端里查看和控制运行');
  if (it.at.st === 'rotor' && !w.inst.centrifuge.lid) return emit(w, 'hint', '先打开离心机盖');
  if (it.at.st === 'reader' && !w.inst.reader.drawer) return emit(w, 'hint', '先打开酶标仪抽屉');
  w.held = { type: 'item', id, from: { ...it.at } };
  it.at = { st: 'hand' };
  return true;
}

export function place(w, st, slotId) {
  const it = heldItem(w);
  if (!it) return;
  const s = slotDef(st, slotId);
  if (!s || !slotActive(w.level, s)) return;
  if (!s.accepts.includes(it.cat)) return emit(w, 'hint', `${it.label}放不到这里`);
  if (occupant(w, st, slotId)) return emit(w, 'hint', '这个位置已经有东西了');
  if (s.door && !w.inst[s.door].door) return emit(w, 'hint', '门关着，先打开');
  if (s.inst === 'reader' && !w.inst.reader.drawer) return emit(w, 'hint', '先打开酶标仪抽屉');
  const from = w.held.from;
  const fromBSC = from.st === 'bsc', toBSC = st === 'bsc';
  const slips = [];
  if (fromBSC && !toBSC && it.open && needsAsepsis(it) && totalVol(it) > 0) slips.push('open_carry_out');
  if (toBSC && !fromBSC && it.sterile && (!it.sprayed || it.wet)) slips.push('unsprayed_in');
  if (mentorStop(w, slips)) return false;
  if (fromBSC && !toBSC) {
    it.sprayed = false;
    if (it.open && needsAsepsis(it) && totalVol(it) > 0) { violate(w, 'open_carry_out', it.label); seedBug(w, it, 0.6); }
  }
  if (toBSC && !fromBSC && it.sterile && (!it.sprayed || it.wet)) { violate(w, 'unsprayed_in', it.label); it.risk += 0.35; }
  if (s.env === 'bath') {
    it.wet = true; it.sprayed = false;
    if (it.type === 'flask' || it.wells) violate(w, 'plate_in_bath', it.label);
  }
  it.at = { st, slot: slotId };
  w.held = null;
  if (s.env === 'inc') log(w, `${it.label} 放入培养箱`);
  return true;
}

export function cancel(w) {
  const h = w.held;
  if (!h) return;
  if (h.type === 'item') {
    const it = w.items[h.id];
    it.at = { ...h.from };
    w.held = null;
  } else putBack(w);
}

// Reaching into the cabinet while the UV lamp is on is refused (and, in a
// level, counted once as the SOP mistake it would be).
function uvBlocked(w) {
  if (w.station !== 'bsc' || !w.bsc.uv) return false;
  if (w.level?.kind === 'level' && once(w, 'uv')) violate(w, 'bsc_uv');
  emit(w, 'warn', '紫外灯开着，不能把手伸进安全柜：先点「紫外」关掉（紫外线会灼伤皮肤和眼睛）');
  return true;
}

export function take(w, toolId) {
  if (w.held) return emit(w, 'hint', '手上已经拿着东西了');
  if (uvBlocked(w)) return;
  const t = w.tools[toolId];
  if (!t || t.home !== w.station) return;
  w.held = { type: 'tool', id: toolId };
  return true;
}

export function putBack(w) {
  const t = heldTool(w);
  if (!t) return;
  if (w.plunger.down) release(w);
  if (t.home !== w.station) {
    // Put down away from its stand: it goes back to its own stand, and a tip
    // that left the cabinet is no longer sterile.
    if (t.kind === 'pip') t.tips.forEach((tp) => tp && (tp.sterile = false));
    if (t.kind === 'aid' && t.sp) t.sp.sterile = false;
    if (t.kind === 'vac' && t.pasteur) t.pasteur.sterile = false;
    emit(w, 'hint', `${t.spec?.label || (t.kind === 'aid' ? '电动移液器' : '吸液器')}放回了${t.home === 'bsc' ? '安全柜' : '实验台'}的支架`);
  }
  w.held = null; w.depth = 0;
  return true;
}

export function goStation(w, st) {
  if (!w.stations.includes(st) || w.station === st) return;
  if (w.plunger.down) release(w);
  const t = heldTool(w);
  if (t && w.station === 'bsc') {
    if (t.kind === 'pip') t.tips.forEach((tp) => tp && (tp.sterile = false));
    if (t.kind === 'aid' && t.sp) t.sp.sterile = false;
    if (t.kind === 'vac' && t.pasteur) t.pasteur.sterile = false;
  }
  const it = heldItem(w);
  if (it && w.station === 'bsc' && it.open && needsAsepsis(it) && totalVol(it) > 0) { violate(w, 'open_carry_out', it.label); seedBug(w, it, 0.6); }
  w.station = st; w.hover = null; w.depth = 0;
}

// ---------------------------------------------------------------- pointing & depth

export function hover(w, tgt) {
  const p = w.hover;
  const same = p && tgt && p.id === tgt.id && p.well === tgt.well && p.col === tgt.col && p.row === tgt.row && p.lane === tgt.lane && p.fixture === tgt.fixture;
  if (!same) w.depth = 0;
  w.hover = tgt;
}

const fresh = (t) => t && vol(t.liq) < 1.5;

export function depthBy(w, d) {
  const tool = heldTool(w);
  if (!tool || !w.hover || !w.hover.id) return;
  const it = w.items[w.hover.id];
  if (!it) return;
  const slots = channelSlots(w, tool, w.hover);
  if (typeof slots === 'string') return emit(w, 'hint', slots);
  if (!slots) return;
  if (d > 0 && !it.open) return emit(w, 'hint', `${it.label}盖着盖子，先按 O 打开`);
  if (d > 0 && tool.kind === 'pip' && !tool.tips.some(Boolean)) return emit(w, 'hint', '先装枪头：移到枪头盒上按 T');
  if (d > 0 && tool.kind === 'aid' && !tool.sp) return emit(w, 'hint', '先装血清移液管：移到移液管架上按 T');
  if (d > 0 && tool.kind === 'vac' && !tool.pasteur) return emit(w, 'hint', '先装巴斯德吸管：移到吸管罐上按 T');
  const nd = clamp(w.depth + d, 0, 3);
  if (nd === w.depth) return;
  if (nd >= 1 && w.depth < 1) {
    const slips = [];
    if (it.sterile && needsAsepsis(it) && contacts(tool).some((t) => t && !t.sterile)) slips.push('tip_nonsterile');
    if (inBSC(w, it) && needsAsepsis(it) && !it.bscChecked) slips.push(...bscRules(w, it));
    if (mentorStop(w, slips)) return false;
  }
  const prev = w.depth;
  w.depth = nd;
  if (nd >= 1 && prev < 1) touchInside(w, tool, it, slots);
  if (nd >= 2 && prev < 2) immerse(w, tool, slots);
  if (nd === 3) touchBottom(w, tool, it, slots);
}

function contacts(tool) {
  if (tool.kind === 'pip') return tool.tips.map((t) => t || null);
  if (tool.kind === 'aid') return [tool.sp];
  return [tool.pasteur];
}

function touchInside(w, tool, it, slots) {
  for (const t of contacts(tool)) {
    if (!t) continue;
    if (!it.sterile) t.sterile = false;
    else if (!t.sterile && needsAsepsis(it)) {
      if (once(w, `ns:${it.id}`)) violate(w, 'tip_nonsterile', it.label);
      it.risk += 0.8;
    }
  }
  if (inBSC(w, it) && needsAsepsis(it) && !it.bscChecked) bscCheck(w, it);
}

function immerse(w, tool, slots) {
  const tips = contacts(tool);
  slots.forEach((s, k) => {
    const t = tips[k];
    if (!s || !t) return;
    const l = t.liq;
    if (t.src && t.src !== s.key && vol(l) > 0 && vol(l) < 1.5) {
      // The wet film of the previous liquid washes into this one.
      const filmHasStuff = Object.keys(l.c).some((k2) => k2.startsWith('drug:') || k2 === 'cells' || k2 === 'bug' || k2 === 'trypsin' || k2 === 'tb');
      const target = s.get();
      if (s.it.stock && once(w, `stock:${s.it.id}`)) violate(w, 'dirty_tip_stock', s.it.label);
      else if (filmHasStuff && vol(target) > 0 && once(w, `cross:${t.src}>${s.key}`)) {
        const novel = Object.keys(l.c).some((k2) => (k2.startsWith('drug:') || k2 === 'cells' || k2 === 'trypsin' || k2 === 'tb') && !target.c[k2]);
        if (novel) violate(w, 'cross_tip', s.it.label);
      }
      s.set(add(target, l));
      t.liq = L();
    }
    t.src = s.key;
  });
}

function touchBottom(w, tool, it, slots) {
  if (it.layer && it.layer.n > 0) {
    const f = tool.kind === 'vac' ? 0.9 : 0.97;
    it.layer.n *= f;
    if (once(w, `scrape:${it.id}:${Math.floor(w.t)}`)) violate(w, 'scrape_cells', it.label);
  }
  if (it.wells) for (const s of slots) if (s && it.wells[s.well].n > 0) it.wells[s.well].n *= 0.96;
  if (it.pellet && it.pellet.n > 0 && tool.kind !== 'vac') {
    // Poking the pellet lifts some of it into the liquid.
    const m = 0.3;
    it.liq = add(it.liq, L({ cells: it.pellet.n * m, dead: it.pellet.d * m }, 0.3));
    giveSrc(it.pellet.src, it.liq, m);
    it.pellet.n *= 1 - m; it.pellet.d *= 1 - m;
  }
}

// Safety-cabinet rules that touching `it` right now would break.
export function bscRules(w, it) {
  const r = [];
  if (w.bsc.uv) r.push('bsc_uv');
  if (!w.bsc.fan) r.push('bsc_off');
  else if (w.t - w.bsc.fanSince < 4.999) r.push('bsc_not_ready');
  if (!w.bsc.wiped) r.push('bsc_not_wiped');
  return r;
}
function bscCheck(w, it) {
  it.bscChecked = true;
  const r = bscRules(w, it);
  if (r.includes('bsc_uv') && once(w, 'uv')) violate(w, 'bsc_uv');
  if (r.includes('bsc_off')) { if (once(w, 'bscoff')) violate(w, 'bsc_off'); it.risk += 1.2; }
  if (r.includes('bsc_not_ready')) { if (once(w, 'bscready')) violate(w, 'bsc_not_ready'); it.risk += 0.5; }
  if (r.includes('bsc_not_wiped')) { if (once(w, 'wipe')) violate(w, 'bsc_not_wiped'); it.risk += 0.15; }
}

// ---------------------------------------------------------------- mechanical pipettes

const inLiquid = (w, s) => s && w.depth >= 2 && vol(s.get()) > 0.3;

export function press(w) {
  const tool = heldTool(w);
  const p = w.plunger;
  if (!tool || tool.kind !== 'pip' || p.down) return;
  p.down = true; p.stop = 1; p.peak = 1;
  const slots = channelSlots(w, tool, w.hover);
  const valid = Array.isArray(slots);
  const loaded = tool.tips.some((t) => t && vol(t.liq) >= 1.5);
  if (loaded) {
    p.mode = 'disp';
    p.disp = valid ? slots.map((s) => s && s.key) : null;
    const boat = valid && slots[0] && slots[0].it.type === 'boat' ? slots[0].it : null;
    w.flags.boat = boat ? { id: boat.id, v0: vol(boat.liq), tool: tool.id, set: tool.vol } : null;
    tool.tips.forEach((t, k) => {
      if (!t || vol(t.liq) < 1.5) return;
      const out = Math.max(0, vol(t.liq) - residual(tool.vol));
      if (valid && w.depth >= 1 && slots[k]) dispenseInto(w, slots[k], t, out);
      else spill(w, t, out);
    });
    logTransfer(w, tool, slots, 'disp');
  } else {
    p.mode = 'asp';
    if (valid && slots.some((s) => inLiquid(w, s))) {
      if (once(w, `pil:${Math.floor(w.t / 3)}`)) violate(w, 'press_in_liquid');
      for (const s of slots) if (s && s.kind === 'well') s.it.wells[s.well].bubble = 1;
    }
  }
}

export function shift(w, on) {
  w.keys.Shift = on;
  const p = w.plunger;
  const tool = heldTool(w);
  if (!on || !p.down || p.stop !== 1 || !tool || tool.kind !== 'pip') return;
  p.stop = 2; p.peak = 2;
  if (p.mode !== 'disp') return;
  const slots = channelSlots(w, tool, w.hover);
  const valid = Array.isArray(slots);
  tool.tips.forEach((t, k) => {
    if (!t) return;
    const out = Math.max(0, vol(t.liq) - film(tool.vol));
    if (out <= 0) return;
    if (valid && w.depth >= 1 && slots[k]) {
      dispenseInto(w, slots[k], t, out);
      if (w.depth >= 2 && slots[k].kind === 'well') slots[k].it.wells[slots[k].well].bubble = 0.6;
    } else spill(w, t, out);
  });
}

// Pausing (or the window losing focus) in the middle of a stroke ends it as if
// it never happened: nothing is drawn up, and the key coming up later is a no-op.
// Liquid already pushed out by the press stays where it went.
export function abortStroke(w) {
  const p = w.plunger;
  if (!p.down) return false;
  p.down = false; p.stop = 0; p.mode = null; p.peak = 0; p.disp = null;
  log(w, '暂停：活塞已复位，这一下吸液取消');
  return true;
}

export function release(w) {
  const p = w.plunger;
  if (!p.down) return;
  const tool = heldTool(w);
  p.down = false;
  if (tool && tool.kind === 'pip') {
    const slots = channelSlots(w, tool, w.hover);
    if (Array.isArray(slots) && w.depth >= 2) {
      const back = p.mode === 'disp';
      if (!back && p.peak === 2 && once(w, `ss:${Math.floor(w.t * 4)}`)) violate(w, 'second_stop_asp');
      let air = false, drew = false;
      tool.tips.forEach((t, k) => {
        const s = slots[k];
        if (!t || !s) return;
        if (s.it.frozen) { if (once(w, `frz:${Math.floor(w.t)}`)) emit(w, 'hint', `${s.it.label}还冻着（DMSO 在 18.5 °C 以下是固体），先在室温放置解冻`); return; }
        const src = s.get();
        if (vol(src) <= 0.3) { air = true; return; }
        if (s.it.type === 'vial' && src.mix < 0.9 && once(w, `dmso:${s.it.id}`)) violate(w, 'dmso_unmixed', s.it.label);
        if ((src.c.cells || 0) > 0 && src.mix < 0.6 && !back && once(w, `unmixed:${s.key}:${Math.floor(w.t / 4)}`)) violate(w, 'sample_unmixed', s.it.label);
        const want = aspirateVol(tool.spec, tool.vol, back ? 1 : p.peak, w.r, tool.bias);
        const got = Math.min(want, vol(src));
        if (got < want * 0.93) air = true;
        const skew = clamp(1 + (1 - src.mix) * 0.7 * gauss(w.r), 0.15, 2.2);
        const [tk, rest] = split(src, got, skew);
        s.set(rest);
        t.liq = add(t.liq, tk); t.src = s.key; t.temp = s.it.temp;
        drew = true;
        if (back) mixCycle(w, s, t);
      });
      if (air && once(w, `air:${Math.floor(w.t)}`)) emit(w, 'warn', '吸进了空气：液体不够或枪头没有完全浸入');
      if (back && drew && once(w, 'backasp')) emit(w, 'hint', '松开活塞时枪头还在液面下，液体被吸回了枪头。吹打混匀就是这样做的；如果只想打液，先按 ↑ 提起枪头再松开空格。');
      if (!back && drew) logTransfer(w, tool, slots, 'asp');
    }
  }
  const b = w.flags.boat;
  if (b) {
    const got = vol(w.items[b.id].liq) - b.v0;
    if (got > 0.3) (w.flags.boatLog = w.flags.boatLog || []).push({ tool: b.tool, set: b.set, got, t: w.t });
    w.flags.boat = null;
  }
  p.stop = 0; p.mode = null; p.peak = 0; p.disp = null;
}

// Three up-and-down strokes homogenise the well and the liquid in the tip.
function mixCycle(w, s, t) {
  w.flags.mix = w.flags.mix || {};
  const m = w.flags.mix[s.key] || (w.flags.mix[s.key] = { n: 0 });
  m.n++;
  if (m.n >= 3) {
    m.n = 0;
    resuspendPellet(s.it, 0.8);
    const all = mixed(add(s.get(), t.liq), 1);
    const [inTip, inWell] = split(all, vol(t.liq));
    t.liq = inTip; s.set(inWell);
  } else resuspendPellet(s.it, 0.3);
}

function resuspendPellet(it, f) {
  if (!it.pellet || it.pellet.n + it.pellet.d <= 0) return;
  it.liq = add(it.liq, L({ cells: it.pellet.n * f, dead: it.pellet.d * f }));
  giveSrc(it.pellet.src, it.liq, f);
  it.liq.mix = Math.min(it.liq.mix, f > 0.5 ? 0.9 : 0.4);
  it.pellet.n *= 1 - f; it.pellet.d *= 1 - f;
}

function dispenseInto(w, s, t, out) {
  if (out <= 0) return;
  const [tk, rest] = split(t.liq, out);
  t.liq = rest;
  const it = s.it;
  // Cold medium straight onto cells stresses them.
  if ((t.temp ?? 22) < 15 && (tk.c.medium || 0) > 50 && (it.layer || it.wells) && once(w, 'cold')) violate(w, 'cold_medium');
  s.set(giveBack(s, t, tk));
  if (it.layer && w.depth === 3) { const m = it.layer.n * 0.04; it.layer.n -= m; it.liq.c.cells = (it.liq.c.cells || 0) + m; tagCells(it.liq, it.line, m); }
  if (it.type === 'hemo') loadHemo(w, it);
}

// Liquid returned to the container it was drawn from is part of mixing, not
// a new liquid layered on top.
function giveBack(s, t, tk) {
  const before = s.get();
  const l = add(before, tk);
  return t.src === s.key ? { ...l, mix: Math.max(l.mix, Math.min(before.mix, tk.mix)) } : l;
}

function spill(w, t, out) {
  if (out <= 0) return;
  const [, rest] = split(t.liq, out);
  t.liq = rest;
  if (once(w, `spill:${Math.floor(w.t)}`)) violate(w, 'spill');
}

function logTransfer(w, tool, slots, kind) {
  if (!Array.isArray(slots)) return;
  const s = slots.find(Boolean);
  if (!s) return;
  const where = s.kind === 'well' ? `${s.it.label} ${wellLabel(slots)}` : s.kind === 'lane' ? `${s.it.label} 第 ${s.lane + 1} 槽` : s.it.label;
  log(w, `${tool.spec.label} ${kind === 'asp' ? '吸取' : '加入'} ${fmtV(tool.vol)}${kind === 'asp' ? ' ← ' : ' → '}${where}`);
}

function wellLabel(slots) {
  const names = slots.filter(Boolean).map((s) => 'ABCDEFGH'[Math.floor(s.well / 12)] + ((s.well % 12) + 1));
  return names.length > 1 ? `${names[0]}–${names[names.length - 1]}` : names[0];
}

export function setVol(w, steps, coarse = false) {
  const tool = heldTool(w);
  if (!tool || tool.kind !== 'pip' || w.plunger.down) return;
  const s = tool.spec;
  const inc = coarse ? s.coarse : s.step;
  const v = clamp(Math.round((tool.vol + steps * inc) / s.step) * s.step, s.min, s.max);
  tool.vol = Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------- tips & consumables

export function tipOn(w) {
  const tool = heldTool(w);
  if (!tool) return;
  const tgt = w.hover;
  const box = tgt && w.items[tgt.id];
  if (tool.kind === 'pip') {
    if (tool.tips.some(Boolean)) return emit(w, 'hint', '先退掉旧枪头（E）');
    if (!box || !['tipbox', 'tipboxSide'].includes(box.type)) return emit(w, 'hint', '把移液器移到枪头盒上再按 T');
    if (!box.open) return emit(w, 'hint', '先打开枪头盒盖（O）');
    if (!TIP_FOR[box.color].includes(tool.id)) return emit(w, 'warn', `枪头规格不对：${tool.spec.label} 要用${tool.spec.tip === 'white' ? '白色 10/20 µL' : tool.spec.tip === 'yellow' ? '黄色 200 µL' : '蓝色 1000 µL'}枪头`);
    let idx = [];
    if (tool.spec.ch === 1) {
      if (box.type === 'tipbox' && tgt.tip != null && box.present[tgt.tip]) idx = [tgt.tip];
      else { const i = box.present.indexOf(true); if (i >= 0) idx = [i]; }
      if (!idx.length) return emit(w, 'hint', '这盒枪头用完了');
      box.present[idx[0]] = false;
      tool.tips[0] = newTip(w, box);
    } else {
      if (box.type !== 'tipbox') return emit(w, 'hint', '多道移液器要在台面俯视区的枪头盒上装枪头');
      const col = tgt.col ?? 0, row = tgt.row ?? 0;
      let any = false;
      for (let k = 0; k < 8; k++) {
        const i = w.orient === 'col' ? k * 12 + col : row * 12 + Math.min(col, 4) + k;
        if (box.present[i]) { box.present[i] = false; tool.tips[k] = newTip(w, box); any = true; }
      }
      if (!any) return emit(w, 'hint', '这一列没有枪头了');
    }
    return true;
  }
  if (tool.kind === 'aid') {
    if (tool.sp) return emit(w, 'hint', '先丢掉用过的移液管（E）');
    if (!box || box.type !== 'seropack') return emit(w, 'hint', '移到血清移液管架上再按 T');
    tool.sp = { size: tgt.size || box.size, liq: L(), sterile: inBSC(w, box), src: null };
    tool.cyc = null;
    return true;
  }
  if (tool.kind === 'vac') {
    if (tool.pasteur) return emit(w, 'hint', '先丢掉用过的吸管（E）');
    if (!box || box.type !== 'pasteur') return emit(w, 'hint', '移到巴斯德吸管罐上再按 T');
    if (!box.open) return emit(w, 'hint', '先打开吸管罐（O）');
    tool.pasteur = { liq: L(), sterile: inBSC(w, box) && box.sterile, src: null };
    return true;
  }
}

const newTip = (w, box) => ({ liq: L(), sterile: box.sterile && inBSC(w, box), src: null, temp: 22 });

export function tipOff(w) {
  const tool = heldTool(w);
  if (!tool) return;
  if (!['bsc', 'bench'].includes(w.station)) return emit(w, 'hint', '这里没有废弃盒');
  if (w.plunger.down) release(w);
  if (tool.kind === 'pip' && tool.tips.some(Boolean)) { w.flags.tipsUsed = (w.flags.tipsUsed || 0) + tool.tips.filter(Boolean).length; tool.tips = tool.tips.map(() => null); }
  else if (tool.kind === 'aid' && tool.sp) tool.sp = null;
  else if (tool.kind === 'vac' && tool.pasteur) tool.pasteur = null;
  else return;
  w.depth = 0;
  return true;
}

// ---------------------------------------------------------------- serological pipette & aspirator (held keys)

export function flow(w, dtReal) {
  const tool = heldTool(w);
  if (!tool) return;
  const slots = channelSlots(w, tool, w.hover);
  const s = Array.isArray(slots) ? slots[0] : null;
  if (tool.kind === 'aid') {
    const up = w.keys.KeyW, down = w.keys.KeyS;
    if (!up && !down) return;
    if (!tool.sp) { if (once(w, `nosp:${Math.floor(w.t)}`)) emit(w, 'hint', '先装血清移液管'); return; }
    const sp = tool.sp;
    const rate = (w.keys.Shift ? 0.22 : 1.3) * 1000 * dtReal;
    if (up) {
      if (s && w.depth >= 2 && vol(s.get()) > 0.5) {
        const src = s.get();
        if (s.it.frozen) return;
        const amt = Math.min(rate, vol(src));
        if ((src.c.cells || 0) > 0 && src.mix < 0.6 && (!tool.cyc || tool.cyc.key !== s.key) && once(w, `unmixed:${s.key}:${Math.floor(w.t / 4)}`)) violate(w, 'sample_unmixed', s.it.label);
        const skew = clamp(1 + (1 - src.mix) * 0.5 * gauss(w.r), 0.3, 1.8);
        const [tk, rest] = split(src, amt, skew);
        s.set(rest);
        sp.liq = add(sp.liq, tk); sp.src = s.key; sp.temp = s.it.temp;
        track(w, tool, s, 1, amt);
        if (vol(sp.liq) > sp.size * 1300) {
          if (once(w, 'filter')) violate(w, 'aid_filter');
          sp.liq = split(sp.liq, vol(sp.liq) - sp.size * 1300)[1];
          w.keys.KeyW = false;
        }
      }
    } else if (vol(sp.liq) > 0) {
      const amt = Math.min(rate, vol(sp.liq));
      const [tk, rest] = split(sp.liq, amt);
      sp.liq = rest;
      if (s && w.depth >= 1) {
        if ((sp.temp ?? 22) < 15 && (tk.c.medium || 0) > 0 && (s.it.layer || s.it.pellet) && once(w, 'cold')) violate(w, 'cold_medium');
        s.set(giveBack(s, sp, tk));
        if (s.it.layer && w.depth >= 2) {
          // Rinsing over the growth surface lifts loosened cells.
          const loose = (s.it.tryMin || 0) > 2 ? 0.25 : 0.01;
          const m = s.it.layer.n * loose * (amt / 1000) * (w.depth === 3 ? 2 : 1);
          s.it.layer.n -= m; s.it.liq.c.cells = (s.it.liq.c.cells || 0) + m; tagCells(s.it.liq, s.it.line, m);
        }
        track(w, tool, s, -1, amt);
      } else if (once(w, `spill:${Math.floor(w.t)}`)) violate(w, 'spill');
    }
    return;
  }
  if (tool.kind === 'vac' && w.keys.KeyW) {
    if (!tool.pasteur) { if (once(w, `nop:${Math.floor(w.t)}`)) emit(w, 'hint', '先装巴斯德吸管'); return; }
    if (!s || w.depth < 2) return;
    if (s.it.stock && once(w, `vacstock:${s.it.id}`)) violate(w, 'dirty_tip_stock', s.it.label);
    const src = s.get();
    const amt = Math.min((w.keys.Shift ? 300 : 3000) * dtReal, vol(src));
    if (amt > 0) s.set(split(src, amt)[1]);
    w.flags.vacuumed = (w.flags.vacuumed || 0) + amt;
    if (s.it.layer && w.depth === 3) s.it.layer.n *= Math.exp(-1.6 * dtReal);
    if (s.it.pellet && s.it.pellet.n > 0 && (vol(s.get()) < 30 || w.depth === 3)) {
      const before = s.it.pellet.n;
      s.it.pellet.n *= Math.exp(-2.4 * dtReal); s.it.pellet.d *= Math.exp(-2.4 * dtReal);
      s.it.pelletLost = (s.it.pelletLost || 0) + (before - s.it.pellet.n);
      if (s.it.pelletLost > 0.2 * (s.it.pellet.n + s.it.pelletLost) && once(w, `pellet:${s.it.id}`)) violate(w, 'pellet_lost', s.it.label);
    }
  }
}

// Up/down strokes in the same liquid count as pipetting to mix.
function track(w, tool, s, dir, amt) {
  let c = tool.cyc;
  if (!c || c.key !== s.key) c = tool.cyc = { key: s.key, dir, amt: 0, n: 0 };
  if (c.dir !== dir) {
    if (c.amt > 300 && dir === 1) {
      c.n++;
      resuspendPellet(s.it, 0.5);
      if (c.n >= 3) {
        // up-and-down strokes homogenise the tube and the pipette contents together
        const sp = tool.sp;
        const all = mixed(add(s.get(), sp.liq), 1);
        const [inP, inT] = split(all, vol(sp.liq));
        sp.liq = inP; s.set(inT);
      }
      else s.set({ ...s.get(), mix: Math.min(1, s.get().mix + 0.25) });
    }
    c.dir = dir; c.amt = 0;
  }
  c.amt += amt;
}

// ---------------------------------------------------------------- lids, ethanol, orientation

export function toggleCap(w, id) {
  const it = w.items[id];
  if (!it || !TYPES[it.type].lid) return;
  if (it.at.st === 'hand') return;
  if (!it.open && w.level?.aseptic) {
    const slips = [];
    if (it.type === 'tipbox' || it.type === 'tipboxSide') { if (!inBSC(w, it) && it.sterile) slips.push('tips_outside'); }
    else if (needsAsepsis(it)) slips.push(...(inBSC(w, it) ? bscRules(w, it) : ['open_outside']));
    if (inBSC(w, it) && w.bsc.uv) slips.push('bsc_uv');
    if (mentorStop(w, slips)) return false;
  }
  if (!it.open) {
    if (it.type === 'tipbox' || it.type === 'tipboxSide') {
      if (!inBSC(w, it) && it.sterile && w.level?.aseptic) { violate(w, 'tips_outside', it.label); it.sterile = false; }
    } else if (needsAsepsis(it) && w.level?.aseptic) {
      if (!inBSC(w, it)) { violate(w, 'open_outside', it.label); seedBug(w, it, 0.6); }
      else bscCheck(w, it);
    }
    if (inBSC(w, it) && w.bsc.uv && once(w, 'uv')) violate(w, 'bsc_uv');
  }
  it.open = !it.open;
  return true;
}

export function spray(w, id) {
  if (id === 'bsc') {
    if (w.station !== 'bsc') return;
    w.bsc.wiped = true;
    log(w, '75% 酒精擦拭安全柜台面');
    return true;
  }
  const it = w.items[id];
  if (!it) return;
  if (it.open && totalVol(it) > 0 && it.sterile) {
    violate(w, 'spray_open', it.label);
    if (it.liq) it.liq = add(it.liq, L({ ethanol: 8 }));
    return;
  }
  it.sprayed = true; it.wet = false;
  return true;
}

export function orient(w) {
  const it = heldItem(w);
  if (it && it.wells) { it.rot = !it.rot; return; }
  w.orient = w.orient === 'col' ? 'row' : 'col';
}

// ---------------------------------------------------------------- instruments

export function bsc(w, what) {
  const b = w.bsc;
  if (what === 'fan') {
    b.fan = !b.fan; b.light = b.fan;
    b.fanSince = b.fan ? w.t : null;
    log(w, b.fan ? '打开安全柜风机和照明' : '关闭安全柜风机');
  } else if (what === 'uv') {
    b.uv = !b.uv;
    if (b.uv) { b.uvSince = w.t; b.uvMin = b.uvMin || 15; b.light = false; } else { b.uvSince = null; b.light = b.fan; }
    log(w, b.uv ? `打开紫外灯（灭菌 ${b.uvMin} 分钟）` : '关闭紫外灯');
  }
  else if (what === 'light') b.light = !b.light;
  return true;
}

export function door(w, which) {
  if (which === 'reader') { w.inst.reader.drawer = !w.inst.reader.drawer; return true; }
  if (which === 'centrifuge') { w.inst.centrifuge.lid = !w.inst.centrifuge.lid; return true; }
  const d = w.inst[which];
  if (!d) return;
  d.door = !d.door;
  return true;
}

export function rotorPut(w, idx) {
  const it = heldItem(w);
  const c = w.inst.centrifuge;
  if (!it || !c.lid) return emit(w, 'hint', c.lid ? '' : '先打开离心机盖');
  if (!['tube15', 'tube50'].includes(it.type)) return emit(w, 'hint', '这台离心机的转子只放 15/50 mL 离心管');
  if (items(w).some((x) => x.at && x.at.st === 'rotor' && x.at.slot === idx)) return emit(w, 'hint', '这个位置已经有管子了');
  it.at = { st: 'rotor', slot: idx };
  w.held = null;
  return true;
}

const TUBE_TARE = { tube15: 6.6, tube50: 13.4 };
export const tubeMass = (it) => (TUBE_TARE[it.type] || 0) + totalVol(it) / 1000 + ((it.pellet?.n || 0) + (it.pellet?.d || 0)) * 2e-9;

export function spin(w, rpm, minutes) {
  const c = w.inst.centrifuge;
  c.alarm = false;
  if (c.lid) return emit(w, 'hint', '先盖上离心机盖');
  const tubes = items(w).filter((x) => x.at && x.at.st === 'rotor');
  if (!tubes.length) return emit(w, 'hint', '转子里没有离心管');
  if (!(rpm > 0) || !(minutes > 0)) return emit(w, 'hint', '先设定转速和时间');
  const at = (i) => tubes.find((x) => x.at.slot === i);
  for (let i = 0; i < 3; i++) {
    const a = at(i), b = at(i + 3);
    if (!a && !b) continue;
    const ma = a ? tubeMass(a) : 0, mb = b ? tubeMass(b) : 0;
    if (Math.abs(ma - mb) > 0.3) {
      c.alarm = true;
      violate(w, 'imbalance', `${ma.toFixed(2)} g 对 ${mb.toFixed(2)} g`);
      log(w, `离心机报警：转子不平衡（${ma.toFixed(2)} g / ${mb.toFixed(2)} g）`);
      return { ok: false };
    }
  }
  for (const t of tubes) if (t.open) { violate(w, 'open_in_centrifuge', t.label); seedBug(w, t, 0.4); }
  const g = rcf(rpm, R_CM);
  for (const t of tubes) {
    const l = t.liq;
    if (!(l.c.cells || l.c.dead)) continue;
    const f = pelletFrac(g, minutes), dmg = spinDamage(g);
    t.pellet = t.pellet || { n: 0, d: 0 };
    const mvN = (l.c.cells || 0) * f, mvD = (l.c.dead || 0) * f;
    takeSrc(l, (t.pellet.src ||= {}), f);
    t.pellet.n += mvN * dmg; t.pellet.d += mvD + mvN * (1 - dmg);
    l.c.cells -= mvN; l.c.dead -= mvD;
    t.liq = { ...l, mix: 1 };
  }
  c.last = { rpm, min: minutes, g };
  log(w, `离心 ${Math.round(rpm)} rpm（${Math.round(g)} ×g），${minutes} 分钟`);
  advance(w, minutes + 1.5);
  return { ok: true, g };
}

// Analytical balance. Reading in grams, 0.1 mg readability.
const Z_WATER = val('constants', 'z-water-22c'); // µL per mg at 22 °C
export function balanceReading(w) {
  const b = w.inst.balance;
  const boat = occupant(w, 'bench', 'pan');
  const gross = boat ? 0.4512 + vol(boat.liq) / Z_WATER / 1000 : 0; // water mass (g) = volume ÷ Z
  const n = gauss(w.r) * (b.doors ? 0.00004 : 0.0011);
  return Math.round((gross - b.tare + n) * 10000) / 10000;
}

export function balance(w, what) {
  const b = w.inst.balance;
  if (what === 'doors') { b.doors = !b.doors; return true; }
  if (what === 'tare') { const r = balanceReading(w); b.tare += r; log(w, '天平去皮'); return true; }
  if (what === 'print') {
    const r = balanceReading(w);
    b.prints.push({ t: w.t, g: r, stable: b.doors });
    log(w, `天平读数 ${r.toFixed(4)} g${b.doors ? '' : '（防风罩开着，读数不稳）'}`);
    return r;
  }
}

export function vortex(w) {
  const it = occupant(w, 'bench', 'vortex');
  if (!it) return emit(w, 'hint', '涡旋仪上没有管子');
  if (it.open) { violate(w, 'vortex_open', it.label); it.liq = split(it.liq, vol(it.liq) * 0.15)[1]; }
  if (it.frozen) return emit(w, 'hint', '还冻着，涡旋不动');
  if ((it.liq.c.cells || 0) > 0) { violate(w, 'vortex_cells', it.label); it.liq.c.dead = (it.liq.c.dead || 0) + it.liq.c.cells * 0.05; it.liq.c.cells *= 0.95; }
  it.liq = mixed(it.liq, 1);
  log(w, `涡旋混匀 ${it.label}`);
  return true;
}

export function readPlate(w, wl) {
  const c = w.inst.reader;
  if (c.drawer) return emit(w, 'hint', '先关上抽屉再读板');
  const p = occupant(w, 'reader', 'drawer');
  if (!p) return emit(w, 'hint', '抽屉里没有板');
  c.wl = wl;
  return readPlateItem(w, p, wl);
}

// Read one plate at a wavelength (the bench reader above, or the automation
// workstation's integrated reader): values, a frozen version, the same checks.
export function readPlateItem(w, p, wl) {
  const noise = () => gauss(w.r);
  const vals = p.wells.map((wl2) => {
    const v = vol(wl2.liq);
    return absorbance({ cells: wl2.n + (wl2.liq.c.cells || 0), frac: v > 0 ? (wl2.liq.c.cck8 || 0) / v : 0, minutes: wl2.cck, wl, light: Math.min(1, (wl2.light || 0) / 2), bubble: wl2.bubble, vol: v }, noise);
  });
  // A plate loaded rotated 180° reads H12 as A1.
  const values = p.rot ? vals.slice().reverse() : vals;
  // Every read is also a numbered, frozen version with what was really in
  // each well (cell lines by share, compounds by concentration), so later
  // analyses can be checked against the plate's label.
  w.readSeq = (w.readSeq || 0) + 1;
  const ver = `R${w.readSeq}`;
  const wells = p.wells.map((x) => {
    const v = vol(x.liq), d = {};
    for (const k in x.liq.c) if (k.startsWith('drug:') && v > 0) d[k.slice(5)] = +(x.liq.c[k] / v).toPrecision(4);
    const comp = wellComposition(x, p.line);
    return { lines: Object.fromEntries(Object.entries(comp).map(([k, f]) => [k, +f.toFixed(4)])), drugs: d };
  });
  const snap = { id: ver, plateId: p.id, label: p.label, declaredLine: p.line || null, values: values.slice(), wl, t: w.t, rot: !!p.rot, wells: p.rot ? wells.slice().reverse() : wells };
  (w.readLog ||= []).push(JSON.parse(JSON.stringify(snap)));
  w.reads[p.id] = { values, wl, t: w.t, rot: !!p.rot, label: p.label, line: p.line, ver };
  if (wl !== 450 && once(w, `wl:${p.id}`)) violate(w, 'wrong_wavelength', `${wl} nm`);
  if (p.wells.some((x) => (x.light || 0) > 1) && once(w, `light:${p.id}`)) violate(w, 'light_cck8');
  advance(w, 1);
  log(w, `酶标仪读板 ${p.label}，${wl} nm`);
  return w.reads[p.id];
}

export function scope(w) {
  const it = occupant(w, 'bench', 'scope');
  if (!it) return null;
  w.flags.scoped[it.id] = { t: w.t, tryMin: it.tryMin || 0, detached: it.layer ? (it.liq.c.cells || 0) / Math.max(1, it.layer.n + (it.liq.c.cells || 0)) : 0 };
  if (it.type === 'hemo' && !w.hemo) loadHemo(w, it);
  return it;
}

export function loadHemo(w, it) {
  const v = vol(it.liq);
  if (v <= 0) return;
  let factor = 1;
  if (v > 12) { if (once(w, `hemo:${it.id}`)) violate(w, 'overfill_hemo'); factor = 1.15; }
  const live = ((it.liq.c.cells || 0) / v) * factor, dead = ((it.liq.c.dead || 0) / v) * factor;
  w.hemo = { id: it.id, squares: [0, 1, 2, 3].map(() => hemoSquare(w.r, live, dead)), marks: [{}, {}, {}, {}], tb: (it.liq.c.tb || 0) / v };
}

export function mark(w, sq, idx, kind) {
  if (!w.hemo) return;
  const m = w.hemo.marks[sq];
  if (kind) m[idx] = kind; else delete m[idx];
}

export function note(w, id, value) {
  w.notes[id] = value;
  return true;
}

export function wait(w, minutes) {
  if (w.plunger.down) release(w);
  advance(w, minutes);
  log(w, `等待 ${minutes >= 60 ? `${+(minutes / 60).toFixed(1)} 小时` : `${minutes} 分钟`}`);
  return true;
}

export { TOOL_HOME };
