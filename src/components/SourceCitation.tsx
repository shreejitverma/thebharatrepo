import Link from 'next/link';
import type { Source } from '@/lib/content/schema';
import { formatSource, sourceHref } from '@/lib/content/kaalchakra';
import { verifiedSourceLink } from '@/lib/content/verification';

/**
 * A formatted citation. The title links to the source's verified identifier only (see sourceIdentifiers);
 * `record` adds a link to the source's own page, which lists everything that cites it.
 */
export default function SourceCitation({ source, locator, record = false }: { source: Source; locator?: string; record?: boolean }) {
  const link = verifiedSourceLink(source);
  const text = formatSource(source);
  return (
    <>
      {link ? (
        <a href={link} rel="noopener noreferrer" target="_blank">
          {text}
        </a>
      ) : (
        text
      )}
      {locator ? `, ${locator}` : ''}
      {source.doi ? <span className="muted"> doi:{source.doi}</span> : source.isbn ? <span className="muted"> ISBN {source.isbn}</span> : null}
      {record ? (
        <>
          {' '}
          <Link href={sourceHref(source.id)} className="source-record" aria-label={`Source record: ${text}`}>
            Source record
          </Link>
        </>
      ) : null}
    </>
  );
}
