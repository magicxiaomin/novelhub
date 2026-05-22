import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NovelsEmptyReasonReporter } from './novels-empty-reason-reporter';

describe('NovelsEmptyReasonReporter', () => {
  it('is a null-rendering client seam with a default no-op callback', () => {
    const html = renderToStaticMarkup(
      <NovelsEmptyReasonReporter hasCategoryFilter={false} hasStatusFilter={false} />,
    );

    expect(html).toBe('');
  });
});
