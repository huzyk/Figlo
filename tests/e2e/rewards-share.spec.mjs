import { test, expect } from '@playwright/test';

const DATE = '2026-10-15';
async function addGame(page, gameId = 'korony', date = DATE) {
  await page.evaluate(async ({ date, gameId }) => {
    const { completeDailyGame } = await import('/src/storage.js');
    completeDailyGame(gameId, { today: date, timeMs: 60000 });
  }, { date, gameId });
}
async function mockNativeShare(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async value => { window.__sharedPuzli = value; } });
  });
}
async function solveCrown(page) {
  await expect(page.locator('#gameLoader')).toBeHidden();
  await page.waitForFunction(() => window.__FIGLO_TEST__?.getSolution?.()?.length === 9);
  const solution = await page.evaluate(() => window.__FIGLO_TEST__.getSolution());
  for (const index of solution) {
    const cell = page.locator('#board .cell').nth(index);
    await cell.click(); await cell.click();
  }
  await expect(page.locator('#done')).toBeVisible();
}

test('PUZLI IQ and achievements update after a daily game, without disturbing six tiles', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/index.html?date=' + DATE);
  await expect(page.locator('#puzliIq')).toHaveText('100');
  await expect(page.locator('#puzliRank')).toHaveText('Nowicjusz');
  await expect(page.locator('#badgesCount')).toContainText('0/9');
  await expect(page.locator('#shareDailyResult')).toBeDisabled();
  await addGame(page);
  await page.reload();
  await expect(page.locator('#totalPuzliPoints')).toHaveText('120');
  await expect(page.locator('#weekPuzliPoints')).toHaveText('120');
  await expect(page.locator('#badgesCount')).toContainText('1/9');
  await expect(page.locator('#cardStreak')).toHaveText('1 dzień');
  await expect(page.locator('#dailyShareProgress')).toContainText('1/6 gier');
  await expect(page.locator('#dailyShareProgress')).toContainText('Dzień zaliczony');
  await expect(page.locator('#shareDailyResult')).toBeEnabled();
  await expect(page.locator('a.game-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('shared weekly score uses fragment and updates only after opening a new link', async ({ browser }) => {
  const senderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const receiverContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  try {
    const sender = await senderContext.newPage();
    await mockNativeShare(sender);
    await sender.goto('/index.html?date=' + DATE);
    await addGame(sender); await sender.reload();
    await sender.locator('#playerNickname').fill('Kasia');
    await sender.locator('#sharePuzliResult').click();
    const sent = await sender.evaluate(() => window.__sharedPuzli);
    expect(new URL(sent.url).searchParams.has('wynik')).toBe(false);
    expect(new URL(sent.url).hash).toMatch(/^#rywalizacja\?wynik=/);
    expect(sent.text).toContain('120 pkt');

    const receiver = await receiverContext.newPage();
    const url = new URL(sent.url); url.searchParams.set('date', DATE);
    await receiver.goto(url.toString());
    await expect(receiver.locator('#friendsRanking .friend-row')).toHaveCount(2);
    await expect(receiver.locator('#friendsRanking')).toContainText('Kasia');
    await expect(receiver.locator('#friendStatus')).toContainText('Dodano wynik');
    await expect(receiver.locator('#friendsRanking')).toContainText('120 pkt');
    expect(receiver.url()).not.toContain('wynik=');

    await addGame(sender, 'duet'); await sender.reload();
    await receiver.reload();
    await expect(receiver.locator('#friendsRanking')).toContainText('120 pkt');
    await sender.locator('#sharePuzliResult').click();
    const next = new URL((await sender.evaluate(() => window.__sharedPuzli)).url);
    next.searchParams.set('date', DATE);
    await receiver.goto(next.toString());
    await expect(receiver.locator('#friendsRanking .friend-row')).toHaveCount(2);
    await expect(receiver.locator('#friendsRanking')).toContainText('240 pkt');
  } finally { await senderContext.close(); await receiverContext.close(); }
});

test('malformed shared score is rejected and removed from legacy query', async ({ page }) => {
  await page.goto('/index.html?date=' + DATE + '&wynik=niepoprawne#rywalizacja');
  await expect(page.locator('#friendsRanking .friend-row')).toHaveCount(1);
  await expect(page.locator('#friendStatus')).toContainText('Nie można odczytać');
  expect(new URL(page.url()).searchParams.has('wynik')).toBe(false);
  expect(new URL(page.url()).hash).toBe('#rywalizacja');
});

test('native share failure and clipboard rejection reveal copyable daily result', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('failed'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
  });
  await page.goto('/index.html?date=' + DATE);
  await addGame(page); await page.reload();
  await page.locator('#shareDailyResult').click();
  await expect(page.locator('#dailyShareStatus')).toContainText('Skopiuj');
  await expect(page.locator('#dailyShareText')).toBeVisible();
  await expect(page.locator('#dailyShareText')).toHaveValue(/1\/6 gier ukończonych/);
  await expect(page.locator('#dailyShareText')).toHaveValue(/index\.html#gry/);
});

test('native share failure uses clipboard before manual fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('failed'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedPuzli = value; } } });
  });
  await page.goto('/index.html?date=' + DATE);
  await addGame(page); await page.reload();
  await page.locator('#playerNickname').fill('Ala');
  await page.locator('#sharePuzliResult').click();
  await expect(page.locator('#friendStatus')).toContainText('skopiowane');
  await expect(page.locator('#weeklyShareFallback')).toBeHidden();
  expect(await page.evaluate(() => window.__copiedPuzli)).toContain('#rywalizacja?wynik=');
});

test('cancelling native sharing keeps a neutral status and clipboard untouched', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancel', 'AbortError'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { window.__copiedPuzli = true; } } });
  });
  await page.goto('/index.html?date=' + DATE);
  await page.locator('#playerNickname').fill('Ala');
  await page.locator('#sharePuzliResult').click();
  await expect(page.locator('#friendStatus')).toHaveText('Udostępnianie anulowane.');
  await expect(page.locator('#weeklyShareFallback')).toBeHidden();
  expect(await page.evaluate(() => window.__copiedPuzli)).toBeUndefined();
});

test('a solved game exposes direct result sharing with exact puzzle version', async ({ page }) => {
  await mockNativeShare(page);
  await page.goto('/korony.html?date=' + DATE);
  const puzzleId = await page.evaluate(async () => {
    await import('/src/ui/game-mode.js');
    return document.documentElement.dataset.gamePuzzleId;
  });
  await solveCrown(page);
  await expect(page.locator('#completionShare')).toHaveText('Udostępnij wynik ↗');
  await expect(page.locator('[data-completion-copy]')).toContainText('Pierwsza gra zalicza dzień');
  await page.locator('#completionShare').click();
  const card = await page.evaluate(() => window.__sharedPuzli);
  const url = new URL(card.url);
  expect(url.searchParams.get('challenge')).toBe(DATE);
  expect(url.searchParams.get('v')).toBe(puzzleId || await page.evaluate(() => document.documentElement.dataset.gamePuzzleId));
  expect(card.text).toContain('Korony');
  expect(card.text).toContain('Bez podpowiedzi');
  expect(card.text).not.toContain('solution');
  await page.locator('#completionRewardsLink').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#backToSet')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#completionRewardsLink')).toBeFocused();
});

test('completion sharing keeps the board date when the current date changes', async ({ page }) => {
  await mockNativeShare(page);
  await page.goto('/korony.html?date=' + DATE);
  await expect(page.locator('#gameLoader')).toBeHidden();
  // Simulate a tab staying open into a new product day without replacing its board.
  await page.evaluate(() => history.replaceState(null, '', '/korony.html?date=2026-10-16'));
  await solveCrown(page);
  await expect(page.locator('[data-completion-eyebrow]')).toHaveText('ZESTAW ' + DATE);
  await page.locator('#completionShare').click();
  expect(new URL((await page.evaluate(() => window.__sharedPuzli)).url).searchParams.get('challenge')).toBe(DATE);
});

test('second daily completion presents the first saved result in both modal and share', async ({ page }) => {
  await mockNativeShare(page);
  await page.goto('/korony.html?date=' + DATE);
  await expect(page.locator('#gameLoader')).toBeHidden();
  await page.evaluate(async date => {
    const { completeGame } = await import('/src/services/progress-service.js');
    const { refreshCompletion } = await import('/src/ui/completion-ui.js');
    const puzzleId = document.documentElement.dataset.gamePuzzleId;
    completeGame({ gameId: 'korony', puzzleId, date, elapsedMs: 30999, hintsUsed: 2, resets: 1, mode: 'daily' });
    completeGame({ gameId: 'korony', puzzleId, date, elapsedMs: 60000, hintsUsed: 0, resets: 0, mode: 'daily' });
    // A second tab's game UI initially presents its own attempt time.
    document.querySelector('#finalTime').textContent = '01:00';
    document.querySelector('#done').hidden = false;
    refreshCompletion();
  }, DATE);
  await expect(page.locator('#finalTime')).toHaveText('00:30');
  await expect(page.locator('#finalTime').locator('..')).toContainText('Zapisany wynik');
  await expect(page.locator('#completionRewardSummary')).toContainText('Rozwiązane z podpowiedzią');
  await page.locator('#completionShare').click();
  const card = await page.evaluate(() => window.__sharedPuzli);
  expect(card.text).toContain('w 0:30');
  expect(card.text).toContain('Podpowiedzi: 2');
  expect(card.text).not.toContain('Bez podpowiedzi');
});

test('engagement sections never cause horizontal overflow on narrow devices', async ({ page }) => {
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/index.html?date=' + DATE);
    const { viewport, documentWidth } = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(documentWidth, 'scroll overflow at ' + width).toBeLessThanOrEqual(viewport + 2);
  }
});

test('daily win has a short game-themed sparkle burst and an anchored earned badge', async ({ page }) => {
  await page.goto('/korony.html?date=' + DATE);
  await solveCrown(page);
  await expect(page.locator('.puzli-victory-spark')).toHaveCount(14);
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Odznaka odblokowana');
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Pierwszy krok');
  await expect(page.locator('.puzli-achievement-toast,.puzli-confetti-layer')).toHaveCount(0);
  await expect(page.locator('.puzli-victory-sparks')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('.puzli-badge-unlock')).toBeVisible();
  // Closing and reopening the result never replays an old award.
  await page.evaluate(() => { document.querySelector('#done').hidden = true; });
  await expect(page.locator('#done')).toBeHidden();
  await page.evaluate(() => { document.querySelector('#done').hidden = false; });
  await expect(page.locator('.puzli-victory-spark')).toHaveCount(0);
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Pierwszy krok');
});

test('reduced motion has no sparkles and still clearly shows the earned badge', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/korony.html?date=' + DATE);
  await solveCrown(page);
  await expect(page.locator('.puzli-victory-sparks')).toHaveCount(0);
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Pierwszy krok');
  const animation = await page.locator('.completion-card').evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});
