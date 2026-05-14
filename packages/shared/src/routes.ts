export const ROUTES = {
  novels: () => '/novels',
  read: (bookId: string, chapterNumber: number) =>
    `/read/${encodeURIComponent(bookId)}/${chapterNumber}`,
  account: () => '/me',
  recharge: () => '/recharge',
} as const;
