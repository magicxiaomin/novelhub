import { type ReactNode } from 'react';

import { BottomNav } from './bottom-nav';
import { TopHeader } from './top-header';

/**
 * Shared mobile shell: header on top, content centered to a 480px column,
 * bottom nav fixed when logged in. Pages place themselves inside `<main>`.
 */
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mx-auto min-h-dvh max-w-mobile">
      <TopHeader />
      {/* Bottom nav is 64px; pad bottom so the last row isn't hidden. */}
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
