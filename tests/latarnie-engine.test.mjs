import test from'node:test';import assert from'node:assert/strict';import{createPuzzle}from'../src/latarnie/model.js';import{visibleFrom,litCells,conflictingBulbs,isSolved}from'../src/latarnie/rules.js';import{solveLatarnie}from'../src/latarnie/solver.js';import{nextHumanStep}from'../src/latarnie/human-solver.js';import{generateLatarnie}from'../src/latarnie/generator.js';
test('Latarnie light stops at walls',()=>{const puzzle=createPuzzle({rows:3,cols:3,walls:[{index:1,clue:null}]});assert.deepEqual(visibleFrom(0,puzzle).sort((a,b)=>a-b),[3,6]);});
test('Latarnie detects bulbs that see each other',()=>{const puzzle=createPuzzle({rows:3,cols:3,walls:[]});assert.deepEqual([...conflictingBulbs(puzzle,new Set([0,2]))].sort((a,b)=>a-b),[0,2]);});
test('Latarnie solver solves a simple unique puzzle',()=>{const puzzle=createPuzzle({rows:1,cols:2,walls:[{index:0,clue:1}]});const solutions=solveLatarnie(puzzle,{limit:2});assert.equal(solutions.length,1);assert.deepEqual(solutions[0],[1]);assert.equal(isSolved(puzzle,new Set(solutions[0])),true);assert.equal(litCells(puzzle,new Set(solutions[0])).has(1),true);});
test('Latarnie zero clue immediately explains adjacent exclusions',()=>{const puzzle=createPuzzle({rows:1,cols:3,walls:[{index:0,clue:0}]});const step=nextHumanStep(puzzle,{bulbs:new Set(),noBulbs:new Set()});assert.equal(step.kind,'zero-clue');assert.equal(step.index,1);assert.equal(step.value,0);assert.match(step.reason,/liczbą 0/i);assert.match(step.reason,/żadnej latarni/i);assert.match(step.action,/Postaw X/i);assert.match(step.action,/wiersz 1, kolumna 2/i);assert.equal(step.sourceIndex,0);assert.deepEqual(step.indices,[1]);});
test('Latarnie daily 2026-08-26 zero clue points only to X cells',()=>{const generated=generateLatarnie({seed:'figlo:latarnie:2026-08-26:v1',difficulty:'medium',maxAttempts:180});const step=nextHumanStep(generated.puzzle,{bulbs:new Set(),noBulbs:new Set()});assert.equal(step.kind,'zero-clue');assert.equal(step.value,0);assert.equal(step.area.includes(20),true);assert.deepEqual(step.indices,[step.index]);assert.equal(step.index,13);assert.equal(step.sourceIndex,20);const solution=new Set(generated.solution);for(const index of step.indices)assert.equal(solution.has(index),false);});
test('Latarnie uses zero-clue cleanup after solution bulb is placed',()=>{const puzzle=createPuzzle({rows:1,cols:3,walls:[{index:0,clue:0}]});const step=nextHumanStep(puzzle,{bulbs:new Set([2]),noBulbs:new Set()});assert.equal(step.kind,'zero-clue');assert.equal(step.index,1);assert.equal(step.value,0);assert.match(step.reason,/liczbą 0/i);});
test('Latarnie prioritizes clear numbered-wall logic over fallback solver moves',()=>{const puzzle=createPuzzle({rows:2,cols:3,walls:[{index:0,clue:0},{index:3,clue:null},{index:4,clue:null},{index:5,clue:1}]});const step=nextHumanStep(puzzle,{bulbs:new Set(),noBulbs:new Set()});assert.equal(step.kind,'zero-clue');assert.equal(step.value,0);});
test('Latarnie hint corrects a wrong cross before suggesting another move',()=>{const puzzle=createPuzzle({rows:1,cols:2,walls:[{index:0,clue:1}]});const step=nextHumanStep(puzzle,{bulbs:new Set(),noBulbs:new Set([1])});assert.equal(step.kind,'wrong-cross');assert.equal(step.index,1);assert.equal(step.value,1);});
test('Latarnie hint suggestion always preserves at least one solution',()=>{const generated=generateLatarnie({seed:'latarnie-hint-safe',difficulty:'easy',maxAttempts:180});const bulbs=new Set(),noBulbs=new Set();for(let i=0;i<generated.puzzle.rows*generated.puzzle.cols*2;i++){const step=nextHumanStep(generated.puzzle,{bulbs,noBulbs});if(!step)break;assert.notEqual(step.kind,'wrong-bulb');assert.notEqual(step.kind,'wrong-cross');if(step.value===1)bulbs.add(step.index);else noBulbs.add(step.index);const remaining=solveLatarnie(generated.puzzle,{limit:1,initialBulbs:[...bulbs],initialNoBulbs:[...noBulbs]});assert.equal(remaining.length,1);if(isSolved(generated.puzzle,bulbs))break;}assert.equal(isSolved(generated.puzzle,bulbs),true);});
for(const difficulty of['easy','medium'])test(`Latarnie ${difficulty} generator returns unique valid puzzle`,()=>{const generated=generateLatarnie({seed:`latarnie-test:${difficulty}`,difficulty,maxAttempts:180});const solutions=solveLatarnie(generated.puzzle,{limit:2});assert.equal(solutions.length,1);assert.deepEqual(solutions[0].slice().sort((a,b)=>a-b),generated.solution.slice().sort((a,b)=>a-b));assert.equal(isSolved(generated.puzzle,new Set(generated.solution)),true);});

test('Latarnie completed clue gives exactly one actionable, located cross',()=>{
  const puzzle=createPuzzle({rows:2,cols:3,walls:[{index:1,clue:1}]});
  const step=nextHumanStep(puzzle,{bulbs:new Set([0]),noBulbs:new Set()});
  assert.equal(step.kind,'clue-complete');
  assert.equal(step.sourceIndex,1);
  assert.equal(step.index,2);
  assert.deepEqual(step.indices,[2]);
  assert.deepEqual(step.area,[1,2]);
  assert.match(step.reason,/wiersz 1, kolumna 2/);
  assert.match(step.action,/Postaw X/);
  assert.match(step.action,/wiersz 1, kolumna 3/);
});
test('Latarnie forced lantern hint is explicit and points at only one target',()=>{
  const puzzle=createPuzzle({rows:1,cols:2,walls:[{index:0,clue:1}]});
  const step=nextHumanStep(puzzle);
  assert.equal(step.kind,'clue-forced');
  assert.equal(step.sourceIndex,0);
  assert.equal(step.index,1);
  assert.deepEqual(step.indices,[1]);
  assert.match(step.reason,/liczbą 1/);
  assert.match(step.action,/Postaw latarnię/);
});
