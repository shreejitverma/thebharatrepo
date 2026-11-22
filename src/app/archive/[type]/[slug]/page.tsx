import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { preconnect } from 'react-dom';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import SourceCitation from '@/components/SourceCitation';
import { getGraph, getIndex, issueUrl, SITE_URL } from '@/lib/content/site';
import { entityHref } from '@/lib/content/kaalchakra';
import { rankDatings } from '@/lib/content/lens';
import { KIND_LABELS, METHOD_LABELS, isTraditional, citationId } from '@/lib/content/schema';
import { verifiedImage } from '@/lib/content/verification';
import { formatRange } from '@/lib/time';
import { yearToUnit } from '@/lib/time/scale';

export const dynamicParams = false;

export function generateStaticParams() {
  return [...getGraph().entities.keys()].map((id) => {
    const [type, slug] = id.split('.');
    return { type, slug };
  });
}

function find(type: string, slug: string) {
  return getGraph().entities.get(`${type}.${slug}`);
}

export async function generateMetadata({ params }: { params: Promise<{ type: string; slug: string }> }): Promise<Metadata> {
  const { type, slug } = await params;
  const e = find(type, slug);
  return e ? { title: e.names.en, description: e.summary, openGraph: { title: e.names.en, description: e.summary } } : {};
}

function relationLabel(kind: string): string {
  return kind.replace(/-/g, ' ');
}

export default async function EntityPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const e = find(type, slug);
  if (!e) notFound();
  const g = getGraph();
  const img = e.image ? verifiedImage(e.image.commons) : null;
  if (img) preconnect(new URL(img.thumb).origin);
  const ordered = rankDatings(e.datings, (d) => isTraditional(d.method));
  const primary = ordered[0];
  const anchor = primary.range.best ?? (primary.range.earliest + primary.range.latest) / 2;
  const u = yearToUnit(anchor);
  const focus = `/kaalchakra?id=${encodeURIComponent(e.id)}`;
  const inbound = g.inbound.get(e.id) ?? [];
  const articles = g.articlesByEntity.get(e.id) ?? [];
  const src = (ref: Parameters<typeof citationId>[0]) => {
    const s = g.sources.get(citationId(ref));
    return s ? <SourceCitation source={s} locator={typeof ref === 'string' ? undefined : ref.locator} /> : citationId(ref);
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': e.type === 'person' ? 'Person' : e.type === 'site' ? 'Place' : e.type === 'text' ? 'CreativeWork' : 'Thing',
    name: e.names.en,
    alternateName: [e.names.iast, e.names.native].filter(Boolean),
    description: e.summary,
    url: `${SITE_URL}${entityHref(e.id)}`,
    sameAs: e.wikidata ? [`https://www.wikidata.org/wiki/${e.wikidata}`] : undefined,
  };

  return (
    <div className="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/archive">Archive</Link> / <Link href={`/archive#${e.kind}`}>{KIND_LABELS[e.kind]}</Link>
      </nav>
      <div className="entity-head">
        <div>
          <h1>{e.names.en}</h1>
          {e.names.iast || e.names.native ? (
            <div className="names">
              {e.names.native ? <span lang="sa">{e.names.native}</span> : null}
              {e.names.iast ? <span>{e.names.iast}</span> : null}
            </div>
          ) : null}
          <p className="lede" style={{ margin: '0 0 12px' }}>{e.summary}</p>
          {e.summaries?.teen || e.summaries?.kids ? (
            <details>
              <summary>Simpler explanations for young readers</summary>
              {e.summaries.teen ? <p><strong>For teens:</strong> {e.summaries.teen}</p> : null}
              {e.summaries.kids ? <p><strong>For children:</strong> {e.summaries.kids}</p> : null}
            </details>
          ) : null}
          {e.region ? <p className="muted">Region: {e.region}</p> : null}
        </div>
        {img && e.image ? (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.thumb} alt={e.image.alt} width={img.width} height={img.height} decoding="async" fetchPriority="high" />
            <figcaption>
              <a href={img.pageUrl} rel="noopener noreferrer" target="_blank">Wikimedia Commons</a>, {img.license}
              {img.artist ? `, ${img.artist}` : ''}
            </figcaption>
          </figure>
        ) : null}
      </div>

      <KaalchakraStrip items={getIndex()} range={primary.range} selfId={e.id} focusHref={`${focus}&view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`} />

      <h2>When, and how we know</h2>
      <div className="datings">
        {ordered.map((d, i) => {
          const lens = isTraditional(d.method) ? 'tradition' : 'scholarship';
          return (
            <div key={i} className={`dating dating--${lens}`}>
              <div className="dating__top">
                <span className="dating__range">{formatRange(d.range)}</span>
                <GradeBadge grade={d.grade} />
                <LensTag lens={lens} />
              </div>
              <div className="dating__method" style={{ marginTop: 6 }}>
                {METHOD_LABELS[d.method]}
                {d.label ? `: ${d.label}` : ''}
              </div>
              {d.note ? <p>{d.note}</p> : null}
              <ul className="dating__sources">
                {d.sources.map((s, j) => (
                  <li key={j}>{src(s)}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {e.debate ? (
        <section aria-labelledby="debate" style={{ maxWidth: 860 }}>
          <h2 id="debate">Where scholars disagree</h2>
          <p style={{ fontFamily: 'var(--font-read)', lineHeight: 1.65 }}>{e.debate}</p>
        </section>
      ) : null}

      {e.claims.length ? (
        <>
          <h2>Key claims</h2>
          <ul className="claims">
            {e.claims.map((c, i) => (
              <li key={i}>
                <p>{c.text}</p>
                <GradeBadge grade={c.grade} />
                <ul className="dating__sources">
                  {c.sources.map((s, j) => (
                    <li key={j}>{src(s)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {e.relations.length || inbound.length ? (
        <>
          <h2>Connections</h2>
          <ul className="relations">
            {e.relations.map((r) => {
              const t = g.entities.get(r.target)!;
              return (
                <li key={`o-${r.kind}-${r.target}`}>
                  <Link href={entityHref(r.target)}>
                    <span>{relationLabel(r.kind)}</span> {t.names.en}
                  </Link>
                </li>
              );
            })}
            {inbound.map((r) => {
              const t = g.entities.get(r.from)!;
              return (
                <li key={`i-${r.kind}-${r.from}`}>
                  <Link href={entityHref(r.from)}>
                    {t.names.en} <span>{relationLabel(r.kind)} this</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {articles.length ? (
        <>
          <h2>Articles</h2>
          <ul className="relations">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/${a.category}/${a.slug}`}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="review-note" style={{ marginTop: 32, maxWidth: 860 }}>
        Review status: {e.review.status === 'reviewed' ? `reviewed by ${e.review.reviewer} on ${e.review.lastReviewed}` : 'draft. Every DOI, ISBN, Wikidata and Commons identifier on this page has been machine-verified; editor review is pending'}.
        {e.wikidata ? (
          <>
            {' '}Wikidata: <a href={`https://www.wikidata.org/wiki/${e.wikidata}`}>{e.wikidata}</a>.
          </>
        ) : null}{' '}
        <a href={issueUrl(`Correction: ${e.names.en} (${e.id})`, `Entity: ${e.id}\n\nWhat is wrong:\n\nEvidence (with source):\n`)}>Report an error</a>
      </p>
    </div>
  );
}
