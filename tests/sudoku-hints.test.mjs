import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completedSudokuUnits,newlyCompletedSudokuUnits,findSudokuHint,boardHasSudokuConflict,sudokuMistakeIndices} from '../src/sudoku/hints.js';

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

test('do not celebrate a filled row when another column has duplicate 4s (screenshot regression)',()=>{
  const before=[
    6,3,5,4,1,2,
    2,1,4,3,6,0,
    1,0,4,6,2,3,
    0,2,3,1,5,4,
    5,0,0,2,4,6,
    0,0,0,5,3,1
  ];
  const after=before.slice();
  after[11]=5;
  assert.equal(boardHasSudokuConflict(after),true);
  assert.deepEqual(newlyCompletedSudokuUnits(before,after),[]);
  assert.deepEqual(completedSudokuUnits(after),[]);

  // Clearing the duplicate removes the conflict, but must not re-celebrate
  // rows that were already full before the correction.
  const repaired=after.slice();
  repaired[14]=0;
  assert.equal(boardHasSudokuConflict(repaired),false);
  assert.deepEqual(newlyCompletedSudokuUnits(after,repaired),[]);
  assert.ok(completedSudokuUnits(repaired).some(unit=>unit.type==='row'&&unit.index===1));
});

test('do not celebrate even an unrelated correct row while the board has errors',()=>{
  const after=solved.slice();
  after[0]=0;
  after[18]=0;
  after[24]=solved[18]; // conflicting digit in a different row
  const before=after.slice();
  // Finish row 0 correctly, but a different part of the board remains invalid.
  after[0]=solved[0];
  assert.equal(boardHasSudokuConflict(after),true);
  assert.deepEqual(newlyCompletedSudokuUnits(before,after),[]);
});

test('wrong digit without duplicates is still a mistake and cannot produce a green row',()=>{
  const puzzle=Array(36).fill(0);
  const before=Array(36).fill(0);
  const after=before.slice();
  after.splice(0,6,1,2,3,4,6,5); // A full row with distinct digits 1–6 but swapped 5 and 6.
  assert.equal(boardHasSudokuConflict(after),false);
  assert.deepEqual(sudokuMistakeIndices(after,puzzle,solved),[4,5]);
  assert.deepEqual(newlyCompletedSudokuUnits(before,after,solved,puzzle),[]);
  assert.deepEqual(completedSudokuUnits(after,solved,puzzle),[]);
});

test('screenshot: several wrong entries have no duplicate but block empty cells',()=>{
  const board=[
    3,4,6,1,2,5,
    2,1,5,4,3,6,
    1,0,3,0,0,0,
    5,6,2,0,1,3,
    6,5,1,0,0,0,
    4,3,0,0,6,1
  ];
  const verifiedSolution=[
    3,4,6,1,2,5,
    2,1,5,4,3,6,
    1,6,3,5,4,2,
    5,2,4,6,1,3,
    6,3,1,2,5,4,
    4,5,2,3,6,1
  ];
  const puzzle=verifiedSolution.map((value,index)=>
    [0,2,3,4,5,6,8,9,10,11,22,23,24,26,30,34,35].includes(index)?value:0);
  assert.equal(boardHasSudokuConflict(board),false);
  assert.ok(sudokuMistakeIndices(board,puzzle,verifiedSolution).includes(19),
    'The non-conflicting 6 in row 4 column 2 cannot be marked correct');
  const hint=findSudokuHint(board,puzzle,verifiedSolution);
  assert.equal(hint.kind,'mistake');
  assert.equal(hint.value,null);
  assert.ok(sudokuMistakeIndices(board,puzzle,verifiedSolution).includes(hint.index));
  assert.match(hint.reason,/błędna/i);
});

test('original givens are not marked as user mistakes and hints remain logical for valid states',()=>{
  const puzzle=solved.slice();
  const board=solved.slice();
  assert.deepEqual(sudokuMistakeIndices(board,puzzle,solved),[]);
  board[0]=0;puzzle[0]=0;
  const hint=findSudokuHint(board,puzzle,solved);
  assert.equal(hint.kind,'single');
  assert.equal(hint.value,1);
});
