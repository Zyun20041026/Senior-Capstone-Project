// Alex 202384014054
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCurrent } from '../src/ui/analysis.js';

// Review #11: a fit belongs to the plate reads it was made from; a newer read
// makes it stale until you fit again, and a stale fit cannot be submitted.
test('a fit is current only for the reads it was made from', () => {
  const reads = { M: { ver: 'R1' }, W: { ver: 'R2' } };
  assert.equal(fitCurrent({ vers: { M: 'R1', W: 'R2' } }, reads), true);
  assert.equal(fitCurrent({ vers: { M: 'R1', W: 'R2' } }, { M: { ver: 'R3' }, W: { ver: 'R2' } }), false, 'tumour plate re-read');
  assert.equal(fitCurrent({ fits: {} }, reads), false, 'a fit with no recorded versions');
  assert.equal(fitCurrent(null, reads), false, 'no fit');
});
