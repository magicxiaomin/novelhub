if (!self.define) {
  let e,
    s = {};
  const c = (c, a) => (
    (c = new URL(c + '.js', a).href),
    s[c] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = c), (e.onload = s), document.head.appendChild(e));
        } else ((e = c), importScripts(c), s());
      }).then(() => {
        let e = s[c];
        if (!e) throw new Error(`Module ${c} didn’t register its module`);
        return e;
      })
  );
  self.define = (a, i) => {
    const n = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (s[n]) return;
    let t = {};
    const r = (e) => c(e, n),
      f = { module: { uri: n }, exports: t, require: r };
    s[n] = Promise.all(a.map((e) => f[e] || r(e))).then((e) => (i(...e), t));
  };
}
define(['./workbox-5bcb5e8b'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: '/OneSignalSDKWorker.js', revision: 'df13b1be4c46893de5af32b877e0cb65' },
        { url: '/_next/app-build-manifest.json', revision: '8259868ca73667d5988bacc6814a399d' },
        {
          url: '/_next/static/_54Bds-j1yq1WrY0Kpf3K/_buildManifest.js',
          revision: '646e7d65f7499ec4ddb413fd229ad421',
        },
        {
          url: '/_next/static/_54Bds-j1yq1WrY0Kpf3K/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/_next/static/chunks/136-bb54cb55eb37a895.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/203-92eb72cb23841549.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/413-992e0910eb31b23b.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/591-12e3e460cf0e2d76.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/66-f7056b3a6fcd3321.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/77-9ced5eac968c5408.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        {
          url: '/_next/static/chunks/7e609c37-9bfabc9e54f55982.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        { url: '/_next/static/chunks/808-479a4a88dc841cc0.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        { url: '/_next/static/chunks/830-f15992221b9d2933.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        {
          url: '/_next/static/chunks/app/_not-found/page-9cedf5b0cbd5aeaf.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/book/%5Bid%5D/not-found-d96e63cf3755a424.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/book/%5Bid%5D/page-fd8ce9ba6793f7a6.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/error-f0e6ccea456ebd78.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/layout-58ca197fb8e23711.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/loading-fa3c27b06577e4e2.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/me/page-65c37ea13aecee3b.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/page-4ef78ebdd6074562.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/payment/success/page-68baf563fe76bb9f.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/read/%5BbookId%5D/%5BchapterNumber%5D/loading-b9c2431c90824e9a.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/read/%5BbookId%5D/%5BchapterNumber%5D/page-15898ad5e4a8a43b.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/recharge/page-6fba1a8447242271.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/app/reset-password/page-f1f467670725be46.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/framework-bef83a85c94ff7de.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/main-app-c034c8a0f96ba30e.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        { url: '/_next/static/chunks/main-f03db3c44d94acb7.js', revision: '_54Bds-j1yq1WrY0Kpf3K' },
        {
          url: '/_next/static/chunks/pages/_app-c08fb214a0b4d40f.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/pages/_error-e807e7592c56f4e8.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-6633450045a2bc9b.js',
          revision: '_54Bds-j1yq1WrY0Kpf3K',
        },
        { url: '/_next/static/css/cbab51ca88238458.css', revision: 'cbab51ca88238458' },
        {
          url: '/_next/static/media/19cfc7226ec3afaa-s.woff2',
          revision: '9dda5cfc9a46f256d0e131bb535e46f8',
        },
        {
          url: '/_next/static/media/21350d82a1f187e9-s.woff2',
          revision: '4e2553027f1d60eff32898367dd4d541',
        },
        {
          url: '/_next/static/media/8e9860b6e62d6359-s.woff2',
          revision: '01ba6c2a184b8cba08b0d57167664d75',
        },
        {
          url: '/_next/static/media/ba9851c3c22cd980-s.woff2',
          revision: '9e494903d6b0ffec1a1e14d34427d44d',
        },
        {
          url: '/_next/static/media/c5fe6dc8356a8c31-s.woff2',
          revision: '027a89e9ab733a145db70f09b8a18b42',
        },
        {
          url: '/_next/static/media/df0a9ae256c0569c-s.woff2',
          revision: 'd54db44de5ccb18886ece2fda72bdfe0',
        },
        {
          url: '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
          revision: '65850a373e258f1c897a2b3d75eb74de',
        },
        { url: '/icons/icon-192.png', revision: 'dab29e47abcbeccce3c7ef2ba0b6c962' },
        { url: '/icons/icon-512-maskable.png', revision: 'dab29e47abcbeccce3c7ef2ba0b6c962' },
        { url: '/icons/icon-512.png', revision: 'dab29e47abcbeccce3c7ef2ba0b6c962' },
        { url: '/manifest.json', revision: 'c9fffd4fd3ad2ba9520af4c4a3fc0a25' },
        { url: '/pwa/ios-install.png', revision: 'dab29e47abcbeccce3c7ef2ba0b6c962' },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: s, event: c, state: a }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, { status: 200, statusText: 'OK', headers: s.headers })
                : s,
          },
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https?:\/\/.*\/api\/.*$/i,
      new e.NetworkFirst({
        cacheName: 'api-cache',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 300 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/static\/.*/i,
      new e.CacheFirst({
        cacheName: 'next-static',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 2592e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'font-cache',
        plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 31536e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => Boolean(imageHost && e.hostname === imageHost),
      new e.CacheFirst({
        cacheName: 'image-cache',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 604800 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => Boolean(r2PublicHost && e.hostname === r2PublicHost),
      new e.CacheFirst({
        cacheName: 'chapter-content-cache',
        plugins: [new e.ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 3600 })],
      }),
      'GET',
    ));
});
