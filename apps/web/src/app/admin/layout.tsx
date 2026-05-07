import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AuthUser } from '@/lib/types';
import { messages } from '@novelhub/shared';

const nav = [
  ['', messages.admin.nav.dashboard],
  ['/books', messages.admin.nav.books],
  ['/chapters', messages.admin.nav.chapters],
  ['/users', messages.admin.nav.users],
  ['/orders', messages.admin.nav.orders],
  ['/push', messages.admin.nav.push],
] as const;

async function fetchAdminUser(): Promise<AuthUser | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const res = await fetch(`${apiBase}/auth/me`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const user = await fetchAdminUser();
  if (!user?.isAdmin || user.bannedAt) notFound();

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-[220px_1fr] gap-6 px-6 py-6">
        <aside className="rounded-md border bg-background p-4">
          <nav className="space-y-1">
            {nav.map(([href, label]) => (
              <Link
                key={href}
                href={`/admin${href}`}
                className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 rounded-md border bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
