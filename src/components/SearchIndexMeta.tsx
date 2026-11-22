import type { Facet } from '@/lib/search/facets';

/**
 * Pagefind filters, metadata and sort keys for one content page, rendered as empty elements inside the
 * page's data-pagefind-body so they add no visible or indexed text. Values are read from data attributes
 * (Pagefind's `key[attr]` form) so they may contain commas.
 */
export default function SearchIndexMeta({
  title,
  kind,
  when,
  filters,
}: {
  title: string;
  kind: string;
  when?: string;
  filters: Partial<Record<Facet, string[]>>;
}) {
  const grades = filters.grade ?? [];
  return (
    <span className="search-index-meta" aria-hidden="true">
      <span data-pagefind-meta="title[data-v]" data-v={title} />
      <span data-pagefind-meta="kind[data-v]" data-v={kind} />
      {when ? <span data-pagefind-meta="when[data-v]" data-v={when} /> : null}
      {grades.length ? <span data-pagefind-meta="grades[data-v]" data-v={grades.join(' ')} /> : null}
      <span data-pagefind-sort="title[data-v]" data-v={title.toLowerCase()} />
      {(Object.entries(filters) as [Facet, string[]][]).flatMap(([facet, values]) =>
        [...new Set(values)].map((v) => <span key={`${facet}:${v}`} data-pagefind-filter={`${facet}[data-v]`} data-v={v} />),
      )}
    </span>
  );
}
