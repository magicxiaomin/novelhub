import withPWAInit from 'next-pwa';

const imageHost = process.env.NEXT_PUBLIC_IMAGE_HOST;
const r2PublicHost = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const appHost = (() => {
  try {
    return appUrl ? new URL(appUrl).hostname : null;
  } catch {
    return null;
  }
})();

// Always block the SW from caching `/api/` (user-scoped data). Prefer a
// host-anchored regex when NEXT_PUBLIC_APP_URL is parseable; otherwise fall
// back to a relative `/api/` matcher so the NetworkOnly rule is never silently
// dropped on misconfig.
const apiCachePattern = appHost ? new RegExp(`^https://${escapeRegExp(appHost)}/api/`) : /\/api\//;

const runtimeCaching = [
  {
    urlPattern: apiCachePattern,
    handler: 'NetworkOnly',
    options: { cacheName: 'api-no-cache' },
  },
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'next-static',
      expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'font-cache',
      expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
    },
  },
];

if (imageHost) {
  runtimeCaching.push({
    urlPattern: new RegExp(`^https://${escapeRegExp(imageHost)}/`),
    handler: 'CacheFirst',
    options: {
      cacheName: 'image-cache',
      expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
    },
  });
}

if (r2PublicHost) {
  runtimeCaching.push({
    urlPattern: new RegExp(`^https://${escapeRegExp(r2PublicHost)}/`),
    handler: 'CacheFirst',
    options: {
      cacheName: 'chapter-content-cache',
      expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
    },
  });
}

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV !== 'production',
  register: true,
  skipWaiting: true,
  runtimeCaching,
});

/** @type {import('next').NextConfig} */
// Keep this allowlist narrow: next/image server-side fetches any host listed here (SSRF/egress risk).
const remotePatterns = [];

if (imageHost) {
  remotePatterns.push({ protocol: 'https', hostname: imageHost });
}

if (r2PublicHost) {
  remotePatterns.push({ protocol: 'https', hostname: r2PublicHost });
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns,
  },
};

export default withPWA(nextConfig);
