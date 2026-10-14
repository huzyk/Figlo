import { SIZE, BOX_ROWS, BOX_COLS, candidates, hasConflict } from './engine.js';

// Shared 6x6 units: six rows, six columns and six 2x3 boxes.
const units = [
  ...Array.from({length:SIZE},(_,index)=>({
    type:'row',index,indices:Array.from({length:SIZE},(_,c)=>index*SIZE+c)
  })),
  ...Array.from({length:SIZE},(_,index)=>({
    type:'column',index,indices:Array.from({length:SIZE},(_,r)=>r*SIZE+index)
  })),
  ...Array.from({length:SIZE/BOX_ROWS*(SIZE/BOX_COLS)},(_,index)=>{
    const boxesPerRow=SIZE/BOX_COLS;
    const firstRow=Math.floor(index/boxesPerRow)*BOX_ROWS;
    const firstCol=(index%boxesPerRow)*BOX_COLS;
    return {
      type:'box',index,
      indices:Array.from({length:BOX_ROWS*BOX_COLS},(_,offset)=>
        (firstRow+Math.floor(offset/BOX_COLS))*SIZE+firstCol+offset%BOX_COLS)
    };
  })
];
const validBoard=board=>Array.isArray(board)&&board.length===SIZE*SIZE;

/**
 * Uniquely generated PUZLI puzzles include their verified solution.
 * A placed digit can violate that solution without yet creating a duplicate
 * in its row/column/box; those moves must never be marked correct.
 * Only editable values are checked; original clues are immutable.
 */
export function sudokuMistakeIndices(board,puzzle,solution){
  if(!validBoard(board)||!validBoard(puzzle)||!validBoard(solution))return [];
  return board.flatMap((value,index)=>
    value && !puzzle[index] && value!==solution[index] ? [index] : []);
}

// A filled row can look correct while one of its values violates a different
// column or box. Never celebrate an area on a board with unresolved conflicts.
export const boardHasSudokuConflict=board=>
  validBoard(board)&&board.some((value,index)=>value!==0&&hasConflict(board,index));
const unitIsComplete=(board,indices)=>{
  const digits=indices.map(index=>board[index]);
  return digits.every(value=>Number.isInteger(value)&&value>=1&&value<=SIZE)
    &&new Set(digits).size===SIZE;
};
const label=unit=>unit.type==='row'?'wierszu '+(unit.index+1)
  :unit.type==='column'?'kolumnie '+(unit.index+1)
  :'bloku 2×3';

export function completedSudokuUnits(board,solution=null,puzzle=null){
  if(!validBoard(board)||boardHasSudokuConflict(board)||
      (solution && validBoard(puzzle) && sudokuMistakeIndices(board,puzzle,solution).length))return [];
  return units.filter(unit=>unitIsComplete(board,unit.indices));
}

export function newlyCompletedSudokuUnits(before,after,solution=null,puzzle=null){
  if(!validBoard(before)||!validBoard(after)||boardHasSudokuConflict(after)||
      (solution && validBoard(puzzle) && sudokuMistakeIndices(after,puzzle,solution).length))return [];
  return units.filter(unit=>
    unitIsComplete(after,unit.indices)&&!unitIsComplete(before,unit.indices));
}

/**
 * Provide a logical next step, not a solution leak or an automatic entry.
 * Naked singles have priority, then hidden singles, then a candidate-based nudge.
 */
export function findSudokuHint(board,puzzle=[],solution=null){
  if(!validBoard(board))return null;
  // Correct the user's earlier wrong entry before analyzing now-impossible
  // empty cells. A local candidate check alone cannot diagnose this.
  const mistakes=sudokuMistakeIndices(board,puzzle,solution);
  if(mistakes.length){
    return {index:mistakes[0],kind:'mistake',value:null,
      reason:'Ta cyfra jest błędna. Popraw zaznaczone pole — wcześniejszy wpis blokuje dalsze rozwiązanie.'};
  }
  for(let i=0;i<board.length;i++){
    if(board[i]&&!puzzle[i]&&hasConflict(board,i)){
      return {index:i,kind:'conflict',value:null,
        reason:'Ta cyfra koliduje z inną. Sprawdź zaznaczone pole.'};
    }
  }
  const options=board.map((value,index)=>value?[]:candidates(board,index));
  for(let i=0;i<board.length;i++){
    if(board[i])continue;
    if(options[i].length===0){
      return {index:i,kind:'blocked',value:null,
        reason:'Tu nie pasuje żadna cyfra. Sprawdź wcześniejsze wpisy.'};
    }
    if(options[i].length===1){
      const value=options[i][0];
      return {index:i,kind:'single',value,
        reason:'W tym polu tylko '+value+' pasuje do wiersza, kolumny i bloku.'};
    }
  }
  for(const unit of units){
    for(let digit=1;digit<=SIZE;digit++){
      if(unit.indices.some(index=>board[index]===digit))continue;
      const possible=unit.indices.filter(index=>!board[index]&&options[index].includes(digit));
      if(possible.length===1){
        return {index:possible[0],kind:'hidden-single',value:digit,
          reason:'Tylko to pole w '+label(unit)+' może zawierać '+digit+'.'};
      }
    }
  }
  let best=-1;
  for(let i=0;i<board.length;i++){
    if(board[i]||!options[i].length)continue;
    if(best<0||options[i].length<options[best].length)best=i;
  }
  if(best<0)return null;
  const digits=options[best].join(', ');
  return {index:best,kind:'candidates',value:null,
    reason:'Sprawdź to pole. Możliwe cyfry: '+digits+'.'};
}
