import {test,expect} from '@playwright/test';
const DATE='2026-08-25';
async function fresh(page){await page.goto(`/bloki.html?date=${DATE}`);await page.evaluate(()=>localStorage.clear());await page.reload();}

test('Bloki daily renders a 6x6 board',async({page})=>{
  await fresh(page);
  await expect(page.locator('#board .bloki-cell')).toHaveCount(36);
  await expect(page.locator('#loadError')).toBeHidden();
  await expect(page.locator('.clue-cell').first()).toBeVisible();
});

test('Bloki hint highlights a correct block without placing it',async({page},info)=>{
  await fresh(page);
  const hint=info.project.name==='mobile-chromium'?page.locator('#mobileHint'):page.locator('#hint');
  await hint.click();
  await expect(page.locator('.block-placement.hint-highlight')).toHaveCount(1);
  const placements=await page.evaluate(date=>{
    const raw=JSON.parse(localStorage.getItem(`figlo-bloki-session-v1:${date}`)||'null');
    return raw?.placements||[];
  },DATE);
  expect(placements).toHaveLength(0);
});

test('Bloki freeplay loads a fresh board after Daily',async({page})=>{
  await fresh(page);
  await page.evaluate(async date=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    const record=await getDailyGame('bloki',date);
    localStorage.setItem(`figlo-bloki-session-v1:${date}`,JSON.stringify({
      date,
      seed:record.puzzleId,
      placements:[],
      history:[],
      elapsedMs:1000,
      runningSince:null,
      startedAt:new Date().toISOString(),
      finished:true,
      hintsUsed:0
    }));
  },DATE);
  await page.reload();
  await expect(page.locator('#done')).toBeVisible();
  await page.locator('#replay').click();
  await expect(page.locator('#roundLabel')).toContainText('Freeplay',{timeout:10000});
  await expect(page.locator('#board .bloki-cell')).toHaveCount(36);
  await expect(page.locator('#done')).toBeHidden();
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
