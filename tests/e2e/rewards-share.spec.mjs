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
  await expect(page.locator('#totalPuzliPoints')).toHaveText('23');
  await expect(page.locator('#weekPuzliPoints')).toHaveText('23');
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
    expect(sent.text).toContain('23 pkt');

    const receiver = await receiverContext.newPage();
    const url = new URL(sent.url); url.searchParams.set('date', DATE);
    await receiver.goto(url.toString());
    await expect(receiver.locator('#friendsRanking .friend-row')).toHaveCount(2);
    await expect(receiver.locator('#friendsRanking')).toContainText('Kasia');
    await expect(receiver.locator('#friendStatus')).toContainText('Dodano wynik');
    await expect(receiver.locator('#friendsRanking')).toContainText('23 pkt');
    expect(receiver.url()).not.toContain('wynik=');

    await addGame(sender, 'duet'); await sender.reload();
    await receiver.reload();
    await expect(receiver.locator('#friendsRanking')).toContainText('23 pkt');
    await sender.locator('#sharePuzliResult').click();
    const next = new URL((await sender.evaluate(() => window.__sharedPuzli)).url);
    next.searchParams.set('date', DATE);
    await receiver.goto(next.toString());
    await expect(receiver.locator('#friendsRanking .friend-row')).toHaveCount(2);
    await expect(receiver.locator('#friendsRanking')).toContainText('46 pkt');
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
  await expect(page.locator('#completionRewardSummary')).toContainText('Podpowiedź wykorzystana');
  await expect(page.locator('#completionRewardSummary')).toContainText('Szybkość');
  await expect(page.locator('.score-row')).toHaveCount(3);
  await expect(page.locator('.score-total')).toHaveText('+19 / 25 pkt');
  await expect(page.locator('.score-base .score-row-value')).toHaveText('10/10');
  await expect(page.locator('.score-speed .score-row-value')).toHaveText('9/10');
  await expect(page.locator('.score-clean .score-row-value')).toHaveText('0/5');
  await expect(page.locator('.score-clean [role="progressbar"]')).toHaveAttribute('aria-valuenow','0');
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

test('daily win has cinematic rings, 48 particles and a persistent earned badge', async ({ page }) => {
  await page.goto('/korony.html?date=' + DATE);
  await solveCrown(page);
  await expect(page.locator('.puzli-victory-spark')).toHaveCount(48);
  await expect(page.locator('.puzli-victory-wave')).toHaveCount(2);
  await expect(page.locator('.puzli-victory-rays')).toHaveCount(1);
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Odznaka odblokowana');
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Pierwszy krok');
  await expect(page.locator('.puzli-achievement-toast,.puzli-confetti-layer')).toHaveCount(0);
  await expect(page.locator('.puzli-victory-sky')).toHaveCount(0, { timeout: 5000 });
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
  await expect(page.locator('.puzli-victory-sky')).toHaveCount(0);
  await expect(page.locator('.puzli-badge-unlock')).toContainText('Pierwszy krok');
  const animation = await page.locator('.completion-card').evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

test('victory preview replays the exact live effect for six games without saving state', async ({page}) => {
  await page.goto('/victory-preview.html');
  await expect(page.locator('.puzli-victory-spark')).toHaveCount(48);
  await expect(page.locator('.puzli-victory-wave')).toHaveCount(2);
  for (const gameId of ['korony','duet','bloki','latarnie','zip','sudoku']) {
    await page.locator('[data-game="'+gameId+'"]').click();
    await expect(page.locator('body')).toHaveClass('game-'+gameId);
    await expect(page.locator('.puzli-victory-spark')).toHaveCount(48);
  }
  await page.locator('#badgeToggle').uncheck();
  await expect(page.locator('.puzli-badge-unlock')).toBeHidden();
  await page.locator('#badgeToggle').check();
  await expect(page.locator('.puzli-badge-unlock')).toBeVisible();
  await page.locator('#replay').click();
  await expect(page.locator('.puzli-victory-wave')).toHaveCount(2);
  const state = await page.evaluate(() => ({
    storage: Object.keys(localStorage).filter(key => key.startsWith('figlo-') || key.startsWith('puzli-')),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  expect(state.storage).toEqual([]);
  expect(state.overflow).toBeLessThanOrEqual(2);
});

test('victory preview respects reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/victory-preview.html');
  await page.locator('#replay').click();
  await expect(page.locator('.puzli-victory-sky')).toHaveCount(0);
  await expect(page.locator('.puzli-badge-unlock')).toBeVisible();
});

test('training success uses the new full celebration without daily rewards or empty UI', async ({ page }) => {
  await page.goto('/korony.html?mode=training');
  await solveCrown(page);
  await expect(page.locator('[data-completion-eyebrow]')).toHaveText('TRENING');
  await expect(page.locator('.puzli-victory-spark')).toHaveCount(48);
  await expect(page.locator('.puzli-victory-wave')).toHaveCount(2);
  await expect(page.locator('[data-completion-progress]')).toBeHidden();
  await expect(page.locator('#completionRewardsLink')).toBeHidden();
  await expect(page.locator('#completionRewardSummary')).toBeHidden();
  await expect(page.locator('.puzli-badge-unlock')).toHaveCount(0);

  const symbol = await page.locator('.success-mark').evaluate(el => ({
    visibleText: el.textContent.trim(),
    font: parseFloat(getComputedStyle(el).fontSize),
    before: getComputedStyle(el, '::before').content,
  }));
  expect(symbol.visibleText).toBe('✓');
  expect(symbol.font).toBeGreaterThan(25);
  expect(['""', "''"]).toContain(symbol.before);
  await expect(page.locator('#completionShare')).toBeVisible();
  await expect(page.locator('.puzli-victory-sky')).toHaveCount(0, {timeout: 5000});
});

test('daily completion also shows a clear checkmark rather than stacked game symbols', async ({ page }) => {
  await page.goto('/korony.html?date=' + DATE);
  await solveCrown(page);
  const symbol = await page.locator('.success-mark').evaluate(el => ({
    font: parseFloat(getComputedStyle(el).fontSize),
    before: getComputedStyle(el, '::before').content
  }));
  expect(symbol.font).toBeGreaterThan(25);
  expect(['""', "''"]).toContain(symbol.before);
  await expect(page.locator('[data-completion-progress]')).not.toBeHidden();
  await expect(page.locator('#completionRewardsLink')).toBeVisible();
});

test('daily score components use compact accessible bars with correct dynamic widths and do not alter points', async ({ page }) => {
  await page.goto('/korony.html?date=' + DATE);
  await expect(page.locator('#gameLoader')).toBeHidden();
  await page.evaluate(async date => {
    const {completeGame} = await import('/src/services/progress-service.js');
    const {refreshCompletion} = await import('/src/ui/completion-ui.js');
    completeGame({gameId:'korony',puzzleId:document.documentElement.dataset.gamePuzzleId,
      date, elapsedMs:240000,hintsUsed:0,mode:'daily'});
    document.querySelector('#done').hidden = false;
    refreshCompletion();
  }, DATE);
  const points = await page.locator('#completionRewardSummary').evaluate(root => ({
    total:root.querySelector('.score-total')?.textContent,
    rows:[...root.querySelectorAll('.score-row')].map(row=>({
      label:row.querySelector('.score-row-label')?.textContent,
      text:row.querySelector('.score-row-value')?.textContent,
      width:row.querySelector('.score-fill')?.style.width,
      now:row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')
    }))
  }));
  expect(points.total).toContain('+22'); // 10 base + 7 speed (4m reference) + 5 clean.
  expect(points.rows).toEqual([
    {label:'Ukończenie',text:'10/10',width:'100%',now:'10'},
    {label:'Szybkość',text:'7/10',width:'70%',now:'7'},
    {label:'Bez podpowiedzi',text:'5/5',width:'100%',now:'5'}
  ]);
  await expect(page.locator('.score-set-bonus')).toHaveCount(0);
  const saved = await page.evaluate(async date => {
    const {loadFigloState}=await import('/src/storage.js');
    return loadFigloState(date).rewards.daily[date].games.korony.points;
  }, DATE);
  expect(saved).toBe(22);
});

test('visual preview demonstrates real score breakdown in all six games and fits mobile', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.goto('/victory-preview.html');
  await expect(page.locator('.score-row')).toHaveCount(3);
  await expect(page.locator('.score-maximum')).toHaveText(' / 25 pkt');
  for (const game of ['korony','duet','bloki','latarnie','zip','sudoku']) {
    await page.locator('[data-game="'+game+'"]').click();
    await expect(page.locator('.score-row')).toHaveCount(3);
    await expect(page.locator('.score-base .score-row-value')).toHaveText('10/10');
    const widths=await page.locator('.score-fill').evaluateAll(items=>items.map(item=>item.style.width));
    expect(widths.every(x=>/^\d+(?:\.\d+)?%$/.test(x))).toBe(true);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('figlo-')||x.startsWith('puzli-')))).toEqual([]);
});
