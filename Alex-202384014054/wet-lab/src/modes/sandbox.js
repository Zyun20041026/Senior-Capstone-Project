// Alex 202384014054
// 沙盒实验室: everything stocked, everything free (but still on the books),
// no goals and no score.

import { startLedger } from './ledger.js';
import { account, yuan } from './orders.js';
import { stockLab } from './stock.js';

export function sandboxMode() {
  return {
    id: 'sandbox', title: '沙盒实验室', num: '沙盒', badge: '沙',
    stations: ['bsc', 'bench', 'incubator', 'fridge', 'reader'], start: 'bsc', par: 0, waits: [5, 15, 30, 60, 1440, 2880],
    steps: [], notes: [], complete: () => false, evaluate: () => ({ metrics: [] }), fatal: () => null, ease: {},
    intro: '没有目标，也不评分。U 物资柜（免费，照常记账），P 查看按键说明。',
    setup(w) {
      w.clock0 = 9 * 60; w.day = 1;
      w.diff = { id: 'sandbox', label: '沙盒', undo: false, truth: true, strict: false };
      account(w, { cash: Infinity, free: true });
      startLedger(w);
      stockLab(w);
    },
    card(w) { return { title: '沙盒实验室', sub: `记账 ${yuan(w.account.listed)}（不扣费）· U 物资柜`, btn: 'U 物资柜' }; },
    cardClick(app) { app.openSupply(); },
  };
}

