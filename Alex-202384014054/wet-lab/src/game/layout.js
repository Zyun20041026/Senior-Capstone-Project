// Alex 202384014054
// Station layouts in game-root coordinates (1600 × 900; scene band y 56–828).
// Slots are where items can stand. `y` is the baseline an item stands on;
// deck slots are plan-view footprints (x, y = top-left). Positions are shared
// by the world (what fits where, what environment) and the view (where to draw).

export const SCENE = { top: 56, bottom: 828 };
export const DECK = { x: 676, y: 262, w: 294, h: 197, gapX: 12, gapY: 44, px: 2.3 };

const deckSlot = (i) => {
  const c = i % 3, r = Math.floor(i / 3);
  return { id: `d${i + 1}`, kind: 'deck', x: DECK.x + c * (DECK.w + DECK.gapX), y: DECK.y + r * (DECK.h + DECK.gapY), w: DECK.w, h: DECK.h, accepts: ['sbs'] };
};

export const STATIONS = {
  bsc: {
    id: 'bsc', key: '1', name: '生物安全柜', env: 'bsc',
    slots: [
      // back row (further away, drawn smaller)
      { id: 'k1', kind: 'surface', x: 292, y: 686, accepts: ['big', 'bottle', 'tube', 'flask', 'small', 'ep', 'box'] },
      { id: 'k2', kind: 'surface', x: 392, y: 686, accepts: ['big', 'bottle', 'tube', 'flask', 'small', 'ep', 'box'] },
      { id: 'k3', kind: 'surface', x: 478, y: 686, accepts: ['big', 'bottle', 'tube', 'flask', 'small', 'ep', 'box'] },
      { id: 'k4', kind: 'surface', x: 560, y: 686, accepts: ['bottle', 'tube', 'small', 'ep', 'box', 'holder'] },
      { id: 'k5', kind: 'surface', x: 624, y: 686, accepts: ['bottle', 'tube', 'small', 'ep', 'holder'] },
      // front row
      { id: 'f1', kind: 'surface', x: 104, y: 790, accepts: ['flask', 'bottle', 'small', 'box', 'big'] },
      { id: 'r1', kind: 'rack15', x: 236, y: 790, accepts: ['tube'] },
      { id: 'r2', kind: 'rack15', x: 270, y: 790, accepts: ['tube'] },
      { id: 'r3', kind: 'rack15', x: 304, y: 790, accepts: ['tube'] },
      { id: 'r4', kind: 'rack15', x: 338, y: 790, accepts: ['tube'] },
      { id: 'e1', kind: 'rackEP', x: 404, y: 790, accepts: ['ep'] },
      { id: 'e2', kind: 'rackEP', x: 428, y: 790, accepts: ['ep'] },
      { id: 'e3', kind: 'rackEP', x: 452, y: 790, accepts: ['ep'] },
      { id: 'e4', kind: 'rackEP', x: 476, y: 790, accepts: ['ep'] },
      { id: 'e5', kind: 'rackEP', x: 500, y: 790, accepts: ['ep'] },
      { id: 'f2', kind: 'surface', x: 572, y: 790, accepts: ['small', 'flask', 'bottle', 'box', 'ep'] },
      ...[0, 1, 2, 3, 4, 5].map(deckSlot),
    ],
    fixtures: ['bscFrame', 'stand', 'waste'],
  },
  bench: {
    id: 'bench', key: '2', name: '实验台', env: 'room',
    slots: [
      { id: 'pan', kind: 'pan', x: 250, y: 600, accepts: ['small'], inst: 'balance', fixture: 'balance' },
      { id: 'scope', kind: 'stage', x: 800, y: 560, accepts: ['flask', 'sbs', 'small'], inst: 'scope', fixture: 'scope' },
      { id: 'bath1', kind: 'bath', x: 1010, y: 760, accepts: ['big', 'bottle', 'tube', 'ep', 'flask', 'sbs'], env: 'bath', fixture: 'bath' },
      { id: 'bath2', kind: 'bath', x: 1100, y: 760, accepts: ['big', 'bottle', 'tube', 'ep', 'flask', 'sbs'], env: 'bath', fixture: 'bath' },
      { id: 'bath3', kind: 'bath', x: 1190, y: 760, accepts: ['big', 'bottle', 'tube', 'ep', 'flask', 'sbs'], env: 'bath', fixture: 'bath' },
      { id: 'vortex', kind: 'vortex', x: 1336, y: 760, accepts: ['tube', 'ep'], inst: 'vortex', fixture: 'vortex' },
      { id: 'b1', kind: 'rack15', x: 1440, y: 790, accepts: ['tube'], fixture: 'rack' },
      { id: 'b2', kind: 'rack15', x: 1474, y: 790, accepts: ['tube'], fixture: 'rack' },
      { id: 'b3', kind: 'rack15', x: 1508, y: 790, accepts: ['tube'], fixture: 'rack' },
      { id: 'b4', kind: 'rack15', x: 1542, y: 790, accepts: ['tube'], fixture: 'rack' },
      { id: 'bf1', kind: 'surface', x: 150, y: 792, accepts: ['big', 'bottle', 'box', 'small', 'flask', 'ep', 'tube', 'sbs'] },
      { id: 'bf2', kind: 'surface', x: 444, y: 792, accepts: ['big', 'bottle', 'box', 'small', 'flask', 'ep', 'tube', 'sbs'] },
      { id: 'bf3', kind: 'surface', x: 540, y: 792, accepts: ['big', 'bottle', 'box', 'small', 'flask', 'ep', 'tube', 'sbs'] },
      { id: 'bf4', kind: 'surface', x: 636, y: 792, accepts: ['big', 'bottle', 'box', 'small', 'flask', 'ep', 'tube', 'sbs'] },
      // spare spots, used only where a level's bench has room for them
      ...['bf5', 'bf6', 'bf7'].map((id) => ({ id, kind: 'surface', x: 0, y: 792, spare: true, accepts: ['big', 'bottle', 'box', 'small', 'flask', 'ep', 'tube', 'sbs'] })),
    ],
    fixtures: ['balance', 'centrifuge', 'scope', 'bath', 'vortex', 'benchStand', 'benchWaste'],
  },
  incubator: {
    id: 'incubator', key: '3', name: '培养箱', env: 'inc',
    slots: [0, 1, 2].flatMap((s) => [0, 1, 2, 3].map((i) => ({ id: `i${s * 4 + i + 1}`, kind: 'shelf', x: 560 + i * 150, y: 330 + s * 170, accepts: ['flask', 'sbs', 'tube', 'bottle', 'ep'], env: 'inc', door: 'incubator' }))),
    fixtures: ['incubator'],
  },
  fridge: {
    id: 'fridge', key: '4', name: '冰箱', env: 'room',
    slots: [
      ...[0, 1, 2].flatMap((s) => [0, 1, 2].map((i) => ({ id: `c${s * 3 + i + 1}`, kind: 'shelf', x: 272 + i * 150, y: 330 + s * 172, accepts: ['big', 'bottle', 'tube', 'ep', 'sbs', 'flask', 'small'], env: 'fridge', door: 'fridge' }))),
      ...[0, 1].flatMap((s) => [0, 1, 2, 3].map((i) => ({ id: `z${s * 4 + i + 1}`, kind: 'shelf', x: 932 + i * 104, y: 404 + s * 170, accepts: ['ep', 'tube', 'small'], env: 'freezer', door: 'freezer' }))),
    ],
    fixtures: ['fridge', 'freezer'],
  },
  reader: {
    id: 'reader', key: '5', name: '酶标仪', env: 'room',
    slots: [{ id: 'drawer', kind: 'drawer', x: 430, y: 600, accepts: ['sbs'], inst: 'reader' },
      { id: 'rf1', kind: 'surface', x: 200, y: 792, accepts: ['sbs', 'small', 'ep', 'tube', 'flask'] },
      { id: 'rf2', kind: 'surface', x: 640, y: 792, accepts: ['sbs', 'small', 'ep', 'tube', 'flask'] }],
    fixtures: ['reader', 'computer'],
  },
};

// The cart that travels with you between stations.
export const TRAY = Array.from({ length: 6 }, (_, i) => ({ id: `t${i + 1}`, kind: 'tray', x: 1112 + i * 80, y: 884, accepts: ['big', 'bottle', 'tube', 'flask', 'sbs', 'small', 'ep', 'box', 'holder'] }));

export const STATION_ORDER = ['bsc', 'bench', 'incubator', 'fridge', 'reader'];

// Levels show only the bench instruments they use and move the free bench
// spots into the gaps (level.benchSlots: { bf1: x, ... }).
export function benchLayout(level) {
  const o = (level && level.benchSlots) || {};
  for (const s of STATIONS.bench.slots) { if (s.x0 == null) s.x0 = s.x; s.x = o[s.id] ?? s.x0; if (s.spare) s.off = o[s.id] == null; }
}
export const slotActive = (level, s) => !s.off && (!s.fixture || !level || !level.benchFixtures || level.benchFixtures.includes(s.fixture));

export function slotDef(st, id) {
  if (st === 'tray') return TRAY.find((s) => s.id === id);
  return STATIONS[st]?.slots.find((s) => s.id === id);
}

// Pipette and tool homes.
export const TOOL_HOME = {
  bsc: { p20: [44, 300], p200: [80, 300], p1000: [116, 300], mc20: [160, 300], mc200: [210, 300], aid: [196, 560], vac: [40, 560] },
  bench: { p20: [1430, 330], p200: [1470, 330], p1000: [1510, 330] },
};

// Rotor: 6 buckets; opposite of i is (i + 3) % 6.
export const ROTOR = 6;
export const R_CM = 10;
