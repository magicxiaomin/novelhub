import { expect, test, type ConsoleMessage } from '@playwright/test';

test('anonymous reading progress failures are swallowed without console errors', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/read/11111111-1111-4111-8111-111111111111/1');
  // Chapter title appears in both the reader top-bar and the article body.
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'A Truth Universally Acknowledged' }),
  ).toBeVisible();
  await expect(page.getByText(/It is a truth universally acknowledged/i)).toBeVisible();

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(5_500);

  const progressErrors = consoleErrors.filter((message) =>
    /reading-progress|Request failed: 404|404/i.test(message),
  );
  expect(progressErrors).toEqual([]);
});
