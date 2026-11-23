import type { Metadata } from 'next';
import Link from 'next/link';
import GradeBadge from '@/components/GradeBadge';
import { getGraph } from '@/lib/content/site';
import { debateHref, debatePlacement, debatesPreview, placementLabel, publishedDebates, visibleDebates } from '@/lib/content/debates';

export function generateMetadata(): Metadata {
  return {
    title: 'Debates',
    description: 'Where credible positions disagree: each position at its strongest, with named proponents, graded evidence and what would change the picture.',
    // An empty index is not worth a search result; it is indexed once the owner approves the first debate.
    // Drafts listed by a preview build do not count: a preview of drafts alone stays noindex.
    robots: publishedDebates(getGraph().debates).length ? undefined : { index: false, follow: true },
  };
}

export default function DebatesPage() {
  const g = getGraph();
  const debates = visibleDebates(g.debates);
  const preview = debatesPreview();
  return (
    <div className="main-content">
      <p className="eyebrow">Debates</p>
      <h1>Where the evidence is contested</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        Some questions are not settled. A debate page sets out every serious position at its strongest, names the scholars and traditions who hold it, grades the evidence each relies on, and says
        what new evidence would change the picture.
      </p>
      <p className="section-note">
        Debate pages are published only after review and the owner&apos;s approval. <Link href="/methodology">How evidence is graded</Link>
      </p>
      {preview ? (
        <p className="unpublished-banner" role="note">
          <strong>Preview build.</strong> Unpublished debates are listed here for review only. They are not in the public site, the search index or the sitemap.
        </p>
      ) : null}
      {debates.length === 0 ? (
        <p className="empty">0 debates published yet. Drafts are under review and appear here once approved.</p>
      ) : (
        <section aria-labelledby="debate-list">
          {/* Keeps the heading outline h1, h2, h3 for the cards' titles. */}
          <h2 id="debate-list" className="visually-hidden">
            All debates
          </h2>
          <div className="category-grid" style={{ marginTop: 16 }}>
            {debates.map((d) => {
              const r = debatePlacement(g, d);
              return (
                <Link key={d.id} href={debateHref(d)} className="card">
                  <h3>{d.title}</h3>
                  <p>{d.question}</p>
                  <p className="card__meta">
                    {d.positions.length} positions{r ? `, ${placementLabel(r)}` : ''}
                    {d.published ? '' : ', unpublished draft'}
                  </p>
                  <p className="card__meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {d.positions.map((p) => (
                      <GradeBadge key={p.id} grade={p.grade} showLabel={false} />
                    ))}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
