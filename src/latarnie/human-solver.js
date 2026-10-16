import { orthogonalNeighbors, whiteCells, rc } from './model.js';
import { lightSourcesFor, visibleFrom, litCells } from './rules.js';
import { solveLatarnie } from './solver.js';

function cellLocation(index,puzzle) {
  const [r,c] = rc(index,puzzle.cols);
  return 'wiersz ' + (r+1) + ', kolumna ' + (c+1);
}
function actionFor(puzzle,index,value) {
  return (value===1 ? 'Postaw latarnię' : 'Postaw X') +
    ' w podświetlonym polu (' + cellLocation(index,puzzle) + ').';
}
function baseSolution(puzzle) {
  const solutions=solveLatarnie(puzzle,{limit:1});
  return solutions.length ? new Set(solutions[0]) : null;
}
function stepKeepsSolution(puzzle,bulbs,noBulbs,step) {
  const nextBulbs=new Set(bulbs),nextNoBulbs=new Set(noBulbs);
  if(step.value===1) {nextNoBulbs.delete(step.index);nextBulbs.add(step.index);}
  else {nextBulbs.delete(step.index);nextNoBulbs.add(step.index);}
  return solveLatarnie(puzzle,{limit:1,initialBulbs:[...nextBulbs],initialNoBulbs:[...nextNoBulbs]}).length>0;
}
function correctionStep(puzzle,bulbs,noBulbs) {
  const solution=baseSolution(puzzle);if(!solution)return null;
  for(const index of bulbs)if(!solution.has(index))return {
    kind:'wrong-bulb',index,value:0,
    reason:'Latarnia w polu ('+cellLocation(index,puzzle)+') jest nieprawidłowa.',
    action:'Usuń podświetloną latarnię. Dotknij ją jeden raz.',
    area:[index],indices:[index]
  };
  for(const index of noBulbs)if(solution.has(index))return {
    kind:'wrong-cross',index,value:1,
    reason:'X w polu ('+cellLocation(index,puzzle)+') blokuje potrzebną latarnię.',
    action:'Usuń X, a następnie postaw w tym polu latarnię.',
    area:[index],indices:[index]
  };
  return null;
}
function wallCells(puzzle,wall) {
  const walls=new Set((puzzle.walls||[]).map(w=>w.index));
  return orthogonalNeighbors(wall.index,puzzle).filter(index=>!walls.has(index));
}
function wallStep(puzzle,wall,index,kind,value,reason) {
  return {
    kind,index,value,sourceIndex:wall.index,
    reason,action:actionFor(puzzle,index,value),
    area:[wall.index,index],indices:[index]
  };
}
function candidateGroups(puzzle,bulbs,noBulbs) {
  const forcedBulbs=[],onlySources=[],zeroClues=[],completedClues=[],visibility=[];
  for(const wall of puzzle.walls||[]) {
    if(!Number.isInteger(wall.clue))continue;
    const cells=wallCells(puzzle,wall);
    const placed=cells.filter(i=>bulbs.has(i));
    const available=cells.filter(i=>!bulbs.has(i)&&!noBulbs.has(i));
    const name='Ściana z liczbą '+wall.clue+' ('+cellLocation(wall.index,puzzle)+')';
    if(wall.clue===0&&available.length) {
      for(const index of available)zeroClues.push(wallStep(
        puzzle,wall,index,'zero-clue',0,
        name+' nie może mieć obok żadnej latarni.'
      ));
      continue;
    }
    if(placed.length+available.length===wall.clue&&available.length) {
      for(const index of available)forcedBulbs.push(wallStep(
        puzzle,wall,index,'clue-forced',1,
        name+' wymaga jeszcze '+available.length+' latarni'+
        '. Wszystkie wolne pola obok niej muszą zawierać latarnie.'
      ));
    }
    if(placed.length===wall.clue&&available.length) {
      for(const index of available)completedClues.push(wallStep(
        puzzle,wall,index,'clue-complete',0,
        name+' jest już spełniona — stoi przy niej komplet latarni.'
      ));
    }
  }
  const lit=litCells(puzzle,bulbs);
  for(const index of whiteCells(puzzle)) {
    if(lit.has(index))continue;
    const possible=lightSourcesFor(index,puzzle).filter(source=>!noBulbs.has(source));
    if(possible.length===1&&!bulbs.has(possible[0])) {
      const source=possible[0];
      onlySources.push({
        kind:'only-light-source',index:source,value:1,sourceIndex:index,
        reason:'Nieoświetlone pole ('+cellLocation(index,puzzle)+') ma tylko jedno możliwe źródło światła.',
        action:actionFor(puzzle,source,1),area:[index,source],indices:[source]
      });
    }
  }
  for(const bulb of bulbs)for(const cell of visibleFrom(bulb,puzzle))
    if(!bulbs.has(cell)&&!noBulbs.has(cell))visibility.push({
      kind:'visibility',index:cell,value:0,sourceIndex:bulb,
      reason:'Latarnia w polu ('+cellLocation(bulb,puzzle)+') już oświetla to miejsce. Druga latarnia nie może jej widzieć.',
      action:actionFor(puzzle,cell,0),area:[bulb,cell],indices:[cell]
    });
  return {forcedBulbs,onlySources,zeroClues,completedClues,visibility};
}
function firstSafeStep(puzzle,bulbs,noBulbs,groups) {
  for(const group of groups)for(const step of group)
    if(stepKeepsSolution(puzzle,bulbs,noBulbs,step))return step;
  return null;
}
export function nextHumanStep(puzzle,{bulbs=new Set(),noBulbs=new Set(),preferBulbs=false}={}) {
  const correction=correctionStep(puzzle,bulbs,noBulbs);if(correction)return correction;
  const groups=candidateGroups(puzzle,bulbs,noBulbs);
  // Gameplay hints prefer placements; the human solver keeps its original
  // deduction order for stable difficulty metrics and puzzle generation.
  // Each suggested step changes exactly one square.
  const order=preferBulbs
    ? [groups.forcedBulbs,groups.onlySources,groups.zeroClues,groups.completedClues,groups.visibility]
    : [groups.zeroClues,groups.forcedBulbs,groups.completedClues,groups.onlySources,groups.visibility];
  const local=firstSafeStep(puzzle,bulbs,noBulbs,order);
  if(local)return local;
  const solution=baseSolution(puzzle);if(!solution)return null;
  for(const index of solution)if(!bulbs.has(index)&&!noBulbs.has(index))return {
    kind:'solver-forced',index,value:1,
    reason:'Rozwiązanie pozostałych warunków wymaga latarni w tym polu.',
    action:actionFor(puzzle,index,1),area:[index],indices:[index]
  };
  for(const index of whiteCells(puzzle))
    if(!solution.has(index)&&!bulbs.has(index)&&!noBulbs.has(index))return {
      kind:'solver-excluded',index,value:0,
      reason:'To pole jest wykluczone przez pozostałe warunki planszy.',
      action:actionFor(puzzle,index,0),area:[index],indices:[index]
    };
  return null;
}
export function humanSolve(puzzle) {
  const bulbs=new Set(),noBulbs=new Set(),steps=[];
  const scoring={'zero-clue':1,visibility:1,'clue-complete':1,'clue-forced':2,'only-light-source':4,'solver-forced':6,'solver-excluded':6};
  for(let i=0;i<puzzle.rows*puzzle.cols*8;i++) {
    const step=nextHumanStep(puzzle,{bulbs,noBulbs});
    if(!step||step.kind==='wrong-bulb'||step.kind==='wrong-cross')break;
    steps.push(step);
    if(step.value===1)bulbs.add(step.index);else noBulbs.add(step.index);
  }
  return {bulbs,noBulbs,steps,score:steps.reduce((s,x)=>s+(scoring[x.kind]||1),0)};
}
