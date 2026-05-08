import { expect, test } from '@playwright/test';

test('anonymous visitor can browse books and read a free chapter', async ({ page }) => {
  await page.goto('/');

  // Books appear in multiple rails (trending, new-releases, category) — use
  // first() to satisfy strict-mode locators while still proving the title
  // rendered.
  await expect(page.getByRole('link', { name: 'Pride and Prejudice' }).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'The Adventures of Sherlock Holmes' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Frankenstein' }).first()).toBeVisible();
  await expect.poll(async () => page.locator('img').count()).toBeGreaterThanOrEqual(3);

  await page.getByRole('link', { name: 'Pride and Prejudice' }).first().click();
  await expect(page).toHaveURL(/\/book\/11111111-1111-4111-8111-111111111111$/);
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /1\. A Truth Universally Acknowledged/ }),
  ).toBeVisible();

  await page.getByRole('link', { name: /1\. A Truth Universally Acknowledged/ }).click();
  await expect(page).toHaveURL(/\/read\/11111111-1111-4111-8111-111111111111\/1$/);
  // The chapter title appears in both the reader top-bar and the article body.
  // Scope to the article so we assert the rendered chapter content.
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'A Truth Universally Acknowledged' }),
  ).toBeVisible();
  await expect(page.getByText(/It is a truth universally acknowledged/i)).toBeVisible();
});
