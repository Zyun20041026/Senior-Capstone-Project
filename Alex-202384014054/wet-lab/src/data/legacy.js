// Alex 202384014054
// Drug codes used by earlier versions of the game, and the save migration
// that renames them. TKI-F (a fictional fourth-generation EGFR inhibitor)
// was retired: no real drug of that kind has public cell data or approval.

export const LEGACY_DRUG_IDS = {
  'TKI-A': 'gefitinib',
  'TKI-B': 'osimertinib',
  'TKI-E': 'afatinib',
  'TKI-C': 'paclitaxel',
  'CHEMO-P': 'cisplatin',
  METi: 'capmatinib',
  STS: 'staurosporine',
  'TKI-F': null,
};

const CODE = Object.keys(LEGACY_DRUG_IDS).sort((a, b) => b.length - a.length).map((k) => k.replace(/-/g, '\\-')).join('|');
const CODE_RE = new RegExp(`(?<![A-Za-z0-9])(?:${CODE})(?![A-Za-z0-9])`, 'g');
const rename = (s) => s.replace(CODE_RE, (m) => LEGACY_DRUG_IDS[m] ?? m);

export function migrateSave(save) {
  if (!save || typeof save !== 'object' || !save.carry) return save;
  const carry = {};
  for (const [k, v] of Object.entries(save.carry)) carry[rename(k)] = v;
  return { ...save, carry };
}
