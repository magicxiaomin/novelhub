import { expect, test, type Page } from '@playwright/test';

const bookId = '11111111-1111-4111-8111-111111111111';
const coinPackButton = (page: Page) => page.getByText('120 coins', { exact: true });

async function stubBrowserApis(page: Page): Promise<void> {
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
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '55555555-0000-4d00-8d00-000000000195',
          email: 'novel-funnel@example.test',
          name: null,
          role: 'USER',
          coinBalance: 0,
        },
      }),
    });
  });
  await page.route('**/unlocks**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, limit: 200 }),
    });
  });
  await page.route('**/reading-progress**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20 }),
    });
  });
  await page.route('**/payments/checkout/subscription', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ url: '/payment/success?session_id=sub_test', sessionId: 'sub_test' }),
    });
  });
  await page.route('**/payments/checkout/coins', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        url: '/payment/success?session_id=coin_test',
        sessionId: 'coin_test',
      }),
    });
  });
}

async function gotoLockedChapter(page: Page): Promise<void> {
  await page.goto(`/read/${bookId}/4`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Chapter locked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe Now', exact: true })).toBeEnabled();
}

test.describe('novel acquisition funnel', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addCookies([
      {
        name: 'consent',
        value: encodeURIComponent(JSON.stringify({ analytics: false, marketing: false })),
        url: baseURL ?? 'http://localhost:3000',
      },
    ]);
    await stubBrowserApis(page);
  });

  test('ad UTM visitor lands on detail, reads three free chapters, then sees paywall options and library entry', async ({
    page,
  }) => {
    await page.goto(`/book/${bookId}?utm_source=facebook&utm_campaign=novel-funnel`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', { name: 'Novel Funnel Test Book' })).toBeVisible();
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /start reading/i })).toHaveAttribute(
      'href',
      `/read/${bookId}/1`,
    );
    await expect(page.getByRole('link', { name: /library/i })).toBeVisible();

    await page.goto(`/read/${bookId}/1`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('article').getByRole('heading', { name: 'Free Chapter 1' }),
    ).toBeVisible();
    await page.goto(`/read/${bookId}/3`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('article').getByRole('heading', { name: 'Free Chapter 3' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Next chapter', exact: true }).first(),
    ).toHaveAttribute('href', `/read/${bookId}/4`);

    await gotoLockedChapter(page);
    await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buy Coins', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe Now', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Buy Coins', exact: true })).toBeVisible();
  });

  test('starts the subscription checkout stub from the locked chapter paywall', async ({
    page,
  }) => {
    await gotoLockedChapter(page);
    await expect(page.getByRole('button', { name: 'Subscribe Now', exact: true })).toBeEnabled();

    const subscriptionCheckout = page.waitForRequest('**/payments/checkout/subscription');
    await page.getByRole('button', { name: 'Subscribe Now', exact: true }).click();

    await expect
      .poll(async () => (await subscriptionCheckout).postDataJSON())
      .toMatchObject({ plan: 'weekly' });
  });

  test('starts the coin checkout stub from the locked chapter paywall', async ({ page }) => {
    await gotoLockedChapter(page);
    await page.getByRole('button', { name: 'Buy Coins', exact: true }).click();
    await expect(coinPackButton(page)).toBeVisible();

    const coinCheckout = page.waitForRequest('**/payments/checkout/coins');
    await coinPackButton(page).click();
    await page.getByRole('button', { name: 'Buy Coins', exact: true }).last().click();

    await expect
      .poll(async () => (await coinCheckout).postDataJSON())
      .toMatchObject({ packageId: 'pack_120' });
  });
});
