export function createPuzzle({rows=7,cols=7,walls=[],seed='',difficulty='medium'}={}){return{rows,cols,walls,seed,difficulty};}
export function indexOf(row,col,cols){return row*cols+col;}
export function rc(index,cols){return[Math.floor(index/cols),index%cols];}
export function inBounds(row,col,puzzle){return row>=0&&col>=0&&row<puzzle.rows&&col<puzzle.cols;}
export function wallMap(puzzle){return new Map((puzzle.walls||[]).map(wall=>[wall.index,wall]));}
export function whiteCells(puzzle){const walls=new Set((puzzle.walls||[]).map(wall=>wall.index));const result=[];for(let i=0;i<puzzle.rows*puzzle.cols;i++)if(!walls.has(i))result.push(i);return result;}
export function orthogonalNeighbors(index,puzzle){const[row,col]=rc(index,puzzle.cols);return[[row-1,col],[row+1,col],[row,col-1],[row,col+1]].filter(([r,c])=>inBounds(r,c,puzzle)).map(([r,c])=>indexOf(r,c,puzzle.cols));}
