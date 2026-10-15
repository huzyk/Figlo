import { test, expect } from '@playwright/test';

const DATE = '2026-10-15';
const games = ['korony', 'duet', 'bloki', 'latarnie', 'zip', 'sudoku'];
async function recordFor(page, game) {
  return page.evaluate(async ({ game, date }) => {
    const { getDailyGame } = await import('/src/services/daily-service.js');
    return getDailyGame(game, date);
  }, { game, date: DATE });
}
async function dragRect(page, rect) {
  const start = page.locator(`.bloki-cell[data-row="${rect.row}"][data-col="${rect.col}"]`);
  const end = page.locator(`.bloki-cell[data-row="${rect.row + rect.height - 1}"][data-col="${rect.col + rect.width - 1}"]`);
  await start.scrollIntoViewIfNeeded();
  const a = await start.boundingBox(), b = await end.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
}

test('all six games complete one day, training preserves totals, next day resets progress', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/index.html?date=${DATE}`);
  await expect(page.locator('#progressRing')).toHaveText('0/6');
  for (const [index, game] of games.entries()) {
    await page.goto(`/${game}.html?date=${DATE}`);
    await expect(page.locator('#gameLoader')).toBeHidden({ timeout: 30000 });
    if (game === 'korony') {
      await page.waitForFunction(() => window.__FIGLO_TEST__?.getSolution?.()?.length === 9);
      for (const cell of await page.evaluate(() => window.__FIGLO_TEST__.getSolution())) {
        await page.locator('#board .cell').nth(cell).click();
        await page.locator('#board .cell').nth(cell).click();
      }
    } else {
      const record = await recordFor(page, game);
      if (game === 'duet') {
        const given = new Set(record.puzzle.givens.map(g => g.index));
        for (const [cell, value] of record.solution.entries()) {
          if (given.has(cell)) continue;
          await page.locator('.duet-cell').nth(cell).click();
          if (value === 2) await page.locator('.duet-cell').nth(cell).click();
        }
      } else if (game === 'bloki') {
        for (const placement of record.solution) await dragRect(page, placement.rect);
      } else if (game === 'latarnie') {
        for (const cell of record.solution) await page.locator(`.latarnia-cell[data-index="${cell}"]`).click();
      } else if (game === 'zip') {
        for (const cell of record.solution) await page.locator('.zip-cell').nth(cell).click();
      } else if (game === 'sudoku') {
        for (const [index,digit] of record.solution.entries()) {
          if (record.puzzle[index]!==0) continue;
          await page.locator('.sudoku-cell').nth(index).click();
          await page.locator('.sudoku-keypad [data-digit="'+digit+'"]').click();
        }
      }
    }
    await expect(page.locator('#done')).toBeVisible();
    await page.goto(`/index.html?date=${DATE}`);
    await expect(page.locator('#progressRing')).toHaveText(`${index + 1}/6`);
    await expect(page.locator('#statStreak')).toHaveText('1'); // activity streak starts after first solved game
  }
  await expect(page.locator('#totalCompleted')).toHaveText('6');
  for (const game of games) {
    await page.goto(`/${game}.html?date=${DATE}`);
    await expect(page.locator('#roundLabel')).toContainText('Trening', { timeout: 30000 });
    await expect(page.locator('#done')).toBeHidden();
  }
  await page.goto('/index.html?date=2026-10-16');
  await expect(page.locator('#progressRing')).toHaveText('0/6');
  await expect(page.locator('#totalCompleted')).toHaveText('6');
  await expect(page.locator('#statStreak')).toHaveText('1');
  expect(errors).toEqual([]);
});
