import test from 'node:test';
import assert from 'node:assert/strict';
import { countRegionSolutions, generatePuzzle, validateGeneratedRegions } from '../src/generator.js';

test('ten sam seed daje identyczną planszę', () => {
  const a = generatePuzzle('daily-2026-08-20');
  const b = generatePuzzle('daily-2026-08-20');
  assert.deepEqual(a.regions, b.regions);
  assert.deepEqual(a.solution, b.solution);
});

test('generator tworzy 9 spójnych regionów i dokładnie jedno rozwiązanie', () => {
  const puzzle = generatePuzzle('practice-test-1');
  assert.equal(puzzle.size, 9);
  assert.equal(validateGeneratedRegions(puzzle.regions), true);
  assert.equal(countRegionSolutions(puzzle.regions, 2).count, 1);
});

test('różne seedy dają różne plansze', () => {
  const a = generatePuzzle('practice-a');
  const b = generatePuzzle('practice-b');
  assert.notDeepEqual(a.regions, b.regions);
});

for (let i = 0; i < 20; i++) {
  test(`plansza testowa ${i + 1} jest poprawna i unikalna`, () => {
    const puzzle = generatePuzzle(`batch-${i}`);
    assert.equal(validateGeneratedRegions(puzzle.regions), true);
    assert.equal(countRegionSolutions(puzzle.regions, 2).count, 1);
  });
}
