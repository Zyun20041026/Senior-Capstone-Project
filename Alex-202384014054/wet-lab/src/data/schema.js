// Alex 202384014054
// The shape every real-world record in src/data/ follows. A record is either
// a number ({ value, range?, unit, kind }) or a stated fact ({ text }), and
// always says how sure we are:
//   verified — at least one source, each with an https link and the date read
//   estimate — no public figure exists; `basis` says how the number was set
//   pending  — not yet checked; `note` says what is missing
// `kind` tells what a number is: a literature measurement, a vendor or
// standard specification, a market price, or a modelling assumption.

export const STATUS = { verified: '已核实', estimate: '估计值', pending: '待核实' };
export const KINDS = { literature: '文献测量', spec: '规格或标准', price: '市场价格', model: '模型假设' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const filled = (s) => typeof s === 'string' && s.trim().length > 0;

export function validate(rec) {
  const p = [];
  if (!rec || typeof rec !== 'object') return ['不是记录'];
  if (!(rec.status in STATUS)) p.push(`状态 ${rec.status} 不在 verified / estimate / pending 之中`);
  const numeric = 'value' in rec;
  if (!numeric && !filled(rec.text)) p.push('既没有数值也没有文字内容');
  if (numeric) {
    if (!(Number.isFinite(rec.value) && rec.value > 0)) p.push(`数值 ${rec.value} 必须是大于 0 的有限数`);
    if (!filled(rec.unit)) p.push('数值缺少单位');
    if (!(rec.kind in KINDS)) p.push(`缺少数值性质 kind（${Object.keys(KINDS).join(' / ')}）`);
    if (rec.range != null) {
      const [lo, hi] = rec.range;
      if (!(Array.isArray(rec.range) && rec.range.length === 2 && Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && lo <= rec.value && rec.value <= hi)) p.push(`范围 ${JSON.stringify(rec.range)} 必须包含数值 ${rec.value}`);
    }
  }
  if (rec.status === 'verified') {
    if (!Array.isArray(rec.sources) || !rec.sources.length) p.push('已核实的记录必须有出处');
    else for (const s of rec.sources) {
      if (!filled(s.title)) p.push('出处缺少标题');
      if (!/^https:\/\//.test(s.url || '')) p.push(`出处链接必须是 https：${s.url}`);
      if (!DATE.test(s.accessed || '')) p.push(`查阅日期格式应为 YYYY-MM-DD：${s.accessed}`);
    }
  }
  if (rec.status === 'estimate' && !filled(rec.basis)) p.push('估计值必须写明依据 basis');
  if (rec.status === 'pending' && !filled(rec.note)) p.push('待核实的记录必须写明 note');
  return p;
}

// A record is any object carrying a status.
export const isRecord = (x) => !!x && typeof x === 'object' && 'status' in x;
