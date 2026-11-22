import type { Source } from '@/lib/content/schema';
import { formatSource, sourceLink } from '@/lib/content/kaalchakra';

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
      {locator ? `, ${locator}` : ''}
      {source.doi ? <span className="muted"> doi:{source.doi}</span> : source.isbn ? <span className="muted"> ISBN {source.isbn}</span> : null}
    </>
  );
}
