import type { MetadataRoute } from 'next';

import { absoluteAppUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: absoluteAppUrl('/sitemap.xml'),
  };
}
