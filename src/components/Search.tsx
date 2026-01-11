'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import { Article } from '@/types/article';
import ArticleCard from '@/components/ArticleCard';

export default function Search() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const [results, setResults] = useState<Article[]>([]);
  const [fuse, setFuse] = useState<Fuse<Article> | null>(null);

  useEffect(() => {
    fetch('/search.json')
      .then((response) => response.json())
      .then((articles: Article[]) => {
        const fuseInstance = new Fuse(articles, {
          keys: ['title', 'content', 'tags'],
          includeScore: true,
        });
        setFuse(fuseInstance);
      });
  }, []);

  useEffect(() => {
    if (fuse && query) {
      const searchResults = fuse.search(query).map((result) => result.item);
      setResults(searchResults);
    }
  }, [fuse, query]);

  return (
    <>
      <h1>Search Results for "{query}"</h1>
      {results.length > 0 ? (
        <div className="category-grid">
          {results.map((article) => (
            <ArticleCard key={article.slug} article={article} category={article.category} />
          ))}
        </div>
      ) : (
        <p>No results found.</p>
      )}
    </>
  );
}
