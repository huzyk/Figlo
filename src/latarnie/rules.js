import{orthogonalNeighbors,rc,indexOf,wallMap,whiteCells,inBounds}from'./model.js';
const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1]];
export function visibleFrom(index,puzzle){const walls=wallMap(puzzle);const[row,col]=rc(index,puzzle.cols);const result=[];for(const[dr,dc]of DIRECTIONS){let r=row+dr,c=col+dc;while(inBounds(r,c,puzzle)){const next=indexOf(r,c,puzzle.cols);if(walls.has(next))break;result.push(next);r+=dr;c+=dc;}}return result;}
export function lightSourcesFor(index,puzzle){return[index,...visibleFrom(index,puzzle)];}
export function litCells(puzzle,bulbs){const result=new Set();for(const bulb of bulbs){result.add(bulb);for(const cell of visibleFrom(bulb,puzzle))result.add(cell);}return result;}
export function conflictingBulbs(puzzle,bulbs){const conflicts=new Set();for(const bulb of bulbs)for(const other of visibleFrom(bulb,puzzle))if(bulbs.has(other)){conflicts.add(bulb);conflicts.add(other);}return conflicts;}
export function clueStatus(puzzle,bulbs,wall){if(!Number.isInteger(wall.clue))return{required:null,actual:null,satisfied:true,over:false};const actual=orthogonalNeighbors(wall.index,puzzle).filter(i=>bulbs.has(i)).length;return{required:wall.clue,actual,satisfied:actual===wall.clue,over:actual>wall.clue};}
export function isSolved(puzzle,bulbs){if(conflictingBulbs(puzzle,bulbs).size)return false;const lit=litCells(puzzle,bulbs);for(const cell of whiteCells(puzzle))if(!lit.has(cell))return false;for(const wall of puzzle.walls||[])if(!clueStatus(puzzle,bulbs,wall).satisfied)return false;return true;}
