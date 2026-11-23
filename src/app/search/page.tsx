import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { preloadModule } from 'react-dom';
import Search from '@/components/Search';
import { SITE_URL } from '@/lib/content/site-url';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/content/labels';
import { PAGEFIND_URL } from '@/lib/search/pagefind';

export const metadata: Metadata = { title: 'Search', description: 'Search every entity, article and source in The Bharat Repo, filtered by kind, category, evidence grade and lens.' };

/**
 * Shown only when JavaScript is off (hidden by the data-js hook in the root layout): the index runs in the
 * browser, so offer browsing and an external site search instead.
 */
function NoScriptFallback() {
  return (
    <div className="search-noscript no-js-only">
      <p>
        <strong>Search needs JavaScript</strong>, because the index runs in your browser. Everything is still reachable without it:
      </p>
      <ul>
        <li>
          <Link href="/archive" prefetch={false}>The archive</Link>: every entity, grouped by kind and in time order.
        </li>
        <li>
          <Link href="/sources" prefetch={false}>The bibliography</Link>: every source, each with a record of what cites it.
        </li>
        <li>
          Articles by category:{' '}
          {CATEGORIES.map((c, i) => (
            <span key={c}>
              {i ? ', ' : ''}
              <Link href={`/${c}`}>{CATEGORY_LABELS[c]}</Link>
            </span>
          ))}
          .
        </li>
      </ul>
      <form action="https://duckduckgo.com/" method="get" className="search-form__row">
        <input type="hidden" name="sites" value={new URL(SITE_URL).hostname} />
        <label htmlFor="search-external" className="visually-hidden">
          Search this site with DuckDuckGo
        </label>
        <input id="search-external" name="q" type="search" className="search-form__input" placeholder="Search this site with DuckDuckGo" />
        <button type="submit" className="btn">
          Search externally
        </button>
      </form>
    </div>
  );
}

export default function SearchPage() {
  // Fetch the Pagefind runtime while the page's own scripts load, instead of after hydration.
  preloadModule(PAGEFIND_URL, { as: 'script' });
  return (
    <div className="main-content">
      <p className="eyebrow">Search</p>
      <h1>Search the archive</h1>
      <NoScriptFallback />
      <Suspense fallback={<p className="muted search-loading js-only">Loading search...</p>}>
        <Search />
      </Suspense>
    </div>
  );
}
