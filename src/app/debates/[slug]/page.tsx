import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EntityNames from '@/components/EntityNames';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import SourceCitation from '@/components/SourceCitation';
import { getGraph, getIndex, issueUrl } from '@/lib/content/site';
import { debatePlacement, placementLabel, visibleDebates } from '@/lib/content/debates';
import { formatDating, primaryDating } from '@/components/kaalchakra/shared';
import { toKcItem } from '@/lib/content/kaalchakra';
import { citationId, reviewStatusText, type CitationRef } from '@/lib/content/schema';
import { formatRange } from '@/lib/time';
import { yearToUnit } from '@/lib/time/scale';

export const dynamicParams = false;

/** Unpublished debates are not built unless DEBATES_PREVIEW=1 (see lib/content/debates.ts). */
export function generateStaticParams() {
  return visibleDebates(getGraph().debates).map((d) => ({ slug: d.slug }));
}

function find(slug: string) {
  return visibleDebates(getGraph().debates).find((d) => d.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = find(slug);
  if (!d) return {};
  return {
    title: d.title,
    description: d.summary,
    openGraph: { title: d.title, description: d.summary },
    robots: d.published ? undefined : { index: false, follow: false },
  };
}

function Sources({ refs }: { refs: CitationRef[] }) {
  const g = getGraph();
  return (
    <ul className="dating__sources">
      {refs.map((ref, i) => {
        const s = g.sources.get(citationId(ref));
        return <li key={i}>{s ? <SourceCitation source={s} locator={typeof ref === 'string' ? undefined : ref.locator} /> : citationId(ref)}</li>;
      })}
    </ul>
  );
}

export default async function DebatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = find(slug);
  if (!d) notFound();
  const g = getGraph();
  const place = debatePlacement(g, d);
  const ranged = d.positions.filter((p) => p.range);
  const lo = Math.min(...ranged.map((p) => p.range!.earliest));
  const hi = Math.max(...ranged.map((p) => p.range!.latest));
  const pad = Math.max(10, (hi - lo) * 0.06);
  const x = (year: number) => ((year - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const related = d.relatedEntities.map((id) => toKcItem(g.entities.get(id)!));
  const articles = d.relatedArticles.map((ref) => g.articles.find((a) => `${a.category}/${a.slug}` === ref)!);
  const u = place ? yearToUnit(place.range.best ?? (place.range.earliest + place.range.latest) / 2) : 0;

  return (
    // Only a published debate is marked for the search index; the indexer also lists published debates only.
    <div className="main-content" data-pagefind-body={d.published ? true : undefined}>
      {d.published ? <SearchIndexMeta title={d.title} kind="debate" when={place ? placementLabel(place) : undefined} filters={{ kind: ['debate'] }} /> : null}
      <nav className="breadcrumbs" aria-label="Breadcrumb" data-pagefind-ignore>
        <Link href="/debates">Debates</Link>
      </nav>
      {d.published ? null : (
        <p className="unpublished-banner" role="note">
          <strong>Unpublished draft.</strong> This debate page has not been approved for publication. It appears only in a local preview build for the owner&apos;s review, and is excluded from the
          public site, search and sitemap.
        </p>
      )}
      <p className="eyebrow">Debate</p>
      <h1>{d.title}</h1>
      <p className="debate-question">{d.question}</p>
      <p className="lede" style={{ marginTop: 0 }}>
        {d.summary}
      </p>

      {ranged.length ? (
        <section className="position-chart" aria-labelledby="glance">
          <h2 id="glance" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>
            Positions at a glance
          </h2>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
            Each bar spans the lifetime that the position implies, on one shared scale.
          </p>
          <ol>
            {ranged.map((p) => (
              <li key={p.id} className="position-chart__row">
                <div className="position-chart__label">
                  <a href={`#${p.id}`}>{p.label}</a>
                  <GradeBadge grade={p.grade} showLabel={false} />
                  <LensTag lens={p.lens} />
                  <span className="muted">{formatRange(p.range!)}</span>
                </div>
                <div className="position-chart__track" aria-hidden="true">
                  <span
                    className={`position-chart__bar${p.lens === 'tradition' ? ' position-chart__bar--tradition' : ''}`}
                    style={{ left: `${x(p.range!.earliest).toFixed(2)}%`, width: `${Math.max(1, x(p.range!.latest) - x(p.range!.earliest)).toFixed(2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <div className="position-chart__axis" aria-hidden="true">
            <span style={{ left: `${x(lo).toFixed(2)}%` }}>{formatRange({ earliest: lo, latest: lo, precision: 'year', circa: false })}</span>
            <span style={{ left: `${x(hi).toFixed(2)}%` }}>{formatRange({ earliest: hi, latest: hi, precision: 'year', circa: false })}</span>
          </div>
        </section>
      ) : null}

      {place ? (
        <KaalchakraStrip
          items={getIndex()}
          dating={place}
          selfId={null}
          focusHref={`/kaalchakra?id=${encodeURIComponent(d.relatedEntities[0])}&view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`}
        />
      ) : null}

      {d.commonGround.length ? (
        <section aria-labelledby="common">
          <h2 id="common">What every position accepts</h2>
          <ul className="evidence-list">
            {d.commonGround.map((ev, i) => (
              <li key={i}>
                <p>{ev.text}</p>
                <GradeBadge grade={ev.grade} />
                <Sources refs={ev.sources} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2>The positions</h2>
      <p className="section-note">Each position is stated as its proponents would state it, with the evidence it relies on and the strongest objections it has to answer.</p>
      {d.positions.map((p) => (
        <section key={p.id} id={p.id} className={`position position--${p.lens}`} aria-labelledby={`h-${p.id}`}>
          <h2 id={`h-${p.id}`}>{p.label}</h2>
          <div className="position__meta">
            <GradeBadge grade={p.grade} />
            <LensTag lens={p.lens} />
            {p.range ? <span className="muted">{formatRange(p.range)}</span> : null}
          </div>
          <p className="position__statement">{p.statement}</p>
          <h3>Named proponents</h3>
          <ul className="proponents">
            {p.proponents.map((pr) => {
              const work = pr.work ? g.sources.get(citationId(pr.work)) : undefined;
              return (
                <li key={pr.name}>
                  <strong>{pr.name}</strong>
                  {pr.role ? `, ${pr.role}` : ''}
                  {work && pr.work ? (
                    <>
                      {'. '}
                      <SourceCitation source={work} locator={typeof pr.work === 'string' ? undefined : pr.work.locator} />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <h3>Evidence</h3>
          <ul className="evidence-list">
            {p.evidence.map((ev, i) => (
              <li key={i}>
                <p>{ev.text}</p>
                <GradeBadge grade={ev.grade} />
                <Sources refs={ev.sources} />
              </li>
            ))}
          </ul>
          {p.objections.length ? (
            <>
              <h3>Strongest objections</h3>
              <ul className="objections">
                {p.objections.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ))}

      <section aria-labelledby="change">
        <h2 id="change">What would change this</h2>
        <ul className="objections" style={{ maxWidth: 860 }}>
          {d.whatWouldChangeThis.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="related">
        <h2 id="related">In the archive</h2>
        <div className="category-grid">
          {related.map((i) => (
            <Link key={i.id} href={i.href} className="card">
              <h3>{i.name}</h3>
              <EntityNames native={i.native} iast={i.iast} nativeLang={i.nativeLang} iastLang={i.iastLang} className="card__names" />
              {primaryDating(i, 'both') ? <p className="card__meta">{formatDating(primaryDating(i, 'both')!, 'ce')}</p> : null}
            </Link>
          ))}
        </div>
        {articles.length ? (
          <ul className="relations" style={{ marginTop: 12 }}>
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/${a.category}/${a.slug}`}>
                  {a.title} <span>Article</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="review-note" style={{ marginTop: 32, maxWidth: 860 }}>
        Review status: {reviewStatusText(d.review)}.
        {d.approval ? ` Approved for publication by ${d.approval.by} on ${d.approval.date}.` : ' Not yet approved for publication.'}{' '}
        <a href={issueUrl(`Correction: ${d.title} (${d.id})`, `Debate: ${d.id}\n\nWhat is wrong or missing:\n\nEvidence (with source):\n`)}>Report an error</a>
      </p>
    </div>
  );
}
