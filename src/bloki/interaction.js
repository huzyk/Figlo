export function cellsOverlap(a,b){return!(a.col+a.width<=b.col||b.col+b.width<=a.col||a.row+a.height<=b.row||b.row+b.height<=a.row);}

export function rectFromPoints(a,b){const row=Math.min(a.row,b.row),col=Math.min(a.col,b.col);return{row,col,width:Math.abs(a.col-b.col)+1,height:Math.abs(a.row-b.row)+1};}

export function rectIncludingCell(rect,cell){const minRow=Math.min(rect.row,cell.row),minCol=Math.min(rect.col,cell.col);const maxRow=Math.max(rect.row+rect.height-1,cell.row),maxCol=Math.max(rect.col+rect.width-1,cell.col);return{row:minRow,col:minCol,width:maxCol-minCol+1,height:maxRow-minRow+1};}

export function rectForDrag(drag){return drag.baseRect?rectIncludingCell(drag.baseRect,drag.end):rectFromPoints(drag.start,drag.end);}

export function applyPlacementReplacingOverlaps(placements,placement){const survivors=placements.filter(p=>p.clueId!==placement.clueId&&!cellsOverlap(p.rect,placement.rect));return[...survivors,{clueId:placement.clueId,rect:{...placement.rect}}];}
