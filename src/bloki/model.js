export const SHAPES = Object.freeze({ ANY:'any', SQUARE:'square', WIDE:'wide', TALL:'tall' });
export function cellKey(row,col){return `${row}:${col}`;}
export function rectArea(rect){return rect.width*rect.height;}
export function rectShape(rect){if(rect.width===rect.height)return SHAPES.SQUARE;return rect.width>rect.height?SHAPES.WIDE:SHAPES.TALL;}
export function rectContains(rect,cell){return cell.row>=rect.row&&cell.row<rect.row+rect.height&&cell.col>=rect.col&&cell.col<rect.col+rect.width;}
export function rectCells(rect){const out=[];for(let r=rect.row;r<rect.row+rect.height;r++)for(let c=rect.col;c<rect.col+rect.width;c++)out.push({row:r,col:c});return out;}
