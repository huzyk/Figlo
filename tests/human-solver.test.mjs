import test from 'node:test';
import assert from 'node:assert/strict';
import { nextHumanDeduction, solveByHumanDeductions } from '../src/human-solver.js';

const referencePuzzle = [
  [1,5,5,5,5,5],
  [1,1,5,5,5,5],
  [4,4,4,5,2,5],
  [5,5,5,5,2,3],
  [5,5,0,5,2,3],
  [5,0,0,3,3,3]
];

const referenceSolution = [0,9,13,22,26,35].sort((a,b)=>a-b);

test('pierwsza podpowiedź jest wyjaśnialną eliminacją, nie arbitralnym wynikiem solvera', () => {
  const hint = nextHumanDeduction(referencePuzzle);
  assert.ok(hint);
  assert.equal(hint.action, 'cross');
  assert.equal(hint.rule, 'region-subset');
  assert.deepEqual(hint.cells, [15,16,17]);
  assert.match(hint.reason, /wierszu 3/);
});

test('deduction solver rozwiązuje referencyjną planszę bez backtrackingu', () => {
  const result = solveByHumanDeductions(referencePuzzle);
  assert.equal(result.status, 'solved');
  assert.deepEqual([...result.state.crowns].sort((a,b)=>a-b), referenceSolution);
  assert.ok(result.deductions.length >= 8);
  assert.equal(result.deductions.some(step => step.rule.includes('lookahead')), false);
});

test('podpowiedź respektuje oznaczenia gracza', () => {
  const first = nextHumanDeduction(referencePuzzle);
  const state = {crossed:new Set(first.cells), crowns:new Set()};
  const second = nextHumanDeduction(referencePuzzle, state);
  assert.ok(second);
  assert.notDeepEqual(second.cells, first.cells);
});
