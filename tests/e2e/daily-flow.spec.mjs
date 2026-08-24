import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'figlo_user_state_v2';
const DATE_A = '2026-08-24';
const DATE_B = '2026-08-25';
const DATE_GAP = '2026-08-26';

function seconds(value) {
  const [minutes, secs] = String(value).split(':').map(Number);
  return minutes * 60 + secs;
}

async function fresh(page, path = `/index.html?date=${DATE_A}`) {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function solveDaily(page) {
  const solution = await page.evaluate(() => window.__FIGLO_TEST__?.getSolution?.());
  expect(Array.isArray(solution)).toBe(true);
  expect(solution).toHaveLength(9);
  for (const index of solution) {
    const cell = page.locator('#board .cell').nth(index);
    await cell.click();
    await cell.click();
  }
  await expect(page.locator('#done')).toHaveClass(/show/);
}

test('fresh user sees incomplete daily set', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('#progressRing')).toHaveText('0/1');
  await expect(page.locator('#dailyStatusTitle')).toContainText('Korony');
  await expect(page.locator('#statStreak')).toHaveText('0');
});

test('move and undo history survive reload', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  const cells = page.locator('#board .cell');
  await cells.nth(0).click();
  await cells.nth(1).click();
  await page.reload();
  await expect(page.locator('#board .cell').nth(0)).toHaveAttribute('aria-label', /X/);
  await expect(page.locator('#board .cell').nth(1)).toHaveAttribute('aria-label', /X/);
  await page.locator('#undo').click();
  await expect(page.locator('#board .cell').nth(0)).toHaveAttribute('aria-label', /X/);
  await expect(page.locator('#board .cell').nth(1)).toHaveAttribute('aria-label', /puste/);
});

test('Auto-X persists after reload', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  await page.locator('#autoX').check();
  await page.reload();
  await expect(page.locator('#autoX')).toBeChecked();
});

test('timer does not reset after reload', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  await page.locator('#board .cell').nth(0).click();
  await page.waitForTimeout(1200);
  const before = await page.locator('#timer').textContent();
  await page.reload();
  const after = await page.locator('#timer').textContent();
  expect(after).not.toBe('00:00');
  expect(seconds(after)).toBeGreaterThanOrEqual(Math.max(1, seconds(before) - 1));
});

test('solving daily updates homepage and replay does not increment counters', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  await solveDaily(page);
  const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(first.user.streak).toBe(1);
  expect(first.user.completedDays).toBe(1);
  expect(first.user.completedGames).toBe(1);

  await page.goto(`/index.html?date=${DATE_A}`);
  await expect(page.locator('#progressRing')).toHaveText('1/1');
  await expect(page.locator('#statStreak')).toHaveText('1');
  await expect(page.locator('#crownsStatus')).toContainText(/ponownie/i);

  await page.goto(`/korony.html?date=${DATE_A}`);
  await solveDaily(page);
  const second = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(second.user.streak).toBe(first.user.streak);
  expect(second.user.completedDays).toBe(first.user.completedDays);
  expect(second.user.completedGames).toBe(first.user.completedGames);
  expect(second.games.korony.completedCount).toBe(first.games.korony.completedCount);
});

test('next consecutive day extends streak', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  await solveDaily(page);
  await page.goto(`/index.html?date=${DATE_B}`);
  await expect(page.locator('#progressRing')).toHaveText('0/1');
  await page.goto(`/korony.html?date=${DATE_B}`);
  await solveDaily(page);
  await page.goto(`/index.html?date=${DATE_B}`);
  await expect(page.locator('#statStreak')).toHaveText('2');
});

test('missing a day resets streak', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  await solveDaily(page);
  await page.goto(`/korony.html?date=${DATE_GAP}`);
  await solveDaily(page);
  await page.goto(`/index.html?date=${DATE_GAP}`);
  await expect(page.locator('#statStreak')).toHaveText('1');
});

test('corrupted localStorage falls back instead of crashing', async ({ page }) => {
  await page.goto(`/index.html?date=${DATE_A}`);
  await page.evaluate(key => localStorage.setItem(key, '{broken-json'), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#progressRing')).toHaveText('0/1');
});

test('keyboard operates board and keeps focus navigation', async ({ page }) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  const first = page.locator('#board .cell').nth(0);
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#board .cell').nth(0)).toHaveAttribute('aria-label', /X/);
  await page.keyboard.press('ArrowRight');
  const focusedIndex = await page.evaluate(() => document.activeElement?.dataset?.index);
  expect(focusedIndex).toBe('1');
});

test('game board stays inside viewport and correct controls are exposed', async ({ page }, testInfo) => {
  await fresh(page, `/korony.html?date=${DATE_A}`);
  const box = await page.locator('#board').boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('.mobile-controls')).toBeVisible();
  } else {
    await expect(page.locator('.controls')).toBeVisible();
  }
});
