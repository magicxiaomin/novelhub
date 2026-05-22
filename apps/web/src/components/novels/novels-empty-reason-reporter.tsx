'use client';

import { useEffect } from 'react';

import {
  buildNovelsEmptyReasonEvent,
  type NovelsEmptyReasonEvent,
} from '@/lib/novels-empty-reason';

type NovelsEmptyReasonReporterProps = {
  hasCategoryFilter: boolean;
  hasStatusFilter: boolean;
  onEmptyReason?: (event: NovelsEmptyReasonEvent) => void;
};

const noop = (): void => {};

export function NovelsEmptyReasonReporter({
  hasCategoryFilter,
  hasStatusFilter,
  onEmptyReason = noop,
}: NovelsEmptyReasonReporterProps): null {
  useEffect(() => {
    onEmptyReason(buildNovelsEmptyReasonEvent({ hasCategoryFilter, hasStatusFilter }));
  }, [hasCategoryFilter, hasStatusFilter, onEmptyReason]);

  return null;
}
