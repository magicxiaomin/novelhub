import type { Metadata } from 'next';

import { NovelHomePage } from '@/components/home/novel-home-page';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
  openGraph: {
    title: messages.metadata.title,
    description: messages.metadata.description,
    type: 'website',
    images: [{ url: '/og/novelhub-home.png', alt: messages.metadata.homeOgAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: messages.metadata.title,
    description: messages.metadata.description,
    images: ['/og/novelhub-home.png'],
  },
};

export default function HomePage(): JSX.Element {
  return <NovelHomePage />;
}
