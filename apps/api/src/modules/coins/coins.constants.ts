export const COIN_TXN_TYPE = {
  SIGNUP_BONUS: 'SIGNUP_BONUS',
  CHAPTER_UNLOCK: 'CHAPTER_UNLOCK',
  PURCHASE: 'PURCHASE',
  DAILY_CHECKIN: 'DAILY_CHECKIN',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  REFUND: 'REFUND',
} as const;

export type CoinTxnType = (typeof COIN_TXN_TYPE)[keyof typeof COIN_TXN_TYPE];

export type CoinTransactionRow = {
  id: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
  createdAt: Date;
};
