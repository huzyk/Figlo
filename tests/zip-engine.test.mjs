import test from'node:test';
import assert from'node:assert/strict';
import{generateZip}from'../src/zip/generator.js';
import{solveZip}from'../src/zip/solver.js';
import{applyPathCell,isSolvedPath,longestSolutionPrefix}from'../src/zip/rules.js';

test('Zip generator is deterministic and unique',()=>{const first=generateZip({seed:'figlo:zip:2026-08-28:v1',difficulty:'medium'}),second=generateZip({seed:'figlo:zip:2026-08-28:v1',difficulty:'medium'});assert.deepEqual(first,second);const found=solveZip(first.puzzle,{limit:2,maxNodes:500000});assert.equal(found.solutions.length,1);assert.deepEqual(found.solutions[0],first.solution);assert.equal(isSolvedPath(first.puzzle,first.solution),true);});

test('Zip generator covers all difficulty levels with unique solutions',()=>{for(const difficulty of['easy','medium','hard','challenge']){const generated=generateZip({seed:`zip:${difficulty}:fixture`,difficulty});const found=solveZip(generated.puzzle,{limit:2,maxNodes:500000});assert.equal(found.solutions.length,1,difficulty);}});

test('Zip interaction starts at 1, rejects future waypoints and supports backtracking',()=>{const generated=generateZip({seed:'zip:interaction',difficulty:'easy'}),{puzzle,solution}=generated;let path=[];let move=applyPathCell(puzzle,path,solution[0]);assert.equal(move.ok,true);path=move.path;move=applyPathCell(puzzle,path,solution[1]);assert.equal(move.ok,true);path=move.path;const future=puzzle.waypoints.find((cell,index)=>index>1&&!path.includes(cell));if(future!==undefined)assert.equal(applyPathCell(puzzle,path,future).ok,false);const truncated=applyPathCell(puzzle,path,solution[0]);assert.equal(truncated.ok,true);assert.deepEqual(truncated.path,[solution[0]]);});

test('Zip hint repair can find the first wrong step',()=>{assert.equal(longestSolutionPrefix([1,2,9],[1,2,3,4]),2);});
