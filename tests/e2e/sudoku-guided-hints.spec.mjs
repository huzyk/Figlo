import {test,expect} from '@playwright/test';

const DATE='2026-10-15';

async function sudokuRecord(page){
  return page.evaluate(async date=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    return getDailyGame('sudoku',date);
  },DATE);
}

test('Sudoku hint explains a step and spotlights its cell without auto-filling',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  const before=await page.locator('.sudoku-cell').allTextContents();
  await page.locator('#hint').click();
  const target=page.locator('.sudoku-cell.hinted');
  await expect(target).toHaveCount(1);
  await expect(page.locator('#feedback')).toHaveClass(/hint-message/);
  await expect(page.locator('#feedback')).not.toBeEmpty();
  expect(await page.locator('.sudoku-cell').allTextContents()).toEqual(before);
  expect(await page.locator('.sudoku-cell.hint-context').count()).toBeGreaterThan(5);
  expect(await page.locator('.sudoku-cell.hint-muted').count()).toBeGreaterThan(0);
  const index=Number(await target.getAttribute('data-index'));
  const record=await sudokuRecord(page);
  if(!record.puzzle[index]){
    await page.locator('#keypad [data-digit="'+record.solution[index]+'"]').click();
    await expect(page.locator('.sudoku-cell').nth(index)).toHaveText(String(record.solution[index]));
    await expect(page.locator('.sudoku-cell.hinted')).toHaveCount(0);
  }
});

test('a completed Sudoku row flashes, then returns to normal',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  const record=await sudokuRecord(page);
  const row=Array.from({length:6},(_,r)=>r).find(r=>
    Array.from({length:6},(_,c)=>r*6+c).filter(i=>!record.puzzle[i]).length>=2);
  expect(row).not.toBeUndefined();
  const editable=Array.from({length:6},(_,c)=>row*6+c).filter(i=>!record.puzzle[i]);
  for(const index of editable){
    await page.locator('.sudoku-cell').nth(index).click();
    await page.locator('#keypad [data-digit="'+record.solution[index]+'"]').click();
  }
  for(let c=0;c<6;c++){
    await expect(page.locator('.sudoku-cell').nth(row*6+c)).toHaveClass(/unit-complete/);
  }
  await expect(page.locator('.sudoku-cell.unit-complete')).toHaveCount(0,{timeout:2500});
});

test('mobile Sudoku hint preserves board and keypad positions',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  await page.setViewportSize({width:360,height:640});
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  const before=await page.locator('#board').boundingBox();
  await page.locator('#hint').click();
  const after=await page.locator('#board').boundingBox();
  expect(after.width).toBeCloseTo(before.width,1);
  expect(after.y).toBeCloseTo(before.y,1);
  await expect(page.locator('#keypad button').last()).toBeInViewport();
  await expect(page.locator('#feedback')).toBeInViewport();
  expect(await page.evaluate(()=>scrollY)).toBe(0);
});

test('Sudoku never celebrates a full row if a different cell still conflicts',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  const record=await sudokuRecord(page);

  let target=null;
  for(let row=0;row<6&&!target;row++){
    const missing=Array.from({length:6},(_,col)=>row*6+col)
      .filter(index=>record.puzzle[index]===0);
    if(missing.length<2)continue;
    for(let col=0;col<6;col++){
      const conflictIndex=Array.from({length:6},(_,other)=>other*6+col)
        .find(index=>Math.floor(index/6)!==row&&record.puzzle[index]===0);
      if(conflictIndex!==undefined){
        target={row,missing,conflictIndex,wrongDigit:record.solution[row*6+col]};
        break;
      }
    }
  }
  expect(target).not.toBeNull();

  await page.locator('.sudoku-cell').nth(target.conflictIndex).click();
  await page.locator('#keypad [data-digit="'+target.wrongDigit+'"]').click();
  for(const index of target.missing){
    await page.locator('.sudoku-cell').nth(index).click();
    await page.locator('#keypad [data-digit="'+record.solution[index]+'"]').click();
  }
  for(let col=0;col<6;col++){
    await expect(page.locator('.sudoku-cell').nth(target.row*6+col)).not.toHaveClass(/unit-complete/);
  }
  expect(await page.locator('.sudoku-cell.conflict').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#feedback')).toHaveClass(/error/);
  await expect(page.locator('#feedback')).toContainText(/błędna|konflikt|powtarza/i);
});

test('Sudoku does not disclose a locally legal wrong entry until the player requests a hint',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  const move=await page.evaluate(async()=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    const {candidates,hasConflict}=await import('/src/sudoku/engine.js');
    const record=await getDailyGame('sudoku','2026-10-15');
    for(let index=0;index<record.puzzle.length;index++){
      if(record.puzzle[index])continue;
      const wrong=candidates(record.puzzle,index).find(n=>n!==record.solution[index]);
      if(wrong!==undefined){
        const board=record.puzzle.slice();board[index]=wrong;
        if(!hasConflict(board,index))return {index,wrong};
      }
    }
    return null;
  });
  expect(move,'daily puzzle must include a plausible but incorrect candidate').not.toBeNull();

  const cell=page.locator('.sudoku-cell').nth(move.index);
  await cell.click();
  await page.locator('#keypad [data-digit="'+move.wrong+'"]').click();
  await expect(cell).not.toHaveClass(/mistake|hint-error|conflict/);
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
  await expect(page.locator('#feedback')).not.toContainText(/błędn|czerwon/);

  await page.reload();
  await expect(page.locator('.sudoku-cell').nth(move.index)).toHaveText(String(move.wrong));
  await expect(page.locator('.sudoku-cell').nth(move.index)).not.toHaveClass(/mistake|hint-error|conflict/);

  // Clicking "Podpowiedź" is an explicit request to check the puzzle.
  await page.locator('#hint').click();
  await expect(page.locator('.sudoku-cell').nth(move.index)).toHaveClass(/hinted/);
  await expect(page.locator('.sudoku-cell').nth(move.index)).toHaveClass(/hint-error/);
  await expect(page.locator('#feedback')).toContainText(/błędna/i);

  // The hint is temporary: ordinary gameplay returns to a neutral grid.
  await page.locator('.sudoku-cell').nth(move.index).click();
  await page.locator('#erase').click();
  await expect(page.locator('.sudoku-cell').nth(move.index)).not.toHaveClass(/hint-error/);
});

test('Six entered copies of a digit are not automatically marked solved',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  // The keypad is for entry, not an answer-key indicator.
  await expect(page.locator('#keypad .complete-digit')).toHaveCount(0);
  const record=await sudokuRecord(page);
  const editable=record.puzzle.map((value,index)=>value?null:index).filter(index=>index!==null);
  for(const index of editable.slice(0,4)){
    await page.locator('.sudoku-cell').nth(index).click();
    await page.locator('#keypad [data-digit="6"]').click();
  }
  await expect(page.locator('#keypad .complete-digit')).toHaveCount(0);
});
