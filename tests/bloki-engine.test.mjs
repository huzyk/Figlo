import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBloki} from '../src/bloki/generator.js';
import {countSolutions,solve} from '../src/bloki/solver.js';
import {isSolved} from '../src/bloki/rules.js';

test('Bloki generator is deterministic',()=>{const a=generateBloki({seed:'2026-08-25'});const b=generateBloki({seed:'2026-08-25'});assert.deepEqual(a,b);});
test('Bloki daily puzzle has exactly one solution',()=>{const puzzle=generateBloki({seed:'2026-08-25'});assert.equal(countSolutions(puzzle,2),1);});
test('Bloki solver returns a valid full partition',()=>{const puzzle=generateBloki({seed:'2026-08-25'});const [solution]=solve(puzzle);assert.equal(isSolved(puzzle,solution),true);});
test('Bloki clues can omit size or use any shape while keeping uniqueness',()=>{const puzzles=Array.from({length:20},(_,i)=>generateBloki({seed:`clue-mix-${i}`,difficulty:'medium'}));assert.ok(puzzles.some(p=>p.clues.some(c=>c.area==null||c.shape==='any')));for(const puzzle of puzzles)assert.equal(countSolutions(puzzle,2),1);});
test('Bloki clues always have a shape and numbered any-shape clues allow square geometry',()=>{for(let i=0;i<120;i++){const puzzle=generateBloki({seed:`semantic-${i}`});for(const clue of puzzle.clues){assert.ok(clue.shape,'every clue must have a shape');if(clue.shape==='any'&&clue.area!=null){assert.ok(clue.area>=4,`any-shape area too small: ${clue.area}`);assert.ok(Number.isInteger(Math.sqrt(clue.area)),`any-shape area cannot form square: ${clue.area}`);}}}});
test('Bloki generator keeps 365 consecutive seeds unique',()=>{for(let day=0;day<365;day++){const puzzle=generateBloki({seed:`stress-${day}`});assert.equal(countSolutions(puzzle,2),1,`stress-${day}`);}});
