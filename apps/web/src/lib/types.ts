/**
 * Mirrors the shapes returned by `apps/api`. Hand-written rather than
 * generated to keep the web bundle small. If these drift the integration
 * test (book listing fetch in the dev server) will surface the mismatch.
 */
export type AuthUser = {
  id: string;
  email: string;
  coinBalance: number;
  hasPassword: boolean;
  hasActiveSubscription: boolean;
  isAdmin: boolean;
  bannedAt: string | null;
};

export type BookSummary = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  tags: string[];
  status: string;
  isFeatured: boolean;
  totalChapters: number;
  freeChapterCount: number;
  coinPerChapter: number;
};

export type ChapterSummary = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  isFree: boolean;
  wordCount: number;
};

export type BookDetail = BookSummary & {
  description: string;
  chapters: ChapterSummary[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type CategoryCount = {
  category: string;
  count: number;
};

export type ReadingProgressEntry = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  scrollPercent: number;
  bookTitle: string;
  bookCover: string;
  updatedAt: string;
};

export type ChapterReadingProgress = {
  id: string;
  bookId: string;
  chapterId: string;
  scrollPercent: number;
  lastReadAt: string;
};

export type ChapterUnlockOptions = {
  coinCost: number;
  canUnlockWithCoins: boolean;
  canUnlockWithSubscription: boolean;
};

export type LockedChapter = {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string;
  isLocked: true;
  preview: string;
  unlockOptions: ChapterUnlockOptions;
};

export type UnlockedChapter = {
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

export type ChapterResponse = LockedChapter | UnlockedChapter;

export type ChapterUnlock = {
  id: string;
  chapterId: string;
  method: string;
  unlockedAt: string;
};

export type CheckoutSession = {
  url: string;
  sessionId: string;
};

export type PaymentOrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type PaymentOrder = {
  status: PaymentOrderStatus;
  type: string;
  amount: number;
  currency: string;
  coinsGranted: number | null;
  completedAt: string | null;
};

export type SubscriptionSummary = {
  plan: 'weekly' | 'monthly';
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

export type CoinTransaction = {
  id: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
  createdAt: string;
};

export type CheckinStatus = {
  today: string;
  claimedToday: boolean;
  streakCount: number;
  nextReward: number;
  todayReward: number;
};

export type CheckinClaim = {
  streakCount: number;
  coinsAwarded: number;
  newBalance: number;
};

export type PushGrantBonus = {
  granted: boolean;
  balance?: number;
  reason?: 'already_granted' | 'no_subscription';
};

export type DramaSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  posterUrl: string;
  category: string;
  tags: string[];
  totalEpisodes: number;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  freeEpisodeCount: number;
  coinPerEpisode: number;
  publishedAt: string | null;
};

export type EpisodeProgress = {
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: string | null;
  lastWatchedAt: string;
};

export type EpisodeSummary = {
  id: string;
  episodeNumber: number;
  title: string;
  synopsis: string | null;
  durationSeconds: number | null;
  isFree: boolean;
  publishedAt: string | null;
  isUnlocked: boolean;
  progress: EpisodeProgress | null;
};

export type DramaDetail = DramaSummary & {
  episodes: EpisodeSummary[];
};

export type DramaPageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DramaPaginated<T> = {
  items: T[];
  pageInfo: DramaPageInfo;
};

export type EpisodePlaybackAccessReason = 'free' | 'unlocked' | 'subscription' | 'locked';

export type EpisodePlaybackGranted = {
  episodeId: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  durationSeconds: number | null;
  access: 'granted';
  accessReason: Exclude<EpisodePlaybackAccessReason, 'locked'>;
  hlsUrl: string;
  provider: string;
  thumbnailUrl: string | null;
};

export type EpisodePlaybackDenied = {
  episodeId: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  durationSeconds: number | null;
  access: 'denied';
  accessReason: 'locked';
  coinPerEpisode: number;
};

export type EpisodePlayback = EpisodePlaybackGranted | EpisodePlaybackDenied;

export type EpisodeUnlockResult = {
  episodeId: string;
  dramaId: string;
  episodeNumber: number;
  access: 'granted';
  accessReason: 'unlocked' | 'subscription';
  unlockId: string;
  method: string;
  coinCost: number;
  balanceAfter: number | null;
  transactionId: string | null;
  unlockedAt: string;
};
