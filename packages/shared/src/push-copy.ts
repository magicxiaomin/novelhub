// TODO: Replace these cron notification literals with locale-keyed lookups when
// backend notification jobs can resolve user locales.
export const PUSH_COPY = {
  reEngagement: {
    title: (bookTitle: string) => `Continue reading ${bookTitle}`,
    body: 'Your next chapter is waiting.',
  },
  renewalReminder: {
    title: 'Your subscription renews in 3 days.',
    body: 'Manage in Settings.',
  },
} as const;
