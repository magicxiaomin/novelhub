export type LockedChapterResponse = {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string;
  isLocked: true;
  preview: string;
  unlockOptions: {
    coinCost: number;
    canUnlockWithCoins: boolean;
    canUnlockWithSubscription: boolean;
  };
};

export type UnlockedChapterResponse = {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string;
  isLocked: false;
  contentUrl: string;
  wordCount: number;
  prevChapterId: string | null;
  nextChapterId: string | null;
};

export type ChapterReadResponse = LockedChapterResponse | UnlockedChapterResponse;
