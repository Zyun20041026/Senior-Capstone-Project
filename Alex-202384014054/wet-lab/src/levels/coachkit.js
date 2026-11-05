// Alex 202384014054
// Tutorial coach. Each level step may carry `coach(c)`, which reads the live
// world through this kit and returns the one next thing to do:
//   { say, keys, target }   target: { item } | { tool } | { fx } | { tab }
//                                   | { slot: { st, id } } | { rect } | { dom }
// Kit helpers return null when their part is already done, so a step reads as
// a chain:  c.tool('p200') || c.vol(100) || c.tip() || c.asp('beaker').

import { STATIONS, slotActive } from '../game/layout.js';
import { heldTool, heldItem } from '../game/actions.js';
import { vol, isSolvent } from '../sim/liquid.js';

const DOOR_FX = { incubator: 'inc-door', fridge: 'fridge-door', freezer: 'freezer-door' };
const COLOR = { white: '白色', yellow: '黄色', blue: '蓝色' };
const BSC_FLOOR = [40, 640, 660, 812];

export function kit(w) {
  const c = { w };
  const get = (x) => (x && typeof x === 'object' ? x : Object.values(w.items).find((it) => it.tag === x) || w.items[x]);
  const name = (it) => `「${it.short && it.short.length > 1 && !it.label.includes(it.short) ? it.short : it.label}」`;
  const toolName = (t) => (t.kind === 'pip' ? t.spec.label : t.kind === 'aid' ? '电动移液器' : '真空吸液器');
  const stationOf = (it) => (it.at.st === 'tray' || it.at.st === 'hand' ? w.station : it.at.st === 'rotor' ? 'bench' : it.at.st);
  const doorOf = (st, slot) => (st === 'incubator' ? 'incubator' : st === 'fridge' ? (String(slot)[0] === 'z' ? 'freezer' : 'fridge') : null);
  const say = (text, keys = [], target = null) => ({ say: text, keys, target });
  const liqOf = (t) => (t.kind === 'pip' ? t.tips.find(Boolean)?.liq : t.kind === 'aid' ? t.sp?.liq : t.pasteur?.liq);
  c.say = say;
  c.get = get;
  c.name = name;

  c.go = (st) => (w.station === st ? null : say(`按 ${STATIONS[st].key} 去${STATIONS[st].name}`, [STATIONS[st].key], { tab: st }));

  // Empty the hand unless it already holds what the next action needs.
  c.free = (keep) => {
    const t = heldTool(w), it = heldItem(w);
    if (t && t.id !== keep) {
      if (t.kind === 'pip' && t.tips.some(Boolean)) return say(`先按 E 退掉 ${toolName(t)} 上的枪头`, ['E']);
      if (t.kind === 'aid' && t.sp) return say('先按 E 丢掉用过的血清移液管', ['E']);
      return say(`按 Esc（或轻点空白处）把 ${toolName(t)} 放回支架`, ['Esc']);
    }
    if (it && it.id !== keep) return say(`先放下手里的${name(it)}：轻点一个空位（Esc 放回原处）`, ['轻点', 'Esc']);
    return null;
  };

  c.tool = (id) => {
    const t = w.tools[id];
    if (heldTool(w)?.id === id) return null;
    return c.free(id) || c.go(t.home) || say(`轻点支架上的 ${toolName(t)} 拿起来`, ['轻点'], { tool: id });
  };

  c.open = (x) => {
    const it = get(x);
    if (!it || it.open) return null;
    return c.go(stationOf(it)) || say(`把指针移到${name(it)}上，按 O 打开盖子`, ['O'], { item: it.id });
  };
  c.close = (x) => {
    const it = get(x);
    if (!it || !it.open) return null;
    if (heldItem(w)?.id === it.id) return say(`先轻点一个空位把${name(it)}放下，再按 O 盖上`, ['轻点', 'O']);
    return c.go(stationOf(it)) || say(`把指针移到${name(it)}上，按 O 盖上`, ['O'], { item: it.id });
  };

  c.pick = (x) => {
    const it = get(x);
    if (heldItem(w)?.id === it.id) return null;
    const st = stationOf(it), d = doorOf(it.at.st, it.at.slot);
    return c.free(it.id) || c.go(st)
      || (d && !w.inst[d].door ? say(`轻点${d === 'incubator' ? '培养箱' : d === 'freezer' ? '冷冻室' : '冰箱'}门把它打开`, ['轻点'], { fx: DOOR_FX[d] }) : null)
      || say(`轻点${name(it)}拿起来`, ['轻点'], { item: it.id });
  };

  // Move an item to a station (and optionally a kind of slot there).
  c.bring = (x, st, pred = null, where = '一个空位') => {
    const it = get(x);
    if (!it) return null;
    if (it.at.st === st && (!pred || pred(it.at.slot))) return null;
    if (heldItem(w)?.id !== it.id) return c.pick(it);
    if (w.station !== st) { const d0 = c.closeDoors(); if (d0) return d0; }
    const go = c.go(st);
    if (go) return { ...go, say: `${go.say}（拿着${name(it)}）` };
    if (st === 'bsc' && it.sterile && (!it.sprayed || it.wet)) return say(`按 A 给${name(it)}喷 75% 酒精，再放进安全柜`, ['A']);
    const slot = (STATIONS[st].slots || []).find((s) => s.accepts.includes(it.cat) && slotActive(w.level, s) && (pred ? pred(s.id) : !s.inst)
      && !Object.values(w.items).some((o) => o.at && o.at.st === st && o.at.slot === s.id));
    const d = slot && doorOf(st, slot.id);
    if (d && !w.inst[d].door) return say('轻点门把它打开', ['轻点'], { fx: DOOR_FX[d] });
    return say(`轻点${where}放下${name(it)}`, ['轻点'], slot ? { slot: { st, id: slot.id } } : null);
  };

  c.closeDoors = () => {
    for (const d of ['incubator', 'fridge', 'freezer']) if (w.inst[d].door && (STATIONS[w.station].slots || []).some((s) => s.door === d)) return say('随手关门：轻点门关上', ['轻点'], { fx: DOOR_FX[d] });
    return null;
  };

  c.vol = (v) => {
    const t = heldTool(w);
    if (!t || t.kind !== 'pip' || Math.abs(t.vol - v) < Math.max(0.05, v * 0.004)) return null;
    const up = t.vol < v;
    return say(`把量程调到 ${+v.toFixed(1)} µL（现在 ${+t.vol.toFixed(1)}）：按 ${up ? ']' : '['}，按住 ⇧ 每次 ±${t.spec.coarse}`, [up ? ']' : '[', '⇧']);
  };

  // Liquid in the held tool (µL).
  c.load = () => { const t = heldTool(w); if (!t) return 0; if (t.kind === 'pip') return t.tips.reduce((s, tp) => s + (tp?.liq ? vol(tp.liq) : 0), 0); const l = liqOf(t); return l ? vol(l) : 0; };

  // Would the held tip carry something foreign into `src`?
  const foreign = (l, src) => l && Object.keys(l.c).some((k) => l.c[k] > 1e-6 && !(src.liq && src.liq.c[k] > 0) && !(isSolvent(k) && k === 'water'));

  c.tip = ({ box = null, layout = null, src = null } = {}) => {
    const t = heldTool(w);
    if (!t || t.kind !== 'pip') return null;
    const s = src && get(src);
    if (t.tips.some(Boolean)) {
      const l = liqOf(t);
      if (s && c.load() < 0.05 && foreign(l, s)) return say(`换枪头：按 E 退掉用过的枪头（它沾过别的液体），再装新的`, ['E']);
      return null;
    }
    const color = t.spec.tip;
    const want = layout || (t.spec.ch > 1 ? 'BG' : null);
    const cands = Object.values(w.items).filter((it) => ['tipbox', 'tipboxSide'].includes(it.type) && it.color === color && it.present.some(Boolean));
    const bx = (box && get(box)) || cands.find((b) => stationOf(b) === w.station && (!want || b.layout === want)) || cands.find((b) => stationOf(b) === w.station) || cands[0];
    if (!bx) return say(`需要一盒${COLOR[color]}枪头`);
    if (bx.type === 'tipbox' && bx.at.st !== 'bsc' && t.home === 'bsc') return c.free(bx.id) || c.bring(bx, 'bsc', (id) => id[0] === 'd', '安全柜台面的空位');
    return c.go(stationOf(bx))
      || (!bx.open ? say(`把指针移到${COLOR[color]}枪头盒上，按 O 打开盒盖`, ['O'], { item: bx.id }) : null)
      || say(`把 ${t.spec.label} 移到${COLOR[color]}枪头盒上，按 T 装枪头${t.spec.ch > 1 ? '（多道枪对准一整列）' : ''}`, ['T'], { item: bx.id });
  };

  c.asp = (x, what = '', note = '') => {
    const it = get(x);
    const g = c.go(stationOf(it)); if (g) return g;
    if (w.plunger.down) return say(`保持按住空格，按 ↓ 让枪头到液面下，再慢慢松开空格吸${what || '液'}`, ['↓', '空格'], { item: it.id });
    return say(`${note}吸${what || '液'}：移到${name(it)}上方 → 按住空格（一档）→ 按 ↓ 两次到液面下 → 松开空格`, ['空格', '↓'], { item: it.id });
  };
  c.disp = (x, how = '') => {
    const it = get(x);
    const g = c.go(stationOf(it)); if (g) return g;
    return say(`打进${name(it)}${how}：按 ↓ 进入容器 → 按住空格打出 → 再按住 ⇧ 吹净 → 按 ↑ 提起后再松开`, ['↓', '空格', '⇧', '↑'], { item: it.id });
  };
  c.dispMix = (x, how = '') => {
    const it = get(x);
    const g = c.go(stationOf(it)); if (g) return g;
    return say(`打进${name(it)}${how}并混匀：按 ↓ 两次到液面下，按放空格 3 次吹打，最后按住空格 + ⇧ 吹净、↑ 提起再松开`, ['↓', '空格', '⇧', '↑'], { item: it.id });
  };
  // One pipetting move: aspirate from src when the tip is (nearly) empty,
  // otherwise dispense into dst.
  c.xfer = (src, dst, v, { mix = false, note = '', from = '', how = '' } = {}) => {
    const s = get(src);
    return c.vol(v) || c.tip({ src: s }) || c.open(s) || c.open(dst)
      || (c.loadPer() < v * 0.5 ? c.asp(s, ` ${+v.toFixed(1)} µL${from}`, note) : mix ? c.dispMix(dst, how) : c.disp(dst, how));
  };
  // Liquid per channel for multichannel pipettes.
  c.loadPer = () => { const t = heldTool(w); const n = t && t.kind === 'pip' ? Math.max(1, t.tips.filter(Boolean).length) : 1; return c.load() / n; };

  c.sero = (size, src = null) => {
    const packs = Object.values(w.items).filter((it) => it.type === 'seropack');
    if (!packs.some((p) => p.size === size) && packs.length) size = packs[0].size;
    const t = heldTool(w);
    if (!t || t.kind !== 'aid') return c.tool('aid');
    const s = src && get(src);
    if (t.sp && (t.sp.size !== size || (s && vol(t.sp.liq) < 1 && foreign(t.sp.liq, s)))) return say(`按 E 丢掉这支移液管，换一支新的 ${size} mL 移液管`, ['E']);
    if (t.sp) return null;
    const pack = Object.values(w.items).find((it) => it.type === 'seropack' && it.size === size);
    return c.go(stationOf(pack)) || say(`移到 ${size} mL 移液管包装上，按 T 装上移液管`, ['T'], { item: pack.id });
  };
  c.seroXfer = (src, dst, ml, size = ml > 5 ? 10 : 5, into = '') => {
    const s = get(src), d = get(dst);
    const r = c.sero(size, s) || c.open(s) || c.open(d);
    if (r) return r;
    const have = c.load() / 1000;
    if (have < ml * 0.95) return c.go(stationOf(s)) || say(`移到${name(s)}，按 ↓ 两次伸到液面下，按住 W 吸到 ${+ml.toFixed(2)} mL（看刻度放大镜，现在 ${have.toFixed(2)} mL）`, ['↓', 'W'], { item: s.id });
    return c.go(stationOf(d)) || say(`移到${name(d)}${into}，按 ↓ 进入容器，按住 S 把 ${+ml.toFixed(2)} mL 全部放出`, ['↓', 'S'], { item: d.id });
  };

  c.vac = (x, { slow = false } = {}) => {
    const t = heldTool(w);
    if (!t || t.kind !== 'vac') return c.tool('vac');
    if (!t.pasteur) {
      const p = Object.values(w.items).find((it) => it.type === 'pasteur');
      return c.go(stationOf(p)) || c.open(p) || say('移到巴斯德吸管罐上，按 T 装上吸管', ['T'], { item: p.id });
    }
    const it = get(x);
    return c.open(it) || c.go(stationOf(it)) || say(`移到${name(it)}，按 ↓ 两次伸到液面下（别到「触底」），按住 W 吸弃${slow ? '；快吸完时同时按住 ⇧ 慢速，别吸到管底沉淀' : ''}`, ['↓', 'W', ...(slow ? ['⇧'] : [])], { item: it.id });
  };

  c.wait = (min, why = '') => say(`按 Z 等待 ${min >= 60 ? `${+(min / 60).toFixed(1)} 小时` : `${min} 分钟`}${why ? `，${why}` : ''}`, ['Z'], { dom: '#waitbtn' });
  c.fx = (id, text) => say(text, ['轻点'], { fx: id });
  c.note = (text) => say(text, ['N'], { dom: '#nbbtn' });

  // Biosafety cabinet start-up: UV off, fan on, 5 minutes, wipe.
  c.bscReady = ({ wipe = true } = {}) => {
    const b = w.bsc;
    if (!b.uv && b.fan && w.t - b.fanSince >= 4.999 && (!wipe || b.wiped)) return null;
    return c.go('bsc')
      || (b.uv ? c.fx('bsc-uv', '轻点安全柜顶部的「紫外」按钮，先关掉紫外灯') : null)
      || (!b.fan ? c.fx('bsc-fan', '轻点「风机」按钮，打开风机和照明') : null)
      || (w.t - b.fanSince < 4.999 ? c.wait(Math.max(1, Math.ceil(5 - (w.t - b.fanSince))), '让下沉气流稳定') : null)
      || (wipe && !b.wiped ? say('把指针移到安全柜台面空处，按 A 用 75% 酒精擦拭', ['A'], { rect: BSC_FLOOR }) : null);
  };

  return c;
}
