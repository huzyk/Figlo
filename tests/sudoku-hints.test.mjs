import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completedSudokuUnits,newlyCompletedSudokuUnits,findSudokuHint} from '../src/sudoku/hints.js';

const solved=[
  1,2,3,4,5,6,
  4,5,6,1,2,3,
  2,3,4,5,6,1,
  5,6,1,2,3,4,
  3,4,5,6,1,2,
  6,1,2,3,4,5
];

test('completion recognizes valid rows, columns and 2x3 boxes',()=>{
  const before=Array(36).fill(0);
  const after=before.slice();
  for(let c=0;c<6;c++)after[c]=solved[c];
  const groups=newlyCompletedSudokuUnits(before,after);
  assert.deepEqual(groups.map(g=>g.type+':'+g.index),['row:0']);
  assert.deepEqual(groups[0].indices,[0,1,2,3,4,5]);
  assert.equal(completedSudokuUnits(after).length,1);
});

test('completion never fires for incomplete or duplicate units',()=>{
  const before=Array(36).fill(0);
  const wrong=before.slice();
  wrong.splice(0,6,1,2,3,4,5,5);
  assert.deepEqual(newlyCompletedSudokuUnits(before,wrong),[]);
  assert.deepEqual(newlyCompletedSudokuUnits(wrong,wrong),[]);
});

test('completion detects intersecting units on the final solved move',()=>{
  const before=solved.slice();
  before[0]=0;
  assert.deepEqual(newlyCompletedSudokuUnits(before,solved).map(g=>g.type+':'+g.index),
    ['row:0','column:0','box:0']);
});

test('hint identifies single without modifying the board',()=>{
  const board=solved.slice();board[0]=0;
  const snapshot=board.slice();
  const hint=findSudokuHint(board,solved.map((value,i)=>i===0?0:value));
  assert.equal(hint.index,0);
  assert.equal(hint.value,1);
  assert.equal(hint.kind,'single');
  assert.match(hint.reason,/wiersza, kolumny i bloku/);
  assert.deepEqual(board,snapshot);
});

test('hint returns a diagnostic for conflicting editable values',()=>{
  const board=solved.slice();board[0]=2;
  const puzzle=solved.slice();puzzle[0]=0;
  const hint=findSudokuHint(board,puzzle);
  assert.equal(hint.index,0);
  assert.equal(hint.kind,'conflict');
  assert.equal(hint.value,null);
});
