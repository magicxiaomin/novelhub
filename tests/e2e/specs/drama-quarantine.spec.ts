import { expect, test } from '@playwright/test';

test.describe('drama public-route quarantine', () => {
  for (const path of [
    '/dramas',
    '/dramas/suspense-test',
    '/dramas/suspense-test/watch/episode-1',
  ]) {
    test(`${path} stays hidden behind a 404`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      expect(response?.status()).toBe(404);
      await expect(
        page.getByText(/404|This page could not be found|not found/i).first(),
      ).toBeVisible();
    });
  }

  test('rendered public links do not expose /dramas routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const dramaLinks = await page.locator('a[href^="/dramas"], a[href*="/dramas/"]').count();
    expect(dramaLinks).toBe(0);
  });
});
