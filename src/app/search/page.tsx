import type { Metadata } from 'next';
import { Suspense } from 'react';
import Search from '@/components/Search';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <div className="main-content">
      <Suspense fallback={<p className="muted">Loading...</p>}>
        <Search />
      </Suspense>
    </div>
  );
}
