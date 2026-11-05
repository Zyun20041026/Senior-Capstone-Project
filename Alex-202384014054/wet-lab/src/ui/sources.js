// Alex 202384014054
// "资料来源": every real-world number and fact the game uses, with how sure we
// are of it and where it comes from. Opened from the pause menu.

import { ARCHIVE, allRecords } from '../data/index.js';
import { STATUS, KINDS } from '../data/schema.js';
import { openPanel } from './panels.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CATS = { cells: '细胞系', drugs: '药物', prices: '价格', constants: '常数与标准' };
const FIELD = { td: '倍增时间', capT25: 'T25 瓶汇合细胞数', capWell: '96 孔单孔汇合细胞数', tissue: '来源', egfr: '基因型', approval: '获批情况', mw: '分子量', h: '剂量反应曲线 Hill 系数', bottom: '最高浓度下残余活力', ic50: 'IC50' };

const num = (v) => (v >= 1e4 || v < 1e-3 ? v.toExponential(2).replace('e', '×10^') : String(+v.toPrecision(4)));
function valueText(r) {
  if (!('value' in r)) return r.text;
  const range = r.range ? `（报道范围 ${num(r.range[0])}–${num(r.range[1])}）` : '';
  return `${num(r.value)} ${r.unit}${range}`;
}
function nameOf(cat, path) {
  const [, id, ...field] = path.split('.');
  const e = ARCHIVE[cat][id];
  if (cat === 'prices') return e.cond;
  if (!field.length) return e.zh || id;
  const f = FIELD[field[0]] || field[0];
  return [e.zh || id, f, ...field.slice(1)].join(' · ');
}

export function sourcesModel() {
  const recs = allRecords();
  return Object.keys(CATS).map((cat) => ({
    cat, title: CATS[cat],
    rows: recs.filter((x) => x.cat === cat).map(({ path, rec }) => ({
      path, name: nameOf(cat, path), valueText: valueText(rec), status: rec.status, statusText: STATUS[rec.status],
      kind: rec.kind ? KINDS[rec.kind] : '', cond: cat === 'prices' ? '' : rec.cond || '',
      links: (rec.sources || []).map((s) => ({ title: s.title, url: s.url, accessed: s.accessed })),
      basis: rec.basis || rec.note || '',
    })),
  }));
}

export function sourcesPanel(app) {
  const m = sourcesModel();
  const all = m.flatMap((g) => g.rows);
  const count = (s) => all.filter((r) => r.status === s).length;
  const st = { cat: 'drugs', q: '' };
  const { body } = openPanel({ title: '资料来源', sub: `游戏里的真实数据共 ${all.length} 条：已核实 ${count('verified')} · 估计值 ${count('estimate')} · 待核实 ${count('pending')}`, w: 1100, y: 60, id: 'sources', modal: true });
  const draw = () => {
    const g = m.find((x) => x.cat === st.cat);
    const rows = g.rows.filter((r) => !st.q || r.name.includes(st.q));
    body.innerHTML = `<div class="src-top"><div class="src-tabs">${m.map((x) => `<button class="chip" data-cat="${x.cat}" aria-pressed="${x.cat === st.cat}">${esc(x.title)}<span>${x.rows.length}</span></button>`).join('')}</div>
      <input class="src-q" placeholder="按名称筛选，如：吉非替尼、PC-9" value="${esc(st.q)}" data-q>
      <p class="src-legend"><i class="src-st verified">已核实</i>有出处，链接可点开<i class="src-st estimate">估计值</i>没有可用的公开数据，写明了依据<i class="src-st pending">待核实</i>还没查到出处</p></div>
      <div class="src-list">${rows.map((r) => `<article class="src-row">
        <header><b>${esc(r.name)}</b><i class="src-st ${r.status}">${esc(r.statusText)}</i></header>
        <p class="src-v">${esc(r.valueText)}${r.kind ? `<span>${esc(r.kind)}</span>` : ''}</p>
        ${r.cond ? `<p class="src-c">${esc(r.cond)}</p>` : ''}
        ${r.basis ? `<p class="src-b">${esc(r.basis)}</p>` : ''}
        ${r.links.length ? `<ul>${r.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a><span>查阅于 ${esc(l.accessed)}</span></li>`).join('')}</ul>` : ''}
      </article>`).join('') || '<p class="hint">没有匹配的条目。</p>'}</div>`;
  };
  draw();
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { st.cat = b.dataset.cat; draw(); } });
  body.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { st.q = e.target.value.trim(); const pos = e.target.selectionStart; draw(); const q = body.querySelector('[data-q]'); q.focus(); q.setSelectionRange(pos, pos); } });
}
