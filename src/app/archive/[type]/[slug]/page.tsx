import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { preconnect } from 'react-dom';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import RelationGraph from '@/components/RelationGraph';
import SourceCitation from '@/components/SourceCitation';
import { getGraph, getIndex, issueUrl, SITE_URL } from '@/lib/content/site';
import { entityHref, primaryAnchor } from '@/lib/content/kaalchakra';
import { relationGroups } from '@/lib/content/relations';
import { KIND_LABELS, METHOD_LABELS, isTraditional, citationId } from '@/lib/content/schema';
import { verifiedImage } from '@/lib/content/verification';
import { formatRange, formatYear } from '@/lib/time';
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

function coordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}\u00b0${value < 0 ? negative : positive}`;
}

export default async function EntityPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const e = find(type, slug);
  if (!e) notFound();
  const g = getGraph();
  const img = e.image ? verifiedImage(e.image.commons) : null;
  if (img) preconnect(new URL(img.thumb).origin);
  const ordered = [...e.datings].sort((a, b) => Number(isTraditional(a.method)) - Number(isTraditional(b.method)));
  const primary = ordered[0];
  const anchor = primary.range.best ?? (primary.range.earliest + primary.range.latest) / 2;
  const u = yearToUnit(anchor);
  const focus = `/kaalchakra?id=${encodeURIComponent(e.id)}`;
  const lens = isTraditional(primary.method) ? 'tradition' : 'scholarship';
  const index = new Map(getIndex().map((i) => [i.id, i]));
  // Entities inside a relation group run in time order, so successions read left to right.
  const when = (id: string) => {
    const item = index.get(id);
    return item ? (primaryAnchor(item, 'both') ?? 0) : 0;
  };
  const groups = relationGroups(g.entities, g.inbound, e.id, (a, b) => when(a) - when(b) || a.localeCompare(b));
  const relationNode = (id: string) => {
    const other = g.entities.get(id);
    if (!other) return undefined;
    const first = [...other.datings].sort((a, b) => Number(isTraditional(a.method)) - Number(isTraditional(b.method)))[0];
    return { name: other.names.en, href: entityHref(id), kind: other.kind, when: formatRange(first.range) };
  };
  // Every source cited anywhere on this page, once each, in order of first use.
  const cited = new Map<string, NonNullable<ReturnType<typeof g.sources.get>>>();
  for (const block of [...ordered, ...e.claims, ...(e.extents ?? [])]) {
    for (const ref of block.sources) {
      const source = g.sources.get(citationId(ref));
      if (source) cited.set(source.id, source);
    }
  }
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
          {e.location ? (
            <p className="muted">
              Place: {e.location.name} ({coordinate(e.location.lat, 'N', 'S')}, {coordinate(e.location.lon, 'E', 'W')}).{' '}
              <Link href={`${focus}&view=map`}>Show on the map</Link>
            </p>
          ) : null}
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

      <KaalchakraStrip items={getIndex()} range={primary.range} selfId={e.id} lens={lens} focusHref={`${focus}&view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`} />

      <h2>When, and how we know</h2>
      <div className="datings">
        {ordered.map((d, i) => {
          const datingLens = isTraditional(d.method) ? 'tradition' : 'scholarship';
          return (
            <div key={i} className={`dating dating--${datingLens}`}>
              <div className="dating__top">
                <span className="dating__range">{formatRange(d.range)}</span>
                <GradeBadge grade={d.grade} />
                <LensTag lens={datingLens} />
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

      {e.extents?.length ? (
        <section aria-labelledby="extent">
          <h2 id="extent">Extent on the map</h2>
          <ul className="claims">
            {e.extents.map((x, i) => (
              <li key={i}>
                <p>
                  {x.label ?? 'Approximate extent'}
                  {x.from !== undefined && x.to !== undefined ? ` (${formatYear(x.from)} to ${formatYear(x.to)})` : ''}
                  {x.note ? `. ${x.note}` : ''}
                </p>
                <GradeBadge grade={x.grade} />
                <ul className="dating__sources">
                  {x.sources.map((s, j) => (
                    <li key={j}>{src(s)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RelationGraph name={e.names.en} groups={groups} node={relationNode} />

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

      <section aria-labelledby="sources">
        <h2 id="sources">Sources</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {cited.size} {cited.size === 1 ? 'work is' : 'works are'} cited on this page. Each is listed above beside the dating or claim it supports.
        </p>
        <ul className="biblio entity-sources">
          {[...cited.values()].map((source) => (
            <li key={source.id}>
              <SourceCitation source={source} />
              <div className="muted">{source.type.replace(/-/g, ' ')}</div>
            </li>
          ))}
        </ul>
      </section>

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
