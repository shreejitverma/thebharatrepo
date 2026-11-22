'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { SEARCH_INDEX_URL } from '@/lib/content/public-data';

export interface SearchDoc {
  href: string;
  title: string;
  summary: string;
  kind: string;
  when: string;
  text: string;
}

const MAX_SHOWN = 60;

/** Heading and hint shown before there is a query; also the server-rendered fallback, so the swap does not shift the page. */
export function SearchIntro() {
  return (
    <>
      <p className="eyebrow">Search</p>
      <h1>Search the archive</h1>
      <p className="muted">Type a person, place, text or period into the search box above.</p>
    </>
  );
}

export default function Search() {
  const query = useSearchParams().get('q') ?? '';
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wanted = query !== '';

  // The index is about 130 KB compressed, so a client-side visit fetches it only once there is something to search for.
  useEffect(() => {
    if (!wanted || docs) return;
    fetch(SEARCH_INDEX_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`search index HTTP ${r.status}`);
        return r.json() as Promise<SearchDoc[]>;
      })
      .then(setDocs)
      .catch((e: Error) => setError(e.message));
  }, [wanted, docs]);

  const fuse = useMemo(() => (docs ? new Fuse(docs, { keys: [{ name: 'title', weight: 3 }, { name: 'summary', weight: 2 }, 'text'], ignoreLocation: true, threshold: 0.34 }) : null), [docs]);
  const results = useMemo(() => (fuse && query ? fuse.search(query).map((r) => r.item) : []), [fuse, query]);
  const shown = results.slice(0, MAX_SHOWN);

  if (!query) return <SearchIntro />;

  return (
    <>
      <p className="eyebrow">Search</p>
      <h1>Results for &ldquo;{query}&rdquo;</h1>
      {error ? <p className="empty">Search is unavailable: {error}</p> : null}
      {!docs && !error ? <p className="muted">Loading the index...</p> : null}
      {docs && results.length === 0 ? (
        <p className="empty">
          0 results for &ldquo;{query}&rdquo;. Try a broader term, or browse the{' '}
          <Link href="/kaalchakra" prefetch={false}>
            Kaalchakra
          </Link>
          .
        </p>
      ) : null}
      {results.length > 0 ? (
        <>
          <p className="muted">{results.length > shown.length ? `Showing ${shown.length} of ${results.length} results` : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}</p>
          <div className="category-grid">
            {shown.map((d) => (
              <Link key={d.href} href={d.href} className="card">
                <p className="eyebrow" style={{ margin: 0 }}>{d.kind}</p>
                <h2>{d.title}</h2>
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
