import type { Metadata } from 'next';
import Link from 'next/link';
import EntityNames from '@/components/EntityNames';
import { getIndex } from '@/lib/content/site';
import { KINDS, KIND_LABELS } from '@/lib/content/labels';
import { formatRange } from '@/lib/time';
import { primaryAnchor } from '@/lib/content/lens';

export const metadata: Metadata = { title: 'Archive', description: 'Every entity in The Bharat Repo, by kind and in time order.' };

export default function ArchivePage() {
  const items = getIndex();
  return (
    <div className="main-content">
      <p className="eyebrow">Archive</p>
      <h1>Everything in the archive</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        {items.length} entries, grouped by kind and ordered in time. Each one carries its datings, evidence grades and sources.
      </p>
      <nav className="tag-list" aria-label="Kinds" style={{ margin: '16px 0 8px' }}>
        {KINDS.filter((k) => items.some((i) => i.kind === k)).map((k) => (
          <a key={k} href={`#${k}`}>
            {KIND_LABELS[k]} ({items.filter((i) => i.kind === k).length})
          </a>
        ))}
      </nav>
      {KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k).sort((a, b) => (primaryAnchor(a, 'both') ?? 0) - (primaryAnchor(b, 'both') ?? 0));
        if (!list.length) return null;
        return (
          <section key={k} id={k} aria-labelledby={`h-${k}`}>
            <h2 id={`h-${k}`}>{KIND_LABELS[k]}</h2>
            <div className="category-grid">
              {list.map((i) => {
                const d = i.datings.find((x) => x.lens === 'scholarship') ?? i.datings[0];
                return (
                  <Link key={i.id} href={i.href} className="card">
                    <h3>{i.name}</h3>
                    <EntityNames native={i.native} iast={i.iast} nativeLang={i.nativeLang} iastLang={i.iastLang} className="card__names" />
                    {/* Adult summary only: teen and kids versions on all cards would double this page's weight. Entity pages switch level. */}
                    <p>{i.summary.length > 140 ? `${i.summary.slice(0, 137).replace(/\s+\S*$/, '')}...` : i.summary}</p>
                    <p className="card__meta">
                      {formatRange(d)} {d.lens === 'tradition' ? '(tradition)' : ''}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
