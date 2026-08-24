import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { dailyPuzzleSeed } from '../src/daily.js';
import { generateDuetPuzzle } from '../src/duet/generator.js';
import { countSolutions } from '../src/duet/solver.js';
import { solveLikeHuman } from '../src/duet/human-solver.js';
import { isSolved } from '../src/duet/rules.js';

function dateKeyFromOffset(offset){const date=new Date(Date.UTC(2026,7,24+offset));return date.toISOString().slice(0,10);}

test('12 representative Duet daily seeds stay deterministic, unique and human-solvable',()=>{
  const timings=[];
  for(let offset=0;offset<12;offset++){
    const dateKey=dateKeyFromOffset(offset),seed=dailyPuzzleSeed('duet',dateKey),started=performance.now();
    const first=generateDuetPuzzle(seed);timings.push({dateKey,ms:performance.now()-started});const second=generateDuetPuzzle(seed);
    assert.deepEqual(second.puzzle,first.puzzle,`puzzle differs for ${dateKey}`);
    assert.deepEqual(second.solution,first.solution,`solution differs for ${dateKey}`);
    assert.equal(countSolutions(first.puzzle,2),1,`puzzle is not unique for ${dateKey}`);
    assert.equal(isSolved(first.solution,first.puzzle),true,`solution invalid for ${dateKey}`);
    const human=solveLikeHuman(first.puzzle);assert.equal(human.solved,true,`human solver failed for ${dateKey}`);
    assert.ok(!human.steps.some(step=>step.rule==='guess'||step.rule==='lookahead'),`guessing used for ${dateKey}`);
  }
  const values=timings.map(item=>item.ms),average=values.reduce((sum,value)=>sum+value,0)/values.length,slowest=[...timings].sort((a,b)=>b.ms-a.ms).slice(0,3);
  console.log(`Duet CI sample timings: avg=${average.toFixed(1)}ms; slowest=${slowest.map(item=>`${item.dateKey}=${item.ms.toFixed(1)}ms`).join(', ')}`);
});
