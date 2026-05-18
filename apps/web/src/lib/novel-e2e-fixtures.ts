import type {
  BookDetail,
  BookSummary,
  CategoryCount,
  ChapterResponse,
  ChapterSummary,
  Paginated,
} from './types';

export const novelE2eFixtureBookId = '19500000-0000-4195-8195-000000000198';
const legacyReaderFixtureBookId = '11111111-1111-4111-8111-111111111111';

const coverSvg = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#7c3aed"/><text x="24" y="210" fill="white" font-size="34" font-family="sans-serif">Novel Funnel</text></svg>',
);

export const novelE2eFixtureChapters: ChapterSummary[] = [1, 2, 3, 4].map((order) => ({
  id: `11111111-1111-4111-8111-11111111111${order}`,
  bookId: novelE2eFixtureBookId,
  order,
  title: order === 4 ? 'The Locked Door' : `Free Chapter ${order}`,
  isFree: order <= 3,
  wordCount: order === 4 ? 1420 : 1200 + order,
}));

export const novelE2eFixtureBook: BookDetail = {
  id: novelE2eFixtureBookId,
  title: 'Novel Funnel Test Book',
  author: 'NovelHub QA',
  coverUrl: `data:image/svg+xml,${coverSvg}`,
  category: 'ROMANCE',
  tags: ['e2e', 'funnel'],
  status: 'ONGOING',
  isFeatured: true,
  totalChapters: novelE2eFixtureChapters.length,
  freeChapterCount: 3,
  coinPerChapter: 5,
  description:
    'A deterministic novel fixture for validating the ad landing, free-reading, paywall, subscription, coin, and library funnel.',
  chapters: novelE2eFixtureChapters,
};

export const novelE2eFixtureChapterList: Paginated<ChapterSummary> = {
  items: novelE2eFixtureChapters,
  total: novelE2eFixtureChapters.length,
  page: 1,
  limit: 200,
};

const baseListBooks: BookSummary[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    coverUrl: '/covers/pride-and-prejudice.svg',
    category: 'ROMANCE',
    tags: ['classic', 'regency', 'slow-burn'],
    status: 'COMPLETED',
    isFeatured: true,
    totalChapters: 10,
    freeChapterCount: 3,
    coinPerChapter: 5,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    coverUrl: '/covers/sherlock-holmes.svg',
    category: 'MYSTERY',
    tags: ['classic', 'detective', 'short-stories'],
    status: 'COMPLETED',
    isFeatured: true,
    totalChapters: 10,
    freeChapterCount: 3,
    coinPerChapter: 5,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    coverUrl: '/covers/frankenstein.svg',
    category: 'GOTHIC',
    tags: ['classic', 'gothic', 'horror'],
    status: 'COMPLETED',
    isFeatured: false,
    totalChapters: 10,
    freeChapterCount: 3,
    coinPerChapter: 5,
  },
];

const legacyReaderFixtureTitles = [
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
];

const legacyReaderFixtureChapters: ChapterSummary[] = legacyReaderFixtureTitles.map(
  (title, index) => ({
    id: `${legacyReaderFixtureBookId}-${String(index + 1).padStart(2, '0')}`,
    bookId: legacyReaderFixtureBookId,
    order: index + 1,
    title,
    isFree: index < 3,
    wordCount: 1100 + index,
  }),
);

const legacyReaderFixtureBook: BookDetail = {
  ...baseListBooks[0]!,
  description:
    'A deterministic Pride and Prejudice fixture retained for legacy anonymous browsing and reader smoke tests.',
  chapters: legacyReaderFixtureChapters,
};

const fixtureBookDetails = new Map<string, BookDetail>([
  [novelE2eFixtureBook.id, novelE2eFixtureBook],
  [legacyReaderFixtureBook.id, legacyReaderFixtureBook],
]);

const fixtureChapterLists = new Map<string, ChapterSummary[]>([
  [novelE2eFixtureBook.id, novelE2eFixtureChapters],
  [legacyReaderFixtureBook.id, legacyReaderFixtureChapters],
]);

export const novelE2eFixtureBooks: BookSummary[] = [
  ...baseListBooks,
  ...Array.from({ length: 22 }, (_, index) => {
    const number = index + 1;
    const category = number % 2 === 0 ? 'MYSTERY' : 'ROMANCE';
    const status = number % 3 === 0 ? 'ONGOING' : 'COMPLETED';
    return {
      id: `19500000-0000-4195-8195-${String(1000 + number).padStart(12, '0')}`,
      title: `Pagination Fixture Novel ${number}`,
      author: 'NovelHub QA',
      coverUrl: `data:image/svg+xml,${coverSvg}`,
      category,
      tags: ['e2e', 'pagination'],
      status,
      isFeatured: false,
      totalChapters: 12,
      freeChapterCount: 3,
      coinPerChapter: 5,
    } satisfies BookSummary;
  }),
];

export function novelE2eFixtureBookList(query?: {
  category?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}): Paginated<BookSummary> {
  const page = query?.page ?? 1;
  const limit = query?.limit ?? 20;
  const filtered = novelE2eFixtureBooks.filter((book) => {
    if (query?.category && book.category !== query.category) return false;
    if (query?.status && book.status !== query.status) return false;
    if (query?.featured !== undefined && book.isFeatured !== query.featured) return false;
    return true;
  });
  const start = (page - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  };
}

export const novelE2eFixtureCategories: CategoryCount[] = Array.from(
  novelE2eFixtureBooks.reduce<Map<string, number>>((counts, book) => {
    counts.set(book.category, (counts.get(book.category) ?? 0) + 1);
    return counts;
  }, new Map()),
  ([category, count]) => ({ category, count }),
);

export function novelE2eFixtureBookDetail(bookId: string): BookDetail | null {
  return fixtureBookDetails.get(bookId) ?? null;
}

export function novelE2eFixtureChapterListForBook(
  bookId: string,
  page: number,
  limit: number,
): Paginated<ChapterSummary> | null {
  const chapters = fixtureChapterLists.get(bookId);
  if (!chapters) return null;
  const start = (page - 1) * limit;
  return {
    items: chapters.slice(start, start + limit),
    total: chapters.length,
    page,
    limit,
  };
}

export function novelE2eFixtureChapter(chapterId: string): ChapterResponse | null {
  const summary = [...novelE2eFixtureChapters, ...legacyReaderFixtureChapters].find(
    (chapter) => chapter.id === chapterId,
  );
  if (!summary) return null;
  if (!summary.isFree) {
    return {
      id: summary.id,
      bookId: summary.bookId,
      chapterNumber: summary.order,
      title: summary.title,
      isLocked: true,
      preview:
        'A locked preview teases the next twist and confirms that chapter four is beyond the three free chapter limit.',
      unlockOptions: {
        coinCost: fixtureBookDetails.get(summary.bookId)?.coinPerChapter ?? 5,
        canUnlockWithCoins: false,
        canUnlockWithSubscription: false,
      },
    };
  }

  return {
    id: summary.id,
    bookId: summary.bookId,
    chapterNumber: summary.order,
    title: summary.title,
    isLocked: false,
    contentUrl: `https://novel-e2e-content.test/${summary.bookId}/chapter-${summary.order}.txt`,
    wordCount: summary.wordCount,
    prevChapterId: fixtureChapterLists.get(summary.bookId)?.[summary.order - 2]?.id ?? null,
    nextChapterId: fixtureChapterLists.get(summary.bookId)?.[summary.order]?.id ?? null,
  };
}
