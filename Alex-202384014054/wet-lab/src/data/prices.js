// Alex 202384014054
// What the open modes charge, in yuan. Keys match orders.js PRICE. Where a
// Chinese list price was found it is used as is; foreign list prices are
// converted at the exchange rate below. Every price here was read from search
// snippets (the vendor pages could not be opened from this environment), so
// all are estimates with their source linked; items with no
// public price are estimates with their basis written out.

const READ = '2026-11-01';
import { constants } from './constants.js';

const USD = constants['usd-cny'].value;
const src = (title, url) => ({ title, url, accessed: READ });
const price = (value, cond, extra) => ({ value, unit: '元', kind: 'price', cond, ...extra });
const fromUSD = (usd, cond, what, sources) => price(Math.round(usd * USD), cond, { status: 'estimate', basis: `${what}标价 $${usd}，按 1 美元 ≈ ${USD} 元（假设汇率）换算；国内经销价通常更高。标价取自搜索结果摘要`, sources });
const guess = (value, cond, basis) => price(value, cond, { status: 'estimate', basis });

const TF_RPMI = src('Thermo Fisher 中国：RPMI 1640 培养基 11875093（500 mL 目录价 432 元）', 'https://www.thermofisher.cn/order/catalog/product/11875093');
const SNAP = '价格取自搜索引擎对该页面的摘要，查阅时本环境无法直接打开页面核对，故标为估计值';

export const prices = {
  // instrument runs
  'job:extract': guess(60, '每份样本的基因组 DNA 提取（柱式试剂盒，自己做）', '商品化柱式提取试剂盒每次约数十元；未找到可引用的国内公开目录价'),
  'job:pcr': guess(30, '每个 PCR 反应（高保真聚合酶、引物、dNTP，自己做）', '高保真 PCR 预混液每个 50 µL 反应约十几到几十元；未找到可引用的公开目录价'),
  'job:gel': guess(20, '每块琼脂糖凝胶（琼脂糖、核酸染料、DNA 标准品）', '按常用试剂用量估计；未找到可引用的公开目录价'),
  'job:seq': fromUSD(4.95, '每个 Sanger 测序反应，外送测序公司', '芝加哥大学测序平台对外部学术用户', [src('University of Chicago DNA Sequencing Core：收费表（外部学术用户每反应 $4.95）', 'https://voices.uchicago.edu/dnaseq/fees')]),
  'job:clone': guess(1500, '一次嘌呤霉素筛选与单克隆扩增（约 3 周培养基、耗材与药物）', '按三周的完全培养基、96 孔板与嘌呤霉素用量估计；人工不计'),
  // patient
  ct: price(200, '一次胸部 CT 平扫（公立医院）', { status: 'estimate', basis: `各省价格不同；报道称国家医保局规范放射检查立项后，多省 CT 收费从 300 多元降到 200 元左右。${SNAP}`, sources: [src('新华网 2025-05-22：部分省份 CT、磁共振检查费用下调', 'https://www.news.cn/fortune/20250522/d6b495f739ac4859a104431b46c7723b/c.html')] }),
  biopsy: guess(3500, 'CT 引导下经皮肺穿刺活检一次（含穿刺、病理与免疫组化）', '未找到可引用的统一收费标准；穿刺术、病理诊断与免疫组化各地分别计价，合计按数千元估计'),
  // supplies
  'buy:flask': fromUSD(736, '一支细胞系冻存管（从细胞库购买，复苏后成一瓶）', 'ATCC NCI-H1975（CRL-5908）', [src('ATCC CRL-5908 产品页', 'https://www.atcc.org/products/crl-5908')]),
  'buy:medium': price(817, '500 mL RPMI-1640 + 50 mL 胎牛血清 + 5 mL 双抗', { status: 'estimate', basis: `组成：RPMI-1640 500 mL 432 元（Thermo Fisher 中国目录价）+ 胎牛血清 50 mL 约 373 元（Gibco 澳洲血清 500 mL 国内询价约 3700 元，按体积折算）+ 双抗 5 mL 约 12 元（估计）。${SNAP}`, sources: [TF_RPMI] }),
  'buy:pbs': guess(60, 'PBS 100 mL（无菌，无钙镁）', '商品化无菌 PBS 500 mL 约两三百元，按体积折算；未找到可引用的公开目录价'),
  'buy:trypsin': price(277, '0.25% 胰酶-EDTA（含酚红）100 mL，Gibco 25200056', { status: 'estimate', basis: `Thermo Fisher 中国目录价 277 元，促销时更低。${SNAP}`, sources: [src('Thermo Fisher 中国：胰蛋白酶-EDTA (0.25%) 25200056', 'https://thermofisher.cn/order/catalog/product/25200056')] }),
  'buy:cck8': fromUSD(144, 'CCK-8 试剂 5 mL（500 次检测），同仁化学 CK04', '同仁化学（Dojindo）美国官网', [src('Dojindo：Cell Counting Kit-8（CK04）', 'https://dojindo.com/products/CK04/')]),
  'buy:dmso': guess(20, '细胞培养级 DMSO 1.5 mL', '细胞培养级 DMSO 每瓶数百元，按体积折算；未找到可引用的公开目录价'),
  'buy:stock': fromUSD(40, '一种药物的 10 mM DMSO 母液 1 mL（化合物试剂商现货）', 'Adooq 奥希替尼 10 mM × 1 mL（DMSO）', [src('Adooq：Osimertinib (AZD-9291)', 'https://www.adooq.com/azd-9291.html')]),
  'buy:plate': guess(36, '一块 96 孔平底细胞培养板（TC 处理，独立包装）', 'Corning 3599 英国经销价每箱 100 块 386 英镑，每块约 3.9 英镑，按 1 英镑 ≈ 9.3 元换算'),
  'buy:uplate': guess(30, '一块 96 孔 U 底稀释板', '与平底板同类耗材，按略低价格估计'),
  'buy:tube': guess(3, '一支 15 mL 无菌离心管', '国产无菌离心管每支数元；未找到可引用的公开目录价'),
  'buy:ep': guess(1, '一支 1.5 mL 离心管', '每包 500 支约数十到一百多元，按支折算'),
  'buy:tips': guess(60, '一盒 96 支无菌带滤芯枪头', '国产滤芯枪头每盒数十元；未找到可引用的公开目录价'),
  'buy:res': guess(25, '一个无菌四槽加样槽', '按同类耗材估计；未找到可引用的公开目录价'),
  'buy:sero': guess(5, '一支 10 mL 无菌血清移液管（独立包装）', '每箱 200 支约一千元，按支折算'),
  'buy:tb': guess(70, '0.4% 台盼蓝溶液一瓶', '按同类试剂估计；未找到可引用的公开目录价'),
};
