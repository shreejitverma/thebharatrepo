'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/kaalchakra', label: 'Kaalchakra', primary: true },
  { href: '/archive', label: 'Archive' },
  { href: '/learn', label: 'Learn' },
  { href: '/history', label: 'History' },
  { href: '/philosophy', label: 'Philosophy' },
  { href: '/science', label: 'Science' },
  { href: '/literature', label: 'Literature' },
  { href: '/art-and-culture', label: 'Art and Culture' },
  { href: '/music', label: 'Music' },
  { href: '/language', label: 'Language' },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={l.primary ? 'site-nav__primary' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
