'use client';

import Link from 'next/link';
import { Search, User } from 'lucide-react';

import { useAuth } from '@/components/providers';

export function TopHeader(): JSX.Element {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur">
      <Link href="/" className="text-lg font-bold tracking-tight">
        <span className="text-brand">Novel</span>Hub
      </Link>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-full text-foreground/70 hover:bg-muted"
        >
          <Search className="h-5 w-5" />
        </button>
        {user ? (
          <Link
            href="/me"
            aria-label="Account"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-foreground"
          >
            <User className="h-5 w-5" />
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
