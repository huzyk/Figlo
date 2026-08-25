import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDuetPuzzle, generateDuetFreeplayPuzzle } from '../src/duet/generator.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

test('same seed produces same Duet puzzle and solution', () => {
  const first = generateDuetPuzzle('duet-test-a');
  const second = generateDuetPuzzle('duet-test-a');
  assert.deepEqual(second.puzzle, first.puzzle);
  assert.deepEqual(second.solution, first.solution);
});

test('different seeds produce different Duet output', () => {
  const first = generateDuetPuzzle('duet-test-a');
  const second = generateDuetPuzzle('duet-test-b');
  assert.notDeepEqual(second.solution, first.solution);
});

test('generated Duet is unique and human solvable', () => {
  const generated = generateDuetPuzzle('duet-test-quality');
  assert.equal(generated.solution.length, 36);
  assert.equal(isSolved(generated.solution, generated.puzzle), true);
  assert.equal(countSolutions(generated.puzzle, 2), 1);
  const human = solveLikeHuman(generated.puzzle);
  assert.equal(human.solved, true);
  assert.ok(human.steps.length > 0);
});

test('freeplay Duet is unique and human solvable without daily minimization', () => {
  const first = generateDuetFreeplayPuzzle('duet-freeplay-quality');
  const second = generateDuetFreeplayPuzzle('duet-freeplay-quality');
  assert.deepEqual(second.puzzle, first.puzzle);
  assert.deepEqual(second.solution, first.solution);
  assert.equal(first.solution.length, 36);
  assert.equal(isSolved(first.solution, first.puzzle), true);
  assert.equal(countSolutions(first.puzzle, 2), 1);
  assert.equal(solveLikeHuman(first.puzzle).solved, true);
});
