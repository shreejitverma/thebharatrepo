'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Routes whose payload carries the whole archive (about 170 KB compressed for /kaalchakra) are not prefetched,
 * because every page shows these links and a phone on 4G would download them on every visit.
 */
const LINKS = [
  { href: '/kaalchakra', label: 'Kaalchakra', primary: true, prefetch: false },
  { href: '/archive', label: 'Archive', prefetch: false },
  { href: '/learn', label: 'Learn', prefetch: false },
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
  // On the search page nothing is prefetched: on a slow connection those requests queue ahead of the index
  // and result downloads, and held the first result back by about 1.4 s in the Lighthouse profile.
  const searching = path === '/search';
  return (
    <nav className="site-nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} prefetch={searching ? false : l.prefetch} aria-current={active ? 'page' : undefined} className={l.primary ? 'site-nav__primary' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
