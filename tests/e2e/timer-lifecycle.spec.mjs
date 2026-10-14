import { test, expect } from '@playwright/test';

const DATE = '2026-10-15';
const cells = {
  korony: '#board .cell',
  duet: '#board .duet-cell:not(.given)',
  bloki: '#board .clue-cell',
  latarnie: '#board .latarnia-cell',
  zip: '#board .zip-cell.numbered'
};
const seconds = value => String(value).split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
async function visibility(page, hidden) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
async function ready(page, game) {
  await expect(page.locator('#gameLoader')).toBeHidden({ timeout: 30000 });
  await expect(page.locator(cells[game]).first()).toBeVisible();
}

for (const game of Object.keys(cells)) {
  for (const mode of ['daily', 'training']) {
    test(`${game} ${mode}: timer pauses, resumes, survives undo and resets`, async ({ page }, info) => {
      test.setTimeout(60000);
      await page.clock.install();
      await page.goto(`/${game}.html?date=${DATE}&mode=${mode}`);
      await ready(page, game);
      const timer = page.locator('#timer');
      // Merely returning to a fresh round must not start its timer.
      await visibility(page, true);
      await visibility(page, false);
      await page.clock.runFor(1200);
      await expect(timer).toHaveText('00:00');
      if (game === 'zip') {
        await page.locator('#board .zip-cell').filter({ hasText: /^1$/ }).click();
      } else {
        await page.locator(cells[game]).first().click();
      }
      await page.clock.runFor(1500);
      expect(seconds(await timer.textContent())).toBeGreaterThan(0);
      const undo = page.locator(info.project.name === 'mobile-chromium' ? '#mobileUndo' : '#undo');
      await undo.click();
      await visibility(page, true);
      const paused = await timer.textContent();
      await page.clock.runFor(5000);
      await expect(timer).toHaveText(paused);
      await visibility(page, false);
      await page.clock.runFor(1500);
      expect(seconds(await timer.textContent())).toBeGreaterThan(seconds(paused));
      if (mode === 'daily') {
        await page.reload();
        await ready(page, game);
        const restored = seconds(await timer.textContent());
        await page.clock.runFor(1500);
        expect(seconds(await timer.textContent())).toBeGreaterThan(restored);
      }
      await page.locator(info.project.name === 'mobile-chromium' ? '#mobileReset' : '#reset').click();
      await visibility(page, true);
      await visibility(page, false);
      await page.clock.runFor(1500);
      await expect(timer).toHaveText('00:00');
    });
  }
}
