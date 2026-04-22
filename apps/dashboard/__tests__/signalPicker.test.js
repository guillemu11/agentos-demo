import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRandomSignals, MOCK_SIGNALS } from '../src/data/mockSignals.js';

test('pickRandomSignals returns requested count', () => {
  assert.equal(pickRandomSignals(4).length, 4);
});

test('pickRandomSignals caps at catalog size', () => {
  assert.equal(pickRandomSignals(999).length, MOCK_SIGNALS.length);
});

test('pickRandomSignals excludes by type+payload equality', () => {
  const first = MOCK_SIGNALS[0];
  const picks = pickRandomSignals(MOCK_SIGNALS.length, [first]);
  const foundExcluded = picks.some(
    s => s.type === first.type && JSON.stringify(s.payload) === JSON.stringify(first.payload),
  );
  assert.equal(foundExcluded, false);
});

test('pickRandomSignals ignores null/undefined in exclude', () => {
  const picks = pickRandomSignals(4, [null, undefined]);
  assert.equal(picks.length, 4);
});
