import SourceCitation from '@/components/SourceCitation';
import { backlinkLabel } from '@/lib/content/references';
import type { RenderedReference } from '@/lib/content/render';

/** Numbered references generated from an article's citations, with locators and back-links to each use. */
export default function ArticleReferences({ references }: { references: RenderedReference[] }) {
  return (
    <section className="references" aria-labelledby="refs" data-pagefind-ignore>
      <h2 id="refs">References</h2>
      <p className="muted references__note">
        Numbered in order of first citation. Each title links to its verified identifier; the source record lists everything else in the archive that cites it.
      </p>
      <ol>
        {references.map((r) => (
          <li key={r.n} id={`ref-${r.n}`}>
            {r.uses.length ? (
              <span className="references__backs">
                <span aria-hidden="true">↑</span>
                {r.uses.map((k, i) => (
                  <a key={k} className="references__back" href={`#cite-${k}`} aria-label={`Back to use ${backlinkLabel(i)} of citation ${r.n} in the text`}>
                    {backlinkLabel(i)}
                  </a>
                ))}
              </span>
            ) : null}
            <SourceCitation source={r.source} record />
            {r.locators.length || r.dating ? (
              <span className="references__notes">
                {r.locators.length ? <span className="references__locators">Cited at: {r.locators.join('; ')}.</span> : null}
                {r.locators.length && r.dating ? ' ' : null}
                {r.dating ? <span className="muted">{r.uses.length ? 'Also cited for' : 'Cited for'} the article&rsquo;s dating.</span> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
