import React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

type NovelsEmptyStateProps = {
  hasCategoryFilter: boolean;
  hasStatusFilter: boolean;
};

function getNovelsEmptyStateCopy({ hasCategoryFilter, hasStatusFilter }: NovelsEmptyStateProps): {
  title: string;
  body: string;
  canClearFilters: boolean;
} {
  if (hasCategoryFilter && hasStatusFilter) {
    return {
      title: messages.novels.categoryAndStatusEmptyTitle,
      body: messages.novels.categoryAndStatusEmptyBody,
      canClearFilters: true,
    };
  }

  if (hasCategoryFilter) {
    return {
      title: messages.novels.categoryOnlyEmptyTitle,
      body: messages.novels.categoryOnlyEmptyBody,
      canClearFilters: true,
    };
  }

  if (hasStatusFilter) {
    return {
      title: messages.novels.statusOnlyEmptyTitle,
      body: messages.novels.statusOnlyEmptyBody,
      canClearFilters: true,
    };
  }

  return {
    title: messages.novels.emptyTitle,
    body: messages.novels.emptyBody,
    canClearFilters: false,
  };
}

export function NovelsEmptyState(props: NovelsEmptyStateProps): JSX.Element {
  const copy = getNovelsEmptyStateCopy(props);

  return (
    <div
      className="mt-10 rounded-2xl border border-dashed p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      {copy.canClearFilters ? (
        <Button asChild className="mt-5">
          <Link href="/novels">{messages.novels.clearFilters}</Link>
        </Button>
      ) : null}
    </div>
  );
}
