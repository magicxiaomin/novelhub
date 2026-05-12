import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSuspense1913SeedRows,
  createSuspense1913ProductionSeed,
  createSuspense1913StagingSeed,
  validateSuspense1913ProductionSeedEnvironment,
  validateSuspense1913SeedEnvironment,
} from './staging-suspense-1913.seed.mjs';

test('staging Suspense seed refuses default and production-like environments', () => {
  assert.throws(() => validateSuspense1913SeedEnvironment({}), /SEED_DRAMA_STAGING_PACK=1/);

  assert.throws(
    () =>
      validateSuspense1913SeedEnvironment({
        SEED_DRAMA_STAGING_PACK: '1',
        STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging-media.example.test',
      }),
    /APP_ENV, NODE_ENV, or VERCEL_ENV must explicitly be one of/i,
  );

  for (const nodeEnv of ['production', 'prod']) {
    assert.throws(
      () =>
        validateSuspense1913SeedEnvironment({
          SEED_DRAMA_STAGING_PACK: '1',
          NODE_ENV: nodeEnv,
          STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging-media.example.test',
        }),
      /refuses production/i,
    );
  }

  assert.throws(
    () =>
      validateSuspense1913SeedEnvironment({
        SEED_DRAMA_STAGING_PACK: '1',
        NODE_ENV: 'staging',
      }),
    /STAGING_DRAMA_MEDIA_BASE_URL/,
  );
});

test('staging Suspense seed requires safe staging media hosts', () => {
  assert.throws(
    () =>
      validateSuspense1913SeedEnvironment({
        SEED_DRAMA_STAGING_PACK: '1',
        NODE_ENV: 'staging',
        STAGING_DRAMA_MEDIA_BASE_URL: 'http://media.example.test',
      }),
    /must use https/i,
  );

  assert.throws(
    () =>
      validateSuspense1913SeedEnvironment({
        SEED_DRAMA_STAGING_PACK: '1',
        NODE_ENV: 'staging',
        STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging.dramavela.com.attacker.example',
      }),
    /Refusing non-staging dramavela.com media host/i,
  );

  assert.deepEqual(
    validateSuspense1913SeedEnvironment({
      SEED_DRAMA_STAGING_PACK: '1',
      NODE_ENV: 'staging',
      STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging.dramavela.com/root/',
    }),
    { mediaBaseUrl: 'https://staging.dramavela.com/root' },
  );
});

test('production Suspense seed requires explicit production approval and production env', () => {
  const baseEnv = {
    NODE_ENV: 'production',
    PRODUCTION_DRAMA_MEDIA_BASE_URL: 'https://media.dramavela.com/root',
  };

  assert.throws(
    () => validateSuspense1913ProductionSeedEnvironment(baseEnv),
    /SEED_DRAMA_PRODUCTION_PACK=1/,
  );

  assert.throws(
    () =>
      validateSuspense1913ProductionSeedEnvironment({
        ...baseEnv,
        SEED_DRAMA_STAGING_PACK: '1',
        SEED_DRAMA_PRODUCTION_PACK: '1',
      }),
    /Refusing staging approval flag/i,
  );

  assert.throws(
    () =>
      validateSuspense1913ProductionSeedEnvironment({
        SEED_DRAMA_PRODUCTION_PACK: '1',
        NODE_ENV: 'staging',
        PRODUCTION_DRAMA_MEDIA_BASE_URL: 'https://media.dramavela.com/root',
      }),
    /must explicitly be production\/prod/i,
  );

  assert.deepEqual(
    validateSuspense1913ProductionSeedEnvironment({
      ...baseEnv,
      SEED_DRAMA_PRODUCTION_PACK: '1',
    }),
    { mediaBaseUrl: 'https://media.dramavela.com/root' },
  );
});

test('production Suspense seed requires https production media URL', () => {
  assert.throws(
    () =>
      validateSuspense1913ProductionSeedEnvironment({
        SEED_DRAMA_PRODUCTION_PACK: '1',
        APP_ENV: 'prod',
        PRODUCTION_DRAMA_MEDIA_BASE_URL: 'http://media.dramavela.com/root',
      }),
    /must use https/i,
  );
});

test('production seed execution builds playback URLs from PRODUCTION_DRAMA_MEDIA_BASE_URL', async () => {
  const calls = [];
  const prisma = {
    drama: { upsert: async (args) => calls.push(['drama.upsert', args]) },
    episode: { upsert: async (args) => calls.push(['episode.upsert', args]) },
    videoAsset: { upsert: async (args) => calls.push(['videoAsset.upsert', args]) },
    $transaction: async (callback) => callback(prisma),
  };

  await createSuspense1913ProductionSeed({
    env: {
      SEED_DRAMA_PRODUCTION_PACK: '1',
      VERCEL_ENV: 'production',
      PRODUCTION_DRAMA_MEDIA_BASE_URL: 'https://prod-media.example.test/base/',
    },
    prisma,
  }).run();

  assert.deepEqual(
    calls
      .filter(([name]) => name === 'videoAsset.upsert')
      .map(([, args]) => args.create.playbackUrl),
    [
      'https://prod-media.example.test/base/dramas/suspense-1913/ep1/index.m3u8',
      'https://prod-media.example.test/base/dramas/suspense-1913/ep2/index.m3u8',
      'https://prod-media.example.test/base/dramas/suspense-1913/ep3/index.m3u8',
      'https://prod-media.example.test/base/dramas/suspense-1913/ep4/index.m3u8',
    ],
  );
});

test('builds one drama, four ordered episodes, and four HLS video assets with provenance', () => {
  const rows = buildSuspense1913SeedRows('https://staging-media.example.test/root/');

  assert.equal(rows.drama.slug, 'suspense-1913');
  assert.equal(rows.drama.totalEpisodes, 4);
  assert.equal(rows.drama.freeEpisodeCount, 2);
  assert.equal(rows.episodes.length, 4);
  assert.deepEqual(
    rows.episodes.map((episode) => [episode.episodeNumber, episode.isFree]),
    [
      [1, true],
      [2, true],
      [3, false],
      [4, false],
    ],
  );

  assert.equal(rows.videoAssets.length, 4);
  assert.deepEqual(
    rows.videoAssets.map((asset) => asset.playbackUrl),
    [
      'https://staging-media.example.test/root/dramas/suspense-1913/ep1/index.m3u8',
      'https://staging-media.example.test/root/dramas/suspense-1913/ep2/index.m3u8',
      'https://staging-media.example.test/root/dramas/suspense-1913/ep3/index.m3u8',
      'https://staging-media.example.test/root/dramas/suspense-1913/ep4/index.m3u8',
    ],
  );

  for (const asset of rows.videoAssets) {
    assert.equal(asset.provider, 'external_hls');
    assert.equal(asset.metadata.fixture, true);
    assert.equal(asset.metadata.stagingPack, 'suspense-1913-v1');
    assert.equal(
      asset.metadata.provenance.sourceUrl,
      'https://commons.wikimedia.org/wiki/File:Suspense_(1913).webm',
    );
    assert.equal(
      asset.metadata.provenance.sourceFileUrl,
      'https://upload.wikimedia.org/wikipedia/commons/2/28/Suspense_%281913%29.webm',
    );
    assert.equal(asset.metadata.provenance.license, 'Public domain / PD-1923');
    assert.equal(
      asset.metadata.provenance.licenseEvidenceUrl,
      'https://commons.wikimedia.org/wiki/Template:PD-1923',
    );
    assert.equal(asset.metadata.provenance.rightsStatus.includes('Public domain'), true);
    assert.equal(typeof asset.metadata.provenance.clip.startSec, 'number');
    assert.equal(typeof asset.metadata.provenance.clip.endSec, 'number');
    assert.equal(asset.metadata.provenance.seedVersion, 1);
    assert.equal(
      asset.metadata.provenance.seededBy,
      'GitHub #180 / #179 / #178 / Kanban t_e1437175',
    );
  }
});

test('seed execution is idempotent by slug, episode number, and episode video asset', async () => {
  const calls = [];
  const prisma = {
    drama: {
      upsert: async (args) => {
        calls.push(['drama.upsert', args]);
        return { id: args.update.id ?? args.create.id };
      },
    },
    episode: {
      upsert: async (args) => {
        calls.push(['episode.upsert', args]);
        return { id: args.update.id ?? args.create.id };
      },
    },
    videoAsset: {
      upsert: async (args) => {
        calls.push(['videoAsset.upsert', args]);
        return { id: args.update.id ?? args.create.id };
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  const seed = createSuspense1913StagingSeed({
    env: {
      SEED_DRAMA_STAGING_PACK: '1',
      NODE_ENV: 'staging',
      STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging-media.example.test',
    },
    prisma,
  });

  await seed.run();
  await seed.run();

  assert.equal(calls.filter(([name]) => name === 'drama.upsert').length, 2);
  assert.equal(calls.filter(([name]) => name === 'episode.upsert').length, 8);
  assert.equal(calls.filter(([name]) => name === 'videoAsset.upsert').length, 8);

  for (const [, args] of calls.filter(([name]) => name === 'drama.upsert')) {
    assert.deepEqual(args.where, { slug: 'suspense-1913' });
  }
  assert.deepEqual(
    calls.filter(([name]) => name === 'episode.upsert').map(([, args]) => args.where),
    [
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 1,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 2,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 3,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 4,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 1,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 2,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 3,
        },
      },
      {
        dramaId_episodeNumber: {
          dramaId: '66666666-6666-4666-8666-666666666666',
          episodeNumber: 4,
        },
      },
    ],
  );
  for (const [, args] of calls.filter(([name]) => name === 'videoAsset.upsert')) {
    assert.deepEqual(args.where, { episodeId: args.create.episodeId });
  }
});

test('seed execution uses a transaction for atomic idempotent upserts', async () => {
  let transactionCalls = 0;
  const prisma = {
    drama: { upsert: async () => ({}) },
    episode: { upsert: async () => ({}) },
    videoAsset: { upsert: async () => ({}) },
    $transaction: async (callback) => {
      transactionCalls += 1;
      return callback(prisma);
    },
  };

  const seed = createSuspense1913StagingSeed({
    env: {
      SEED_DRAMA_STAGING_PACK: '1',
      NODE_ENV: 'staging',
      STAGING_DRAMA_MEDIA_BASE_URL: 'https://staging-media.example.test',
    },
    prisma,
  });

  await seed.run();

  assert.equal(transactionCalls, 1);
});
