'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';

export interface SearchDoc {
  href: string;
  title: string;
  summary: string;
  kind: string;
  when: string;
  text: string;
}

export default function Search() {
  const query = useSearchParams().get('q') ?? '';
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/search.json')
      .then((r) => {
        if (!r.ok) throw new Error(`search index HTTP ${r.status}`);
        return r.json() as Promise<SearchDoc[]>;
      })
      .then(setDocs)
      .catch((e: Error) => setError(e.message));
  }, []);

  const fuse = useMemo(() => (docs ? new Fuse(docs, { keys: [{ name: 'title', weight: 3 }, { name: 'summary', weight: 2 }, 'text'], ignoreLocation: true, threshold: 0.34 }) : null), [docs]);
  const results = useMemo(() => (fuse && query ? fuse.search(query, { limit: 60 }).map((r) => r.item) : []), [fuse, query]);

  return (
    <>
      <p className="eyebrow">Search</p>
      <h1>{query ? `Results for "${query}"` : 'Search the archive'}</h1>
      {error ? <p className="empty">Search is unavailable: {error}</p> : null}
      {!docs && !error ? <p className="muted">Loading the index...</p> : null}
      {docs && query && results.length === 0 ? <p className="empty">0 results for &ldquo;{query}&rdquo;. Try a broader term, or browse the <Link href="/kaalchakra">Kaalchakra</Link>.</p> : null}
      {results.length > 0 ? (
        <>
          <p className="muted">{results.length} results</p>
          <div className="category-grid">
            {results.map((d) => (
              <Link key={d.href} href={d.href} className="card">
                <p className="eyebrow" style={{ margin: 0 }}>{d.kind}</p>
                <h3>{d.title}</h3>
                <p>{d.summary}</p>
                <p className="card__meta">{d.when}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
