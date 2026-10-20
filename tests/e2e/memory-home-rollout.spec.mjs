import {test,expect} from '@playwright/test';

test('new dates expose Memory instead of Latarnie with six daily tiles',async({page})=>{
  await page.goto('/index.html?date=2026-10-20');
  await expect(page.locator('#progressRing')).toHaveText('0/6');
  await expect(page.locator('.game-card:visible')).toHaveCount(6);
  await expect(page.locator('#memoryCard')).toBeVisible();
  await expect(page.locator('#memoryCard')).toContainText('Memory');
  await expect(page.locator('#memoryCard')).toHaveAttribute('href','memory.html');
  await expect(page.locator('#latarnieCard')).toHaveCount(0);
  await page.locator('#memoryCard').click();
  await expect(page).toHaveURL(/memory\.html/);
  await expect(page.locator('#board .memory-card')).toHaveCount(16);
});

test('historical days retain Latarnie and the exact six-game daily requirement',async({page})=>{
  await page.goto('/index.html?date=2026-10-19');
  await expect(page.locator('#latarnieCard')).toBeVisible();
  await expect(page.locator('#latarnieCard')).toHaveAttribute('href','latarnie.html');
  await expect(page.locator('#memoryCard')).toHaveCount(0);
  await expect(page.locator('.game-card:visible')).toHaveCount(6);
});
