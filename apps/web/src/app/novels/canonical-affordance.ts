import { messages } from '@novelhub/shared';

import { parseNovelsFilters, type NovelsSearchParams } from '@/lib/novels-filters';

export const novelsCanonicalPath = '/novels';

export type CanonicalNovelsAffordance = {
  href: typeof novelsCanonicalPath;
  label: string;
};

export function shouldShowCanonicalNovelsAffordance(searchParams?: NovelsSearchParams): boolean {
  const filters = parseNovelsFilters(searchParams);

  return Boolean(filters.category || filters.status || filters.page);
}

export function buildCanonicalNovelsAffordance(
  searchParams?: NovelsSearchParams,
): CanonicalNovelsAffordance | null {
  if (!shouldShowCanonicalNovelsAffordance(searchParams)) {
    return null;
  }

  return {
    href: novelsCanonicalPath,
    label: messages.novels.filteredViewCanonicalCta,
  };
}
