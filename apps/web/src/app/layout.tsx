import type { Metadata } from 'next';
import { Lora } from 'next/font/google';

import messages from '../../messages/en.json';
import './globals.css';

const bodyFont = Lora({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={bodyFont.variable}>{children}</body>
    </html>
  );
}
