// Alex 202384014054
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_DRUG_IDS, migrateSave } from '../src/data/legacy.js';
import { ARCHIVE } from '../src/data/index.js';

test('every legacy code maps to a drug in the archive, or is retired', () => {
  for (const [old, id] of Object.entries(LEGACY_DRUG_IDS)) assert.ok(id === null || ARCHIVE.drugs[id], `${old} → ${id}`);
  assert.equal(LEGACY_DRUG_IDS['TKI-B'], 'osimertinib');
});

test('migrateSave renames legacy codes in carry keys', () => {
  assert.deepEqual(migrateSave({ v: 1, carry: { 'si_TKI-B': 120 } }).carry, { si_osimertinib: 120 });
  assert.deepEqual(migrateSave({ v: 1, carry: { 'TKI-A_hit': 1, CHEMO_x: 2 } }).carry, { gefitinib_hit: 1, CHEMO_x: 2 });
});

test('migrateSave keeps unknown keys and tolerates empty saves', () => {
  assert.deepEqual(migrateSave({ v: 1, carry: { foo: 1 } }).carry, { foo: 1 });
  assert.deepEqual(migrateSave({}), {});
  assert.equal(migrateSave(null), null);
});
