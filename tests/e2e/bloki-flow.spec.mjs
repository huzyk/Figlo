import {test,expect} from '@playwright/test';
import {dailyPuzzleSeed} from '../../src/daily.js';
import {generateBloki} from '../../src/bloki/generator.js';
import {solve} from '../../src/bloki/solver.js';

const DATE='2026-08-25';
const STORAGE_KEY='figlo_user_state_v2';

async function fresh(page){await page.goto(`/bloki.html?date=${DATE}`);await page.evaluate(()=>localStorage.clear());await page.reload();}

function dailySolution(){
  const puzzle=generateBloki({seed:dailyPuzzleSeed('bloki',DATE),rows:6,cols:6,difficulty:'medium'});
  const solution=solve(puzzle,{limit:1})[0];
  if(!solution)throw new Error('Missing Bloki daily solution in E2E');
  return solution;
}

async function dragRect(page,rect){
  const start=page.locator(`.bloki-cell[data-row="${rect.row}"][data-col="${rect.col}"]`);
  const end=page.locator(`.bloki-cell[data-row="${rect.row+rect.height-1}"][data-col="${rect.col+rect.width-1}"]`);
  const a=await start.boundingBox();
  const b=await end.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});
  await page.mouse.up();
}

async function solveDaily(page){
  for(const placement of dailySolution())await dragRect(page,placement.rect);
  await expect(page.locator('#done')).toBeVisible();
}

test('Bloki daily renders a 6x6 board',async({page})=>{
  await fresh(page);
  await expect(page.locator('#board .bloki-cell')).toHaveCount(36);
  await expect(page.locator('#loadError')).toBeHidden();
  await expect(page.locator('.clue-cell').first()).toBeVisible();
});

test('Bloki hint highlights one target without auto-solving',async({page},info)=>{
  await fresh(page);
  const hint=info.project.name==='mobile-chromium'?page.locator('#mobileHint'):page.locator('#hint');
  await hint.click();
  await expect(page.locator('.block-placement.hint-highlight')).toHaveCount(1);
  await expect(page.locator('#done')).toBeHidden();
});

test('Bloki completion joins daily progress',async({page})=>{
  await fresh(page);
  await solveDaily(page);
  await page.goto(`/index.html?date=${DATE}`);
  await expect(page.locator('#progressRing')).toHaveText('1/3');
  await expect(page.locator('#blokiStatus')).toContainText(/ponownie/i);
});

test('Bloki freeplay renders 36 cells and does not increment Daily counters',async({page})=>{
  await fresh(page);
  await solveDaily(page);
  const first=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);
  await page.locator('#replay').click();
  await expect(page.locator('#roundLabel')).toContainText(/Freeplay/i);
  await expect(page.locator('#board .bloki-cell')).toHaveCount(36);
  await expect(page.locator('#done')).toBeHidden();
  const second=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);
  expect(second.user.completedGames).toBe(first.user.completedGames);
  expect(second.games.bloki.completedCount).toBe(first.games.bloki.completedCount);
});

test('Bloki board fits mobile and desktop viewport',async({page})=>{
  await fresh(page);
  const box=await page.locator('#board').boundingBox();
  const viewport=page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
});
