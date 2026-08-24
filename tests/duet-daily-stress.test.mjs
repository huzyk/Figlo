import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { dailyPuzzleSeed } from '../src/daily.js';
import { generateDuetPuzzle } from '../src/duet/generator.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

function dateKeyFromOffset(offset) {
  const date = new Date(Date.UTC(2026, 7, 24 + offset));
  return date.toISOString().slice(0, 10);
}

test('100 consecutive Duet daily seeds are deterministic, unique and human-solvable', () => {
  const timings = [];
  for (let offset = 0; offset < 100; offset++) {
    const dateKey = dateKeyFromOffset(offset);
    const seed = dailyPuzzleSeed('duet', dateKey);

    const started = performance.now();
    const first = generateDuetPuzzle(seed);
    timings.push(performance.now() - started);
    const second = generateDuetPuzzle(seed);

    assert.deepEqual(second.puzzle, first.puzzle, `puzzle differs for ${dateKey}`);
    assert.deepEqual(second.solution, first.solution, `solution differs for ${dateKey}`);
    assert.equal(countSolutions(first.puzzle, 2), 1, `puzzle is not unique for ${dateKey}`);
    assert.equal(isSolved(first.solution, first.puzzle), true, `solution invalid for ${dateKey}`);

    const human = solveLikeHuman(first.puzzle);
    assert.equal(human.solved, true, `human solver failed for ${dateKey}`);
    assert.ok(!human.steps.some(step => step.rule === 'guess' || step.rule === 'lookahead'), `guessing used for ${dateKey}`);
  }

  const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  const max = Math.max(...timings);
  console.log(`Duet generator timings: avg=${average.toFixed(1)}ms max=${max.toFixed(1)}ms`);
  assert.ok(max < 5000, `Duet generator has an extreme slow seed: ${max.toFixed(1)}ms`);
});
