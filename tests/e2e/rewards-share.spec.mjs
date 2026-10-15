import { test, expect } from '@playwright/test';

const DATE = '2026-10-15';

test('PUZLI IQ and achievements update after a daily game, without disturbing six tiles', async ({ page }) => {
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/index.html?date=' + DATE);
  await expect(page.locator('#puzliIq')).toHaveText('100');
  await expect(page.locator('#puzliRank')).toHaveText('Nowicjusz');
  await expect(page.locator('#badgesCount')).toContainText('0/9');
  await page.evaluate(async date => {
    const {completeDailyGame}=await import('/src/storage.js');
    completeDailyGame('korony',{today:date,timeMs:60000});
  },DATE);
  await page.reload();
  await expect(page.locator('#puzliIq')).toHaveText('100');
  await expect(page.locator('#totalPuzliPoints')).toHaveText('120');
  await expect(page.locator('#weekPuzliPoints')).toHaveText('120');
  await expect(page.locator('#badgesCount')).toContainText('1/9');
  await expect(page.locator('#cardStreak')).toHaveText('1 dzień');
  await expect(page.locator('a.game-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('shared score from one browser can join another browser local friends ranking', async ({ browser }) => {
  const senderContext=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const receiverContext=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  try{
    const sender=await senderContext.newPage();
    await sender.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable:true,
        value: async value => { window.__sharedPuzli = value; }
      });
    });
    await sender.goto('/index.html?date=' + DATE);
    await sender.evaluate(async date => {
      const {completeDailyGame}=await import('/src/storage.js');
      completeDailyGame('korony',{today:date});
    }, DATE);
    await sender.reload();
    await sender.locator('#playerNickname').fill('Kasia');
    await sender.locator('#sharePuzliResult').click();
    const sent = await sender.evaluate(() => window.__sharedPuzli);
    expect(sent.url).toContain('wynik=');
    expect(sent.text).toContain('120 pkt');

    const receiver=await receiverContext.newPage();
    const url = new URL(sent.url);
    url.searchParams.set('date', DATE);
    await receiver.goto(url.toString());
    await expect(receiver.locator('#friendsRanking .friend-row')).toHaveCount(2);
    await expect(receiver.locator('#friendsRanking')).toContainText('Kasia');
    await expect(receiver.locator('#friendStatus')).toContainText('Dodano wynik');
    expect(new URL(receiver.url()).searchParams.has('wynik')).toBe(false);
  } finally {
    await senderContext.close();
    await receiverContext.close();
  }
});

test('malformed shared score is rejected without rendering external content', async ({page}) => {
  await page.goto('/index.html?date=' + DATE + '&wynik=niepoprawne');
  await expect(page.locator('#friendsRanking .friend-row')).toHaveCount(1);
  await expect(page.locator('#friendStatus')).toContainText('Nie można odczytać');
});

test('engagement sections never cause horizontal overflow on narrow devices', async ({page}) => {
  for(const width of [320,360,390,768]){
    await page.setViewportSize({width,height:740});
    await page.goto('/index.html?date=' + DATE);
    const {viewport,documentWidth} = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    expect(documentWidth, 'scroll overflow at '+width).toBeLessThanOrEqual(viewport+2);
  }
});
