// Alex 202384014054
// Physical constants and standards the lab's procedures use.

const READ = '2026-11-01';

export const constants = {
  'z-water-22c': {
    id: 'z-water-22c', zh: '水的 Z 因子（22 °C）', en: 'Z factor of water at 22 °C',
    value: 1.0033, unit: 'µL/mg', kind: 'spec', status: 'verified',
    cond: '22 °C、101.3 kPa，蒸馏水；称量法校准移液枪时把质量换算成体积，已含空气浮力修正',
    sources: [
      { title: 'Integra Biosciences：Z-factor 表（按温度与气压）', url: 'https://www.integra-biosciences.com/sites/default/files/Z-factors-calibration_2017_01_26.pdf', accessed: READ },
      { title: 'Ifremer：Z 值表（22 °C 为 1.00328 mL/g）', url: 'https://prelevements-hydro.ifremer.fr/media/Z.pdf', accessed: READ },
    ],
  },
  'usd-cny': {
    id: 'usd-cny', zh: '美元兑人民币汇率', en: 'USD to CNY exchange rate',
    value: 7.1, unit: '元/美元', kind: 'model', status: 'estimate',
    basis: '把国外目录价换算成人民币用的固定假设，取近年汇率的大致水平；实际汇率随时变动',
  },
  'iso8655-200ul-sys': {
    id: 'iso8655-200ul-sys', zh: 'ISO 8655 对 200 µL 移液器的系统误差上限', en: 'ISO 8655 maximum permissible systematic error, 200 µL pipette',
    value: 1.6, unit: 'µL', kind: 'spec', status: 'estimate',
    cond: '标称 200 µL 的单道移液器；上限是绝对体积，不随设定体积变小，所以设定 100 µL 时相当于 ±1.6%',
    basis: '取自 Thermo Fisher 应用说明里的 ISO 8655 对照表（200 µL 档：系统误差 ±1.60 µL，随机误差 0.60 µL）。数值应出自 ISO 8655-2:2002，2022 版待核实；本环境无法直接打开该文件，按搜索结果摘要记录，故标为估计值',
    sources: [{ title: 'Thermo Fisher 应用说明 D20949：Finnpipette 规格与 ISO 8655 限值对照', url: 'https://assets.thermofisher.com/TFS-Assets/LSG/Application-Notes/D20949.pdf', accessed: READ }],
  },
  'lab-p200-sys': {
    id: 'lab-p200-sys', zh: '本实验室 P200 在 100 µL 的系统误差内控标准', en: 'In-house limit, P200 systematic error at 100 µL',
    value: 0.8, unit: '%', kind: 'model', status: 'estimate',
    basis: '本实验室的内控标准，严于 ISO 8655（ISO 在 100 µL 时约相当于 ±1.6%）；许多实验室按厂家出厂规格设更严的内控线',
  },
  'contam-risk-scale': {
    id: 'contam-risk-scale', zh: '无菌失误转为污染的比例系数', en: 'Contamination risk scale per sterility slip',
    value: 0.4, unit: '无量纲', kind: 'model', status: 'estimate',
    basis: '没有公开的单次无菌失误致污染概率数据；取原主线的数值，使一次轻微失误（如物品没消毒就放进安全柜）导致污染的概率约 13%。三档难度共用',
  },
  'robot-cv-50ul': {
    id: 'robot-cv-50ul', zh: '自动移液工作站 50–100 µL 分液变异系数', en: 'Liquid handler CV at 50–100 µL',
    value: 1, unit: '%', kind: 'spec', status: 'estimate',
    basis: '主流 8 通道自动移液工作站在 50–100 µL 的精密度规格通常写作 CV ≤ 1%（水溶液、带滤芯枪头）；未逐家核对厂商规格书，取规格上限',
  },
};
