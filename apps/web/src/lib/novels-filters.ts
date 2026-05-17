import { messages } from '@novelhub/shared';

export const statusFilterOptions = [
  { value: 'ONGOING', label: messages.novels.statusOngoing },
  { value: 'COMPLETED', label: messages.novels.statusCompleted },
] as const;

export type NovelStatusFilter = (typeof statusFilterOptions)[number]['value'];

export type NovelsSearchParams = {
  category?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

export type NovelsFilters = {
  category?: string;
  status?: NovelStatusFilter;
  page?: number;
};

const singleValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? undefined : value;

const isStatusFilter = (value: string | undefined): value is NovelStatusFilter =>
  statusFilterOptions.some((option) => option.value === value);

export const parseNovelsFilters = (searchParams: NovelsSearchParams = {}): NovelsFilters => {
  const category = singleValue(searchParams.category)?.trim();
  const status = singleValue(searchParams.status);
  const pageValue = singleValue(searchParams.page);
  const parsedPage = pageValue ? Number(pageValue) : undefined;
  const page =
    Number.isInteger(parsedPage) && parsedPage !== undefined && parsedPage > 1
      ? parsedPage
      : undefined;

  return {
    ...(category ? { category } : {}),
    ...(isStatusFilter(status) ? { status } : {}),
    ...(page ? { page } : {}),
  };
};

export const buildNovelsHref = (
  current: NovelsFilters,
  updates: { category?: string; status?: NovelStatusFilter; page?: number },
): string => {
  const filters: NovelsFilters = { ...current, ...updates };
  const filterChanged = 'category' in updates || 'status' in updates;
  if (filterChanged && !('page' in updates)) delete filters.page;

  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));

  const query = params.toString();
  return query ? `/novels?${query}` : '/novels';
};
