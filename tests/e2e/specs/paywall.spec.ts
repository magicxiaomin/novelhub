import { expect, test } from '@playwright/test';

const bookId = '19500000-0000-4195-8195-000000000198';

test('anonymous visitor sees the paywall on a paid chapter', async ({ page }) => {
  await page.goto(`/read/${bookId}/4`);

  await expect(page.getByText('Chapter locked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy Coins', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe Now', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy Coins Now', exact: true })).toBeVisible();
});
