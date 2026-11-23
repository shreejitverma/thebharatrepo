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
 * The locator, the identifier and the record link sit on their own line under a linked title, so every list of
 * citations has the same shape whatever the title's length. (In source lists the title link is an inline block, for
 * its target size, so a locator after a two-line title would start the next line with its comma.) An unlinked title
 * keeps its locator inline. `identifier={false}` drops the identifier where the page already shows it (the source
 * record itself).
 */
export default function SourceCitation({ source, locator, record = false, identifier = true }: { source: Source; locator?: string; record?: boolean; identifier?: boolean }) {
  const link = verifiedSourceLink(source);
  const text = formatSource(source);
  const id = !identifier ? null : source.doi ? `doi:${source.doi}` : source.isbn ? `ISBN ${source.isbn}` : null;
  const metaLocator = link && locator ? bindLocator(locator) : null;
  return (
    <>
      {link ? (
        <a href={link} rel="noopener noreferrer" target="_blank" className="source-citation__title">
          {text}
        </a>
      ) : (
        text
      )}
      {locator && !link ? `, ${bindLocator(locator)}` : ''}
      {metaLocator || id || record ? (
        <span className="source-citation__meta">
          {metaLocator ? <span className="source-citation__locator">{metaLocator}</span> : null}
          {metaLocator && (id || record) ? <span className="muted" aria-hidden="true"> · </span> : null}
          {id ? <span className="muted">{id}</span> : null}
          {id && record ? ' ' : null}
          {record ? (
            <Link href={sourceHref(source.id)} prefetch={false} className="source-record" aria-label={`Source record: ${text}`}>
              Source record
            </Link>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
