import type { Facet } from '@/lib/search/facets';
import { EXACT_FILTER, exactFilterValues } from '@/lib/search/normalise';

/**
 * Pagefind filters, metadata and sort keys for one content page, rendered as empty elements inside the
 * page's data-pagefind-body so they add no visible or indexed text. Values are read from data attributes
 * (Pagefind's `key[attr]` form) so they may contain commas.
 *
 * The `exact` filter carries hashes of the normalised title and, marked as such, of the alternate names (`names`,
 * such as an entity's IAST form), so the search page can pin the record a reader named even when longer pages
 * outrank it, a record titled with the query before one that only has it as an alternate name.
 */
export default function SearchIndexMeta({
  title,
  kind,
  when,
  names = [],
  filters,
}: {
  title: string;
  kind: string;
  when?: string;
  /** Alternate names a reader may type instead of the title. */
  names?: (string | undefined)[];
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
      {exactFilterValues(title, names).map((v) => (
        <span key={`${EXACT_FILTER}:${v}`} data-pagefind-filter={`${EXACT_FILTER}[data-v]`} data-v={v} />
      ))}
    </span>
  );
}
