import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS, makeDeck, isPair, formatTime, dateKey} from '../src/memory/core.js';

test('daily board is deterministic with exactly eight distinct pairs', () => {
  const a = makeDeck('daily:2026-10-19');
  assert.deepEqual(a, makeDeck('daily:2026-10-19'));
  assert.equal(a.length, 16);
  assert.equal(new Set(a).size, 8);
  for (const symbol of SYMBOLS) assert.equal(a.filter(x => x === symbol).length, 2);
  assert.notDeepEqual(a, makeDeck('daily:2026-10-20'));
});

test('a pair requires two distinct valid indices of the same symbol', () => {
  const deck = makeDeck('daily:2026-10-19');
  const a = 0, b = deck.findIndex((symbol, i) => i > 0 && symbol === deck[0]);
  assert.ok(isPair(deck, a, b));
  assert.equal(isPair(deck, a, a), false);
  assert.equal(isPair(deck, -1, b), false);
  assert.equal(isPair(deck, a, 16), false);
  assert.equal(isPair(deck, a, deck.findIndex(x => x !== deck[0])), false);
});

test('time and Warsaw daily key are stable around midnight', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(63000), '01:03');
  assert.equal(dateKey(new Date('2026-10-19T22:30:00Z')), '2026-10-20');
});
