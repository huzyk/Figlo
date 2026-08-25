import test from 'node:test';
import assert from 'node:assert/strict';
import {rectForDrag,overlapsAnotherPlacement,replacePlacementForClue,stateIsCorrectCheckpoint,findLastCorrectCheckpoint} from '../src/bloki/interaction.js';

test('dragging from anywhere inside an existing block can expand it',()=>{
  const baseRect={row:0,col:4,width:2,height:4}; // 8 pól
  const rect=rectForDrag({start:{row:2,col:5},end:{row:5,col:5},baseRect,baseClueId:'b1'});
  assert.deepEqual(rect,{row:0,col:4,width:2,height:6}); // 12 pól
});

test('dragging inside an existing block can shrink it',()=>{
  const baseRect={row:0,col:4,width:2,height:6}; // 12 pól
  const rect=rectForDrag({start:{row:2,col:5},end:{row:3,col:5},baseRect,baseClueId:'b1'});
  assert.deepEqual(rect,{row:0,col:4,width:2,height:4}); // 8 pól
});

test('dragging on one axis preserves the other axis of the existing block',()=>{
  const baseRect={row:1,col:1,width:4,height:2};
  const vertical=rectForDrag({start:{row:1,col:3},end:{row:4,col:3},baseRect,baseClueId:'a'});
  assert.deepEqual(vertical,{row:1,col:1,width:4,height:4});
  const horizontal=rectForDrag({start:{row:2,col:2},end:{row:2,col:3},baseRect,baseClueId:'a'});
  assert.deepEqual(horizontal,{row:1,col:1,width:3,height:2});
});

test('a placement cannot overwrite a different existing block',()=>{
  const placements=[
    {clueId:'old',rect:{row:0,col:0,width:2,height:2}},
    {clueId:'safe',rect:{row:4,col:4,width:2,height:2}}
  ];
  assert.equal(overlapsAnotherPlacement(placements,{clueId:'new',rect:{row:1,col:1,width:2,height:2}}),true);
});

test('redrawing over the same clue is blocked unless the gesture started inside its existing block',()=>{
  const placements=[{clueId:'old',rect:{row:0,col:0,width:2,height:2}}];
  const freshRect=rectForDrag({start:{row:0,col:2},end:{row:1,col:0},baseRect:null,baseClueId:null});
  assert.equal(overlapsAnotherPlacement(placements,{clueId:'old',rect:freshRect}),true);

  const editedRect=rectForDrag({start:{row:1,col:1},end:{row:2,col:1},baseRect:placements[0].rect,baseClueId:'old'});
  assert.equal(overlapsAnotherPlacement(placements,{clueId:'old',rect:editedRect}),false);
});

test('editing a clue replaces only that clue placement',()=>{
  const placements=[
    {clueId:'a',rect:{row:0,col:0,width:2,height:2}},
    {clueId:'b',rect:{row:4,col:4,width:2,height:2}}
  ];
  const next=replacePlacementForClue(placements,{clueId:'a',rect:{row:0,col:0,width:2,height:3}});
  assert.deepEqual(next,[
    {clueId:'b',rect:{row:4,col:4,width:2,height:2}},
    {clueId:'a',rect:{row:0,col:0,width:2,height:3}}
  ]);
});

test('hint repair returns the latest fully correct checkpoint',()=>{
  const correctA={clueId:'a',rect:{row:0,col:0,width:2,height:2}};
  const wrongB={clueId:'b',rect:{row:2,col:0,width:2,height:1}};
  const correctC={clueId:'c',rect:{row:4,col:0,width:2,height:1}};
  const history=[[],[correctA],[correctA,wrongB]];
  const isCorrect=p=>p.clueId!=='b';
  assert.equal(stateIsCorrectCheckpoint([correctA,wrongB,correctC],isCorrect),false);
  const repaired=findLastCorrectCheckpoint(history,isCorrect);
  assert.deepEqual(repaired.placements,[correctA]);
  assert.deepEqual(repaired.history,[[]]);
});
