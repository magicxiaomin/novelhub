export type NovelsEmptyReason = 'unfiltered' | 'categoryOnly' | 'statusOnly' | 'categoryAndStatus';

export type NovelsEmptyReasonFilters = {
  hasCategoryFilter: boolean;
  hasStatusFilter: boolean;
};

export type NovelsEmptyReasonEvent = {
  surface: 'novels-list';
  routePattern: '/novels';
  reason: NovelsEmptyReason;
  filters: {
    category: boolean;
    status: boolean;
  };
  timestamp: number;
};

type BuildNovelsEmptyReasonEventInput = NovelsEmptyReasonFilters & {
  timestamp?: number;
};

export function deriveNovelsEmptyReason({
  hasCategoryFilter,
  hasStatusFilter,
}: NovelsEmptyReasonFilters): NovelsEmptyReason {
  if (hasCategoryFilter && hasStatusFilter) {
    return 'categoryAndStatus';
  }

  if (hasCategoryFilter) {
    return 'categoryOnly';
  }

  if (hasStatusFilter) {
    return 'statusOnly';
  }

  return 'unfiltered';
}

export function buildNovelsEmptyReasonEvent({
  hasCategoryFilter,
  hasStatusFilter,
  timestamp = Date.now(),
}: BuildNovelsEmptyReasonEventInput): NovelsEmptyReasonEvent {
  return {
    surface: 'novels-list',
    routePattern: '/novels',
    reason: deriveNovelsEmptyReason({ hasCategoryFilter, hasStatusFilter }),
    filters: {
      category: hasCategoryFilter,
      status: hasStatusFilter,
    },
    timestamp,
  };
}
