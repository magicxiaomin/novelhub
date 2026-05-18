import { expect, test, type ConsoleMessage } from '@playwright/test';

test('anonymous reading progress failures are swallowed without console errors', async ({
  page,
}) => {
  await page.route('https://novel-e2e-content.test/**', async (route) => {
    await route.fulfill({
      contentType: 'text/plain',
      body: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nThis deterministic fixture keeps the anonymous reading-progress smoke test independent from external chapter storage.',
    });
  });

  const appErrors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    // The browser logs every failed network resource as a console error
    // (`Failed to load resource: ...`). The reading-progress 404 is the
    // expected behavior here — what we want to catch is *app-level* logging
    // about it (`console.error('Failed to save reading progress: …')`).
    // App-level logs originate from /_next/ chunks; resource errors come
    // from the failing URL. Filter out the resource-error class.
    const url = message.location().url ?? '';
    if (url.includes('/reading-progress') || /Failed to load resource/i.test(message.text())) {
      return;
    }
    appErrors.push(message.text());
  });

  await page.goto('/read/11111111-1111-4111-8111-111111111111/1');
  // Chapter title appears in both the reader top-bar and the article body.
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'A Truth Universally Acknowledged' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toContainText(/truth universally acknowledged/i);

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(5_500);

  const progressErrors = appErrors.filter((message) => /reading-progress/i.test(message));
  expect(progressErrors).toEqual([]);
});
