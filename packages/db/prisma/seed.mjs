import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const HASH_COST = 12;
const ADMIN_EMAIL = 'admin@novelhub.local';
const ADMIN_PASSWORD = 'admin12345';

function buildChapters(bookId, idPrefix, contentKey) {
  return Array.from({ length: 10 }, (_, index) => {
    const order = index + 1;
    const paddedOrder = String(order).padStart(2, '0');
    const uuidTail = String(order).padStart(12, '0');

    return {
      id: `${idPrefix}-${paddedOrder.padStart(4, '0')}-4000-8000-${uuidTail}`,
      bookId,
      order,
      title: `Chapter ${order}`,
      contentUrl: `books/${contentKey}/chapter-${paddedOrder}.json`,
      wordCount: 1800 + order * 120,
      isFree: order <= 3,
      publishedAt: new Date(Date.UTC(2026, 0, order)),
      deletedAt: null,
    };
  });
}

const books = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    idPrefix: '11111111',
    contentKey: 'moonlit-promise',
    title: 'Moonlit Promise',
    author: 'Ava Sterling',
    coverUrl: 'https://cdn.novelhub.local/covers/moonlit-promise.webp',
    description:
      'A rejected heir discovers a dangerous bond that could save her pack or destroy the only home she has left.',
    category: 'WEREWOLF',
    tags: ['rejected-mate', 'pack-politics', 'slow-burn'],
    totalChapters: 10,
    status: 'ONGOING',
    isFeatured: true,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    idPrefix: '22222222',
    contentKey: 'contract-heiress',
    title: 'Contract Heiress',
    author: 'Maya Hart',
    coverUrl: 'https://cdn.novelhub.local/covers/contract-heiress.webp',
    description:
      'A marriage contract meant to protect a family empire turns into a high-stakes romance with secrets on both sides.',
    category: 'BILLIONAIRE',
    tags: ['contract-marriage', 'family-secrets', 'office-romance'],
    totalChapters: 10,
    status: 'ONGOING',
    isFeatured: true,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    idPrefix: '33333333',
    contentKey: 'ashes-of-evernight',
    title: 'Ashes of Evernight',
    author: 'Lena Vale',
    coverUrl: 'https://cdn.novelhub.local/covers/ashes-of-evernight.webp',
    description:
      'An apprentice with forbidden magic must cross a cursed kingdom before an ancient court wakes beneath the capital.',
    category: 'FANTASY',
    tags: ['forbidden-magic', 'quest', 'royal-court'],
    totalChapters: 10,
    status: 'COMPLETED',
    isFeatured: false,
    freeChapterCount: 3,
    coinPerChapter: 5,
    deletedAt: null,
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
    const { contentKey, id, idPrefix, ...bookData } = book;

    await prisma.book.upsert({
      where: { id },
      update: bookData,
      create: {
        id,
        ...bookData,
      },
    });

    const chapters = buildChapters(id, idPrefix, contentKey);

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

async function main() {
  await seedAdmin();
  await seedBooks();
}

main()
  .catch((error) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
