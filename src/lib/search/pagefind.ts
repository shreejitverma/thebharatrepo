/**
 * Minimal typed loader for the Pagefind browser API written to public/pagefind by scripts/build-search.ts.
 * The module is loaded at runtime from the static site, never bundled.
 */

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

let loading: Promise<Pagefind> | undefined;

export function loadPagefind(): Promise<Pagefind> {
  if (!loading) {
    loading = (async () => {
      const url = PAGEFIND_URL;
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as Pagefind;
      await mod.options({ excerptLength: 28 });
      await mod.init();
      // Load the filter index up front: a search issued before it has loaded reports no filter counts.
      await mod.filters();
      return mod;
    })();
    // A failed load (offline, missing index in `next dev`) must be retryable.
    loading.catch(() => {
      loading = undefined;
    });
  }
  return loading;
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

/** Lowercase letters and digits only, diacritics removed, so "Ṛgveda." compares equal to "rgveda". */
export function normaliseWord(w: string): string {
  return w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
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
