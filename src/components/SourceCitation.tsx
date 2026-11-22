import type { Source } from '@/lib/content/schema';
import { formatSource, sourceLink } from '@/lib/content/kaalchakra';

/** Keeps a locator abbreviation with its number ("pp. 163-167", "fig. 4") when the line wraps. */
export function bindLocator(locator: string): string {
  return locator.replace(/\b(pp?|ll?|vv?|fig|figs|no|nos|col|cols|vol|ch)\.\s+(?=\S)/gi, '$1.\u00a0');
}

export default function SourceCitation({ source, locator }: { source: Source; locator?: string }) {
  const link = sourceLink(source);
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
      {locator ? `, ${bindLocator(locator)}` : ''}
      {source.doi ? <span className="muted"> doi:{source.doi}</span> : source.isbn ? <span className="muted"> ISBN {source.isbn}</span> : null}
    </>
  );
}
