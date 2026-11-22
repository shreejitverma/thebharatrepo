/**
 * Search facets shared by the indexer (data-pagefind-filter attributes on content pages) and the
 * search page (URL state and Pagefind filter queries). Client-safe: no zod, no node APIs.
 *
 * URL contract for /search: ?q=<text>&kind=<k>&category=<c>&grade=<g>&lens=<l>, each facet repeatable.
 * Unknown facet values are dropped, so an old or hand-edited link still loads.
 */

import { CATEGORIES, CATEGORY_LABELS, GRADES, GRADE_LABELS, KINDS, KIND_LABELS } from '@/lib/content/labels';

export const FACETS = ['kind', 'category', 'grade', 'lens'] as const;
export type Facet = (typeof FACETS)[number];

export const FACET_LABELS: Record<Facet, string> = {
  kind: 'Kind',
  category: 'Article category',
  grade: 'Evidence grade',
  lens: 'Lens',
};

export interface FacetOption {
  value: string;
  label: string;
}

/** Record kinds: every entity kind (the Kaalchakra rings), plus articles and sources. */
export const RECORD_KIND_LABELS: Record<string, string> = { ...KIND_LABELS, article: 'Articles', source: 'Sources' };

export const FACET_OPTIONS: Record<Facet, FacetOption[]> = {
  kind: [...KINDS, 'article', 'source'].map((value) => ({ value, label: RECORD_KIND_LABELS[value] })),
  category: CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
  grade: GRADES.map((value) => ({ value, label: `${value}: ${GRADE_LABELS[value]}` })),
  lens: [
    { value: 'scholarship', label: 'Scholarship' },
    { value: 'tradition', label: 'Tradition' },
  ],
};

export type FacetSelection = Record<Facet, string[]>;

export interface SearchState {
  q: string;
  filters: FacetSelection;
}

export function emptySelection(): FacetSelection {
  return { kind: [], category: [], grade: [], lens: [] };
}

/** Selected values for one facet, deduplicated, unknown values dropped, in option order. */
function cleanFacet(facet: Facet, values: string[]): string[] {
  const wanted = new Set(values);
  return FACET_OPTIONS[facet].map((o) => o.value).filter((v) => wanted.has(v));
}

export function parseSearchParams(params: URLSearchParams): SearchState {
  const filters = emptySelection();
  for (const f of FACETS) filters[f] = cleanFacet(f, params.getAll(f).flatMap((v) => v.split(',')));
  return { q: (params.get('q') ?? '').trim(), filters };
}

export function toSearchParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  const q = state.q.trim();
  if (q) p.set('q', q);
  for (const f of FACETS) for (const v of cleanFacet(f, state.filters[f])) p.append(f, v);
  return p;
}

export function activeFilterCount(filters: FacetSelection): number {
  return FACETS.reduce((n, f) => n + filters[f].length, 0);
}

/**
 * Pagefind filter query: OR within a facet, AND across facets. Every facet is always present (an empty
 * `any` places no constraint) because Pagefind reports counts only for the facets named in the query.
 */
export function toPagefindFilters(filters: FacetSelection): Record<Facet, { any: string[] }> {
  return Object.fromEntries(FACETS.map((f) => [f, { any: [...filters[f]] }])) as Record<Facet, { any: string[] }>;
}

/** The selection without one facet, used to count that facet's options (so siblings stay selectable). */
export function withoutFacet(filters: FacetSelection, facet: Facet): FacetSelection {
  return { ...filters, [facet]: [] };
}
