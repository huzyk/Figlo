import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPuzzleSeed, dayDifference, getWeekDateKeys } from '../src/daily.js';
import { generatePuzzle } from '../src/generator.js';

test('daily seed is stable for the same game and date', () => {
  assert.equal(
    dailyPuzzleSeed('korony', '2026-08-24'),
    'figlo:korony:2026-08-24:v1'
  );
  assert.equal(
    dailyPuzzleSeed('korony', '2026-08-24'),
    dailyPuzzleSeed('korony', '2026-08-24')
  );
});

test('same daily seed generates the same puzzle', () => {
  const seed = dailyPuzzleSeed('korony', '2026-08-24');
  const first = generatePuzzle(seed);
  const second = generatePuzzle(seed);
  assert.deepEqual(first.regions, second.regions);
  assert.deepEqual(first.solution, second.solution);
});

test('different daily dates generate different puzzles', () => {
  const first = generatePuzzle(dailyPuzzleSeed('korony', '2026-08-24'));
  const second = generatePuzzle(dailyPuzzleSeed('korony', '2026-08-25'));
  assert.notDeepEqual(first.regions, second.regions);
});

test('dayDifference handles consecutive and skipped days', () => {
  assert.equal(dayDifference('2026-08-24', '2026-08-25'), 1);
  assert.equal(dayDifference('2026-08-24', '2026-08-26'), 2);
  assert.equal(dayDifference('2026-08-24', '2026-08-24'), 0);
});

test('week keys start on Monday and contain seven dates', () => {
  const keys = getWeekDateKeys(new Date(2026, 7, 24, 12, 0, 0));
  assert.deepEqual(keys, [
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
    '2026-08-30'
  ]);
});
