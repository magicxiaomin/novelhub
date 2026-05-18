import { expect, test } from '@playwright/test';

test('me page renders resume card and reading history with reader-route links', async ({
  page,
  baseURL,
}) => {
  await page.context().addCookies([
    {
      name: 'consent',
      value: encodeURIComponent(JSON.stringify({ analytics: false, marketing: false })),
      url: baseURL ?? 'http://localhost:3000',
    },
  ]);
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '55555555-0000-4d00-8d00-000000000265',
          email: 'history-reader@example.test',
          name: null,
          role: 'USER',
          coinBalance: 17,
          hasActiveSubscription: false,
        },
      }),
    });
  });
  await page.route('**/reading-progress**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          bookId: 'book/unsafe',
          chapterId: 'chapter-12',
          chapterNumber: 12,
          scrollPercent: 66.4,
          bookTitle: 'Resume Regression Novel',
          bookCover: '/covers/resume.svg',
          updatedAt: '2026-05-17T00:00:00.000Z',
        },
        {
          bookId: 'book-safe',
          chapterId: 'chapter-2',
          chapterNumber: 2,
          scrollPercent: 8,
          bookTitle: 'Older History Novel',
          bookCover: '/covers/older.svg',
          updatedAt: '2026-05-16T00:00:00.000Z',
        },
      ]),
    });
  });

  await page.goto('/me', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Continue reading Resume Regression Novel · Ch 12')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reading History' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Resume Regression Novel/ }).first()).toHaveAttribute(
    'href',
    '/read/book%2Funsafe/12',
  );
  await expect(page.getByRole('link', { name: /Older History Novel/ })).toHaveAttribute(
    'href',
    '/read/book-safe/2',
  );
});
