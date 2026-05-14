import { expect, test, type Page, type Route } from '@playwright/test';

const book = {
  id: '19500000-0000-4195-8195-000000000199',
  title: 'Novels First Homepage Book',
  author: 'NovelHub QA',
  coverUrl: '/covers/pride-and-prejudice.svg',
  category: 'Romance',
  tags: ['novels-first'],
  description: 'A novels-first discovery fixture for PRODUCT_MODE=novels.',
  status: 'ONGOING',
  totalChapters: 12,
  freeChapters: 3,
  views: 1950,
  rating: 4.8,
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-05-14T00:00:00.000Z',
};

async function fulfillBooks(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const body =
    path.endsWith('/featured') || path.endsWith('/trending') ? [book] : { items: [book] };

  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubNovelHome(page: Page): Promise<void> {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/checkin/status', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ claimedToday: false, currentStreak: 0, rewardCoins: 5 }),
    });
  });
  await page.route('**/reading-progress**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/books/categories', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/books/featured**', fulfillBooks);
  await page.route('**/books/trending**', fulfillBooks);
  await page.route('**/books**', fulfillBooks);
}

test.describe('homepage drama-quarantine', () => {
  test('PRODUCT_MODE=novels homepage exposes novel discovery without drama links', async ({
    page,
  }) => {
    await stubNovelHome(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Trending' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Releases' })).toBeVisible();
    await expect(page.getByText('Featured Drama')).toHaveCount(0);
    await expect(page.locator('a[href^="/dramas"]')).toHaveCount(0);
  });

  test('PRODUCT_MODE=novels quarantines public drama routes', async ({ page }) => {
    await stubNovelHome(page);

    await page.goto('/dramas', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Browse dramas' })).toHaveCount(0);
    await expect(page.getByText('This page could not be found')).toBeVisible();

    await page.goto('/dramas/hidden-love', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Drama not found' })).toBeVisible();
    await expect(page.locator('a[href^="/dramas"]')).toHaveCount(0);
  });
});
