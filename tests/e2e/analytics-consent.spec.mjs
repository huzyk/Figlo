import { test, expect } from '@playwright/test';

// Exercise the real browser module with a fake public GA4 measurement ID.
// Only in the test response is localhost treated as a published hostname.
async function enableAnalyticsFixture(page) {
  await page.route('**/src/services/analytics-config.js', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: "export const GA4_MEASUREMENT_ID = 'G-TEST12345';"
  }));
  await page.route('**/src/services/analytics-bootstrap.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);",
      'const isLocal = false;'
    );
    await route.fulfill({ response, body });
  });
  await page.route('https://www.googletagmanager.com/gtag/js**', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: ''
  }));
}

test('no Google script before consent, then allowed events, then full opt-out', async ({ page }) => {
  await enableAnalyticsFixture(page);
  await page.goto('/index.html?date=2026-10-15');
  await expect(page.getByRole('region', { name: 'Ustawienia statystyk' })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Włącz statystyki' }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() =>
    window.dataLayer?.some(x => x[0] === 'event' && x[1] === 'home_opened') || false
  )).toBe(true);
  const events = await page.evaluate(() =>
    window.dataLayer.filter(x => x[0] === 'event').map(x => ({ name: x[1], params: x[2] }))
  );
  expect(events.some(x => x.name === 'daily_visit')).toBe(true);
  expect(events.every(x => !Object.hasOwn(x.params, 'localId'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('puzli_analytics_consent_v1'))).toBe('accepted');

  await page.locator('#analyticsSettings').click();
  await page.getByRole('button', { name: 'Bez statystyk' }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('puzli_analytics_consent_v1'))).toBe('declined');
  expect(await page.evaluate(() => localStorage.getItem('puzli_analytics_sent_v1'))).toBeNull();
});

test('refusing analytics never injects an external tracking script', async ({ page }) => {
  await enableAnalyticsFixture(page);
  await page.goto('/index.html?date=2026-10-15');
  await page.getByRole('button', { name: 'Bez statystyk' }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ustawienia statystyk' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('puzli_analytics_consent_v1'))).toBe('declined');
});
