'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import GradeBadge from '@/components/GradeBadge';
import { GRADES, GRADE_LABELS, type Grade } from '@/lib/content/labels';
import {
  FACETS,
  FACET_LABELS,
  FACET_OPTIONS,
  RECORD_KIND_LABELS,
  activeFilterCount,
  emptySelection,
  parseSearchParams,
  toPagefindFilters,
  toSearchParams,
  withoutFacet,
  type Facet,
  type SearchState,
} from '@/lib/search/facets';
import { excerptWithEllipses, isGenuineMatch, loadPagefind, matchedWords, type FilterCounts, type Pagefind, type PagefindResult, type PagefindResultData } from '@/lib/search/pagefind';

const PAGE_SIZE = 20;
const TYPING_DEBOUNCE_MS = 180;

type Outcome =
  | { status: 'idle'; counts: FilterCounts }
  | { status: 'done'; for: string; q: string; nFilters: number; results: PagefindResult[]; items: PagefindResultData[]; counts: FilterCounts };

function serialise(s: SearchState): string {
  return toSearchParams(s).toString();
}

function isActive(s: SearchState): boolean {
  return s.q !== '' || activeFilterCount(s.filters) > 0;
}

export default function Search() {
  const paramString = useSearchParams().toString();
  const [state, setState] = useState<SearchState>(() => parseSearchParams(new URLSearchParams(paramString)));
  const [draft, setDraft] = useState(state.q);
  const [syncedParams, setSyncedParams] = useState(paramString);
  const [pagefind, setPagefind] = useState<Pagefind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // External navigation (the header search box, Back and Forward) changes the URL: adopt it.
  if (paramString !== syncedParams) {
    setSyncedParams(paramString);
    const next = parseSearchParams(new URLSearchParams(paramString));
    if (serialise(next) !== serialise(state)) {
      setState(next);
      setDraft(next.q);
    }
  }

  // State -> URL, without adding history entries for every keystroke or checkbox.
  useEffect(() => {
    const qs = serialise(state);
    if (qs !== new URLSearchParams(window.location.search).toString()) {
      window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, [state]);

  // Typing commits the query after a short pause; submitting commits at once.
  useEffect(() => {
    const t = setTimeout(() => setState((s) => (s.q === draft.trim() ? s : { ...s, q: draft.trim() })), TYPING_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    loadPagefind()
      .then(setPagefind)
      .catch((e: Error) => setError(e.message || 'the search index could not be loaded'));
  }, []);

  useEffect(() => {
    if (!pagefind) return;
    let cancelled = false;
    const key = serialise(state);
    (async () => {
      if (!isActive(state)) {
        const counts = await pagefind.filters();
        if (!cancelled) setOutcome({ status: 'idle', counts });
        return;
      }
      const term = state.q || null;
      const nFilters = activeFilterCount(state.filters);
      // Pagefind's fallback for an unknown term is decided per term, so probe it once without filters:
      // if the top hit is only a short-prefix fallback, the honest answer is 0 results, with no counts.
      if (term) {
        const probe = await pagefind.search(term);
        const top = probe.results[0] ? await probe.results[0].data() : null;
        if (top && !isGenuineMatch(term, matchedWords(top))) {
          if (!cancelled) setOutcome({ status: 'done', for: key, q: state.q, nFilters, results: [], items: [], counts: {} });
          return;
        }
      }
      const res = await pagefind.search(term, {
        filters: toPagefindFilters(state.filters),
        // With no query there is no relevance to rank by, so browse alphabetically.
        sort: state.q ? undefined : { title: 'asc' },
      });
      // A facet with a selection is counted as if its own selection were cleared, so its other options
      // show how many results they would add instead of a misleading 0.
      const counts: FilterCounts = { ...res.filters };
      await Promise.all(
        FACETS.filter((f) => state.filters[f].length).map(async (f) => {
          const other = await pagefind.search(term, { filters: toPagefindFilters(withoutFacet(state.filters, f)) });
          counts[f] = other.filters[f] ?? {};
        }),
      );
      const items = await Promise.all(res.results.slice(0, PAGE_SIZE).map((r) => r.data()));
      if (!cancelled) setOutcome({ status: 'done', for: key, q: state.q, nFilters, results: res.results, items, counts });
    })().catch((e: Error) => {
      if (!cancelled) setError(e.message || 'the search failed');
    });
    return () => {
      cancelled = true;
    };
  }, [pagefind, state]);

  const loadMore = useCallback(async () => {
    if (!outcome || outcome.status !== 'done') return;
    setLoadingMore(true);
    const from = outcome.items.length;
    try {
      const more = await Promise.all(outcome.results.slice(from, from + PAGE_SIZE).map((r) => r.data()));
      setOutcome((o) => (o && o.status === 'done' && o.for === outcome.for ? { ...o, items: [...o.items, ...more] } : o));
      requestAnimationFrame(() => listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-result]')[from]?.focus());
    } catch (e) {
      setError((e as Error).message || 'loading more results failed');
    } finally {
      setLoadingMore(false);
    }
  }, [outcome]);

  // "/" focuses the search box from anywhere on the page, as on most search pages.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resultLinks = () => [...(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-result]') ?? [])];

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      const first = resultLinks()[0];
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'Escape' && draft) {
      e.preventDefault();
      setDraft('');
      setState((s) => ({ ...s, q: '' }));
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const links = resultLinks();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = links[i + 1];
    else if (e.key === 'ArrowUp') next = i === 0 ? (inputRef.current ?? undefined) : links[i - 1];
    else if (e.key === 'Home') next = links[0];
    else if (e.key === 'End') next = links[links.length - 1];
    else if (e.key === 'Escape') next = inputRef.current ?? undefined;
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const toggle = (facet: Facet, value: string, on: boolean) =>
    setState((s) => ({ ...s, filters: { ...s.filters, [facet]: on ? [...s.filters[facet], value] : s.filters[facet].filter((v) => v !== value) } }));

  const clearFilters = () => setState((s) => ({ ...s, filters: emptySelection() }));

  const nFilters = activeFilterCount(state.filters);
  const counts = outcome?.counts ?? {};
  // While a new search runs, keep showing the previous results rather than flashing an empty list.
  const current = isActive(state) && outcome?.status === 'done' ? outcome : null;
  const total = current?.results.length ?? 0;
  const indexed = Object.values(outcome?.status === 'idle' ? (outcome.counts.kind ?? {}) : {}).reduce((a, b) => a + b, 0);

  let status: string;
  if (error) status = `Search is unavailable: ${error}.`;
  else if (!pagefind) status = 'Loading the search index...';
  else if (!isActive(state)) status = indexed ? `${indexed} records indexed. Type a word or a name, or choose a filter to browse.` : 'Type a word or a name, or choose a filter to browse.';
  else if (!current) status = 'Searching...';
  else {
    const what = total === 1 ? 'result' : 'results';
    status = current.q ? `${total} ${what} for “${current.q}”` : `${total} ${what} match these filters`;
    if (current.q && current.nFilters) status += ` with ${current.nFilters} ${current.nFilters === 1 ? 'filter' : 'filters'}`;
    status += '.';
  }

  return (
    <div className="search">
      <form
        role="search"
        aria-label="Archive"
        action="/search"
        method="get"
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          setState((s) => ({ ...s, q: draft.trim() }));
        }}
      >
        <label htmlFor="search-q" className="search-form__label">
          Search entities, articles and sources
        </label>
        <div className="search-form__row">
          <input
            ref={inputRef}
            id="search-q"
            name="q"
            type="search"
            className="search-form__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-describedby="search-hint"
            placeholder="Ashoka, Rigveda, Harappa..."
          />
          <button type="submit" className="btn btn--primary">
            Search
          </button>
        </div>
        <p id="search-hint" className="search-hint">
          Press <kbd>/</kbd> to focus the search box, and <kbd>&darr;</kbd> <kbd>&uarr;</kbd> to move through results.
        </p>
      </form>

      <div className="search-layout">
        <div className="search-filters-wrap">
          <button type="button" className="btn search-filters-toggle" aria-expanded={filtersOpen} aria-controls="search-filters" onClick={() => setFiltersOpen((o) => !o)}>
            Filters{nFilters ? ` (${nFilters} active)` : ''}
          </button>
          <div id="search-filters" className={`search-filters${filtersOpen ? ' is-open' : ''}`}>
            {FACETS.map((facet) => {
              const options = FACET_OPTIONS[facet].filter((o) => state.filters[facet].includes(o.value) || (counts[facet]?.[o.value] ?? 0) > 0);
              if (!options.length) return null;
              return (
                <fieldset key={facet} className="search-facet">
                  <legend>{FACET_LABELS[facet]}</legend>
                  {options.map((o) => {
                    const id = `f-${facet}-${o.value}`;
                    const n = counts[facet]?.[o.value] ?? 0;
                    return (
                      <div key={o.value} className="search-facet__option">
                        <input
                          id={id}
                          type="checkbox"
                          name={facet}
                          value={o.value}
                          checked={state.filters[facet].includes(o.value)}
                          onChange={(e) => toggle(facet, o.value, e.target.checked)}
                        />
                        <label htmlFor={id}>
                          {facet === 'grade' ? <GradeOption grade={o.value as Grade} /> : o.label}
                          <span className="search-facet__count"> ({n})</span>
                        </label>
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
            {nFilters ? (
              <button type="button" className="btn search-filters__clear" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="search-main">
          <p className={current && total === 0 ? 'search-status search-status--empty' : 'search-status'} role="status" aria-live="polite">
            {status}
          </p>
          {error ? (
            <p className="muted">
              Browse the <Link href="/archive">archive</Link>, the <Link href="/sources">bibliography</Link> or the <Link href="/kaalchakra?view=list">Kaalchakra list</Link> instead.
            </p>
          ) : null}
          {current && total === 0 ? (
            <p className="muted search-empty-help">
              Try a shorter or more general term{nFilters ? ', or ' : ''}
              {nFilters ? (
                <button type="button" className="link-button" onClick={clearFilters}>
                  clear the filters
                </button>
              ) : null}
              . You can also browse the <Link href="/archive">archive</Link> or the <Link href="/kaalchakra?view=list">Kaalchakra</Link>.
            </p>
          ) : null}
          {current && total > 0 ? (
            <>
              <ol className="search-results" ref={listRef} onKeyDown={onListKeyDown} aria-label="Search results">
                {current.items.map((d) => (
                  <ResultItem key={d.url} data={d} />
                ))}
              </ol>
              {current.items.length < total ? (
                <button type="button" className="btn search-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : `Show ${Math.min(PAGE_SIZE, total - current.items.length)} more of ${total - current.items.length} remaining`}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GradeOption({ grade }: { grade: Grade }) {
  return (
    <span className={`grade grade--${grade}`}>
      <span className="grade__letter" aria-hidden="true">
        {grade}
      </span>
      <span className="grade__label">
        <span className="visually-hidden">Grade {grade}: </span>
        {GRADE_LABELS[grade]}
      </span>
    </span>
  );
}

function ResultItem({ data }: { data: PagefindResultData }) {
  const kind = data.meta.kind ?? '';
  const grades = (data.meta.grades ?? '').split(' ').filter((g): g is Grade => (GRADES as readonly string[]).includes(g));
  return (
    <li className="search-result">
      <p className="search-result__kind">{RECORD_KIND_LABELS[kind] ?? kind}</p>
      <h2 className="search-result__title">
        <Link href={data.url} data-result>
          {data.meta.title ?? data.url}
        </Link>
      </h2>
      <p className="search-result__excerpt">
        {excerptWithEllipses(data.excerpt, data.content).map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
      </p>
      {data.meta.when || grades.length ? (
        <p className="search-result__meta">
          {data.meta.when ? <span>{data.meta.when}</span> : null}
          {[...new Set(grades)].sort().map((g) => (
            <GradeBadge key={g} grade={g} showLabel={false} />
          ))}
        </p>
      ) : null}
    </li>
  );
}
