import type { Metadata } from 'next';
import SourceCitation from '@/components/SourceCitation';
import { getGraph } from '@/lib/content/site';

export const metadata: Metadata = { title: 'Bibliography', description: 'Every source cited in The Bharat Repo, each identifier machine-verified.' };

export default function SourcesPage() {
  const sources = [...getGraph().sources.values()].sort((a, b) => (a.authors[0] ?? a.editors[0] ?? a.title).localeCompare(b.authors[0] ?? b.editors[0] ?? b.title));
  return (
    <div className="main-content">
      <p className="eyebrow">Bibliography</p>
      <h1>Sources</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        {sources.length} works cited across the archive. Every DOI and ISBN below has been resolved against Crossref, Open Library or Google Books, and its title matched.
      </p>
      <ul className="biblio">
        {sources.map((s) => (
          <li key={s.id} id={s.id}>
            <SourceCitation source={s} />
            <div className="muted">{s.type.replace(/-/g, ' ')}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
