import { fileURLToPath } from 'node:url';

const DRAMA_ID = '66666666-6666-4666-8666-666666666666';
const DRAMA_SLUG = 'suspense-1913';
const SEED_VERSION = 1;
const STAGING_PACK = 'suspense-1913-v1';
const SEEDED_BY = 'GitHub #180 / #179 / #178 / Kanban t_e1437175';

const SOURCE_PROVENANCE = {
  originalWork: 'Suspense (1913), dir. Lois Weber and Phillips Smalley',
  rightsStatus:
    'Public domain in the United States; pre-1928 publication / PD-1923 evidence on Wikimedia Commons',
  source: 'Wikimedia Commons',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Suspense_(1913).webm',
  sourceFileUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Suspense_%281913%29.webm',
  license: 'Public domain / PD-1923',
  licenseEvidenceUrl: 'https://commons.wikimedia.org/wiki/Template:PD-1923',
  attribution:
    'Suspense (1913), public domain; source retained for evidence, attribution not required by PD status',
  modifiedForStaging: true,
  seedVersion: SEED_VERSION,
  seededBy: SEEDED_BY,
};

const EPISODES = [
  {
    episodeNumber: 1,
    title: 'Part 1: The Call',
    startSec: 0,
    endSec: 152.5,
  },
  {
    episodeNumber: 2,
    title: 'Part 2: The Intruder',
    startSec: 152.5,
    endSec: 305,
  },
  {
    episodeNumber: 3,
    title: 'Part 3: The Rescue Race',
    startSec: 305,
    endSec: 457.5,
  },
  {
    episodeNumber: 4,
    title: 'Part 4: The Escape',
    startSec: 457.5,
    endSec: 610.276,
  },
];

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function seededUuid(kind, episodeNumber) {
  const padded = String(episodeNumber).padStart(4, '0');
  const uuidTail = String(episodeNumber).padStart(12, '0');
  const marker = kind === 'episode' ? '4d00-8d00' : '4a00-8a00';
  return `66666666-${padded}-${marker}-${uuidTail}`;
}

function withoutId(row) {
  const { id: _id, ...rest } = row;
  return rest;
}

export function validateSuspense1913SeedEnvironment(env = process.env) {
  if (env.SEED_DRAMA_STAGING_PACK !== '1') {
    throw new Error(
      '[suspense-1913 seed] Refusing to run: set SEED_DRAMA_STAGING_PACK=1 explicitly.',
    );
  }

  const nodeEnv = String(env.NODE_ENV ?? '').toLowerCase();
  const appEnv = String(env.APP_ENV ?? env.RAILWAY_ENVIRONMENT_NAME ?? '').toLowerCase();
  const vercelEnv = String(env.VERCEL_ENV ?? '').toLowerCase();
  const allowedEnvironmentValues = new Set(['development', 'dev', 'staging', 'test']);
  const environmentValues = [nodeEnv, appEnv, vercelEnv].filter(Boolean);
  const unsafeValues = new Set(['production', 'prod']);

  if (environmentValues.some((value) => unsafeValues.has(value))) {
    throw new Error('[suspense-1913 seed] Refuses production/prod environments.');
  }

  if (!environmentValues.some((value) => allowedEnvironmentValues.has(value))) {
    throw new Error(
      '[suspense-1913 seed] APP_ENV, NODE_ENV, or VERCEL_ENV must explicitly be one of development, staging, or test.',
    );
  }

  const baseUrl = env.STAGING_DRAMA_MEDIA_BASE_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new Error('[suspense-1913 seed] STAGING_DRAMA_MEDIA_BASE_URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('[suspense-1913 seed] STAGING_DRAMA_MEDIA_BASE_URL must be an absolute URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('[suspense-1913 seed] STAGING_DRAMA_MEDIA_BASE_URL must use https.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedDramavelaHosts = new Set(['staging.dramavela.com']);
  if (hostname.includes('dramavela.com') && !allowedDramavelaHosts.has(hostname)) {
    throw new Error('[suspense-1913 seed] Refusing non-staging dramavela.com media host.');
  }

  return {
    mediaBaseUrl: normalizeBaseUrl(baseUrl),
  };
}

export function buildSuspense1913SeedRows(mediaBaseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(mediaBaseUrl);
  const publishedAt = new Date(Date.UTC(2026, 4, 12));

  const drama = {
    id: DRAMA_ID,
    slug: DRAMA_SLUG,
    title: 'Suspense (1913)',
    description:
      'A public-domain silent thriller staged for alpha QA: a split-screen rescue race unfolds after an intruder threatens a mother and child.',
    posterUrl: '/dramas/suspense-1913/poster.svg',
    category: 'THRILLER',
    tags: ['public-domain', 'silent-film', 'suspense', 'staging'],
    totalEpisodes: 4,
    status: 'PUBLISHED',
    isFeatured: false,
    sortOrder: 90,
    freeEpisodeCount: 2,
    coinPerEpisode: 5,
    publishedAt,
    deletedAt: null,
  };

  const episodes = EPISODES.map((episode) => {
    const durationSeconds = Math.round(episode.endSec - episode.startSec);

    return {
      id: seededUuid('episode', episode.episodeNumber),
      dramaId: DRAMA_ID,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      synopsis: `Staging clip ${episode.episodeNumber} from Suspense (1913).`,
      durationSeconds,
      isFree: episode.episodeNumber <= drama.freeEpisodeCount,
      isPublished: true,
      publishedAt,
      deletedAt: null,
    };
  });

  const videoAssets = EPISODES.map((episode) => {
    const durationSeconds = Math.round(episode.endSec - episode.startSec);

    return {
      id: seededUuid('videoAsset', episode.episodeNumber),
      episodeId: seededUuid('episode', episode.episodeNumber),
      provider: 'external_hls',
      playbackUrl: `${normalizedBaseUrl}/dramas/${DRAMA_SLUG}/ep${episode.episodeNumber}/index.m3u8`,
      thumbnailUrl: `/dramas/${DRAMA_SLUG}/ep${episode.episodeNumber}.jpg`,
      durationSeconds,
      metadata: {
        fixture: true,
        aspectRatio: '4:3',
        stagingPack: STAGING_PACK,
        provenance: {
          ...SOURCE_PROVENANCE,
          clip: {
            startSec: episode.startSec,
            endSec: episode.endSec,
          },
        },
      },
    };
  });

  return { drama, episodes, videoAssets };
}

export function createSuspense1913StagingSeed({ env = process.env, prisma }) {
  if (!prisma) {
    throw new Error('[suspense-1913 seed] prisma client is required.');
  }

  return {
    async run() {
      const { mediaBaseUrl } = validateSuspense1913SeedEnvironment(env);
      const { drama, episodes, videoAssets } = buildSuspense1913SeedRows(mediaBaseUrl);

      await prisma.$transaction(async (tx) => {
        const dramaUpdate = withoutId(drama);
        await tx.drama.upsert({
          where: { slug: DRAMA_SLUG },
          update: dramaUpdate,
          create: drama,
        });

        for (const episode of episodes) {
          const episodeUpdate = withoutId(episode);
          await tx.episode.upsert({
            where: {
              dramaId_episodeNumber: {
                dramaId: DRAMA_ID,
                episodeNumber: episode.episodeNumber,
              },
            },
            update: episodeUpdate,
            create: episode,
          });
        }

        for (const videoAsset of videoAssets) {
          const videoAssetUpdate = withoutId(videoAsset);
          await tx.videoAsset.upsert({
            where: { episodeId: videoAsset.episodeId },
            update: videoAssetUpdate,
            create: videoAsset,
          });
        }
      });

      return {
        dramaSlug: DRAMA_SLUG,
        episodes: episodes.length,
        videoAssets: videoAssets.length,
        freeEpisodeCount: drama.freeEpisodeCount,
      };
    },
  };
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const result = await createSuspense1913StagingSeed({ env: process.env, prisma }).run();
    console.log(
      `[suspense-1913 seed] Upserted ${result.dramaSlug}: ${result.episodes} episodes, ${result.videoAssets} video assets, ${result.freeEpisodeCount} free episodes.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
