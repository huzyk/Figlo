import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSudokuPuzzle, candidates, countSudokuSolutions, hasConflict, isSudokuSolved } from '../src/sudoku/engine.js';
import { requiredGamesForDate } from '../src/daily-games.js';

test('Sudoku Daily starts October 14 with six games, historical dates keep five', () => {
  assert.equal(requiredGamesForDate('2026-10-13').length,5);
  assert.deepEqual(requiredGamesForDate('2026-10-14'),
    ['korony','duet','bloki','latarnie','zip','sudoku']);
});

test('Sudoku generator is deterministic and every generated puzzle has exactly one solution', () => {
  for (const date of ['2026-10-14','2026-10-15','2026-11-01','2027-01-01','2027-03-14']) {
    const seed='puzli:sudoku:'+date+':v1';
    const one=buildSudokuPuzzle(seed,{givens:39});
    const two=buildSudokuPuzzle(seed,{givens:39});
    assert.deepEqual(one,two);
    assert.ok(one.givens>=39);
    assert.equal(one.puzzle.length,81);
    assert.equal(one.solution.length,81);
    assert.ok(isSudokuSolved(one.solution));
    assert.equal(countSudokuSolutions(one.puzzle),1);
    assert.ok(one.puzzle.every((value,i)=>value===0||value===one.solution[i]));
  }
});
test('Sudoku solution is validated by row, column and box, not only cell count',()=>{
  const puzzle=buildSudokuPuzzle('validation:v1');
  assert.ok(isSudokuSolved(puzzle.solution));
  const duplicate=[...puzzle.solution];duplicate[0]=duplicate[1];
  assert.equal(isSudokuSolved(duplicate),false);
  assert.equal(hasConflict(duplicate,0),true);
  assert.equal(countSudokuSolutions(duplicate),0);
  const missing=[...puzzle.solution];missing[0]=0;
  assert.deepEqual(candidates(missing,0),[puzzle.solution[0]]);
});
