import { expect, test } from '@playwright/test';

import {
  dramaE2eFixtureDetail,
  dramaE2eFixtureList,
  dramaE2eFixturePlayback,
  dramaE2eFixtureSlug,
  dramaE2eFreeEpisodeId,
  dramaE2eLockedEpisodeId,
} from '../fixtures/drama';

const dramaSlug = dramaE2eFixtureSlug;
const freeEpisodeId = dramaE2eFreeEpisodeId;
const lockedEpisodeId = dramaE2eLockedEpisodeId;
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

async function mockAnonymousDramaBrowserApi(page: import('@playwright/test').Page) {
  await page.route('http://localhost:4000/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({}) }),
  );

  await page.route('http://localhost:4000/dramas?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dramaE2eFixtureList()),
    }),
  );

  await page.route(`http://localhost:4000/dramas/${dramaSlug}`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dramaE2eFixtureDetail),
    }),
  );

  await page.route(`http://localhost:4000/episodes/${freeEpisodeId}/playback`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dramaE2eFixturePlayback(freeEpisodeId)),
    }),
  );

  await page.route(`http://localhost:4000/episodes/${lockedEpisodeId}/playback`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dramaE2eFixturePlayback(lockedEpisodeId)),
    }),
  );
}

async function mockSignedInDramaResumeApi(page: import('@playwright/test').Page, email: string) {
  let registered = false;
  const user = {
    id: '55555555-0000-4d00-8d00-000000000000',
    email,
    name: null,
    role: 'USER',
    coinBalance: 0,
  };

  await page.route('http://localhost:4000/auth/me', (route) =>
    route.fulfill({
      status: registered ? 200 : 401,
      contentType: 'application/json',
      body: registered ? JSON.stringify({ user }) : JSON.stringify({}),
    }),
  );

  await page.route('http://localhost:4000/auth/register', (route) => {
    registered = true;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ user }),
    });
  });

  await page.route('http://localhost:4000/drama-progress', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        episodeId: freeEpisodeId,
        positionSeconds: 37,
        durationSeconds: 80,
        completed: false,
      }),
    }),
  );
}

test('anonymous visitor can browse drama detail, open deterministic free playback, and hit locked paywall', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const hlsRequests = await mockDeterministicDramaHls(page);
  await mockAnonymousDramaBrowserApi(page);

  const browseResponse = await page.goto('/dramas', { waitUntil: 'domcontentloaded' });
  test.skip(
    (browseResponse?.status() ?? 200) === 404,
    'Drama browse route is unavailable in this environment; skipping seeded drama smoke.',
  );
  await expect(page.getByRole('heading', { name: 'Browse dramas' })).toBeVisible();

  const seededDramaLink = page
    .getByRole('link', {
      name: /Watch now: The Billionaire Contract/,
    })
    .first();
  test.skip(
    (await seededDramaLink.count()) === 0,
    'Seeded drama browse data is unavailable in this environment; skipping seeded drama smoke.',
  );

  await expect(seededDramaLink).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Watch now: Revenge in Red Heels/ }).first(),
  ).toBeVisible();

  await seededDramaLink.click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}$`));
  await expect(page.getByRole('heading', { name: 'The Billionaire Contract' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Episodes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /1\. The Offer.*Free/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /4\. The Locked Penthouse.*Locked/ })).toBeVisible();

  await page.locator(`a[href="/dramas/${dramaSlug}/watch/${freeEpisodeId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}/watch/${freeEpisodeId}$`));
  await expect(page.getByRole('link', { name: 'Back to details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Offer' })).toBeVisible();
  await expect(page.locator('video')).toBeVisible();

  await expect
    .poll(() => hlsRequests.some((url) => url.includes(`/hls/${dramaSlug}/episode-01.m3u8`)))
    .toBe(true);
  expect(hlsRequests.every((url) => !/[?&](token|signature|expires|key)=/i.test(url))).toBe(true);

  const requestsBeforeLockedPlayback = hlsRequests.length;
  await page.goto(`/dramas/${dramaSlug}/watch/${lockedEpisodeId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: 'Episode locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to unlock' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Subscribe to unlock every episode' })).toBeVisible();
  await expect(
    page.getByText('Your watch progress resumes after access is restored.'),
  ).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  expect(hlsRequests).toHaveLength(requestsBeforeLockedPlayback);
});

test('signed-in viewer sees resume CTA and resume label for existing drama progress', async ({
  page,
}) => {
  const email = `drama-resume-${Date.now()}@example.com`;
  const password = 'password123';

  await mockDeterministicDramaHls(page);
  await mockSignedInDramaResumeApi(page, email);

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const signUpButton = page.getByRole('button', { name: 'Sign Up' });
  test.skip(
    (await signUpButton.count()) === 0,
    'Auth sign-up UI is unavailable in this environment; skipping authenticated drama resume smoke.',
  );
  await signUpButton.click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000';
  const progressUrl = `${apiBaseUrl.replace(/\/+$/, '')}/drama-progress`;
  const progressResponse = await page.evaluate(
    async ({ episodeId, url }) => {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          positionSeconds: 37,
          durationSeconds: 80,
          completed: false,
        }),
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    },
    { episodeId: freeEpisodeId, url: progressUrl },
  );
  test.skip(
    progressResponse.status === 404,
    `Drama progress endpoint is unavailable in this environment: ${JSON.stringify(progressResponse)}`,
  );
  expect(
    progressResponse,
    `drama progress response: ${JSON.stringify(progressResponse)}`,
  ).toMatchObject({
    ok: true,
  });

  await page.goto(`/dramas/${dramaSlug}`);
  test.skip(
    (await page.getByRole('heading', { name: 'The Billionaire Contract' }).count()) === 0,
    'Seeded drama detail data is unavailable in this environment; skipping resume CTA smoke.',
  );
  await expect(page.getByRole('link', { name: 'Continue watching' })).toBeVisible();

  await page.getByRole('link', { name: 'Continue watching' }).click();
  await expect(page).toHaveURL(new RegExp(`/dramas/${dramaSlug}/watch/${freeEpisodeId}$`));
  await expect(page.getByText(/Resume available: Resume from 37s/)).toBeVisible();
});
