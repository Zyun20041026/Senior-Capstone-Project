// Alex 202384014054
// A fully stocked lab for the open modes, built from the same factories the
// levels use, and the supply catalogue for the cabinet (key U).

import { put, occupant } from '../game/world.js';
import { make } from '../game/catalog.js';
import { R, tools, flask } from '../levels/common.js';
import { TRAY } from '../game/layout.js';
import { bill, priceOf } from './orders.js';

export function stockLab(w, { flasks = ['A549', 'A549'] } = {}) {
  const sp = { sprayed: true };
  tools(w, ['p20', 'p200', 'p1000', 'mc20', 'mc200', 'aid', 'vac'], 'bsc');
  put(w, R.medium({ tag: 'medium' }), 'fridge', 'c1');
  put(w, R.pbs({ tag: 'pbs' }), 'fridge', 'c2');
  put(w, R.trypsin({ tag: 'trypsin' }), 'fridge', 'c3');
  put(w, R.cck8({ tag: 'cck' }), 'fridge', 'c4');
  put(w, R.dmso({ tag: 'dmso' }), 'bench', 'bf3');
  put(w, R.tb({ tag: 'tb' }), 'bench', 'bf4');
  put(w, R.sero(10), 'bsc', 'k5');
  put(w, R.tips('blue', 'full', { side: true, ...sp }), 'bsc', 'k4');
  put(w, R.tips('white', 'full', { side: true, ...sp }), 'bsc', 'k3');
  put(w, R.tube('15 mL 管', { ...sp }), 'bsc', 'r1');
  put(w, R.tube('15 mL 管', { ...sp }), 'bsc', 'r2');
  put(w, make('plate', { label: '96 孔板', short: '96 孔板', ...sp }), 'bsc', 'd1');
  put(w, make('uplate', { label: '稀释板', short: '稀释板（U 底）', ...sp }), 'bsc', 'd2');
  put(w, R.res({ ...sp }), 'bsc', 'd4');
  put(w, R.tips('yellow', 'full', sp), 'bsc', 'd5');
  put(w, R.tips('white', 'full', sp), 'bsc', 'd6');
  flasks.forEach((l, k) => put(w, flask(l, 1.6e6, { critical: false, tag: `flask:${l}:${k + 1}` }), 'incubator', `i${k + 1}`));
}

// What the cabinet sells. `make` builds the item.
const cell = (id, desc) => ({ tab: '细胞', key: 'flask', id, name: `${id} 培养瓶（${desc}）`, make: () => flask(id, 1.2e6, { critical: false }) });
export const TABS = ['细胞', '试剂', '耗材'];
export const CATALOG = [
  cell('A549', '人肺上皮来源细胞系'),
  { tab: '试剂', key: 'medium', name: 'RPMI-1640 完全培养基 500 mL', make: () => R.medium() },
  { tab: '试剂', key: 'pbs', name: 'PBS 100 mL', make: () => R.pbs() },
  { tab: '试剂', key: 'trypsin', name: '0.25% 胰酶-EDTA 100 mL', make: () => R.trypsin() },
  { tab: '试剂', key: 'cck8', name: 'CCK-8 试剂 5 mL', make: () => R.cck8() },
  { tab: '试剂', key: 'dmso', name: 'DMSO 1.5 mL', make: () => R.dmso() },
  { tab: '试剂', key: 'tb', name: '0.4% 台盼蓝', make: () => R.tb() },
  { tab: '耗材', key: 'plate', name: '96 孔细胞培养板', make: () => make('plate', { label: '96 孔板', short: '96 孔板' }) },
  { tab: '耗材', key: 'uplate', name: '96 孔 U 底稀释板', make: () => make('uplate', { label: '稀释板', short: '稀释板（U 底）' }) },
  { tab: '耗材', key: 'res', name: '四槽加样槽', make: () => R.res() },
  { tab: '耗材', key: 'tips', id: 'yellow', name: '200 µL 枪头（整盒）', make: () => R.tips('yellow', 'full') },
  { tab: '耗材', key: 'tips', id: 'white', name: '20 µL 枪头（整盒）', make: () => R.tips('white', 'full') },
  { tab: '耗材', key: 'tube', name: '15 mL 离心管', make: () => R.tube('15 mL 管') },
  { tab: '耗材', key: 'ep', name: '1.5 mL 离心管', make: () => R.ep('EP 管') },
  { tab: '耗材', key: 'sero', name: '10 mL 血清移液管', make: () => R.sero(10) },
];
export const freeCartSlot = (w) => TRAY.find((s) => !occupant(w, 'tray', s.id))?.id || null;

// One purchase: a free cart slot first, then the charge, then the item.
export function buy(w, entry) {
  if (entry.need && !entry.need(w)) return { error: entry.needText || '暂不可购买' };
  const slot = freeCartSlot(w);
  if (!slot) return { error: '推车满了：先把推车上的东西放到工位上' };
  if (!bill(w, `buy:${entry.key}`, { item: entry.name })) return { error: `余额不足（${entry.name}）` };
  const it = entry.make();
  put(w, it, 'tray', slot);
  return { item: it };
}
export const priceFor = (w, entry) => priceOf(w, `buy:${entry.key}`);
