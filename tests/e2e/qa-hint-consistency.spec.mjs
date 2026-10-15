import {test,expect} from '@playwright/test';

const DATE='2026-10-15';
const stateOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('figlo_user_state_v2')));
async function load(page,game){
  await page.goto('/'+game+'.html?date='+DATE);
  await expect(page.locator('#gameLoader')).toBeHidden({timeout:30000});
}
function hintButton(page,info){
  return page.locator(info.project.name==='mobile-chromium'?'#mobileHint':'#hint');
}

test('Sudoku does not celebrate locally legal but incorrect row',async({page})=>{
  await load(page,'sudoku');
  const record=await page.evaluate(async()=>(
    await import('/src/services/daily-service.js')).getDailyGame('sudoku','2026-10-15'));
  const row=0,blanks=[0,2,3];
  expect(blanks.every(index=>record.puzzle[index]===0)).toBe(true);
  const numbers=record.solution.slice();
  [numbers[0],numbers[2]]=[numbers[2],numbers[0]];
  for(const index of blanks){
    await page.locator('.sudoku-cell').nth(index).click();
    await page.locator('#keypad [data-digit="'+numbers[index]+'"]').click();
  }
  await expect(page.locator('.sudoku-cell.unit-complete')).toHaveCount(0);
  await expect(page.locator('#feedback')).not.toContainText(/uzupełniono wiersz/i);
});

test('Duet explains its hint context and clears it after a move',async({page},info)=>{
  await load(page,'duet');
  await hintButton(page,info).click();
  await expect(page.locator('.duet-cell.hint')).toHaveCount(1);
  await expect(page.locator('.duet-cell.hint-source')).not.toHaveCount(0);
  await page.locator('.duet-cell:not(.given)').first().click();
  await expect(page.locator('.duet-cell.hint')).toHaveCount(0);
  await expect(page.locator('.duet-cell.hint-source')).toHaveCount(0);
  await expect(page.locator('#hintCard')).toBeHidden();
  await expect(page.locator('#feedback')).not.toHaveClass(/hint-feedback/);
});

test('Bloki correction consumes a hint and forfeits clean-game bonus',async({page},info)=>{
  await load(page,'bloki');
  await page.locator('.bloki-cell.clue-cell').first().click();
  await expect(page.locator('#filledCounter')).toHaveText('1/36');
  await hintButton(page,info).click();
  await expect(page.locator('#filledCounter')).toHaveText('0/36');
  await expect(page.locator('#feedback')).toContainText(/podpowiedzią|podpowiedź/i);
  let state=await stateOf(page);
  expect(state.rewards.hintCounts.bloki).toBe(1);
  await page.evaluate(async()=>{
    const {completeDailyGame}=await import('/src/storage.js');
    completeDailyGame('bloki',{today:'2026-10-15'});
  });
  state=await stateOf(page);
  expect(state.rewards.daily[DATE].games.bloki.points).toBe(100);
  expect(state.rewards.daily[DATE].games.bloki.hintsUsed).toBe(1);
});

test('Zip correction consumes a hint without changing the visual board',async({page},info)=>{
  await load(page,'zip');
  const wrongMove=await page.evaluate(async()=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    const {buildNeighbors}=await import('/src/zip/solver.js');
    const {applyPathCell}=await import('/src/zip/rules.js');
    const {puzzle,solution}=await getDailyGame('zip','2026-10-15');
    const neighbors=buildNeighbors(puzzle);
    for(let length=1;length<solution.length-1;length++){
      const prefix=solution.slice(0,length),last=prefix.at(-1);
      const alternative=neighbors[last].find(index=>
        index!==solution[length]&&!prefix.includes(index)&&
        applyPathCell(puzzle,prefix,index).ok);
      if(alternative!==undefined)return {prefix,alternative};
    }
    return null;
  });
  expect(wrongMove,'daily Zip puzzle should allow an incorrect legal step').not.toBeNull();
  for(const index of [...wrongMove.prefix,wrongMove.alternative]){
    await page.locator('.zip-cell').nth(index).click();
  }
  await expect(page.locator('#filledCounter')).toHaveText(
    String(wrongMove.prefix.length+1)+'/36');
  await hintButton(page,info).click();
  await expect(page.locator('#filledCounter')).toHaveText(
    String(wrongMove.prefix.length)+'/36');
  await expect(page.locator('#feedback')).toContainText(/podpowiedzią|podpowiedź/i);
  const state=await stateOf(page);
  expect(state.rewards.hintCounts.zip).toBe(1);
});
