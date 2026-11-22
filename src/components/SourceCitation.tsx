import Link from 'next/link';
import type { Source } from '@/lib/content/schema';
import { formatSource, sourceHref } from '@/lib/content/kaalchakra';
import { verifiedSourceLink } from '@/lib/content/verification';

/** Keeps a locator abbreviation with its number ("pp. 163-167", "fig. 4") when the line wraps. */
export function bindLocator(locator: string): string {
  return locator.replace(/\b(pp?|ll?|vv?|fig|figs|no|nos|col|cols|vol|ch)\.\s+(?=\S)/gi, '$1.\u00a0');
}

/**
 * A formatted citation. The title links to the source's verified identifier only (see sourceIdentifiers);
 * `record` adds a link to the source's own page, which lists everything that cites it.
 *
 * The identifier and the record link sit on their own line under the title, so every list of citations
 * has the same shape whatever the title's length. `identifier={false}` drops the identifier where the
 * page already shows it (the source record itself).
 */
export default function SourceCitation({ source, locator, record = false, identifier = true }: { source: Source; locator?: string; record?: boolean; identifier?: boolean }) {
  const link = verifiedSourceLink(source);
  const text = formatSource(source);
  const id = !identifier ? null : source.doi ? `doi:${source.doi}` : source.isbn ? `ISBN ${source.isbn}` : null;
  return (
    <>
      {link ? (
        <a href={link} rel="noopener noreferrer" target="_blank" className="source-citation__title">
          {text}
        </a>
      ) : (
        text
      )}
      {locator ? `, ${bindLocator(locator)}` : ''}
      {id || record ? (
        <span className="source-citation__meta">
          {id ? <span className="muted">{id}</span> : null}
          {id && record ? ' ' : null}
          {record ? (
            <Link href={sourceHref(source.id)} className="source-record" aria-label={`Source record: ${text}`}>
              Source record
            </Link>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
