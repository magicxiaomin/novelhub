'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookMarked, Home, User } from 'lucide-react';

import { useAuth } from '@/components/providers';
import { cn } from '@/lib/utils';
import { messages } from '@novelhub/shared';

const tabs = [
  { href: '/', label: messages.nav.home, Icon: Home },
  { href: '/library', label: messages.nav.library, Icon: BookMarked },
  { href: '/me', label: messages.nav.me, Icon: User },
] as const;

export function BottomNav(): JSX.Element | null {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Bottom nav exists only for signed-in users; anonymous browsing is
  // header-only by ticket spec. While we're still resolving session,
  // render nothing rather than flash-then-hide.
  if (isLoading || !user) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex h-16 max-w-mobile items-stretch border-t bg-background/95 backdrop-blur"
      aria-label={messages.nav.primary}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs',
              active ? 'text-brand' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
