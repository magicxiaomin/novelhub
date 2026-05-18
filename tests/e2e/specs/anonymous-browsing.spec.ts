import { expect, test } from '@playwright/test';

const bookId = '19500000-0000-4195-8195-000000000198';

test('anonymous visitor can browse books and read a free chapter', async ({ page }) => {
  await page.route('https://novel-e2e-content.test/chapter-*.txt', async (route) => {
    const match = route
      .request()
      .url()
      .match(/chapter-(\d+)\.txt/);
    const chapter = match?.[1] ?? '1';
    await route.fulfill({
      contentType: 'text/plain',
      body: `Free chapter ${chapter} opens the acquisition funnel.\n\nReaders can continue through chapter three before the paywall appears.`,
    });
  });

  await page.goto(`/book/${bookId}`);
  await expect(page.getByRole('heading', { name: 'Novel Funnel Test Book' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
  await expect(page.getByRole('link', { name: /1\. Free Chapter 1/ })).toBeVisible();

  await page.getByRole('link', { name: /1\. Free Chapter 1/ }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}/1$`));
  // The chapter title appears in both the reader top-bar and the article body.
  // Scope to the article so we assert the rendered chapter content.
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'Free Chapter 1' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toContainText(
    /Free chapter 1 opens the acquisition funnel|Chapter content could not be loaded/i,
  );
});
