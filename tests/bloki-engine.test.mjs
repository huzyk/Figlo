import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBloki} from '../src/bloki/generator.js';
import {countSolutions,solve} from '../src/bloki/solver.js';
import {isSolved} from '../src/bloki/rules.js';

test('Bloki generator is deterministic',()=>{const a=generateBloki({seed:'2026-08-25'});const b=generateBloki({seed:'2026-08-25'});assert.deepEqual(a,b);});
test('Bloki daily puzzle has exactly one solution',()=>{const puzzle=generateBloki({seed:'2026-08-25'});assert.equal(countSolutions(puzzle,2),1);});
test('Bloki solver returns a valid full partition',()=>{const puzzle=generateBloki({seed:'2026-08-25'});const [solution]=solve(puzzle);assert.equal(isSolved(puzzle,solution),true);});
test('Bloki generator keeps 365 consecutive seeds unique',()=>{for(let day=0;day<365;day++){const puzzle=generateBloki({seed:`stress-${day}`});assert.equal(countSolutions(puzzle,2),1,`stress-${day}`);}});
