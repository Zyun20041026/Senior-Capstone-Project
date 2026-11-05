// Alex 202384014054
// 自动生成，勿手改：python3 tools/chembl/gen.py（数据快照 tools/chembl/built.json，取自 ChEMBL REST API，2026-11-01）。
// 每种药物在每个细胞系上的 72 小时细胞活力 IC50（µM）及其出处或估计依据。

export const IC50 = {
 "gefitinib": {
  "PC-9": {
   "value": 0.02,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "16 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Nat Commun 2017：Brigatinib combined with anti-EGFR antibody overcomes osimertinib resistance in EGFR-mutat",
     "url": "https://doi.org/10.1038/ncomms14768",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2024：Design and activity evaluation of new EGFR tyrosine kinase inhibitors containing cyclic po",
     "url": "https://doi.org/10.1016/j.bmcl.2024.129961",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2011：Discovery of selective irreversible inhibitors for EGFR-T790M.",
     "url": "https://doi.org/10.1016/j.bmcl.2010.12.036",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL614102&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.01579,
    0.1908
   ]
  },
  "H1975": {
   "value": 10.05,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "38 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 2010：Novel irreversible epidermal growth factor receptor inhibitors by chemical modulation of t",
     "url": "https://doi.org/10.1021/jm901558p",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2012：Design, synthesis, and biological evaluation of novel conformationally constrained inhibit",
     "url": "https://doi.org/10.1021/jm201591k",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2012：Structural optimization and structure-activity relationships of N2-(4-(4-Methylpiperazin-1",
     "url": "https://doi.org/10.1021/jm301365e",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL614348&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    8.34,
    13.02
   ]
  },
  "PC-9-T790M": {
   "value": 10.05,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "PC-9 敲入 T790M 后对 EGFR 抑制剂的敏感性按同样带 T790M 的 NCI-H1975 估计"
  },
  "A431": {
   "value": 3.304,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "38 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Eur J Med Chem 2021：Investigation of 3-sulfamoyl coumarins against cancer-related IX and XII isoforms of human",
     "url": "https://doi.org/10.1016/j.ejmech.2021.113589",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2020：Novel quinazoline-based EGFR kinase inhibitors: A review focussing on SAR and molecular do",
     "url": "https://doi.org/10.1016/j.ejmech.2020.112640",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2009：Synthesis and in vitro antitumor activities of novel 4-anilinoquinazoline derivatives.",
     "url": "https://doi.org/10.1016/j.ejmech.2008.07.023",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    1.755,
    4.556
   ]
  },
  "HCC827": {
   "value": 0.008,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "24 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Cancer Res 2007：PF00299804, an irreversible pan-ERBB inhibitor, is effective in lung cancer models with EG",
     "url": "https://doi.org/10.1158/0008-5472.can-07-1885",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2017：Novel conjugates of endoperoxide and 4-anilinoquinazoline as potential anticancer agents.",
     "url": "https://doi.org/10.1016/j.bmcl.2017.02.023",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2017：C-2 (E)-4-(Styryl)aniline substituted diphenylpyrimidine derivatives (Sty-DPPYs) as specif",
     "url": "https://doi.org/10.1016/j.bmc.2017.03.032",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL4296422&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.00475,
    0.02782
   ]
  },
  "H3255": {
   "value": 0.04,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "7 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Cancer Res 2007：PF00299804, an irreversible pan-ERBB inhibitor, is effective in lung cancer models with EG",
     "url": "https://doi.org/10.1158/0008-5472.can-07-1885",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2022：Ynamide Electrophile for the Profiling of Ligandable Carboxyl Residues in Live Cells and t",
     "url": "https://doi.org/10.1021/acs.jmedchem.2c00272",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2022：Recent advances in the development of EGFR degraders: PROTACs and LYTACs.",
     "url": "https://doi.org/10.1016/j.ejmech.2022.114533",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL4296476&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.0165,
    0.073
   ]
  },
  "A549": {
   "value": 10.07,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "68 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Eur J Med Chem 2020：Novel quinazoline-based EGFR kinase inhibitors: A review focussing on SAR and molecular do",
     "url": "https://doi.org/10.1016/j.ejmech.2020.112640",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2009：2,3-Disubstituted 8-arylamino-3H-imidazo[4,5-g]quinazolines: a novel class of antitumor ag",
     "url": "https://doi.org/10.1016/j.ejmech.2008.01.009",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2009：5-Benzylidene-hydantoins: synthesis and antiproliferative activity on A549 lung cancer cel",
     "url": "https://doi.org/10.1016/j.ejmech.2009.01.035",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL939&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    5.44,
    15.0
   ]
  },
  "BEAS-2B": {
   "value": 2,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "HCC827-GR": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "Engelman 等 2007 报道 HCC827 GR 对吉非替尼耐药（>1 µM）；具体数值缺乏公开数据，沿用原设定"
  },
  "PC-9-T790M-C797S": {
   "value": 8,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "顺式 T790M/C797S 对一、三代 EGFR 抑制剂均耐药；缺乏该细胞的公开数据，沿用原设定"
  },
  "PC-9-EGFR-KO": {
   "value": 12,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "EGFR 敲除后细胞不再依赖 EGFR，EGFR 抑制剂只剩脱靶毒性；缺乏公开数据，沿用原设定"
  }
 },
 "osimertinib": {
  "PC-9": {
   "value": 0.019,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "22 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Nat Commun 2017：Brigatinib combined with anti-EGFR antibody overcomes osimertinib resistance in EGFR-mutat",
     "url": "https://doi.org/10.1038/ncomms14768",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2023：Discovery of Novel Fourth-Generation EGFR Inhibitors to Overcome C797S-Mediated Resistance",
     "url": "https://doi.org/10.1021/acs.jmedchem.3c01165",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2024：Exploring the structural activity relationship of the Osimertinib: A covalent inhibitor of",
     "url": "https://doi.org/10.1016/j.bmc.2024.117796",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL614102&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.00655,
    0.724
   ]
  },
  "H1975": {
   "value": 0.0473,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "71 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 2022：Discovery of Isoform-Selective Akt3 Degraders Overcoming Osimertinib-Induced Resistance in",
     "url": "https://doi.org/10.1021/acs.jmedchem.2c01246",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2024：Exploring the structural activity relationship of the Osimertinib: A covalent inhibitor of",
     "url": "https://doi.org/10.1016/j.bmc.2024.117796",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2018：Design, synthesis and evaluation of the osimertinib analogue (C-005) as potent EGFR inhibi",
     "url": "https://doi.org/10.1016/j.bmc.2018.10.018",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL614348&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.019,
    0.1
   ]
  },
  "PC-9-T790M": {
   "value": 0.0473,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "PC-9 敲入 T790M 后对 EGFR 抑制剂的敏感性按同样带 T790M 的 NCI-H1975 估计"
  },
  "A431": {
   "value": 0.84,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "40 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Bioorg Med Chem 2018：Design, synthesis and evaluation of the osimertinib analogue (C-005) as potent EGFR inhibi",
     "url": "https://doi.org/10.1016/j.bmc.2018.10.018",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2022：Insight into Targeting Exon20 Insertion Mutations of the Epidermal Growth Factor Receptor",
     "url": "https://doi.org/10.1021/acs.jmedchem.1c02080",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2016：Discovery of 5-(methylthio)pyrimidine derivatives as L858R/T790M mutant selective epiderma",
     "url": "https://doi.org/10.1016/j.bmc.2016.04.032",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.6181,
    1.302
   ]
  },
  "HCC827": {
   "value": 0.009,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "22 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Bioorg Med Chem 2023：Discovery of novel hypoxia-activated, nitroimidazole constructed multi-target kinase inhib",
     "url": "https://doi.org/10.1016/j.bmc.2023.117384",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2017：Design, synthesis, SAR discussion, in vitro and in vivo evaluation of novel selective EGFR",
     "url": "https://doi.org/10.1016/j.ejmech.2017.04.036",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2018：Synthesis and biological evaluation of irreversible EGFR tyrosine kinase inhibitors contai",
     "url": "https://doi.org/10.1016/j.bmc.2018.05.039",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL4296422&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.003,
    0.03173
   ]
  },
  "H3255": {
   "value": 0.02,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "A549": {
   "value": 0.865,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "32 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Eur J Med Chem 2023：Design, synthesis, and biological evaluation of novel quinoline derivatives as small molec",
     "url": "https://doi.org/10.1016/j.ejmech.2022.114889",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2017：Structure-Guided Development of Covalent and Mutant-Selective Pyrazolopyrimidines to Targe",
     "url": "https://doi.org/10.1021/acs.jmedchem.7b00515",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2018：Synthesis and biological evaluation of irreversible EGFR tyrosine kinase inhibitors contai",
     "url": "https://doi.org/10.1016/j.bmc.2018.05.039",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.53,
    1.84
   ]
  },
  "BEAS-2B": {
   "value": 17.48,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 2 条报道（14.9, 20.06 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Bioorg Med Chem 2017：Synthesis and evaluation of osimertinib derivatives as potent EGFR inhibitors.",
     "url": "https://doi.org/10.1016/j.bmc.2017.06.004",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2024：Design and activity evaluation of new EGFR tyrosine kinase inhibitors containing cyclic po",
     "url": "https://doi.org/10.1016/j.bmcl.2024.129961",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL3353410&target_chembl_id=CHEMBL4296403&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "HCC827-GR": {
   "value": 3,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "Engelman 等 2007 报道 HCC827 GR 对吉非替尼耐药（>1 µM）；具体数值缺乏公开数据，沿用原设定"
  },
  "PC-9-T790M-C797S": {
   "value": 4,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "顺式 T790M/C797S 对一、三代 EGFR 抑制剂均耐药；缺乏该细胞的公开数据，沿用原设定"
  },
  "PC-9-EGFR-KO": {
   "value": 8,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "EGFR 敲除后细胞不再依赖 EGFR，EGFR 抑制剂只剩脱靶毒性；缺乏公开数据，沿用原设定"
  }
 },
 "afatinib": {
  "PC-9": {
   "value": 0.002819,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "8 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Nat Commun 2017：Brigatinib combined with anti-EGFR antibody overcomes osimertinib resistance in EGFR-mutat",
     "url": "https://doi.org/10.1038/ncomms14768",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2019：Click chemistry for improvement in selectivity of quinazoline-based kinase inhibitors for",
     "url": "https://doi.org/10.1016/j.bmcl.2018.12.020",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2021：Design, synthesis and biological evaluation of novel 2,4-diaryl pyrimidine derivatives as",
     "url": "https://doi.org/10.1016/j.ejmech.2020.113019",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL1173655&target_chembl_id=CHEMBL614102&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.0003525,
    0.3165
   ]
  },
  "H1975": {
   "value": 0.6086,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "18 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2013：Design, synthesis and biological evaluation of novel 4-anilinoquinazolines with C-6 urea-l",
     "url": "https://doi.org/10.1016/j.bmc.2013.09.049",
     "accessed": "2026-11-01"
    },
    {
     "title": "ACS Med Chem Lett 2014：Discovery and Biological Evaluation of Novel Dual EGFR/c-Met Inhibitors.",
     "url": "https://doi.org/10.1021/ml4003309",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL1173655&target_chembl_id=CHEMBL614348&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.1353,
    0.9
   ]
  },
  "PC-9-T790M": {
   "value": 0.6086,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "PC-9 敲入 T790M 后对 EGFR 抑制剂的敏感性按同样带 T790M 的 NCI-H1975 估计"
  },
  "A431": {
   "value": 0.4823,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "9 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 2022：Insight into Targeting Exon20 Insertion Mutations of the Epidermal Growth Factor Receptor",
     "url": "https://doi.org/10.1021/acs.jmedchem.1c02080",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2013：Design, synthesis and biological evaluation of novel 4-anilinoquinazolines with C-6 urea-l",
     "url": "https://doi.org/10.1016/j.bmc.2013.09.049",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL1173655&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.02,
    0.594
   ]
  },
  "HCC827": {
   "value": 0.0003338,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 2 条报道（0.00023, 0.0004376 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Bioorg Med Chem Lett 2019：Discovery of new quinazoline derivatives as irreversible dual EGFR/HER2 inhibitors and the",
     "url": "https://doi.org/10.1016/j.bmcl.2018.12.056",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2024：Discovery of Novel 5,6-Dihydro-4<i>H</i>-pyrido[2,3,4-<i>de</i>]quinazoline Irreversible I",
     "url": "https://doi.org/10.1021/acs.jmedchem.3c02302",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL1173655&target_chembl_id=CHEMBL4296422&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "H3255": {
   "value": 0.003,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "A549": {
   "value": 1.49,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "15 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Eur J Med Chem 2020：Novel quinazoline-based EGFR kinase inhibitors: A review focussing on SAR and molecular do",
     "url": "https://doi.org/10.1016/j.ejmech.2020.112640",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "ACS Med Chem Lett 2014：Discovery and Biological Evaluation of Novel Dual EGFR/c-Met Inhibitors.",
     "url": "https://doi.org/10.1021/ml4003309",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL1173655&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    1.22,
    5.2
   ]
  },
  "BEAS-2B": {
   "value": 0.2,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "HCC827-GR": {
   "value": 1.5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "Engelman 等 2007 报道 HCC827 GR 对吉非替尼耐药（>1 µM）；具体数值缺乏公开数据，沿用原设定"
  },
  "PC-9-T790M-C797S": {
   "value": 0.3,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "顺式 T790M/C797S 对一、三代 EGFR 抑制剂均耐药；缺乏该细胞的公开数据，沿用原设定"
  },
  "PC-9-EGFR-KO": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "EGFR 敲除后细胞不再依赖 EGFR，EGFR 抑制剂只剩脱靶毒性；缺乏公开数据，沿用原设定"
  }
 },
 "paclitaxel": {
  "PC-9": {
   "value": 0.01,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 两条报道相差上千倍（0.0027 与 3.7 µM）；按紫杉醇在 A549 上 214 条报道的中位数（0.01 µM）的量级估计",
   "sources": [
    {
     "title": "J Med Chem 2002：Tumor-specific novel taxoid-monoclonal antibody conjugates.",
     "url": "https://doi.org/10.1021/jm025540g",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2012：Synthesis and cytotoxic activity evaluation of dihydrocucurbitacin B and cucurbitacin B de",
     "url": "https://doi.org/10.1016/j.bmc.2012.03.001",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2018：Antiproliferative Alkaloids from Alangium longiflorum, an Endangered Tropical Plant Specie",
     "url": "https://doi.org/10.1021/acs.jnatprod.8b00411",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "H1975": {
   "value": 0.028,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "7 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Bioorg Med Chem Lett 2015：Five new phorbol esters with cytotoxic and selective anti-inflammatory activities from Cro",
     "url": "https://doi.org/10.1016/j.bmcl.2015.03.017",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2015：New Indole Tubulin Assembly Inhibitors Cause Stable Arrest of Mitotic Progression, Enhance",
     "url": "https://doi.org/10.1021/acs.jmedchem.5b00310",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2015：Dicarabrol, a new dimeric sesquiterpene from Carpesium abrotanoides L.",
     "url": "https://doi.org/10.1016/j.bmcl.2015.08.034",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL614348&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.006735,
    3.35
   ]
  },
  "PC-9-T790M": {
   "value": 0.01,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  },
  "A431": {
   "value": 0.004678,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "6 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "Bioorg Med Chem Lett 2008：A micellar prodrug of paclitaxel conjugated to cyclotriphosphazene.",
     "url": "https://doi.org/10.1016/j.bmcl.2008.10.077",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Med Chem 2011：Synthesis and biological evaluation of 2,4,5-substituted pyrimidines as a new class of tub",
     "url": "https://doi.org/10.1021/jm101388d",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 2014：Biological evaluation of new antitumor taxoids: alteration of substitution at the C-7 and",
     "url": "https://doi.org/10.1016/j.bmcl.2013.12.083",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.002089,
    0.00865
   ]
  },
  "HCC827": {
   "value": 0.001254,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 1 条报道（0.001254 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Eur J Med Chem 2024：Discovery and mechanistic insights into thieno[3,2-d]pyrimidine and heterocyclic fused pyr",
     "url": "https://doi.org/10.1016/j.ejmech.2024.116649",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL4296422&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "H3255": {
   "value": 0.01,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "A549": {
   "value": 0.01,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "214 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 2002：Tumor-specific novel taxoid-monoclonal antibody conjugates.",
     "url": "https://doi.org/10.1021/jm025540g",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2012：Synthesis and cytotoxic activity evaluation of dihydrocucurbitacin B and cucurbitacin B de",
     "url": "https://doi.org/10.1016/j.bmc.2012.03.001",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2018：Antiproliferative Alkaloids from Alangium longiflorum, an Endangered Tropical Plant Specie",
     "url": "https://doi.org/10.1021/acs.jnatprod.8b00411",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.004625,
    0.1
   ]
  },
  "BEAS-2B": {
   "value": 0.0075,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 2 条报道（0.007, 0.008 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Bioorg Med Chem 2018：Butenolides from a marine-derived fungus Aspergillus terreus with antitumor activities aga",
     "url": "https://doi.org/10.1016/j.bmc.2018.10.040",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem 2021：Synthesis of small molecules targeting paclitaxel-induced MyD88 expression in triple-negat",
     "url": "https://doi.org/10.1016/j.bmc.2021.116442",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL428647&target_chembl_id=CHEMBL4296403&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "HCC827-GR": {
   "value": 0.001254,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 HCC827 的数值估计（亲本数据：估计值）"
  },
  "PC-9-T790M-C797S": {
   "value": 0.01,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  },
  "PC-9-EGFR-KO": {
   "value": 0.01,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  }
 },
 "cisplatin": {
  "PC-9": {
   "value": 3.2,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "4 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 1997：Preparation, DNA binding, and in vitro cytotoxicity of a pair of enantiomeric platinum(II)",
     "url": "https://doi.org/10.1021/jm9607966",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 1996：Synthesis and in vitro cytotoxicity of cis-(glycolato-O,O)-[2-substituted-(4R,5R)-4,5-bis(",
     "url": "https://doi.org/10.1016/0960-894X(96)00126-6",
     "accessed": "2026-11-01"
    },
    {
     "title": "Bioorg Med Chem Lett 1994：Synthesis and in vitro cytotoxicity of 1,3-dioxolane-2-(2-ethanamine)-2-methanamine platin",
     "url": "https://doi.org/10.1016/S0960-894X(01)80262-6",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL11359&target_chembl_id=CHEMBL614102&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    1.3,
    5.0
   ]
  },
  "H1975": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 仅 1 条报道（GDSC 高通量筛选，408.9 µM），比顺铂在其他细胞系的文献值（3–19 µM）高两个数量级，疑为超出测试浓度的曲线外推值；暂沿用原设定",
   "sources": [
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL11359&target_chembl_id=CHEMBL614348&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "PC-9-T790M": {
   "value": 3.2,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：已核实）"
  },
  "A431": {
   "value": 12,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 仅 1 条报道（GDSC 高通量筛选，571.9 µM），比顺铂在其他细胞系的文献值（3–19 µM）高两个数量级，疑为超出测试浓度的曲线外推值；暂沿用原设定",
   "sources": [
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL11359&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "HCC827": {
   "value": 4,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "H3255": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "A549": {
   "value": 11.02,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 2 条报道（3.2, 18.83 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Bioorg Med Chem Lett 1996：Synthesis and in vitro cytotoxicity of cis-dichloro[(2S,3R,4S)-2-aminomethyl-3,4-(O-isopro",
     "url": "https://doi.org/10.1016/0960-894X(96)00088-1",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL ：Genomics of Drug Sensitity in Cancer screening data, Wellcome Trust Sanger Institute",
     "url": "https://doi.org/10.6019/CHEMBL1201861",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL11359&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "BEAS-2B": {
   "value": 3,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录该组合的细胞活力数据；沿用原设定"
  },
  "HCC827-GR": {
   "value": 4,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 HCC827 的数值估计（亲本数据：估计值）"
  },
  "PC-9-T790M-C797S": {
   "value": 3.2,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：已核实）"
  },
  "PC-9-EGFR-KO": {
   "value": 3.2,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：已核实）"
  }
 },
 "capmatinib": {
  "PC-9": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "H1975": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "PC-9-T790M": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "A431": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "HCC827": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "H3255": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "A549": {
   "value": 7,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "BEAS-2B": {
   "value": 5,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "HCC827-GR": {
   "value": 0.3,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "PC-9-T790M-C797S": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  },
  "PC-9-EGFR-KO": {
   "value": 6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 未收录卡马替尼在该细胞系上的活力数据；沿用原设定（体现\"MET 抑制剂只对依赖 MET 的细胞有效\"）"
  }
 },
 "staurosporine": {
  "PC-9": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 只有 A549 有充足报道（11 条，中位 0.6 µM）；其余细胞系按此量级估计",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "H1975": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 只有 A549 有充足报道（11 条，中位 0.6 µM）；其余细胞系按此量级估计",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "PC-9-T790M": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  },
  "A431": {
   "value": 0.07,
   "unit": "µM",
   "kind": "literature",
   "status": "estimate",
   "basis": "ChEMBL 仅 1 条报道（0.07 µM），数据不足，暂按报道值",
   "sources": [
    {
     "title": "Bioorg Med Chem 2012：Synthesis, biological evaluation and molecular docking studies of novel 2-(1,3,4-oxadiazol",
     "url": "https://doi.org/10.1016/j.bmc.2012.03.061",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL614069&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "HCC827": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 只有 A549 有充足报道（11 条，中位 0.6 µM）；其余细胞系按此量级估计",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "H3255": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 只有 A549 有充足报道（11 条，中位 0.6 µM）；其余细胞系按此量级估计",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "A549": {
   "value": 0.6,
   "unit": "µM",
   "kind": "literature",
   "status": "verified",
   "cond": "细胞活力 IC50（多数为 72 小时；MTT、MTS、CCK-8、CellTiter-Glo 等方法），ChEMBL 汇总的文献数据",
   "note": "11 条报道，取中位数；范围为四分位距",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ],
   "range": [
    0.02,
    8.285
   ]
  },
  "BEAS-2B": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "ChEMBL 只有 A549 有充足报道（11 条，中位 0.6 µM）；其余细胞系按此量级估计",
   "sources": [
    {
     "title": "J Med Chem 2020：\"A Sweet Combination\": Developing Saccharin and Acesulfame K Structures for Selectively Ta",
     "url": "https://doi.org/10.1021/acs.jmedchem.9b01669",
     "accessed": "2026-11-01"
    },
    {
     "title": "J Nat Prod 2008：Cytotoxic staurosporines from the marine ascidian Cystodytes solitus.",
     "url": "https://doi.org/10.1021/np700748h",
     "accessed": "2026-11-01"
    },
    {
     "title": "Eur J Med Chem 2014：The chemical and biological potential of C ring modified triterpenoids.",
     "url": "https://doi.org/10.1016/j.ejmech.2013.11.025",
     "accessed": "2026-11-01"
    },
    {
     "title": "ChEMBL 活性数据查询（本组合全部记录）",
     "url": "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=CHEMBL388978&target_chembl_id=CHEMBL392&standard_units=nM",
     "accessed": "2026-11-01"
    }
   ]
  },
  "HCC827-GR": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 HCC827 的数值估计（亲本数据：估计值）"
  },
  "PC-9-T790M-C797S": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  },
  "PC-9-EGFR-KO": {
   "value": 0.6,
   "unit": "µM",
   "kind": "model",
   "status": "estimate",
   "basis": "与 EGFR 无关的药物，按亲本 PC-9 的数值估计（亲本数据：估计值）"
  }
 }
};
