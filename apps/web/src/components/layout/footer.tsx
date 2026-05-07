import Link from 'next/link';

import messages from '@/../messages/en.json';

const links = [
  ['/privacy', messages.footer.privacy],
  ['/terms', messages.footer.terms],
  ['/refund', messages.footer.refund],
  ['/dmca', messages.footer.dmca],
  ['/contact', messages.footer.contact],
  ['/about', messages.footer.about],
] as const;

export function Footer(): JSX.Element {
  return (
    <footer className="mx-auto max-w-mobile px-4 py-8 text-sm text-muted-foreground">
      <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="hover:text-foreground">
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
