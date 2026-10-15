import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isDailyViewStale} from '../src/ui/day-rollover.js';
import {newlyCompletedSudokuUnits} from '../src/sudoku/hints.js';
import {buildSudokuPuzzle,hasConflict} from '../src/sudoku/engine.js';

test('daily view turns stale only when the Warsaw calendar date changes',()=>{
  assert.equal(isDailyViewStale('2026-10-15','2026-10-15'),false);
  assert.equal(isDailyViewStale('2026-10-15','2026-10-16'),true);
  assert.equal(isDailyViewStale('2026-10-16','2026-10-15'),true);
  assert.equal(isDailyViewStale(null,'2026-10-15'),false);
});

test('a nonconflicting but answer-inconsistent filled row is never celebrated',()=>{
  const {puzzle,solution}=buildSudokuPuzzle('puzli:sudoku:2026-10-15:v2',{givens:18});
  const row=0,empty=Array.from({length:6},(_,col)=>row*6+col).filter(i=>!puzzle[i]);
  const wrong=puzzle.slice();
  for(const i of empty)wrong[i]=solution[i];
  [wrong[0],wrong[2]]=[wrong[2],wrong[0]];
  assert.notEqual(wrong[0],solution[0]);
  assert.equal(wrong.some((n,i)=>n&&hasConflict(wrong,i)),false);
  const before=wrong.slice();
  before[empty.at(-1)]=0;
  assert.ok(newlyCompletedSudokuUnits(before,wrong).some(x=>x.type==='row'&&x.index===row));
  assert.deepEqual(newlyCompletedSudokuUnits(before,wrong,solution,puzzle),[]);
});
