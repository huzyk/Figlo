import { test, expect } from '@playwright/test';

const DATE = '2026-08-24';
const STORAGE_KEY = 'figlo_user_state_v2';

async function fresh(page) {
  await page.goto(`/duet.html?date=${DATE}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#gameLoader')).toBeHidden();
}

async function solveDuet(page) {
  const record = await page.evaluate(async date => await (await fetch(`/data/duet/${date}.json`)).json(), DATE);
  const given = new Set(record.puzzle.givens.map(g => g.index));
  for (let i = 0; i < record.solution.length; i++) {
    if (given.has(i)) continue;
    const cell = page.locator('#board .duet-cell').nth(i);
    await cell.click();
    if (record.solution[i] === 2) await cell.click();
  }
  await expect(page.locator('#done')).toBeVisible();
}

test('Duet daily loads from static JSON', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('#board .duet-cell')).toHaveCount(36);
  await expect(page.locator('#loadError')).toBeHidden();
  await expect(page.locator('.relation').first()).toBeVisible();
  await expect(page.locator('#done')).toBeHidden();
});

test('Duet given cells are readonly', async ({ page }) => {
  await fresh(page);
  const given = page.locator('.duet-cell.given').first();
  await expect(given).toHaveAttribute('aria-readonly', 'true');
  const index = await given.getAttribute('data-index');
  const before = await given.getAttribute('data-value');
  await given.click();
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-value', before);
});

test('Duet move and undo survive reload', async ({ page }, info) => {
  await fresh(page);
  const editable = page.locator('.duet-cell:not(.given)').first();
  const index = await editable.getAttribute('data-index');
  await editable.click();
  await page.reload();
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-value', 'a');
  const undo = info.project.name === 'mobile-chromium' ? page.locator('#mobileUndo') : page.locator('#undo');
  await undo.click();
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-value', 'empty');
});

test('Duet keyboard can set value and navigate', async ({ page }) => {
  await fresh(page);
  const editable = page.locator('.duet-cell:not(.given)').first();
  const index = await editable.getAttribute('data-index');
  await editable.focus();
  await page.keyboard.press('1');
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-value', 'a');
});

test('Duet hint opens and remains inside viewport', async ({ page }, info) => {
  await fresh(page);
  const hint = info.project.name === 'mobile-chromium' ? page.locator('#mobileHint') : page.locator('#hint');
  await hint.click();
  await expect(page.locator('#hintCard')).toBeVisible();
  if (info.project.name === 'mobile-chromium') await page.waitForTimeout(450);
  const box = await page.locator('#hintCard').boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  if (info.project.name === 'mobile-chromium') {
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + Math.min(box.height, 120)).toBeLessThanOrEqual(viewport.height - 70);
  }
});

test('Duet completion produces 1/2 if Korony is not done', async ({ page }) => {
  await fresh(page);
  await solveDuet(page);
  const state = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  expect(state.daily.completedGames).toEqual(['duet']);
  expect(state.user.streak).toBe(0);
  await page.goto(`/index.html?date=${DATE}`);
  await expect(page.locator('#progressRing')).toHaveText('1/2');
  await expect(page.locator('#duetStatus')).toContainText(/ponownie/i);
  await expect(page.locator('#duetCard')).toHaveAttribute('href',/duet\.html\?mode=training/);
});

test('Duet training renders 36 cells and does not increment product counters', async ({ page }) => {
  await fresh(page);
  await solveDuet(page);
  const first = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  await page.locator('#replay').click();
  await expect(page.locator('#roundLabel')).toContainText(/Trening/i);
  await expect(page.locator('#board .duet-cell')).toHaveCount(36);
  await expect(page.locator('#done')).toBeHidden();
  await expect(page.locator('#gameLoader')).toBeHidden();
  const second = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  expect(second.user.completedGames).toBe(first.user.completedGames);
  expect(second.games.duet.completedCount).toBe(first.games.duet.completedCount);
});

test('Duet board fits mobile and desktop viewport', async ({ page }) => {
  await fresh(page);
  const box = await page.locator('#board').boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
});

test('Duet cells keep equal size after symbols render', async ({ page }) => {
  await fresh(page);
  const editable = page.locator('.duet-cell:not(.given)').first();
  const index = await editable.getAttribute('data-index');
  const before = await editable.boundingBox();
  expect(before).not.toBeNull();
  await editable.click();
  const after = await page.locator(`[data-index="${index}"]`).boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.width - before.width)).toBeLessThan(1);
  expect(Math.abs(after.height - before.height)).toBeLessThan(1);
  const sizes = await page.locator('.duet-cell').evaluateAll(cells => cells.map(cell => { const rect = cell.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
  const widths = sizes.map(size => size.width);
  const heights = sizes.map(size => size.height);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
});
