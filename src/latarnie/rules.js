import{orthogonalNeighbors,rc,indexOf,wallMap,whiteCells,inBounds}from'./model.js';
const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1]];
export function visibleFrom(index,puzzle){const walls=wallMap(puzzle);const[row,col]=rc(index,puzzle.cols);const result=[];for(const[dr,dc]of DIRECTIONS){let r=row+dr,c=col+dc;while(inBounds(r,c,puzzle)){const next=indexOf(r,c,puzzle.cols);if(walls.has(next))break;result.push(next);r+=dr;c+=dc;}}return result;}
export function lightSourcesFor(index,puzzle){return[index,...visibleFrom(index,puzzle)];}
export function litCells(puzzle,bulbs){const result=new Set();for(const bulb of bulbs){result.add(bulb);for(const cell of visibleFrom(bulb,puzzle))result.add(cell);}return result;}
export function conflictingBulbs(puzzle,bulbs){const conflicts=new Set();for(const bulb of bulbs)for(const other of visibleFrom(bulb,puzzle))if(bulbs.has(other)){conflicts.add(bulb);conflicts.add(other);}return conflicts;}
export function clueStatus(puzzle,bulbs,wall){if(!Number.isInteger(wall.clue))return{required:null,actual:null,satisfied:true,over:false};const actual=orthogonalNeighbors(wall.index,puzzle).filter(i=>bulbs.has(i)).length;return{required:wall.clue,actual,satisfied:actual===wall.clue,over:actual>wall.clue};}
export function isSolved(puzzle,bulbs){if(conflictingBulbs(puzzle,bulbs).size)return false;const lit=litCells(puzzle,bulbs);for(const cell of whiteCells(puzzle))if(!lit.has(cell))return false;for(const wall of puzzle.walls||[])if(!clueStatus(puzzle,bulbs,wall).satisfied)return false;return true;}

/**
 * Describe the first remaining obstacle in the actual current position.
 * Lighting every white square is necessary but not sufficient to win.
 */
export function latarnieProgress(puzzle,bulbs){
  const conflicts=conflictingBulbs(puzzle,bulbs);
  if(conflicts.size){
    return {kind:'conflict',message:'Te latarnie oświetlają się nawzajem. Usuń jedną z czerwonych latarni.'};
  }
  const numbered=(puzzle.walls||[]).filter(wall=>Number.isInteger(wall.clue))
    .map(wall=>clueStatus(puzzle,bulbs,wall));
  if(numbered.some(status=>status.over)){
    return {kind:'conflict',message:'Przy czerwonej liczbie jest za dużo latarni. Usuń nadmiarową.'};
  }
  const lit=litCells(puzzle,bulbs);
  const dark=whiteCells(puzzle).filter(index=>!lit.has(index));
  if(dark.length){
    return {kind:'incomplete',message:dark.length===1
      ?'Pozostało 1 nieoświetlone pole.'
      :'Pozostały '+dark.length+' nieoświetlone pola.'};
  }
  if(numbered.some(status=>!status.satisfied)){
    return {kind:'incomplete',message:'Wszystkie pola są oświetlone, ale nie wszystkie liczby przy ścianach są spełnione.'};
  }
  return {kind:'success',message:'Wszystkie pola oświetlone. Brawo!'};
}
