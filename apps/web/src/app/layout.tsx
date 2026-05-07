import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';

import { ConsentBanner } from '@/components/consent/consent-banner';
import { FbTracking } from '@/components/consent/fb-tracking';
import { Providers } from '@/components/providers';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PushPrompt } from '@/components/push/push-prompt';
import { Toaster } from '@/components/ui/toaster';
import messages from '../../messages/en.json';

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
          <Suspense fallback={null}>
            <FbTracking />
          </Suspense>
          <InstallPrompt />
          <PushPrompt />
          <ConsentBanner />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
