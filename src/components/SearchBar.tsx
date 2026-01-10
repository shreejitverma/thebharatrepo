'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Fuse from 'fuse.js';
import { Article } from '@/types/article';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [fuse, setFuse] = useState<Fuse<Article> | null>(null);

  useEffect(() => {
    fetch('/search.json')
      .then((response) => response.json())
      .then((articles) => {
        const fuseInstance = new Fuse(articles, {
          keys: ['title', 'content', 'tags'],
          includeScore: true,
        });
        setFuse(fuseInstance);
      });
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    if (fuse && newQuery) {
      const searchResults = fuse.search(newQuery).map((result) => result.item);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  };

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Search..."
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((article) => (
            <li key={article.slug}>
              <Link href={`/${article.category}/${article.slug}`}>
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
