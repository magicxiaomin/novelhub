import withPWAInit from 'next-pwa';

const imageHost = process.env.NEXT_PUBLIC_IMAGE_HOST;
const r2PublicHost = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV !== 'production',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 32, maxAgeSeconds: 5 * 60 },
      },
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
    {
      urlPattern: ({ url }) => Boolean(imageHost && url.hostname === imageHost),
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ url }) => Boolean(r2PublicHost && url.hostname === r2PublicHost),
      handler: 'CacheFirst',
      options: {
        cacheName: 'chapter-content-cache',
        expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
      },
    },
  ],
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
