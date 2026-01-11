import { Suspense } from 'react';
import Search from '@/components/Search';

export default function SearchPage() {
  return (
    <main className="main-content">
      <Suspense fallback={<p>Loading...</p>}>
        <Search />
      </Suspense>
    </main>
  );
}
