import path from 'node:path';
import { fileURLToPath } from 'node:url';

import withPWAInit from 'next-pwa';
import { withSentryConfig } from '@sentry/nextjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// `output: 'standalone'` is the right shape for the Phase 1 self-hosted
// VPS / Vercel deploy. `next-on-pages` (Task 14) wants the default
// (non-standalone) output and synthesises its own _worker.js — leaving
// `standalone` set produces extra .next/standalone scaffolding that's
// dead code on Pages. We branch on BUILD_TARGET=pages so a single
// codebase still ships both builds during the Phase 1 → Phase 2 cutover.
const isPagesBuild = process.env.BUILD_TARGET === 'pages';

const nextConfig = {
  output: isPagesBuild ? undefined : 'standalone',
  reactStrictMode: true,
  // `outputFileTracingRoot` is needed for the standalone monorepo build so
  // pnpm-workspace symlinks resolve. `next-on-pages` does its own tracing
  // and trips over the monorepo prefix, so leave it default for Pages.
  experimental: isPagesBuild
    ? undefined
    : {
        outputFileTracingRoot: path.join(__dirname, '../../'),
      },
  images: {
    remotePatterns,
    // Pages doesn't run Next's image optimizer — Cloudflare Images is the
    // intended path post-cutover. `unoptimized` keeps `<Image>` working as
    // a regular <img> until that wiring lands (Task 18 phase 2). The
    // standalone build keeps the optimizer enabled.
    unoptimized: isPagesBuild,
  },
};

// On the Pages target, skip Sentry's webpack wrapper. Its source-map
// upload plugin emits duplicated identifiers in the function bundles
// that next-on-pages' deduper rejects with
// "A duplicated identifier has been detected in the same function file."
// The Sentry runtime hooks (sentry.client/edge/server.config.ts) still
// load via Next's instrumentation hooks; only the build-time wrapper
// is skipped. Source-map uploads happen from the standalone build path
// (Phase 1) and once Cloudflare's source-map ingestion is wired in
// Task 18 we'll restore the wrapper here.
const finalConfig = withPWA(nextConfig);

export default isPagesBuild
  ? finalConfig
  : withSentryConfig(finalConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT_WEB,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
    });
