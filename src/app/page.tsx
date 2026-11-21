import Link from 'next/link';
import Wheel from '@/components/kaalchakra/Wheel';
import GradeBadge from '@/components/GradeBadge';
import { CATEGORY_META, getGraph, getIndex } from '@/lib/content/site';
import { CATEGORIES } from '@/lib/content/schema';
import { KINDS, GRADE_LABELS, isTraditional } from '@/lib/content/labels';
import { orderedItems } from '@/components/kaalchakra/shared';

export default function Home() {
  const g = getGraph();
  const items = getIndex();
  const datings = [...g.entities.values()].flatMap((e) => e.datings);
  const scholarly = datings.filter((d) => !isTraditional(d.method));
  const ab = scholarly.length ? Math.round((100 * scholarly.filter((d) => d.grade === 'A' || d.grade === 'B').length) / scholarly.length) : 0;

  return (
    <div className="main-content">
      <section className="home-hero">
        <div>
          <p className="eyebrow">The evidence-based archive of Bharat</p>
          <h1>Our whole history, on one wheel of time</h1>
          <p className="lede">
            The history, knowledge and living traditions of Bharat and Sanatana Dharma. Every entry is placed on the Kaalchakra, every claim is graded, and every source is verified, so you can
            share it with anyone and it will stand.
          </p>
          <div className="home-hero__actions">
            <Link href="/kaalchakra" className="btn btn--primary">
              Enter the Kaalchakra
            </Link>
            <Link href="/methodology" className="btn">
              How we know
            </Link>
          </div>
          <div className="stat-row">
            <div className="stat">
              <span className="stat__n">{items.length}</span>
              <span className="stat__l">entries in time</span>
            </div>
            <div className="stat">
              <span className="stat__n">{g.sources.size}</span>
              <span className="stat__l">verified sources</span>
            </div>
            <div className="stat">
              <span className="stat__n">{ab}%</span>
              <span className="stat__l">scholarly datings graded A or B</span>
            </div>
          </div>
        </div>
        <Link href="/kaalchakra" className="home-hero__wheel" aria-label="Open the Kaalchakra">
          <Wheel items={orderedItems(items, 'both')} kinds={KINDS} lens="both" selectedId={null} cal="ce" interactive={false} />
        </Link>
      </section>

      <section aria-labelledby="how">
        <h2 id="how">Every claim tells you how sure we are</h2>
        <div className="grade-strip">
          {(['A', 'B', 'C', 'D', 'E'] as const).map((gr) => (
            <div key={gr}>
              <GradeBadge grade={gr} />
              <p>
                {
                  {
                    A: 'Inscriptions, coins, dated excavations, contemporary records.',
                    B: 'Independent lines of evidence agree; mainstream scholarship.',
                    C: 'Reasoned estimates that scholars still debate.',
                    D: 'The chronology of the Puranas and Siddhantas, in its own lens.',
                    E: 'Speculative reconstructions, shown and labelled.',
                  }[gr]
                }
              </p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          {GRADE_LABELS.D} is shown beside scholarship, never hidden and never passed off as dated history.
        </p>
      </section>

      <section aria-labelledby="read">
        <h2 id="read">Read</h2>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/${c}`} className="card">
              <h3>{CATEGORY_META[c].title}</h3>
              <p>{CATEGORY_META[c].description}</p>
              <p className="card__meta">{g.articles.filter((a) => a.category === c).length} articles</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
