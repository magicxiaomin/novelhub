'use client';

import { useEffect } from 'react';

import { fbTrackViewContent } from '@/lib/fb-pixel';

export function BookViewContentEvent({ bookId }: { bookId: string }): null {
  useEffect(() => {
    fbTrackViewContent({ contentId: bookId, contentType: 'product' });
  }, [bookId]);

  return null;
}
