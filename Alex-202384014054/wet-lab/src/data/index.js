// Alex 202384014054
// The real-world data archive: the one place the game takes names, numbers
// and prices from. Every entry carries its source or the basis of an estimate
// (see schema.js); the game's "资料来源" page lists them all.

import { constants } from './constants.js';
import { cells } from './cells.js';
import { drugs } from './drugs.js';
import { prices } from './prices.js';
import { isRecord } from './schema.js';

export const ARCHIVE = { cells, drugs, prices, constants };

// Every record in the archive with its dotted path, nested ones included
// (a drug's IC50 for one cell line is `drugs.<id>.ic50.<line>`).
export function allRecords() {
  const out = [];
  const walk = (x, path, cat) => {
    if (isRecord(x)) out.push({ cat, path, rec: x });
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'sources') walk(v, `${path}.${k}`, cat);
  };
  for (const [cat, entries] of Object.entries(ARCHIVE)) for (const [id, e] of Object.entries(entries)) walk(e, `${cat}.${id}`, cat);
  return out;
}

// The typical value of a record: val('constants', 'z-water-22c') or
// val('drugs', 'gefitinib', 'ic50.PC-9').
export function val(cat, id, field = null) {
  let r = ARCHIVE[cat]?.[id];
  if (field) for (const k of field.split('.')) r = r?.[k];
  if (!r || !('value' in r)) throw new Error(`no value at ${cat}.${id}${field ? `.${field}` : ''}`);
  return r.value;
}

export const drugName = (id) => ARCHIVE.drugs[id]?.zh ?? id;
export const drugAbbr = (id) => ARCHIVE.drugs[id]?.abbr ?? id;
// A regimen label such as 'gefitinib+capmatinib' in Chinese.
export const regimenName = (label) => (label ? String(label).split('+').map(drugName).join(' + ') : label);
