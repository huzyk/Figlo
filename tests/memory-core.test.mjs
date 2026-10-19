import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS, PACKS, packById, packForDate, nextPackId, makeDeck, isPair, formatTime, dateKey} from '../src/memory/core.js';
import {ART} from '../src/memory/symbols.js';

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

test('four packs have exactly eight unique hand-drawn, nameable vector symbols', () => {
  assert.equal(PACKS.length, 4);
  const ids = PACKS.flatMap(pack => pack.symbols);
  assert.equal(new Set(ids).size, 32);
  for (const pack of PACKS) {
    assert.equal(pack.symbols.length, 8);
    assert.equal(new Set(pack.symbols).size, 8);
    assert.ok(pack.name.length > 3);
    for (const id of pack.symbols) {
      assert.ok(ART[id], id + ' is missing');
      assert.ok(ART[id].label && ART[id].color && ART[id].art.includes('<'), id);
      assert.doesNotMatch(ART[id].art, /<script|onload=|<image/i);
    }
    const deck = makeDeck('daily:2026-10-28', pack.symbols);
    assert.equal(deck.length, 16);
    for (const id of pack.symbols) assert.equal(deck.filter(value => value === id).length, 2);
    assert.deepEqual(deck, makeDeck('daily:2026-10-28', pack.symbols));
  }
});

test('packs rotate precisely every three Warsaw calendar dates, cycling after twelve', () => {
  const cases = [
    ['2026-10-19','discoveries'], ['2026-10-20','discoveries'], ['2026-10-21','discoveries'],
    ['2026-10-22','cosmos'], ['2026-10-23','cosmos'], ['2026-10-24','cosmos'],
    ['2026-10-25','mind'], ['2026-10-27','mind'],
    ['2026-10-28','nature'], ['2026-10-30','nature'],
    ['2026-10-31','discoveries'], ['2026-11-02','discoveries'], ['2026-11-03','cosmos']
  ];
  for (const [day, pack] of cases) assert.equal(packForDate(day).id, pack, day);
  assert.equal(packById('missing').id, 'discoveries');
  assert.equal(nextPackId('discoveries'), 'cosmos');
  assert.equal(nextPackId('cosmos'), 'mind');
  assert.equal(nextPackId('mind'), 'nature');
  assert.equal(nextPackId('nature'), 'discoveries');
  assert.throws(() => packForDate('2026-02-30'));
  assert.throws(() => packForDate('not-a-date'));
  assert.throws(() => makeDeck('bad', ['a', 'a']));
});

test('Warsaw calendar day, not UTC midnight, selects the visible pack', () => {
  const before = dateKey(new Date('2026-10-21T21:30:00Z'));
  const after = dateKey(new Date('2026-10-21T22:30:00Z'));
  assert.equal(before, '2026-10-21');
  assert.equal(after, '2026-10-22');
  assert.equal(packForDate(before).id, 'discoveries');
  assert.equal(packForDate(after).id, 'cosmos');
});
