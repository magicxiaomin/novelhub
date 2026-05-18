import { expect, test, type ConsoleMessage } from '@playwright/test';

const bookId = '19500000-0000-4195-8195-000000000198';

test.beforeEach(async ({ page }) => {
  await page.route('https://novel-e2e-content.test/**/chapter-*.txt**', async (route) => {
    const match = route
      .request()
      .url()
      .match(/chapter-(\d+)\.txt/);
    const chapter = match?.[1] ?? '1';
    const paragraph = `Free chapter ${chapter} opens the acquisition funnel. Readers can continue through chapter three before the paywall appears.`;
    let body = paragraph;
    for (let index = 1; index < 80; index += 1) body += `\n\n${paragraph}`;
    await route.fulfill({
      contentType: 'text/plain',
      body,
    });
  });
});

test('anonymous reading progress failures are swallowed without console errors', async ({
  page,
}) => {
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

  await page.goto(`/read/${bookId}/1`);
  // Chapter title appears in both the reader top-bar and the article body.
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'Free Chapter 1' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toContainText(
    /Free chapter 1 opens the acquisition funnel|Chapter content could not be loaded/i,
  );

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(5_500);

  const progressErrors = appErrors.filter((message) => /reading-progress/i.test(message));
  expect(progressErrors).toEqual([]);
});

test('reader adjacent navigation keeps rendered content visible and restores back-scroll within 40px', async ({
  page,
}) => {
  await page.goto(`/read/${bookId}/1`);
  const article = page.getByRole('article');
  await expect(article.getByRole('heading', { name: 'Free Chapter 1' })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 720));
  const beforeY = await page.evaluate(() => window.scrollY);
  expect(beforeY).toBeGreaterThan(0);

  await page
    .getByRole('link', { name: 'Next chapter' })
    .last()
    .evaluate((link) => {
      (link as HTMLAnchorElement).click();
    });
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}/2$`));
  await expect(article.getByRole('heading', { name: 'Free Chapter 2' })).toBeVisible();
  await expect(page.getByLabel('Loading chapter content')).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}/1$`));
  await expect(article.getByRole('heading', { name: 'Free Chapter 1' })).toBeVisible();

  await page.waitForFunction((expectedY) => Math.abs(window.scrollY - expectedY) <= 40, beforeY);
  const restoredY = await page.evaluate(() => window.scrollY);
  // Percent-based reader progress can reflow by a paragraph line-height between
  // route renders, so this browser QA uses the issue-approved ±40px tolerance.
  expect(Math.abs(restoredY - beforeY)).toBeLessThanOrEqual(40);
});
