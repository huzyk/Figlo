import test from'node:test';
import assert from'node:assert/strict';
import{generateZip}from'../src/zip/generator.js';
import{solveZip}from'../src/zip/solver.js';
import{applyPathCell,isSolvedPath,longestSolutionPrefix}from'../src/zip/rules.js';

function canonicalPath(path,size){const transforms=[
(r,c)=>[r,c],(r,c)=>[c,size-1-r],(r,c)=>[size-1-r,size-1-c],(r,c)=>[size-1-c,r],
(r,c)=>[r,size-1-c],(r,c)=>[size-1-r,c],(r,c)=>[c,r],(r,c)=>[size-1-c,size-1-r]
];const variants=[];for(const transform of transforms){const mapped=path.map(index=>{const r=Math.floor(index/size),c=index%size,[nr,nc]=transform(r,c);return nr*size+nc;});variants.push(mapped.join(','),[...mapped].reverse().join(','));}return variants.sort()[0];}

test('Zip generator is deterministic and unique',()=>{const first=generateZip({seed:'figlo:zip:2026-08-28:v2',difficulty:'medium'}),second=generateZip({seed:'figlo:zip:2026-08-28:v2',difficulty:'medium'});assert.deepEqual(first,second);const found=solveZip(first.puzzle,{limit:2,maxNodes:500000});assert.equal(found.solutions.length,1);assert.deepEqual(found.solutions[0],first.solution);assert.equal(isSolvedPath(first.puzzle,first.solution),true);});

test('Zip generator covers all difficulty levels with unique solutions',()=>{for(const difficulty of['easy','medium','hard','challenge']){const generated=generateZip({seed:`zip:${difficulty}:fixture:v2`,difficulty});const found=solveZip(generated.puzzle,{limit:2,maxNodes:500000});assert.equal(found.solutions.length,1,difficulty);}});

test('Zip training seeds produce genuinely different path shapes, not rotations or mirrors',()=>{const signatures=new Set();for(let i=0;i<12;i++){const generated=generateZip({seed:`zip:diversity:${i}`,difficulty:'medium'});signatures.add(canonicalPath(generated.solution,generated.puzzle.cols));}assert.ok(signatures.size>=10,`expected at least 10 distinct shapes, got ${signatures.size}`);});

test('Zip interaction starts at 1, rejects future waypoints and supports backtracking',()=>{const generated=generateZip({seed:'zip:interaction:v2',difficulty:'easy'}),{puzzle,solution}=generated;let path=[];let move=applyPathCell(puzzle,path,solution[0]);assert.equal(move.ok,true);path=move.path;move=applyPathCell(puzzle,path,solution[1]);assert.equal(move.ok,true);path=move.path;const future=puzzle.waypoints.find((cell,index)=>index>1&&!path.includes(cell));if(future!==undefined)assert.equal(applyPathCell(puzzle,path,future).ok,false);const truncated=applyPathCell(puzzle,path,solution[0]);assert.equal(truncated.ok,true);assert.equal(truncated.type,'backtrack');assert.deepEqual(truncated.path,[solution[0]]);});

test('Zip touching an older path segment does not erase the route',()=>{const generated=generateZip({seed:'zip:overlap-guard:v2',difficulty:'medium'}),{puzzle,solution}=generated;const path=solution.slice(0,7);const result=applyPathCell(puzzle,path,solution[2]);assert.equal(result.ok,true);assert.equal(result.type,'overlap-noop');assert.deepEqual(result.path,path);const backtrack=applyPathCell(puzzle,path,solution[5]);assert.equal(backtrack.type,'backtrack');assert.deepEqual(backtrack.path,solution.slice(0,6));});

test('Zip hint repair can find the first wrong step',()=>{assert.equal(longestSolutionPrefix([1,2,9],[1,2,3,4]),2);});
