import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPuzzleSeed } from '../src/daily.js';
import { countRegionSolutions, generatePuzzle } from '../src/generator.js';

function dateKeyFromOffset(offset) {
  const date = new Date(Date.UTC(2026, 7, 24 + offset));
  return date.toISOString().slice(0, 10);
}

test('60 consecutive daily Crown seeds are deterministic and uniquely solvable', () => {
  for (let offset = 0; offset < 60; offset++) {
    const dateKey = dateKeyFromOffset(offset);
    const seed = dailyPuzzleSeed('korony', dateKey);
    const first = generatePuzzle(seed);
    const second = generatePuzzle(seed);

    assert.deepEqual(second.regions, first.regions, `regions differ for ${dateKey}`);
    assert.deepEqual(second.solution, first.solution, `solution differs for ${dateKey}`);

    const solved = countRegionSolutions(first.regions, 2);
    assert.equal(solved.count, 1, `daily puzzle is not unique for ${dateKey}`);
    assert.ok(first.deductionCount > 0, `daily puzzle has no human deductions for ${dateKey}`);
  }
});
