export function cellsOverlap(a,b){return!(a.col+a.width<=b.col||b.col+b.width<=a.col||a.row+a.height<=b.row||b.row+b.height<=a.row);}

export function rectFromPoints(a,b){const row=Math.min(a.row,b.row),col=Math.min(a.col,b.col);return{row,col,width:Math.abs(a.col-b.col)+1,height:Math.abs(a.row-b.row)+1};}

function resizedAxis(min,max,start,end){
  if(end===start)return[min,max];
  if(end>start)return[min,Math.max(min,end)];
  return[Math.min(max,end),max];
}

export function resizeRectFromDrag(rect,start,end){
  const baseBottom=rect.row+rect.height-1;
  const baseRight=rect.col+rect.width-1;
  const [top,bottom]=resizedAxis(rect.row,baseBottom,start.row,end.row);
  const [left,right]=resizedAxis(rect.col,baseRight,start.col,end.col);
  return{row:top,col:left,width:right-left+1,height:bottom-top+1};
}

export function rectForDrag(drag){return drag.baseRect?resizeRectFromDrag(drag.baseRect,drag.start,drag.end):rectFromPoints(drag.start,drag.end);}

export function applyPlacementReplacingOverlaps(placements,placement){const survivors=placements.filter(p=>p.clueId!==placement.clueId&&!cellsOverlap(p.rect,placement.rect));return[...survivors,{clueId:placement.clueId,rect:{...placement.rect}}];}
