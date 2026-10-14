import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPuzzle,whiteCells} from '../src/latarnie/model.js';
import {litCells,conflictingBulbs,clueStatus,isSolved,latarnieProgress} from '../src/latarnie/rules.js';

// Regression fixture reconstructed from a 7x7 screenshot:
// 10 bulbs, every white cell lit and every numbered wall satisfied,
// but row 2, columns 1 and 2 contain mutually visible bulbs.
const screenshotPuzzle=createPuzzle({
  rows:7,cols:7,
  walls:[
    {index:0,clue:1},{index:1,clue:1},{index:3},
    {index:5,clue:3},{index:11,clue:2},
    {index:18,clue:1},{index:19,clue:1},
    {index:28},{index:29,clue:1},
    {index:31,clue:0},{index:32,clue:2},{index:35,clue:2},
    {index:48}
  ]
});
const screenshotBulbs=new Set([4,6,7,8,12,16,25,33,36,42]);

test('screen regression: fully illuminated board can still be invalid',()=>{
  const lit=litCells(screenshotPuzzle,screenshotBulbs);
  assert.equal(whiteCells(screenshotPuzzle).every(index=>lit.has(index)),true);
  for(const wall of screenshotPuzzle.walls){
    assert.equal(clueStatus(screenshotPuzzle,screenshotBulbs,wall).satisfied,true,
      'clue at '+wall.index);
  }
  assert.deepEqual([...conflictingBulbs(screenshotPuzzle,screenshotBulbs)].sort((a,b)=>a-b),[7,8]);
  assert.equal(isSolved(screenshotPuzzle,screenshotBulbs),false);
  const progress=latarnieProgress(screenshotPuzzle,screenshotBulbs);
  assert.equal(progress.kind,'conflict');
  assert.match(progress.message,/oświetlają się nawzajem/i);
  assert.doesNotMatch(progress.message,/oświetl wszystkie jasne pola/i);
});

test('missing light and oversatisfied clues receive distinct descriptions',()=>{
  assert.match(latarnieProgress(screenshotPuzzle,new Set()).message,/nieoświetlone/i);
  const puzzle=createPuzzle({rows:2,cols:3,walls:[{index:1,clue:0}]});
  const status=latarnieProgress(puzzle,new Set([0]));
  assert.equal(status.kind,'conflict');
  assert.match(status.message,/za dużo latarni/i);
});

test('fully solved simple board gives positive status',()=>{
  const puzzle=createPuzzle({rows:1,cols:1,walls:[]});
  const bulbs=new Set([0]);
  assert.equal(isSolved(puzzle,bulbs),true);
  assert.equal(latarnieProgress(puzzle,bulbs).kind,'success');
});
