// Alex 202384014054
// Level score: SOP compliance, data quality, time, and, from level 3 on, the
// patient benefit ("攻克癌症指数").

export function levelScore({ penalty, data, minutes, par, cancer = null, stars: cut = [88, 72, 52] }) {
  const sop = Math.max(0, Math.round(100 - penalty));
  const over = Math.max(0, minutes - par) / par;
  const time = Math.max(0, Math.round(100 - over * 100));
  const dataS = Math.max(0, Math.min(100, Math.round(data)));
  const total = cancer == null
    ? Math.round(0.4 * sop + 0.45 * dataS + 0.15 * time)
    : Math.round(0.3 * sop + 0.25 * dataS + 0.1 * time + 0.35 * cancer);
  const stars = total >= cut[0] ? 3 : total >= cut[1] ? 2 : total >= cut[2] ? 1 : 0;
  return { sop, data: dataS, time, cancer, total, stars };
}
