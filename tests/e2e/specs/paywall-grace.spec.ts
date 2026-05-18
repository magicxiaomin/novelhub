import { expect, test } from '@playwright/test';

const bookId = '19500000-0000-4195-8195-000000000198';

test('locked chapter subscription checkout uses the current reader URL as mocked returnUrl', async ({
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
          id: '55555555-0000-4d00-8d00-000000000264',
          email: 'return-reader@example.test',
          name: null,
          role: 'USER',
          coinBalance: 0,
        },
      }),
    });
  });
  await page.route('**/payments/checkout/subscription', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ url: '/payment/success?session_id=sub_test', sessionId: 'sub_test' }),
    });
  });

  await page.goto(`/read/${bookId}/4`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Chapter locked')).toBeVisible();

  const subscriptionCheckout = page.waitForRequest('**/payments/checkout/subscription');
  await page.getByRole('button', { name: 'Subscribe Now', exact: true }).click();

  await expect
    .poll(async () => (await subscriptionCheckout).postDataJSON())
    .toMatchObject({ plan: 'weekly', returnUrl: `/read/${bookId}/4` });
});
