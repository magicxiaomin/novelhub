import type { BookDetail, ChapterResponse, ChapterSummary, Paginated } from './types';

export const novelE2eFixtureBookId = '22222222-2222-4222-8222-222222222222';

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
  category: 'Romance',
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

export function novelE2eFixtureChapter(chapterId: string): ChapterResponse | null {
  const summary = novelE2eFixtureChapters.find((chapter) => chapter.id === chapterId);
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
        coinCost: novelE2eFixtureBook.coinPerChapter,
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
    contentUrl: `https://novel-e2e-content.test/chapter-${summary.order}.txt`,
    wordCount: summary.wordCount,
    prevChapterId: novelE2eFixtureChapters[summary.order - 2]?.id ?? null,
    nextChapterId: novelE2eFixtureChapters[summary.order]?.id ?? null,
  };
}

export function novelE2eFixtureContent(chapterNumber: number): string {
  return `Free chapter ${chapterNumber} opens the acquisition funnel.\n\nReaders can continue through chapter three before the paywall appears.`;
}
