import { test, expect } from '@playwright/test';

test('previously published Crown v2 challenge still opens',async({page})=>{
 const date='2026-10-16',id=`figlo:korony:${date}:v2`;
 await page.goto(`/korony.html?date=${date}&challenge=${date}&v=${encodeURIComponent(id)}`);
 await expect(page.locator('#board .cell')).toHaveCount(81);
 await expect(page.locator('html')).toHaveAttribute('data-game-puzzle-id',id);
});

test('new daily Korony board has no placed starting pieces',async({page})=>{
 await page.goto('/korony.html?date=2026-10-16');
 await expect(page.locator('#board .cell')).toHaveCount(81);
 await expect(page.locator('#board .crown, #board .x-mark')).toHaveCount(0);
 await expect(page.locator('#crownCounter')).toHaveText('0/9');
 await expect(page.locator('html')).toHaveAttribute('data-game-puzzle-id','figlo:korony:2026-10-16:v3');
});

const TODAY = '2026-10-15';
const DATE = '2026-08-28';
const STORAGE_KEY = 'figlo_user_state_v2';

for (const [game, puzzleId, cells] of [
  ['korony', `figlo:korony:${DATE}:v1`, '.cell'],
  ['duet', `duet:${DATE}:v4`, '.duet-cell'],
  ['zip', `zip:${DATE}:v2`, '.zip-cell']
]) {
  test(`${game}: a versioned public challenge loads outside the daily round`, async ({ page }) => {
    await page.goto(`/${game}.html?date=${TODAY}&challenge=${DATE}&v=${encodeURIComponent(puzzleId)}`);
    await expect(page.locator('#board ' + cells).first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-mode', 'challenge');
    await expect(page.locator('html')).toHaveAttribute('data-game-date', DATE);
    await expect(page.locator('html')).toHaveAttribute('data-game-puzzle-id', puzzleId);
    await expect(page.locator('#roundLabel')).toContainText('Wyzwanie');
    await expect(page.locator('#done')).toBeHidden();
  });

  test(`${game}: missing or outdated challenge version shows an error without a replacement board`, async ({ page }) => {
    for (const version of ['', '&v=outdated']) {
      await page.goto(`/${game}.html?date=${TODAY}&challenge=${DATE}${version}`);
      await expect(page.locator('#board ' + cells)).toHaveCount(0);
      await expect(page.locator('[role="alert"]')).toContainText(/wersji|wersja/);
      await expect(page.locator('#done')).toBeHidden();
    }
  });
}

test('Duet challenge completion preserves daily progress and an unfinished daily session', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/duet.html?date=${TODAY}`);
  await expect(page.locator('#board .duet-cell').first()).toBeVisible();
  await page.locator('#board .duet-cell:not(.given)').first().click();
  const challenge = await page.evaluate(async date => (await fetch(`/data/duet/${date}.json`)).json(), DATE);
  await page.goto(`/duet.html?date=${TODAY}&challenge=${DATE}&v=${encodeURIComponent(challenge.puzzleId)}`);
  await expect(page.locator('#roundLabel')).toContainText('Wyzwanie');
  await expect(page.locator('#board .duet-cell')).toHaveCount(36);
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(before.sessions.duet.date).toBe(TODAY);
  const given = new Set(challenge.puzzle.givens.map(item => item.index));
  for (let index = 0; index < 36; index++) {
    if (given.has(index)) continue;
    const cell = page.locator('#board .duet-cell').nth(index);
    await cell.click();
    if (challenge.solution[index] === 2) await cell.click();
  }
  await expect(page.locator('#done')).toBeVisible();
  await expect(page.locator('#doneCopy')).toContainText('Wyzwanie');
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(after.daily).toEqual(before.daily);
  expect(after.sessions.duet).toEqual(before.sessions.duet);
  expect(after.games.duet).toEqual(before.games.duet);
  expect(after.user).toEqual(before.user);
  expect(errors).toEqual([]);
});

test('Zip hint stays counted after reset and reload and reaches the completion record', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.goto(`/zip.html?date=${TODAY}`);
  await expect(page.locator('#board .zip-cell').first()).toBeVisible();
  const mobile = info.project.name === 'mobile-chromium';
  await page.locator(mobile ? '#mobileHint' : '#hint').click();
  await page.locator(mobile ? '#mobileReset' : '#reset').click();
  await page.reload();
  await expect(page.locator('#board .zip-cell').first()).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('figlo_zip_session_v1')));
  expect(session.hintsUsed).toBe(1);
  expect(session.resets).toBe(1);
  const solution = await page.evaluate(() => window.__ZIP_TEST__.getSolution());
  for (const index of solution) await page.locator('#board .zip-cell').nth(index).click();
  await expect(page.locator('#done')).toBeVisible();
  const result = await page.evaluate(({ key, date }) => JSON.parse(localStorage.getItem(key)).puzzleResults[`zip:${date}:v2`], { key: STORAGE_KEY, date: TODAY });
  expect(result.hintsUsed).toBe(1);
  expect(result.resets).toBe(1);
  expect(result.attemptNo).toBe(2);
});
