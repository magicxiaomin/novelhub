import { messages } from '@novelhub/shared';

import {
  parseNovelsFilters,
  serializeNovelsFilters,
  type NovelsSearchParams,
} from '@/lib/novels-filters';

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

export type NovelsUrlSearchParams = Record<string, string | string[] | undefined>;

const buildIncomingNovelsHref = (searchParams: NovelsUrlSearchParams = {}): string => {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      params.append(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    }
  });

  const query = params.toString();
  return query ? `${novelsCanonicalPath}?${query}` : novelsCanonicalPath;
};

export function shouldRedirectToCanonicalNovelsHref(
  searchParams?: NovelsUrlSearchParams,
): string | null {
  const canonicalHref = serializeNovelsFilters(parseNovelsFilters(searchParams));
  const incomingHref = buildIncomingNovelsHref(searchParams);

  return canonicalHref === incomingHref ? null : canonicalHref;
}
