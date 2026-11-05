// Alex 202384014054
// Drugs in the lab, under their real names. Identity, molecular weight and
// approval come from ChEMBL; IC50 per cell line is generated from ChEMBL's
// literature data into ic50.js (see tools/chembl/gen.py). Curve shape
// (Hill slope, residual viability) is a modelling choice, not a measurement.
// `abbr` is the abbreviation commonly used in papers and on lab tube labels.

import { IC50 } from './ic50.js';

const READ = '2026-11-01';
const chembl = (id, name) => ({ title: `ChEMBL ${id}（${name}）`, url: `https://www.ebi.ac.uk/chembl/api/data/molecule/${id}.json`, accessed: READ });
const mw = (id, name, value, salt) => ({ value, unit: 'g/mol', kind: 'spec', status: 'verified', note: `游离碱（母体分子）分子量，ChEMBL full_mwt${salt ? `；临床制剂为${salt}，称量盐型时要换算` : ''}`, sources: [chembl(id, name)] });
const approved = (id, name, year, what) => ({ text: `已获批上市（${year} 年首次批准）。${what}`, status: 'verified', note: 'ChEMBL 记录的最高研发阶段为 4（已上市），首次批准年份取自 ChEMBL', sources: [chembl(id, name)] });
const SHAPE = 'Hill 系数与残余活力是模型参数：取该类药物剂量反应曲线常见的形状，没有逐药拟合公开数据';
const h = (value) => ({ value, unit: '无量纲', kind: 'model', status: 'estimate', basis: SHAPE });
const bottom = (value) => ({ value, unit: '活力比例', kind: 'model', status: 'estimate', basis: `${SHAPE}；残余活力指最高浓度下仍存活的细胞比例` });

export const drugs = {
  gefitinib: {
    id: 'gefitinib', abbr: 'GEF', zh: '吉非替尼', en: 'gefitinib', chembl: 'CHEMBL939',
    cls: '第一代可逆 EGFR 抑制剂',
    approval: approved('CHEMBL939', 'GEFITINIB', 2003, '用于 EGFR 敏感突变（19 外显子缺失、L858R）的晚期非小细胞肺癌。'),
    mw: mw('CHEMBL939', 'GEFITINIB', 446.91),
    note: '与 ATP 竞争结合 EGFR 激酶口袋。19 外显子缺失和 L858R 让突变体对它更敏感，所以对野生型 EGFR 有窗口；T790M 提高了激酶对 ATP 的亲和力，药物失效。',
    h: h(1.1), bottom: bottom(0.12), ic50: IC50.gefitinib,
  },
  osimertinib: {
    id: 'osimertinib', abbr: 'OSI', zh: '奥希替尼', en: 'osimertinib', chembl: 'CHEMBL3353410',
    cls: '第三代突变选择性共价 EGFR 抑制剂',
    approval: approved('CHEMBL3353410', 'OSIMERTINIB', 2015, '先用于 T790M 阳性的耐药患者，后扩展到 EGFR 突变肺癌一线治疗。'),
    mw: mw('CHEMBL3353410', 'OSIMERTINIB', 499.62, '甲磺酸盐'),
    note: '丙烯酰胺弹头与 C797 形成共价键，对 T790M 和敏感突变都有效，对野生型 EGFR 弱得多。C797S 突变让共价键无法形成，药物失效。',
    h: h(1.2), bottom: bottom(0.1), ic50: IC50.osimertinib,
  },
  afatinib: {
    id: 'afatinib', abbr: 'AFA', zh: '阿法替尼', en: 'afatinib', chembl: 'CHEMBL1173655',
    cls: '第二代不可逆泛 ERBB 抑制剂',
    approval: approved('CHEMBL1173655', 'AFATINIB', 2013, '用于 EGFR 敏感突变的晚期非小细胞肺癌一线治疗。'),
    mw: mw('CHEMBL1173655', 'AFATINIB', 485.95, '马来酸盐'),
    note: '共价不可逆，对敏感突变极强。体外抑制 T790M 细胞需要的浓度和抑制野生型 EGFR 细胞差不多，没有窗口：临床上达到这个浓度之前，皮疹和腹泻已让患者无法耐受。',
    h: h(1.1), bottom: bottom(0.08), ic50: IC50.afatinib,
  },
  paclitaxel: {
    id: 'paclitaxel', abbr: 'PTX', zh: '紫杉醇', en: 'paclitaxel', chembl: 'CHEMBL428647',
    cls: '微管稳定剂（细胞毒化疗药）',
    approval: approved('CHEMBL428647', 'PACLITAXEL', 1992, '用于多种实体瘤，包括非小细胞肺癌的含铂联合化疗。'),
    mw: mw('CHEMBL428647', 'PACLITAXEL', 853.92),
    note: '让微管无法解聚，细胞停在有丝分裂期。杀伤所有快速分裂的细胞，与 EGFR 无关：单看 PC-9 的 IC50 很低，但对野生型细胞同样强，没有治疗窗。',
    h: h(1.6), bottom: bottom(0.03), ic50: IC50.paclitaxel,
  },
  cisplatin: {
    id: 'cisplatin', abbr: 'CDDP', zh: '顺铂', en: 'cisplatin', chembl: 'CHEMBL11359',
    cls: '铂类细胞毒化疗药',
    approval: approved('CHEMBL11359', 'CISPLATIN', 1978, '非小细胞肺癌含铂双药化疗的基础药物。'),
    mw: mw('CHEMBL11359', 'CISPLATIN', 300.05),
    note: '与 DNA 交联、阻断复制，对所有分裂细胞都有效，与 EGFR 状态无关。没有可靶向突变的患者，或靶向药耐药后，含铂化疗是标准选择。',
    h: h(1.0), bottom: bottom(0.05), ic50: IC50.cisplatin,
  },
  capmatinib: {
    id: 'capmatinib', abbr: 'CAP', zh: '卡马替尼', en: 'capmatinib', chembl: 'CHEMBL3188267',
    cls: 'MET 激酶抑制剂',
    approval: approved('CHEMBL3188267', 'CAPMATINIB', 2020, '用于 MET 14 外显子跳跃突变的晚期非小细胞肺癌。'),
    mw: mw('CHEMBL3188267', 'CAPMATINIB', 412.43, '盐酸盐'),
    note: '单用只对依赖 MET 的细胞有效。MET 扩增是 EGFR 抑制剂耐药的旁路：MET 替 EGFR 维持下游信号。关掉旁路后，原来失效的 EGFR 抑制剂重新起作用（联合用药）。',
    h: h(1.2), bottom: bottom(0.45), ic50: IC50.capmatinib,
  },
  staurosporine: {
    id: 'staurosporine', abbr: 'STS', zh: '星形孢菌素', en: 'staurosporine', chembl: 'CHEMBL388978',
    cls: '广谱激酶抑制剂（阳性杀伤对照）',
    approval: { text: '未获批，只作科研用工具化合物', status: 'verified', note: 'ChEMBL 未记录任何研发阶段', sources: [chembl('CHEMBL388978', 'STAUROSPORINE')] },
    mw: mw('CHEMBL388978', 'STAUROSPORINE', 466.54),
    note: '几乎抑制所有激酶，低微摩尔浓度就能杀死大多数细胞。用作"药物确实能杀死细胞"的阳性对照，不是候选药。',
    h: h(1.8), bottom: bottom(0.02), ic50: IC50.staurosporine,
  },
};
