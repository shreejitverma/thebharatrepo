import type { Metadata } from 'next';
import Link from 'next/link';
import SourceCitation from '@/components/SourceCitation';
import { entityHref } from '@/lib/content/kaalchakra';
import { citationId } from '@/lib/content/schema';
import { correctionAnchors } from '@/lib/content/references';
import { getGraph } from '@/lib/content/site';

export const metadata: Metadata = { title: 'Corrections log', description: 'Every substantive correction made to The Bharat Repo, with reasons and sources.' };

export default function CorrectionsPage() {
  const g = getGraph();
  const list = g.corrections;
  const anchors = correctionAnchors(list);
  // Link a target only when it is a page that exists.
  const pages = new Set([...g.articles.map((a) => `/${a.category}/${a.slug}`), ...[...g.entities.keys()].map(entityHref)]);
  return (
    <div className="main-content">
      <div className="prose-wrap">
        <p className="eyebrow">Corrections</p>
        <h1>Corrections log</h1>
        <p className="lede" style={{ marginTop: 0 }}>
          When we get something wrong, we fix it in public. {list.length} correction{list.length === 1 ? '' : 's'} recorded.
        </p>
        {list.length === 0 ? <p className="empty">0 corrections recorded.</p> : null}
        {list.map((c, i) => (
          <section key={anchors[i]} id={anchors[i]} className="correction" aria-label={`Correction of ${c.date} to ${c.target}`}>
            <p className="muted" style={{ margin: 0 }}>
              {c.date} / {pages.has(c.target) ? <Link href={c.target} prefetch={false}>{c.target}</Link> : c.target}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>Before:</strong> {c.before}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>After:</strong> {c.after}
            </p>
            <p style={{ margin: '6px 0' }} className="muted">
              Why: {c.reason}
            </p>
            {c.sources.length > 0 ? (
              <>
                <p style={{ margin: '6px 0 0' }}>
                  <strong>Sources:</strong>
                </p>
                <ul className="correction-sources">
                  {c.sources.map((ref, j) => {
                    const s = g.sources.get(citationId(ref));
                    return <li key={j}>{s ? <SourceCitation source={s} locator={typeof ref === 'string' ? undefined : ref.locator} record /> : citationId(ref)}</li>;
                  })}
                </ul>
              </>
            ) : (
              <p style={{ margin: '6px 0 0' }} className="muted">
                No source cited for this correction.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
