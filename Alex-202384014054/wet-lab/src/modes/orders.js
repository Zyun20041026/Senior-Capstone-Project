// Alex 202384014054
// Money in the open modes. One entry point charges for anything (bill), one
// refunds (refund); both write the account's ledger. Instrument runs are
// charged when their job starts, supplies when they reach the cart, exams
// and biopsies when booked. Advancing the patient's months never charges.

import { setJobGate } from '../game/jobs.js';
import { ARCHIVE } from '../data/index.js';

// Prices in yuan, from the real-world archive (src/data/prices.js).
export const PRICE = Object.fromEntries(Object.entries(ARCHIVE.prices).map(([k, r]) => [k, Math.round(r.value)]));

export function account(w, { cash = Infinity, free = false } = {}) {
  w.account = { cash, start: cash, spent: 0, listed: 0, free, entries: [], seq: 0 };
  // every job start goes through here: keyboard and mouse paths alike
  setJobGate((ww, job) => (ww.account ? bill(ww, `job:${job.kind}`, { job: job.id, label: job.label }) : true));
  return w.account;
}
export const priceOf = (w, key) => (w.account?.free ? 0 : PRICE[key] ?? 0);

// Charge `key`. Refuses (and charges nothing) when the balance is short.
export function bill(w, key, ref = {}) {
  const a = w.account;
  if (!a) return true;
  const amt = priceOf(w, key);
  if (amt > a.cash + 1e-9) { a.lastRefusal = { key, amt, t: w.t }; return false; }
  a.cash -= amt; a.spent += amt; a.listed += PRICE[key] ?? 0; // listed: what it would have cost
  a.entries.push({ id: `B${++a.seq}`, key, amt, list: PRICE[key] ?? 0, ref, t: w.t, month: w.case?.sim.month ?? null });
  return true;
}
export function refund(w, entryId) {
  const a = w.account, e = a?.entries.find((x) => x.id === entryId);
  if (!e || e.refunded) return false;
  e.refunded = true; a.cash += e.amt; a.spent -= e.amt; a.listed -= e.list || 0;
  a.entries.push({ id: `B${++a.seq}`, key: `refund:${e.key}`, amt: -e.amt, ref: { of: e.id }, t: w.t, month: w.case?.sim.month ?? null });
  return true;
}
export const yuan = (v) => (v === Infinity ? '不限' : `¥${Math.round(v).toLocaleString('zh-CN')}`);

// ---------------------------------------------------------------- orders

// Patient orders (CT, biopsy): booked → done | cancelled. Charged at booking,
// refunded if cancelled before use.
export function book(w, kind, extra = {}) {
  w.orders ||= { seq: 0, list: [] };
  const id = `O${++w.orders.seq}`;
  if (!bill(w, kind, { order: id })) return { error: `余额不足：${kind === 'ct' ? 'CT' : '活检'}需要 ${yuan(priceOf(w, kind))}` };
  const o = { id, kind, state: 'booked', month: w.case?.sim.month ?? null, t: w.t, bill: w.account?.entries.at(-1)?.id, ...extra };
  w.orders.list.push(o);
  return { order: o };
}
export function cancel(w, id) {
  const o = w.orders?.list.find((x) => x.id === id);
  if (!o || o.state !== 'booked') return false;
  o.state = 'cancelled';
  if (o.bill) refund(w, o.bill);
  return true;
}
export const openOrders = (w, kind) => (w.orders?.list || []).filter((o) => o.state === 'booked' && (!kind || o.kind === kind));
