import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const HASH_COST = 12;
const ADMIN_EMAIL = 'admin@novelhub.local';
const ADMIN_PASSWORD = 'admin12345';

function buildChapters(bookId, idPrefix, contentKey, chapterTitles) {
  return Array.from({ length: 10 }, (_, index) => {
    const order = index + 1;
    const paddedOrder = String(order).padStart(2, '0');
    const uuidTail = String(order).padStart(12, '0');
    const fallbackTitle = `Chapter ${order}`;
    const title = chapterTitles?.[index] ?? fallbackTitle;

    return {
      id: `${idPrefix}-${paddedOrder.padStart(4, '0')}-4000-8000-${uuidTail}`,
      bookId,
      order,
      title,
      contentUrl: `chapters/${contentKey}/chapter-${paddedOrder}.txt`,
      wordCount: 1800 + order * 120,
      isFree: order <= 3,
      publishedAt: new Date(Date.UTC(2026, 0, order)),
      deletedAt: null,
    };
  });
}

const dramas = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    slug: 'the-billionaire-contract',
    title: 'The Billionaire Contract',
    description:
      'A florist signs a one-year marriage contract with a guarded CEO, then discovers the family secret that could destroy both their hearts.',
    posterUrl: '/dramas/the-billionaire-contract/poster.svg',
    category: 'ROMANCE',
    tags: ['contract-marriage', 'billionaire', 'vertical-drama'],
    totalEpisodes: 6,
    status: 'PUBLISHED',
    isFeatured: true,
    sortOrder: 10,
    freeEpisodeCount: 3,
    coinPerEpisode: 5,
    publishedAt: new Date(Date.UTC(2026, 4, 1)),
    deletedAt: null,
    episodeTitles: [
      'The Offer',
      'A Ring Before Sunrise',
      'Dinner With Enemies',
      'The Locked Penthouse',
      'A Contract Torn',
      'Choose Me Again',
    ],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    slug: 'revenge-in-red-heels',
    title: 'Revenge in Red Heels',
    description:
      'After a public betrayal, a designer returns under a new name to reclaim her company and expose the people who stole her life.',
    posterUrl: '/dramas/revenge-in-red-heels/poster.svg',
    category: 'REVENGE',
    tags: ['revenge', 'fashion', 'comeback'],
    totalEpisodes: 6,
    status: 'PUBLISHED',
    isFeatured: false,
    sortOrder: 20,
    freeEpisodeCount: 3,
    coinPerEpisode: 5,
    publishedAt: new Date(Date.UTC(2026, 4, 2)),
    deletedAt: null,
    episodeTitles: [
      'The Fall',
      'A New Name',
      'Runway Trap',
      'The Hidden Ledger',
      'Boardroom Fire',
      'Her Final Bow',
    ],
  },
];

function buildDramaEpisodes(drama) {
  return drama.episodeTitles.map((title, index) => {
    const episodeNumber = index + 1;
    const padded = String(episodeNumber).padStart(2, '0');
    const uuidTail = String(episodeNumber).padStart(12, '0');
    const prefix = drama.id.slice(0, 8);

    return {
      id: `${prefix}-${padded.padStart(4, '0')}-4d00-8d00-${uuidTail}`,
      dramaId: drama.id,
      episodeNumber,
      title,
      synopsis: `Episode ${episodeNumber} of ${drama.title}.`,
      durationSeconds: 72 + episodeNumber * 8,
      isFree: episodeNumber <= drama.freeEpisodeCount,
      isPublished: true,
      publishedAt: new Date(Date.UTC(2026, 4, episodeNumber)),
      deletedAt: null,
      videoAsset: {
        id: `${prefix}-${padded.padStart(4, '0')}-4a00-8a00-${uuidTail}`,
        provider: 'external_hls',
        playbackUrl: `https://media.dramavela.test/hls/${drama.slug}/episode-${padded}.m3u8`,
        thumbnailUrl: `/dramas/${drama.slug}/episode-${padded}.jpg`,
        durationSeconds: 72 + episodeNumber * 8,
        metadata: {
          fixture: true,
          aspectRatio: '9:16',
        },
      },
    };
  });
}

const books = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    idPrefix: '11111111',
    contentKey: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    coverUrl: '/covers/pride-and-prejudice.svg',
    description:
      'When the wealthy Mr. Darcy arrives in the Bennet family neighborhood, sharp-witted Elizabeth must navigate first impressions, social pressure, and her own pride to discover what she really wants.',
    category: 'ROMANCE',
    tags: ['classic', 'regency', 'slow-burn'],
    totalChapters: 10,
    status: 'COMPLETED',
    isFeatured: true,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
    chapterTitles: [
      'A Truth Universally Acknowledged',
      'Mr. Bennet Pays a Call',
      'The Meryton Assembly',
      'Sisters Confide',
      'The Lucases at Longbourn',
      'A Visit to Netherfield',
      'The Officers Arrive in Meryton',
      'Jane Falls Ill',
      'A Letter Brings News',
      'Conversations After Dinner',
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    idPrefix: '22222222',
    contentKey: 'sherlock-holmes',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    coverUrl: '/covers/sherlock-holmes.svg',
    description:
      'Ten classic cases from 221B Baker Street: a king blackmailed by a clever opera singer, a vanishing pawnbroker, a bachelor’s missing bride, and the spotted band that creeps in the dark.',
    category: 'MYSTERY',
    tags: ['classic', 'detective', 'short-stories'],
    totalChapters: 10,
    status: 'COMPLETED',
    isFeatured: true,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
    chapterTitles: [
      'A Scandal in Bohemia',
      'The Red-Headed League',
      'A Case of Identity',
      'The Boscombe Valley Mystery',
      'The Five Orange Pips',
      'The Man with the Twisted Lip',
      'The Adventure of the Blue Carbuncle',
      'The Adventure of the Speckled Band',
      'The Adventure of the Engineer’s Thumb',
      'The Adventure of the Noble Bachelor',
    ],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    idPrefix: '33333333',
    contentKey: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    coverUrl: '/covers/frankenstein.svg',
    description:
      'A young scientist obsessed with the boundary between life and death gives form to a creature he cannot control. A gothic tragedy of ambition, isolation, and the price of creation.',
    category: 'GOTHIC',
    tags: ['classic', 'gothic', 'horror'],
    totalChapters: 10,
    status: 'COMPLETED',
    isFeatured: false,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
    chapterTitles: [
      'A Letter from the Arctic',
      'The Stranger on the Ice',
      'Geneva, My Childhood',
      'A Family in Mourning',
      'The Spark of Life',
      'The Monster Awakes',
      'Flight Through the Night',
      'A Letter from Elizabeth',
      'Justine on Trial',
      'In the Mountains of Chamonix',
    ],
  },
];

async function seedAdmin() {
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, HASH_COST);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      emailVerified: true,
      isAdmin: true,
      deletedAt: null,
    },
    create: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: ADMIN_EMAIL,
      passwordHash,
      emailVerified: true,
      isAdmin: true,
    },
  });
}

async function seedBooks() {
  for (const book of books) {
    const { contentKey, id, idPrefix, chapterTitles, ...bookData } = book;

    await prisma.book.upsert({
      where: { id },
      update: bookData,
      create: {
        id,
        ...bookData,
      },
    });

    const chapters = buildChapters(id, idPrefix, contentKey, chapterTitles);

    for (const chapter of chapters) {
      const { id: chapterId, ...chapterData } = chapter;

      await prisma.chapter.upsert({
        where: { id: chapterId },
        update: chapterData,
        create: {
          id: chapterId,
          ...chapterData,
        },
      });
    }
  }
}

async function seedDramas() {
  for (const drama of dramas) {
    const { episodeTitles, ...dramaData } = drama;

    await prisma.drama.upsert({
      where: { id: drama.id },
      update: dramaData,
      create: dramaData,
    });

    const episodes = buildDramaEpisodes(drama);
    for (const episode of episodes) {
      const { videoAsset, ...episodeData } = episode;

      await prisma.episode.upsert({
        where: { id: episode.id },
        update: episodeData,
        create: episodeData,
      });

      await prisma.videoAsset.upsert({
        where: { episodeId: episode.id },
        update: videoAsset,
        create: {
          episodeId: episode.id,
          ...videoAsset,
        },
      });
    }
  }
}

async function uploadChapterContentToR2() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_BUCKET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length === required.length) {
    console.log('[seed] R2 env unset - skipping chapter content upload to R2.');
    return;
  }
  if (missing.length > 0) {
    throw new Error(`[seed] Partial R2 env: missing ${missing.join(', ')}`);
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
    },
  });

  // Anchor at the workspace's apps/api/static dir. process.cwd() is the
  // package the seed was invoked from, so resolve relative to this file.
  const here = path.dirname(new URL(import.meta.url).pathname);
  const staticRoot = path.resolve(here, '..', '..', '..', 'apps', 'api', 'static');

  let uploaded = 0;
  for (const book of books) {
    for (let order = 1; order <= 10; order += 1) {
      const padded = String(order).padStart(2, '0');
      const key = `chapters/${book.contentKey}/chapter-${padded}.txt`;
      const filePath = path.join(staticRoot, 'chapters', book.contentKey, `chapter-${padded}.txt`);
      const body = await readFile(filePath, 'utf-8');
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: 'text/plain; charset=utf-8',
        }),
      );
      uploaded += 1;
    }
  }
  console.log(`[seed] Uploaded ${uploaded} chapter files to R2 bucket ${process.env.R2_BUCKET}.`);
}

async function main() {
  await seedAdmin();
  await seedBooks();
  await seedDramas();
  await uploadChapterContentToR2();
}

main()
  .catch((error) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
