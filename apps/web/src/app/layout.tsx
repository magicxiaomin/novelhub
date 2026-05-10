import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { Suspense } from 'react';

// `<Analytics />` injects a script tag pointing at `/_vercel/insights/script.js`,
// which only exists on Vercel's edge. On Cloudflare Pages it 404s, the SPA
// fallback returns text/html, and the browser refuses to execute. Use a
// `NEXT_PUBLIC_*` env so Next inlines the value at build time — a plain
// `process.env.BUILD_TARGET` only works in Node-side code; layout.tsx ships
// to the edge and would evaluate the expression at request time, where
// the variable is undefined and the conditional always trues. The Pages
// build script (`apps/web/package.json`) sets NEXT_PUBLIC_BUILD_TARGET=pages.
const isVercelTarget = process.env.NEXT_PUBLIC_BUILD_TARGET !== 'pages';

import { ConsentBanner } from '@/components/consent/consent-banner';
import { FbTracking } from '@/components/consent/fb-tracking';
import { Footer } from '@/components/layout/footer';
import { Providers } from '@/components/providers';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PushPrompt } from '@/components/push/push-prompt';
import { Toaster } from '@/components/ui/toaster';
import { messages } from '@novelhub/shared';

import './globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
  applicationName: 'NovelHub',
  formatDetection: { telephone: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NovelHub',
    startupImage: [
      {
        url: '/splash/iphone-1170x2532.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/iphone-1284x2778.png',
        media:
          '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  themeColor: '#FF4D4F',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={bodyFont.variable}>
      <body>
        <Providers>
          {children}
          <Footer />
          <Suspense fallback={null}>
            <FbTracking />
          </Suspense>
          <InstallPrompt />
          <PushPrompt />
          <ConsentBanner />
        </Providers>
        <Toaster />
        {isVercelTarget ? <Analytics /> : null}
      </body>
    </html>
  );
}
