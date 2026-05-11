import { expect, test } from '@playwright/test';

const dramaSlug = 'the-billionaire-contract';
const freeEpisodeId = '44444444-0001-4d00-8d00-000000000001';
const lockedEpisodeId = '44444444-0004-4d00-8d00-000000000004';
const fixtureManifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:4.000,
episode-01-segment-000.ts
#EXT-X-ENDLIST
`;

async function mockDeterministicDramaHls(page: import('@playwright/test').Page) {
  const requestedUrls: string[] = [];

  await page.route('https://media.dramavela.test/hls/**', async (route) => {
    const url = route.request().url();
    requestedUrls.push(url);

    if (url.endsWith('.m3u8')) {
      await route.fulfill({
        contentType: 'application/vnd.apple.mpegurl',
        body: fixtureManifest,
      });
      return;
    }

    await route.fulfill({
      contentType: 'video/mp2t',
      body: 'deterministic-mock-ts-segment',
    });
  });

  return requestedUrls;
}

test('anonymous visitor can browse drama detail, open deterministic free playback, and hit locked paywall', async ({
  page,
}) => {
  const hlsRequests = await mockDeterministicDramaHls(page);

  await page.goto('/dramas');
  await expect(page.getByRole('heading', { name: 'Browse dramas' })).toBeVisible();
  await expect(page.getByRole('link', { name: /The Billionaire Contract/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Revenge in Red Heels/ }).first()).toBeVisible();

  await page
    .getByRole('link', { name: /The Billionaire Contract/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}$`));
  await expect(page.getByRole('heading', { name: 'The Billionaire Contract' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Episodes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /1\. The Offer\s+Episode 1.*Free/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /4\. The Locked Penthouse\s+Episode 4.*Locked/ }),
  ).toBeVisible();

  await page.getByRole('link', { name: /1\. The Offer/ }).click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}/watch/${freeEpisodeId}$`));
  await expect(page.getByRole('link', { name: 'Back to details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Offer' })).toBeVisible();
  await expect(page.locator('video')).toBeVisible();

  await expect
    .poll(() => hlsRequests.some((url) => url.includes(`/hls/${dramaSlug}/episode-01.m3u8`)))
    .toBe(true);
  expect(hlsRequests.every((url) => !/[?&](token|signature|expires|key)=/i.test(url))).toBe(true);

  await page.goto(`/dramas/${dramaSlug}/watch/${lockedEpisodeId}`);
  await expect(page.getByRole('heading', { name: 'Episode locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to unlock' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Subscribe to unlock every episode' })).toBeVisible();
  await expect(
    page.getByText('Your watch progress resumes after access is restored.'),
  ).toBeVisible();
});

test('signed-in viewer sees resume CTA and resume label for existing drama progress', async ({
  page,
}) => {
  const email = `drama-resume-${Date.now()}@example.com`;
  const password = 'password123';

  await mockDeterministicDramaHls(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const progressResponse = await page.request.post(`${apiBaseUrl}/drama-progress`, {
    data: {
      episodeId: freeEpisodeId,
      positionSeconds: 37,
      durationSeconds: 80,
      completed: false,
    },
  });
  expect(progressResponse.ok()).toBe(true);

  await page.goto(`/dramas/${dramaSlug}`);
  await expect(page.getByRole('link', { name: 'Continue watching' })).toBeVisible();

  await page.getByRole('link', { name: 'Continue watching' }).click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}/watch/${freeEpisodeId}$`));
  await expect(page.getByText(/Resume available: 0:37/)).toBeVisible();
});
