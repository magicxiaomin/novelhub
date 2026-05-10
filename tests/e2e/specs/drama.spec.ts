import { expect, test, type Page } from '@playwright/test';

const dramaSlug = 'the-billionaire-contract';
const freeEpisodeUrl = `/drama/${dramaSlug}/watch/1`;
const lockedEpisodeUrl = `/drama/${dramaSlug}/watch/4`;
const novelRegressionUrl = '/read/11111111-1111-4111-8111-111111111111/1';

async function signUp(page: Page): Promise<string> {
  const email = `drama-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'password123';

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();

  return email;
}

async function claimDailyCoins(page: Page): Promise<void> {
  await page.goto('/');
  const claimButton = page.getByRole('button', { name: /^Claim \d+$/ });
  await expect(claimButton).toBeVisible();
  await claimButton.click();
  await expect(page.getByText(/\+\d+ coins!/)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://media.dramavela.test/hls/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.m3u8')) {
      await route.fulfill({
        path: 'fixtures/hls/drama-fixture.m3u8',
        contentType: 'application/vnd.apple.mpegurl',
      });
      return;
    }

    await route.fulfill({
      path: `fixtures/hls/${url.pathname.split('/').pop() ?? 'drama-fixture-000.bin'}`,
      contentType: 'video/mp2t',
    });
  });
});

test('drama product loop covers browse, free playback, locked paywall, coin unlock, and resume', async ({
  page,
}) => {
  await page.goto('/drama');
  await expect(page.getByRole('heading', { name: 'Binge emotional short dramas' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Read novels instead/i })).toHaveAttribute(
    'href',
    '/novels',
  );

  await page
    .getByRole('link', { name: /The Billionaire Contract/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'The Billionaire Contract' })).toBeVisible();
  await page.goto(freeEpisodeUrl);

  const freePlayer = page.locator('video');
  await expect(freePlayer).toBeVisible();
  await expect(freePlayer).toHaveAttribute(
    'src',
    'https://media.dramavela.test/hls/the-billionaire-contract/episode-01.m3u8',
  );
  await expect(page.getByRole('heading', { name: 'The Offer' })).toBeVisible();

  await page.goto(lockedEpisodeUrl);
  await expect(page.getByRole('heading', { name: 'Episode locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock for 5 coins' })).toBeVisible();

  const email = await signUp(page);
  await claimDailyCoins(page);
  await page.goto(lockedEpisodeUrl);
  await page.getByRole('button', { name: 'Unlock for 5 coins' }).click();

  const unlockedPlayer = page.locator('video');
  await expect(unlockedPlayer).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Locked Penthouse' })).toBeVisible();
  await expect(unlockedPlayer).toHaveAttribute(
    'src',
    'https://media.dramavela.test/hls/the-billionaire-contract/episode-04.m3u8',
  );

  await page.goto('/me');
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('0').first()).toBeVisible();

  await page.goto(lockedEpisodeUrl);
  await expect(page.locator('video')).toHaveAttribute(
    'src',
    'https://media.dramavela.test/hls/the-billionaire-contract/episode-04.m3u8',
  );
  await expect(page.getByRole('heading', { name: 'Episode locked' })).toBeHidden();
});

test('novel reading regression remains green alongside the drama entry point', async ({ page }) => {
  await page.goto('/drama');
  await expect(page.getByRole('link', { name: /Read novels instead/i })).toHaveAttribute(
    'href',
    '/novels',
  );

  await page.goto(novelRegressionUrl);
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'A Truth Universally Acknowledged' }),
  ).toBeVisible();
  await expect(page.getByText(/It is a truth universally acknowledged/i)).toBeVisible();
});
