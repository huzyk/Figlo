import {test, expect} from '@playwright/test';

const DATE='2026-10-20';
async function fresh(page, url='/memory.html?date='+DATE) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#board .memory-card')).toHaveCount(16);
}
async function findPairs(page) {
  return page.locator('#board .memory-card').evaluateAll(cards => {
    const symbols=new Map();
    cards.forEach((card,index)=>{
      const svg=card.querySelector('.card-front').innerHTML;
      if(!symbols.has(svg))symbols.set(svg,[]);
      symbols.get(svg).push(index);
    });
    return [...symbols.values()];
  });
}
async function solve(page) {
  const pairs=await findPairs(page);
  await page.locator('#readyButton').click();
  for(let i=0;i<8;i++){
    for(const index of pairs[i])await page.locator('.memory-card').nth(index).click();
    await expect(page.locator('#board .is-matched')).toHaveCount(2*(i+1));
    if(i<7)await expect(page.locator('.memory-card:not(.is-matched)').first()).toBeEnabled();
  }
  await expect(page.locator('#done')).toBeVisible();
}

test('Memory Daily shows a fixed board and player initiates the challenge',async({page})=>{
  await fresh(page);
  await expect(page.locator('#roundLabel')).toHaveText('Dzisiaj');
  await expect(page.locator('#packName')).toHaveText('Odkrycia');
  await expect(page.locator('#board .is-faceup')).toHaveCount(16);
  await expect(findPairs(page)).resolves.toHaveLength(8);
  await page.locator('#readyButton').click();
  await expect(page.locator('#board .is-faceup')).toHaveCount(0);
  await expect(page.locator('#hintButton')).toBeVisible();
  await expect(page.locator('#readyButton')).toBeHidden();
  await expect(page.locator('#stageLabel')).toHaveText('02 / ODKRYWAJ');
});

test('Memory found pair and replay stage survive reload',async({page})=>{
  await fresh(page);
  const pairs=await findPairs(page);
  await page.locator('#readyButton').click();
  for(const index of pairs[0])await page.locator('.memory-card').nth(index).click();
  await expect(page.locator('#pairsCount')).toHaveText('1 / 8');
  await page.reload();
  await expect(page.locator('#pairsCount')).toHaveText('1 / 8');
  await expect(page.locator('#board .is-matched')).toHaveCount(2);
  await expect(page.locator('#roundLabel')).toHaveText('Dzisiaj');
});

test('Memory Daily awards completion, points and progress exactly once; replay is Training',async({page})=>{
  await fresh(page);
  await solve(page);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('figlo_user_state_v2')));
  expect(stored.days[DATE].completedGames).toContain('memory');
  expect(stored.puzzleResults['memory:'+DATE+':v1'].gameId).toBe('memory');
  expect(stored.rewards.daily[DATE].games.memory.base).toBe(10);
  expect(stored.rewards.daily[DATE].games.memory.clean).toBe(5);
  expect(stored.games.memory.completedCount).toBe(1);
  await expect(page.locator('#completionRewardSummary')).toContainText('PUNKTY ZA GRĘ');
  await page.goto('/index.html?date='+DATE);
  await expect(page.locator('#progressRing')).toHaveText('1/6');
  await expect(page.locator('#memoryCard')).toContainText('Zagraj ponownie');
  await page.locator('#memoryCard').click();
  await expect(page.locator('#roundLabel')).toHaveText('Trening');
  await expect(page.locator('#done')).toBeHidden();
  await solve(page);
  const again=await page.evaluate(()=>JSON.parse(localStorage.getItem('figlo_user_state_v2')));
  expect(again.user.completedGames).toBe(1);
  expect(again.rewards.daily[DATE].games.memory.points).toBe(stored.rewards.daily[DATE].games.memory.points);
});

test('Optional memory refresh counts as hint; no error count is displayed',async({page})=>{
  await fresh(page);
  await page.locator('#readyButton').click();
  await page.locator('#hintButton').click();
  await expect(page.locator('#board .is-faceup')).toHaveCount(16);
  await expect(page.locator('#hintButton')).toBeDisabled();
  await expect(page.locator('#board .is-faceup')).toHaveCount(0,{timeout:5000});
  await solveHinted(page);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('figlo_user_state_v2')));
  expect(stored.rewards.daily[DATE].games.memory.clean).toBe(0);
  expect(stored.rewards.daily[DATE].games.memory.hintsUsed).toBe(1);
});
async function solveHinted(page){
  const pairs=await findPairs(page);
  for(const pair of pairs){
    for(const index of pair)await page.locator('.memory-card').nth(index).click();
    await expect(page.locator('#board .is-matched')).toHaveCount((pairs.indexOf(pair)+1)*2);
    if(pairs.indexOf(pair)<7)await expect(page.locator('.memory-card:not(.is-matched)').first()).toBeEnabled();
  }
  await expect(page.locator('#done')).toBeVisible();
}

test('Challenge uses matching Daily deck and does not award points',async({page})=>{
  await fresh(page);
  const baseline=await findPairs(page);
  await page.goto('/memory.html?challenge='+DATE+'&v=memory:'+DATE+':v1');
  await expect(page.locator('#roundLabel')).toHaveText('Wyzwanie');
  expect(await findPairs(page)).toEqual(baseline);
  await solve(page);
  expect(await page.evaluate(()=>localStorage.getItem('figlo_user_state_v2'))).toBeNull();
});

test('Untrusted and historical challenge links are rejected',async({page})=>{
  await page.goto('/memory.html?challenge='+DATE+'&v=fake');
  await expect(page.locator('#loadError')).toContainText('wersja');
  await expect(page.locator('#readyButton')).toBeDisabled();
  await page.goto('/memory.html?challenge=2026-10-15&v=memory:2026-10-15:v1');
  await expect(page.locator('#loadError')).toContainText('od 2026-10-20');
});

test('Training cycles four packs, without changing Daily',async({page})=>{
  await fresh(page);
  const packs=['Ziemia i kosmos','Umysł i logika','Natura jako wzór','Odkrycia'];
  for(const name of packs){
    await page.locator('#newButton').click();
    await expect(page.locator('#packName')).toHaveText(name);
    await expect(page.locator('#roundLabel')).toHaveText('Trening');
    await page.reload();
    await expect(page.locator('#packName')).toHaveText(name);
    expect(await findPairs(page)).toHaveLength(8);
  }
  expect(await page.evaluate(()=>localStorage.getItem('figlo_user_state_v2'))).toBeNull();
});

test('Memory board fits phone and desktop widths',async({page})=>{
  await fresh(page);
  const board=await page.locator('#board').boundingBox(),viewport=page.viewportSize();
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.x+board.width).toBeLessThanOrEqual(viewport.width+1);
  expect(Math.abs(board.width-board.height)).toBeLessThan(1);
});
