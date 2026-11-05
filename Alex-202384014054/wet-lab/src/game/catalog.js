// Alex 202384014054
// Item types and a small factory. `cat` decides which slots accept the item;
// `tau` is the thermal time constant in minutes; `cap` is volume in µL.

import { L } from '../sim/liquid.js';

export const TYPES = {
  bottle500: { cat: 'big', name: '500 mL 培养基瓶', cap: 500000, lid: true, tau: 16 },
  bottle100: { cat: 'bottle', name: '100 mL 试剂瓶', cap: 100000, lid: true, tau: 9 },
  beaker: { cat: 'bottle', name: '烧杯', cap: 100000, lid: false, tau: 20 },
  flask: { cat: 'flask', name: 'T25 培养瓶', cap: 15000, lid: true, tau: 5 },
  tube15: { cat: 'tube', name: '15 mL 离心管', cap: 15000, lid: true, tau: 4 },
  tube50: { cat: 'tube', name: '50 mL 离心管', cap: 50000, lid: true, tau: 7 },
  ep: { cat: 'ep', name: '1.5 mL 离心管', cap: 1500, lid: true, tau: 1.2 },
  vial: { cat: 'ep', name: '棕色冻存管', cap: 2000, lid: true, tau: 2.5 },
  kit: { cat: 'ep', name: '试剂盒小瓶', cap: 5000, lid: true, tau: 3 },
  plate: { cat: 'sbs', name: '96 孔细胞培养板', wells: 96, wellCap: 360, lid: true, tau: 6 },
  uplate: { cat: 'sbs', name: '96 孔 U 底稀释板', wells: 96, wellCap: 320, lid: true, tau: 4 },
  res4: { cat: 'sbs', name: '四槽加样槽', lanes: 4, laneCap: 30000, lid: false, tau: 4 },
  tipbox: { cat: 'sbs', name: '枪头盒', lid: true },
  tipboxSide: { cat: 'box', name: '枪头盒', lid: true },
  seropack: { cat: 'holder', name: '血清移液管' },
  pasteur: { cat: 'holder', name: '巴斯德吸管罐' },
  boat: { cat: 'small', name: '称量舟', cap: 3000, lid: false, tau: 1 },
  hemo: { cat: 'small', name: '血球计数板', cap: 12, lid: false, tau: 0.5 },
};

let seq = 0;
export function make(type, props = {}) {
  const T = TYPES[type];
  const it = {
    id: props.id || `${type}${++seq}`, type, cat: T.cat,
    label: T.name, sub: '', open: !T.lid, sprayed: false, wet: false,
    temp: 22, sterile: true, stock: false, risk: 0,
    liq: L(), at: null,
    ...props,
  };
  if (T.wells) it.wells = it.wells || Array.from({ length: 96 }, () => ({ liq: L(), n: 0, dead: 0, bubble: 0, seededAt: null, cck: 0 }));
  if (T.lanes) it.lanes = it.lanes || Array.from({ length: T.lanes }, () => L());
  return it;
}

export function tipbox(color, layout = 'full', props = {}) {
  const present = Array.from({ length: 96 }, (_, i) => layout === 'full' || (Math.floor(i / 12) >= 1 && Math.floor(i / 12) <= 6));
  return make(props.side ? 'tipboxSide' : 'tipbox', {
    color, layout, present,
    label: `${{ white: '10/20 µL 白色', yellow: '200 µL 黄色', blue: '1000 µL 蓝色' }[color]}枪头${layout === 'BG' ? '（B–G 排）' : ''}`,
    ...props,
  });
}

export const TIP_FOR = { white: ['p20', 'mc20'], yellow: ['p200', 'mc200'], blue: ['p1000'] };
