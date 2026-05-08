import { expect, test } from '@playwright/test';

test('anonymous visitor sees the paywall on a paid chapter', async ({ page }) => {
  await page.goto('/read/11111111-1111-4111-8111-111111111111/4');

  await expect(page.getByText('Chapter locked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy Coins', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe Now', exact: true })).toBeVisible();
});
