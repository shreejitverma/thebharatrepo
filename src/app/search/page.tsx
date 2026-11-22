import type { Metadata } from 'next';
import { Suspense } from 'react';
import { preload } from 'react-dom';
import Search, { SearchIntro } from '@/components/Search';
import { SEARCH_INDEX_URL } from '@/lib/content/public-data';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  // A visit to /search is almost always a search, so the index downloads alongside the scripts rather than after them.
  preload(SEARCH_INDEX_URL, { as: 'fetch', crossOrigin: 'anonymous' });
  return (
    // Results arrive after the index loads; the reserved height keeps the footer from jumping when they do.
    <div className="main-content search-page">
      <Suspense fallback={<SearchIntro />}>
        <Search />
      </Suspense>
    </div>
  );
}
