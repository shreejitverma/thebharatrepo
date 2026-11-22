import type { Metadata } from 'next';
import Link from 'next/link';
import SourceCitation from '@/components/SourceCitation';
import { sourceHref } from '@/lib/content/kaalchakra';
import { citedByCount } from '@/lib/content/references';
import { getCitationIndex, getGraph } from '@/lib/content/site';

export const metadata: Metadata = { title: 'Bibliography', description: 'Every source cited in The Bharat Repo, each identifier machine-verified.' };

export default function SourcesPage() {
  const sources = [...getGraph().sources.values()].sort((a, b) => (a.authors[0] ?? a.editors[0] ?? a.title).localeCompare(b.authors[0] ?? b.editors[0] ?? b.title));
  const cited = getCitationIndex();
  return (
    <div className="main-content">
      <p className="eyebrow">Bibliography</p>
      <h1>Sources</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        {sources.length} works cited across the archive. Every DOI and ISBN below has been resolved against Crossref, Open Library or Google Books, and its title matched. Each source record lists every article, archive record and correction that cites it.
      </p>
      <ul className="biblio">
        {sources.map((s) => {
          const n = citedByCount(cited.get(s.id));
          return (
            <li key={s.id} id={s.id}>
              <SourceCitation source={s} />
              <div className="muted">
                {s.type.replace(/-/g, ' ')},{' '}
                <Link href={sourceHref(s.id)} aria-label={`Source record, cited by ${n} ${n === 1 ? 'item' : 'items'}: ${s.title}`}>
                  source record, cited by {n} {n === 1 ? 'item' : 'items'}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
