export const CHAPTERS_READ_COUNT_KEY = 'chapters-read-count';
export const CHAPTERS_READ_COUNT_EVENT = 'chapters-read-count-changed';

export const getChaptersReadCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(CHAPTERS_READ_COUNT_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const incrementChaptersReadCount = (): number => {
  const next = getChaptersReadCount() + 1;
  window.localStorage.setItem(CHAPTERS_READ_COUNT_KEY, String(next));
  window.dispatchEvent(new CustomEvent(CHAPTERS_READ_COUNT_EVENT, { detail: next }));
  return next;
};
