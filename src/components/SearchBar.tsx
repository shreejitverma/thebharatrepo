'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Header search. A plain GET form to /search, so it also works before hydration and without JavaScript. */
export default function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <form action="/search" method="get" onSubmit={handleSearch} className="search-bar" role="search" aria-label="Site">
      <label htmlFor="site-search" className="visually-hidden">
        Search the archive
      </label>
      <input id="site-search" name="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the archive" enterKeyHint="search" />
    </form>
  );
}
