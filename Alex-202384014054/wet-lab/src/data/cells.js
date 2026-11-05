// Alex 202384014054
// Cell lines in the lab. Identity, genotype and doubling time come from
// Cellosaurus and the sources it cites; where cell banks disagree the typical
// value is the cell banks' median and the range spans every reported value.
// Confluent cell numbers are one generic reference (no per-line data exists).

const READ = '2026-11-01';
const cello = (acc, name) => ({ title: `Cellosaurus ${acc}（${name}）`, url: `https://www.cellosaurus.org/${acc}`, accessed: READ });
const thermo = { title: 'Thermo Fisher（Gibco）：Cell culture useful numbers', url: 'https://www.thermofisher.com/us/en/home/references/gibco-cell-culture-basics/cell-culture-protocols/cell-culture-useful-numbers.html', accessed: READ };

// No line-specific confluent densities are published for these lines; the
// Gibco reference (HeLa) is used for all of them.
const capT25 = { value: 2.8e6, unit: '个细胞', kind: 'model', status: 'estimate', cond: 'T25 培养瓶（25 cm²）长满时', basis: 'Gibco 参考值（HeLa）：T-25 汇合时约 2.8×10⁶ 个细胞；各细胞系实际不同，缺乏逐株数据，统一采用参考值', sources: [thermo] };
const capWell = { value: 4e4, unit: '个细胞', kind: 'model', status: 'estimate', cond: '96 孔板单孔（0.32 cm²）长满时', basis: 'Gibco 参考值：96 孔板每孔汇合约 4×10⁴ 个细胞；各细胞系实际不同，缺乏逐株数据，统一采用参考值', sources: [thermo] };

const made = (from, what) => ({ status: 'estimate', text: what, basis: `游戏内用 CRISPR 在 ${from} 上构建，基因型由编辑设计决定` });

export const cells = {
  'PC-9': {
    id: 'PC-9', zh: 'PC-9', en: 'PC-9', accession: 'CVCL_B260',
    tissue: { text: '肺腺癌（淋巴结转移灶来源）', status: 'verified', sources: [cello('CVCL_B260', 'PC-9')] },
    egfr: { text: 'EGFR 19 外显子缺失 p.E746_A750del（c.2235_2249del15）', status: 'verified', sources: [cello('CVCL_B260', 'PC-9')] },
    td: {
      value: 24, range: [22, 36], unit: 'h', kind: 'literature', status: 'verified', cond: '亲本 PC-9，常规培养',
      note: 'Cellosaurus 未收录倍增时间；同行评审论文报道亲本 24 ± 2 h，供应商资料约 36 h',
      sources: [
        { title: 'PMC6472415 表 1：亲本 PC9 倍增时间 24 ± 2 h', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6472415/table/Tab1', accessed: READ },
        { title: 'KYinno PC9 产品资料：倍增时间约 36 h', url: 'https://cn.kyinno.com/?p=19967', accessed: READ },
      ],
    },
    capT25, capWell,
  },
  H1975: {
    id: 'H1975', zh: 'NCI-H1975', en: 'NCI-H1975', accession: 'CVCL_1511',
    tissue: { text: '肺腺癌', status: 'verified', sources: [cello('CVCL_1511', 'NCI-H1975')] },
    egfr: { text: 'EGFR L858R（c.2573T>G）+ T790M（c.2369C>T），均为杂合', status: 'verified', sources: [cello('CVCL_1511', 'NCI-H1975')] },
    td: {
      value: 34.6, range: [28, 48], unit: 'h', kind: 'literature', status: 'verified',
      note: '无细胞库数值，取四篇文献的中位（38.7、30.5、28、42.2 h）；供应商 Hysigen 为 36–48 h',
      sources: [cello('CVCL_1511', 'NCI-H1975')],
    },
    capT25, capWell,
  },
  'PC-9-T790M': {
    id: 'PC-9-T790M', zh: 'PC-9-T790M', en: 'PC-9 T790M knock-in',
    tissue: made('PC-9', '肺腺癌（PC-9 经 CRISPR 敲入 T790M）'),
    egfr: made('PC-9', 'EGFR 19 外显子缺失 + T790M（敲入）'),
    td: { value: 24, unit: 'h', kind: 'model', status: 'estimate', basis: '由 PC-9 改造，倍增时间按亲本 PC-9 估计' },
    capT25, capWell,
  },
  A431: {
    id: 'A431', zh: 'A-431', en: 'A-431', accession: 'CVCL_0037',
    tissue: { text: '皮肤鳞状细胞癌（表皮样癌），表皮来源', status: 'verified', sources: [cello('CVCL_0037', 'A-431')] },
    egfr: { text: 'EGFR 激酶区野生型（常用作野生型 EGFR 参照）', status: 'pending', note: 'Cellosaurus 未列 EGFR 激酶区突变，另列 EGFR-PPARGC1A 融合（PubMed 23637631）；EGFR 扩增与高表达的出处待补' },
    td: {
      value: 90, range: [80, 100], unit: 'h', kind: 'literature', status: 'verified',
      note: '细胞库 DSMZ（ACC-91）：约 80–100 h；原设定 26 h 偏快',
      sources: [cello('CVCL_0037', 'A-431')],
    },
    capT25, capWell,
  },
  HCC827: {
    id: 'HCC827', zh: 'HCC827', en: 'HCC827', accession: 'CVCL_2063',
    tissue: { text: '肺腺癌', status: 'verified', sources: [cello('CVCL_2063', 'HCC827')] },
    egfr: { text: 'EGFR 19 外显子缺失 p.E746_A750del（c.2236_2250del15），杂合', status: 'verified', sources: [cello('CVCL_2063', 'HCC827')] },
    td: {
      value: 41.5, range: [28, 84], unit: 'h', kind: 'literature', status: 'verified',
      note: '两家细胞库差异很大：ATCC 28 h、DSMZ 约 50–60 h，取二者中位；文献 44.5、71 h，供应商 72–84 h',
      sources: [cello('CVCL_2063', 'HCC827')],
    },
    capT25, capWell,
  },
  H3255: {
    id: 'H3255', zh: 'NCI-H3255', en: 'NCI-H3255', accession: 'CVCL_6831',
    tissue: { text: '肺腺癌', status: 'verified', sources: [cello('CVCL_6831', 'NCI-H3255')] },
    egfr: { text: 'EGFR L858R', status: 'verified', sources: [{ title: 'CIViC 证据 4293：NCI-H3255（EGFR L858R）对厄洛替尼敏感', url: 'https://mgend.ncgm.go.jp/annotation/info/CIVIC_EVIDENCE_4293', accessed: READ }] },
    td: { value: 44, unit: 'h', kind: 'model', status: 'estimate', basis: 'Cellosaurus 与 ATCC 均未给出倍增时间；沿用原设定，量级与其他 EGFR 突变肺腺癌细胞系相近' },
    capT25, capWell,
  },
  A549: {
    id: 'A549', zh: 'A-549', en: 'A-549', accession: 'CVCL_0023',
    tissue: { text: '肺腺癌', status: 'verified', sources: [cello('CVCL_0023', 'A-549')] },
    egfr: { text: 'KRAS p.G12S（c.34G>A，纯合）', status: 'verified', sources: [cello('CVCL_0023', 'A-549')] },
    td: {
      value: 34, range: [18, 40], unit: 'h', kind: 'literature', status: 'verified',
      note: '细胞库 CLS 约 28 h、DSMZ 约 40 h，取二者中位；文献 18–37 h（随培养基不同）',
      sources: [cello('CVCL_0023', 'A-549')],
    },
    capT25, capWell,
  },
  'BEAS-2B': {
    id: 'BEAS-2B', zh: 'BEAS-2B', en: 'BEAS-2B', accession: 'CVCL_0168',
    tissue: { text: '支气管上皮，经 Ad12-SV40 杂合病毒转化永生化', status: 'verified', sources: [cello('CVCL_0168', 'BEAS-2B')] },
    egfr: { text: '未报道 EGFR 突变（常作正常上皮参照）', status: 'pending', note: 'Cellosaurus 未列 EGFR 变异；"无突变"的出处待补' },
    td: { value: 42, range: [36, 48], unit: 'h', kind: 'literature', status: 'verified', note: '供应商 Hysigen 资料 36–48 h，取中值', sources: [cello('CVCL_0168', 'BEAS-2B')] },
    capT25, capWell,
  },
  'HCC827-GR': {
    id: 'HCC827-GR', zh: 'HCC827-GR', en: 'HCC827 GR5', accession: 'CVCL_V622',
    tissue: { text: '肺腺癌（HCC827 经吉非替尼长期筛选的耐药亚系）', status: 'verified', sources: [cello('CVCL_V622', 'HCC827 GR5')] },
    egfr: {
      text: 'EGFR 19 外显子缺失（继承自 HCC827）+ MET 扩增（7q31.1–q33.3）', status: 'verified',
      sources: [cello('CVCL_V622', 'HCC827 GR5'), { title: 'Engelman 等，Science 2007：MET amplification leads to gefitinib resistance in lung cancer by activating ERBB3 signaling', url: 'https://pure.skku.edu/en/publications/met-amplification-leads-to-gefitinib-resistance-in-lung-cancer-by/', accessed: READ }],
    },
    td: { value: 48, unit: 'h', kind: 'literature', status: 'verified', note: 'HCC827 GR5：48 h（PubMed 25984343）', sources: [cello('CVCL_V622', 'HCC827 GR5')] },
    capT25, capWell,
  },
  'PC-9-T790M-C797S': {
    id: 'PC-9-T790M-C797S', zh: 'PC-9-T790M-C797S', en: 'PC-9 T790M/C797S knock-in',
    tissue: made('PC-9', '肺腺癌（PC-9 经 CRISPR 敲入 T790M 与 C797S）'),
    egfr: made('PC-9', 'EGFR 19 缺失 + T790M + C797S（顺式）'),
    td: { value: 24, unit: 'h', kind: 'model', status: 'estimate', basis: '由 PC-9 改造，倍增时间按亲本 PC-9 估计' },
    capT25, capWell,
  },
  'PC-9-EGFR-KO': {
    id: 'PC-9-EGFR-KO', zh: 'PC-9-EGFR-KO', en: 'PC-9 EGFR knockout',
    tissue: made('PC-9', '肺腺癌（PC-9 经 CRISPR 敲除 EGFR）'),
    egfr: made('PC-9', 'EGFR 敲除（移码）'),
    td: { value: 40, unit: 'h', kind: 'model', status: 'estimate', basis: 'PC-9 依赖 EGFR 信号，敲除后生长明显减慢；具体数值无公开数据，沿用原设定' },
    capT25, capWell,
  },
};
