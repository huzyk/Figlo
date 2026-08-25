import test from 'node:test';
import assert from 'node:assert/strict';
import {rectForDrag,applyPlacementReplacingOverlaps} from '../src/bloki/interaction.js';

test('dragging from anywhere inside an existing block can expand it',()=>{
  const baseRect={row:0,col:4,width:2,height:4}; // 8 pól
  const rect=rectForDrag({start:{row:2,col:5},end:{row:5,col:5},baseRect});
  assert.deepEqual(rect,{row:0,col:4,width:2,height:6}); // 12 pól
});

test('dragging inside an existing block can shrink it',()=>{
  const baseRect={row:0,col:4,width:2,height:6}; // 12 pól
  const rect=rectForDrag({start:{row:2,col:5},end:{row:3,col:5},baseRect});
  assert.deepEqual(rect,{row:0,col:4,width:2,height:4}); // 8 pól
});

test('dragging on one axis preserves the other axis of the existing block',()=>{
  const baseRect={row:1,col:1,width:4,height:2};
  const vertical=rectForDrag({start:{row:1,col:3},end:{row:4,col:3},baseRect});
  assert.deepEqual(vertical,{row:1,col:1,width:4,height:4});
  const horizontal=rectForDrag({start:{row:2,col:2},end:{row:2,col:3},baseRect});
  assert.deepEqual(horizontal,{row:1,col:1,width:3,height:2});
});

test('a new valid placement replaces older overlapping placements',()=>{
  const placements=[
    {clueId:'old',rect:{row:0,col:0,width:2,height:1}},
    {clueId:'safe',rect:{row:4,col:4,width:2,height:2}}
  ];
  const next=applyPlacementReplacingOverlaps(placements,{clueId:'new',rect:{row:0,col:0,width:2,height:2}});
  assert.deepEqual(next,[
    {clueId:'safe',rect:{row:4,col:4,width:2,height:2}},
    {clueId:'new',rect:{row:0,col:0,width:2,height:2}}
  ]);
});
