import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';

import { ConsentBanner } from '@/components/consent/consent-banner';
import { FbTracking } from '@/components/consent/fb-tracking';
import { Providers } from '@/components/providers';
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
          <ConsentBanner />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
