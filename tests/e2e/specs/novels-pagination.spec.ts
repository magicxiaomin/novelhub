import { expect, test } from '@playwright/test';

test('novels pagination defaults to page one with next link', async ({ page }) => {
  await page.goto('/novels', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Novels' })).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/novels?page=2');
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
});

test('novels pagination preserves page two URL state', async ({ page }) => {
  await page.goto('/novels?page=2', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/novels\?page=2$/);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/novels');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('novels pagination clips out-of-range pages to the last page', async ({ page }) => {
  await page.goto('/novels?page=999', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/novels\?page=2$/);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
});

test('novels pagination keeps filters across page links', async ({ page }) => {
  await page.goto('/novels?category=ROMANCE&status=COMPLETED&page=2', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/\/novels\?category=ROMANCE&status=COMPLETED$/);
  await expect(page.getByText('Page 1 of 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'All statuses' })).toHaveAttribute(
    'href',
    '/novels?category=ROMANCE',
  );
});
