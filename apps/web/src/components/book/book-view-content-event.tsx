'use client';

import { useEffect } from 'react';

import { readFacebookUtmAttribution } from '@/lib/fb-attribution';
import { fbTrackViewContent } from '@/lib/fb-pixel';

export function BookViewContentEvent({ bookId }: { bookId: string }): null {
  useEffect(() => {
    fbTrackViewContent({
      contentId: bookId,
      contentType: 'novel',
      novelId: bookId,
      utm: readFacebookUtmAttribution(),
    });
  }, [bookId]);

  return null;
}
