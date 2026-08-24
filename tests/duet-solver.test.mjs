import test from 'node:test';
import assert from 'node:assert/strict';
import { A, B, EMPTY, REL_SAME } from '../src/duet/constants.js';
import { countSolutions, solveOne } from '../src/duet/solver.js';
import { getNextHumanStep, solveLikeHuman } from '../src/duet/human-solver.js';

const solution = [
  A,A,B,A,B,B,
  A,B,A,B,A,B,
  B,A,A,B,B,A,
  A,B,B,A,B,A,
  B,A,B,B,A,A,
  B,B,A,A,A,B
];

const fullPuzzle = {
  size: 6,
  givens: solution.map((value, index) => ({ index, value })),
  relations: []
};

test('solver returns unique fully given solution', () => {
  assert.equal(countSolutions(fullPuzzle, 2), 1);
  assert.deepEqual(solveOne(fullPuzzle), solution);
});

test('solver detects contradictory givens', () => {
  const puzzle = { size:6, givens:[{index:0,value:A},{index:1,value:A},{index:2,value:A},{index:3,value:A}], relations:[] };
  assert.equal(countSolutions(puzzle, 2), 0);
});

test('human solver detects sandwich', () => {
  const board = Array(36).fill(EMPTY);
  board[0] = A; board[2] = A;
  const step = getNextHumanStep({ size:6, givens:[], relations:[] }, board);
  assert.equal(step.index, 1);
  assert.equal(step.value, B);
  assert.equal(step.rule, 'sandwich');
});

test('human solver propagates equality relation', () => {
  const board = Array(36).fill(EMPTY);
  board[0] = A;
  const step = getNextHumanStep({ size:6, givens:[], relations:[{a:0,b:1,type:REL_SAME}] }, board);
  assert.equal(step.index, 1);
  assert.equal(step.value, A);
});

test('human solver accepts already solved puzzle', () => {
  const result = solveLikeHuman(fullPuzzle);
  assert.equal(result.solved, true);
});
