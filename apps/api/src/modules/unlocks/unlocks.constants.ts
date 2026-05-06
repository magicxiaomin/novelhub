export const UNLOCK_METHOD = {
  COINS: 'COINS',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;

export type UnlockMethod = (typeof UNLOCK_METHOD)[keyof typeof UNLOCK_METHOD];

export type UnlockResponse = {
  id: string;
  chapterId: string;
  bookId: string;
  method: UnlockMethod;
  unlockedAt: Date;
};

export type UnlockListItem = {
  id: string;
  chapterId: string;
  method: string;
  unlockedAt: Date;
};
