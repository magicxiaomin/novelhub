import { parseNovelsFilters, serializeNovelsFilters } from './novels-filters';

export type NovelsUrlSearchParams = Record<string, string | string[] | undefined>;

const novelsCanonicalPath = '/novels';

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
