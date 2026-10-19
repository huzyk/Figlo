import {test, expect} from '@playwright/test';

async function fresh(page) {
  await page.goto('/memory.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#board .memory-card')).toHaveCount(16);
}

async function findPairs(page) {
  return page.locator('#board .memory-card').evaluateAll(cards => {
    const bySymbol = new Map();
    cards.forEach((card, index) => {
      const markup = card.querySelector('.card-front').innerHTML;
      if (!bySymbol.has(markup)) bySymbol.set(markup, []);
      bySymbol.get(markup).push(index);
    });
    return [...bySymbol.values()];
  });
}

test('Memory study phase shows 16 cards and voluntarily starts play', async ({page}) => {
  await fresh(page);
  await expect(page.locator('#board .is-faceup')).toHaveCount(16);
  await expect(page.locator('#readyButton')).toBeVisible();
  const pairs = await findPairs(page);
  expect(pairs).toHaveLength(8);
  for (const pair of pairs) expect(pair).toHaveLength(2);
  await page.locator('#readyButton').click();
  await expect(page.locator('#board .is-faceup')).toHaveCount(0);
  await expect(page.locator('#readyButton')).toBeHidden();
  await expect(page.locator('#stageLabel')).toHaveText('02 / ODKRYWAJ');
});

test('Matching pair stays revealed across refresh; no PUZLI Daily data is changed', async ({page}) => {
  await fresh(page);
  const pairs = await findPairs(page);
  await page.locator('#readyButton').click();
  for (const index of pairs[0]) await page.locator('#board .memory-card').nth(index).click();
  await expect(page.locator('#pairsCount')).toHaveText('1 / 8');
  await expect(page.locator('#board .is-matched')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#board .is-matched')).toHaveCount(2);
  await expect(page.locator('#pairsCount')).toHaveText('1 / 8');
  expect(await page.evaluate(() => localStorage.getItem('figlo_user_state_v2'))).toBeNull();
});

test('Eight pairs complete Memory and training can restart', async ({page}) => {
  await fresh(page);
  const pairs = await findPairs(page);
  await page.locator('#readyButton').click();
  for (let i = 0; i < pairs.length; i++) {
    for (const index of pairs[i]) await page.locator('#board .memory-card').nth(index).click();
    await expect(page.locator('#board .is-matched')).toHaveCount((i + 1) * 2);
    if (i < pairs.length - 1) await expect(page.locator('#board .memory-card:not(.is-matched)').first()).toBeEnabled();
  }
  await expect(page.locator('#finish')).toBeVisible();
  await expect(page.locator('#finishReveals')).toHaveText('16');
  await page.locator('#againButton').click();
  await expect(page).toHaveURL(/try=1/);
  await expect(page.locator('#finish')).toBeHidden();
  await expect(page.locator('#board .is-faceup')).toHaveCount(16);
  await expect(page.locator('#pairsCount')).toHaveText('0 / 8');
});

test('Board stays square and fits narrow phone', async ({page}) => {
  await fresh(page);
  const board = await page.locator('#board').boundingBox();
  const viewport = page.viewportSize();
  expect(board).not.toBeNull();
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.x + board.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(Math.abs(board.width - board.height)).toBeLessThan(1);
  const card = await page.locator('#board .memory-card').first().boundingBox();
  expect(Math.abs(card.width - card.height)).toBeLessThan(1);
});
