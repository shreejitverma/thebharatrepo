/**
 * Minimal typed loader for the Pagefind browser API written to public/pagefind by scripts/build-search.ts.
 * The module is loaded at runtime from the static site, never bundled.
 */

import { FACETS } from './facets';
import { normaliseWord } from './normalise';

export interface PagefindResultData {
  url: string;
  excerpt: string;
  /** Indexed text; `locations` are indices into its whitespace-separated words. */
  content: string;
  locations: number[];
  meta: Record<string, string | undefined>;
  filters: Record<string, string[]>;
}

export interface PagefindResult {
  id: string;
  score: number;
  data: () => Promise<PagefindResultData>;
}

export type FilterCounts = Record<string, Record<string, number>>;

export interface PagefindSearchResponse {
  results: PagefindResult[];
  unfilteredResultCount: number;
  filters: FilterCounts;
  totalFilters: FilterCounts;
}

export interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  search: (term: string | null, options?: { filters?: Record<string, unknown>; sort?: Record<string, 'asc' | 'desc'> }) => Promise<PagefindSearchResponse>;
  filters: () => Promise<FilterCounts>;
  preload: (term: string) => Promise<void>;
}

export const PAGEFIND_URL = '/pagefind/pagefind.js';

/**
 * Ranking. Pagefind's default page-length penalty (0.75) let short bibliography records outrank the entity
 * a reader is looking for: on 20 name queries ("buddha", "aryabhata", "ashoka", ...) the expected page
 * ranked 4th or 5th for three of them. At 0.25 all but "ashoka" ranked first; lower values changed nothing
 * further. At 1,027 entities shorter pages that mention a name in their titles outrank its own record again
 * ("ashoka" 8th, "buddha" 6th), so ranking alone cannot do it: Search pins the record whose title or alternate
 * name is exactly the query (see pinExact and the `exact` filter in SearchIndexMeta).
 */
export const RANKING = { pageLength: 0.25 } as const;

export interface PagefindHandle {
  pagefind: Pagefind;
  /** Resolves once the filter index has loaded; searches issued before it report no filter counts. */
  filtersReady: Promise<unknown>;
}

let loading: Promise<PagefindHandle> | undefined;

/**
 * Loads and initialises Pagefind once. Resolves as soon as the index entry is ready, with the filter index
 * still loading, so a caller can fetch the filter index and a query's index chunks in parallel.
 */
export function loadPagefind(): Promise<PagefindHandle> {
  if (!loading) {
    loading = (async () => {
      const url = PAGEFIND_URL;
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as Pagefind;
      await mod.options({ excerptLength: 28, ranking: RANKING });
      await mod.init();
      return { pagefind: mod, filtersReady: mod.filters() };
    })();
    // A failed load (offline, missing index in `next dev`) must be retryable.
    loading.catch(() => {
      loading = undefined;
    });
  }
  return loading;
}

/** Only the facets the filter panel shows: the `exact` lookup filter never reaches the panel or its counts. */
export function facetCounts(counts: FilterCounts): FilterCounts {
  return Object.fromEntries(FACETS.filter((f) => counts[f]).map((f) => [f, counts[f]]));
}

/**
 * Puts the exact-name hits first, then the ranked results without them. Hits whose title is the query (`titled`, a
 * subset of `exact`) come before hits that have it only as an alternate name, so "mahavira" pins the Jain teacher
 * titled Mahavira before the mathematician whose IAST name is Mahāvīra. Within each group, hits keep the order the
 * ranked results give them, as the ranked result objects; one the ranked results lack (a name matched only through
 * an alternate spelling) follows those, in the order the lookup returned it. A reader who types a name expects
 * that record first, even when shorter pages that mention the name in their own titles score higher.
 */
export function pinExact<T extends { id: string }>(ranked: T[], exact: T[], titled: T[] = []): T[] {
  if (!exact.length) return ranked;
  const rank = new Map(ranked.map((r, i) => [r.id, i]));
  const ids = [...new Set(exact.map((r) => r.id))];
  const lookup = new Map(exact.map((r) => [r.id, r]));
  const isTitled = new Set(titled.map((r) => r.id));
  const pinned = ids
    .map((id, i) => ({ id, group: isTitled.has(id) ? 0 : 1, at: rank.get(id) ?? ranked.length + i }))
    .sort((a, b) => a.group - b.group || a.at - b.at)
    // The ranked result, where there is one, carries the query's matched words for excerpts and the
    // genuine-match check; a filter-only lookup result has none.
    .map(({ id, at }) => (at < ranked.length ? ranked[at] : lookup.get(id)!));
  const pinnedIds = new Set(ids);
  return [...pinned, ...ranked.filter((r) => !pinnedIds.has(r.id))];
}

/**
 * The exact hits alone, in the order pinExact put them at the front of `pinned` (its result), so the results kept
 * when the query term itself matched nothing are in the same order as the fragments already loaded from `pinned`.
 */
export function exactHits<T extends { id: string }>(pinned: T[], exact: T[]): T[] {
  return pinned.slice(0, new Set(exact.map((r) => r.id)).size);
}

/**
 * Splits a Pagefind excerpt into plain text and highlighted parts. Pagefind escapes indexed text and adds
 * only <mark> tags, so after splitting on those tags every part is decoded as text and rendered by React,
 * never injected as HTML.
 */
export function excerptParts(excerpt: string): { text: string; mark: boolean }[] {
  const decode = (s: string) =>
    s
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&amp;/g, '&');
  const parts: { text: string; mark: boolean }[] = [];
  const re = /<mark>([\s\S]*?)<\/mark>/g;
  let last = 0;
  for (const m of excerpt.matchAll(re)) {
    if (m.index > last) parts.push({ text: decode(excerpt.slice(last, m.index)), mark: false });
    parts.push({ text: decode(m[1]), mark: true });
    last = m.index + m[0].length;
  }
  if (last < excerpt.length) parts.push({ text: decode(excerpt.slice(last)), mark: false });
  return parts.filter((p) => p.text);
}

/** Excerpt parts with "..." added where the excerpt starts or ends inside the page's text. */
export function excerptWithEllipses(excerpt: string, content: string): { text: string; mark: boolean }[] {
  const parts = excerptParts(excerpt);
  const plain = parts.map((p) => p.text).join('').trim();
  if (!plain) return parts;
  const flat = content.replace(/\s+/g, ' ').trim();
  const probe = (s: string) => s.replace(/\s+/g, ' ');
  const out = [...parts];
  if (!flat.startsWith(probe(plain.slice(0, 24)))) out.unshift({ text: '...', mark: false });
  if (!flat.endsWith(probe(plain.slice(-24)))) out.push({ text: '...', mark: false });
  return out;
}

/** Longest suffix a stem may drop and still count as the same word ("running" to "run"). */
const MAX_STEM_CUT = 4;
const MIN_STEM = 3;

/**
 * When a term matches nothing, Pagefind falls back to the longest indexed word that is a prefix of it,
 * so "xyzzyplugh" returns every page containing "x". That fallback is right for stems ("running" finds
 * "run") and wrong for nonsense. A match is genuine when, for every query term, some matched word
 * either extends the term (prefix search) or shares a stem with it at least MIN_STEM long that leaves at
 * most MAX_STEM_CUT characters of the term unmatched ("cities" and "city" share "cit"). Pagefind applies the fallback to the whole result set of a term, so checking
 * the top result decides it for all of them.
 */
export function isGenuineMatch(query: string, matchedWords: string[]): boolean {
  const terms = query.split(/\s+/).map(normaliseWord).filter(Boolean);
  const words = matchedWords.map(normaliseWord).filter(Boolean);
  return terms.every((t) =>
    words.some((w) => {
      if (w.startsWith(t)) return true;
      const shared = commonPrefix(t, w);
      return shared >= MIN_STEM && t.length - shared <= MAX_STEM_CUT;
    }),
  );
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** The words of a result that Pagefind matched. */
export function matchedWords(d: Pick<PagefindResultData, 'content' | 'locations'>): string[] {
  const words = d.content.split(/\s+/);
  return d.locations.map((i) => words[i]).filter((w): w is string => Boolean(w));
}
