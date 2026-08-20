import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle } from '../src/generator.js';
import { solveByHumanDeductions } from '../src/human-solver.js';

test('generator przepuszcza tylko planszę rozwiązywalną przez ten sam silnik podpowiedzi', () => {
  const puzzle = generatePuzzle('human-gate-regression');
  const result = solveByHumanDeductions(puzzle.regions);
  assert.equal(result.status, 'solved');
  assert.equal(puzzle.deductionCount, result.deductions.length);
  assert.deepEqual(puzzle.deductionRules, result.deductions.map(step => step.rule));
});
