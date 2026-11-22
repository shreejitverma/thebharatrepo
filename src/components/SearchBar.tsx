'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={handleSearch} className="search-bar" role="search">
      <label htmlFor="site-search" className="visually-hidden">
        Search the archive
      </label>
      <input id="site-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
    </form>
  );
}
