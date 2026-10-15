import {test,expect} from '@playwright/test';

const DATE='2026-10-15',CHALLENGE_DATE='2026-10-14';
const games=[
  {id:'bloki',cells:'.bloki-cell',session:'figlo-bloki-session-v1:'},
  {id:'latarnie',cells:'.latarnia-cell',session:'figlo-latarnie-session-v1:'},
  {id:'sudoku',cells:'.sudoku-cell',session:'puzli_sudoku_session_v2:'}
];
async function ready(page,game){
  await expect(page.locator(game.cells).first()).toBeVisible({timeout:30000});
  await expect(page.locator('#loadError')).toBeHidden();
}
async function visibleControl(page,desktop,mobile){
  const control=page.locator(desktop);
  return await control.isVisible()?control:page.locator(mobile);
}
async function state(page){
  return page.evaluate(async()=>{
    const {loadFigloState}=await import('/src/storage.js');
    return loadFigloState('2026-10-15');
  });
}
async function solveChallenge(page,game,record){
  if(game.id==='latarnie'){
    for(const index of record.solution)await page.locator(`.latarnia-cell[data-index="${index}"]`).click();
  }else if(game.id==='sudoku'){
    for(const [index,digit] of record.solution.entries()){
      if(record.puzzle[index])continue;
      await page.locator('.sudoku-cell').nth(index).click();
      await page.locator(`#keypad [data-digit="${digit}"]`).click();
    }
  }else{
    for(const {rect} of record.solution){
      const start=page.locator(`.bloki-cell[data-row="${rect.row}"][data-col="${rect.col}"]`);
      const end=page.locator(`.bloki-cell[data-row="${rect.row+rect.height-1}"][data-col="${rect.col+rect.width-1}"]`);
      const a=await start.boundingBox(),b=await end.boundingBox();
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});await page.mouse.up();
    }
  }
}

for(const game of games){
  test(`${game.id}: an archived challenge opens after today's completion and preserves daily progress`,async({page})=>{
    test.setTimeout(60000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`/index.html?date=${DATE}`);
    const record=await page.evaluate(async({game,date,challengeDate})=>{
      const {getDailyGame}=await import('/src/services/daily-service.js');
      const {completeGame}=await import('/src/services/progress-service.js');
      const daily=await getDailyGame(game,date);
      completeGame({gameId:game,puzzleId:daily.puzzleId,date,elapsedMs:15000,hintsUsed:0,resets:0,attemptNo:1});
      return getDailyGame(game,challengeDate);
    },{game:game.id,date:DATE,challengeDate:CHALLENGE_DATE});
    const before=await state(page);
    await page.goto(`/${game.id}.html?date=${DATE}&challenge=${CHALLENGE_DATE}&v=${encodeURIComponent(record.puzzleId)}`);
    await ready(page,game);
    await expect(page.locator('html')).toHaveAttribute('data-game-mode','challenge');
    await expect(page.locator('#roundLabel')).toHaveText(`Wyzwanie · ${CHALLENGE_DATE}`);
    await (await visibleControl(page,'#hint','#mobileHint')).click();
    await solveChallenge(page,game,record);
    await expect(page.locator('#done')).toBeVisible();
    const after=await state(page);
    expect(after.daily).toEqual(before.daily);
    expect(after.games).toEqual(before.games);
    expect(await page.evaluate(key=>localStorage.getItem(key),game.session+CHALLENGE_DATE)).toBeNull();
    expect(errors).toEqual([]);
  });

  test(`${game.id}: resetting and refreshing preserves the day's hint and attempt counts`,async({page})=>{
    await page.goto(`/${game.id}.html?date=${DATE}`);
    await ready(page,game);
    await (await visibleControl(page,'#hint','#mobileHint')).click();
    const key=game.session+DATE;
    const hints=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).hintsUsed,key);
    expect(hints).toBeGreaterThan(0);
    // Sudoku keeps its reset action inside the mobile help panel.
    if(game.id==='sudoku' && !(await page.locator('#reset').isVisible())){
      await page.locator('#rulesTop').click();
    }
    await (await visibleControl(page,'#reset','#mobileReset')).click();
    await page.reload();await ready(page,game);
    const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    expect(restored.hintsUsed).toBe(hints);
    expect(restored.resets).toBe(1);
  });

  test(`${game.id}: a different puzzle version shows an explicit error`,async({page})=>{
    await page.goto(`/${game.id}.html?date=${DATE}&challenge=${CHALLENGE_DATE}&v=unavailable`);
    await expect(page.locator('#loadError')).toBeVisible({timeout:30000});
    await expect(page.locator('#loadError')).toContainText('wersja wyzwania');
    await expect(page.locator('#board')).toBeEmpty();
    await expect(page.locator('#board')).toHaveAttribute('aria-disabled','true');
  });
}

test('Bloki: revealing an incorrect placement counts as assistance',async({page})=>{
  await page.goto(`/bloki.html?date=${DATE}`);
  await ready(page,games[0]);
  const clue=await page.evaluate(async date=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    const record=await getDailyGame('bloki',date);
    const target=record.solution.find(({rect})=>rect.width*rect.height>1);
    return record.puzzle.clues.find(clue=>clue.id===target.clueId);
  },DATE);
  await page.locator(`.bloki-cell[data-row="${clue.row}"][data-col="${clue.col}"]`).click();
  await expect(page.locator('.block-placement:not(.preview)')).toHaveCount(1);
  await (await visibleControl(page,'#hint','#mobileHint')).click();
  await expect(page.locator('.block-placement:not(.preview)')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('liczona jako podpowiedź');
  const hints=await page.evaluate(()=>JSON.parse(localStorage.getItem('figlo-bloki-session-v1:2026-10-15')).hintsUsed);
  expect(hints).toBe(1);
  expect((await state(page)).rewards.hintCounts.bloki).toBe(1);
});
