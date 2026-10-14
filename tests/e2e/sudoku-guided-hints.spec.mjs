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
