import { test, expect } from '@playwright/test';

const DATE = '2026-10-15';
const games = [
  ['korony', 'crownsCard'],
  ['duet', 'duetCard'],
  ['bloki', 'blokiCard'],
  ['latarnie', 'latarnieCard'],
  ['zip', 'zipCard'],
  ['sudoku', 'sudokuCard']
];

test('PUZLI homepage lists the complete daily set and real destinations', async ({ page }) => {
  await page.goto('/index.html?date=' + DATE);
  await expect(page).toHaveTitle(/PUZLI/);
  await expect(page.locator('#progressRing')).toHaveText('0/6');
  await expect(page.locator('#gamesSummary')).toContainText('6 gier');
  for (const [game, id] of games) {
    const card = page.locator('#' + id);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', game + '.html');
  }
  await expect(page.locator('.game-card.coming-soon')).toHaveCount(0);
  await expect(page.locator('.newsletter')).toHaveCount(0);
});

test('all five game cards exist in HTML if homepage JavaScript fails', async ({ page }) => {
  await page.route('**/home.js', route => route.abort());
  await page.goto('/index.html?date=' + DATE);
  await expect(page.locator('.games > a.game-card')).toHaveCount(6);
  await expect(page.locator('#duetCard')).toHaveAttribute('href', 'duet.html');
});

test('mobile navigation can be opened and closed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/index.html?date=' + DATE);
  const menu = page.locator('.menu');
  const nav = page.locator('.nav-wrap nav');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Statystyki' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/#statystyki$/);
});

test('only the released games are exposed for historical dates', async ({ page }) => {
  await page.goto('/index.html?date=2026-08-24');
  await expect(page.locator('#progressRing')).toHaveText('0/2');
  await expect(page.locator('#crownsCard')).toBeVisible();
  await expect(page.locator('#duetCard')).toBeVisible();
  for (const id of ['blokiCard', 'latarnieCard', 'zipCard','sudokuCard']) {
    await expect(page.locator('#' + id)).toBeHidden();
  }
});
