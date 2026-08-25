import test from 'node:test';
import assert from 'node:assert/strict';
import {rectForDrag,applyPlacementReplacingOverlaps} from '../src/bloki/interaction.js';

test('dragging from anywhere inside an existing block expands the whole block',()=>{
  const baseRect={row:0,col:4,width:2,height:4}; // 8 pól
  const rect=rectForDrag({start:{row:2,col:5},end:{row:5,col:5},baseRect});
  assert.deepEqual(rect,{row:0,col:4,width:2,height:6}); // 12 pól
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
