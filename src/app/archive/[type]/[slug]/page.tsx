import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { preconnect } from 'react-dom';
import EntityNames from '@/components/EntityNames';
import GradeBadge from '@/components/GradeBadge';
import DatingList from '@/components/DatingList';
import LeveledText from '@/components/LeveledText';
import ReadingLevelSwitcher from '@/components/ReadingLevel';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import RelationGraph from '@/components/RelationGraph';
import SourceCitation from '@/components/SourceCitation';
import { getGraph, getIndex, issueUrl, SITE_URL } from '@/lib/content/site';
import { entityHref, primaryAnchor, toKcItem } from '@/lib/content/kaalchakra';
import { debateHref, debatesForEntity } from '@/lib/content/debates';
import { learnHref, pathsForEntity } from '@/lib/content/learning';
import { rankDatings, summarizeDatings } from '@/lib/content/lens';
import { relationGroups } from '@/lib/content/relations';
import { KIND_LABELS, READING_LEVEL_LABELS, isTraditional, citationId, reviewStatusText, type ReadingLevel } from '@/lib/content/schema';
import { verifiedImage } from '@/lib/content/verification';
import { formatYear } from '@/lib/time';
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
  const ordered = rankDatings(e.datings, (d) => isTraditional(d.method));
  const primary = ordered[0];
  const anchor = primary.range.best ?? (primary.range.earliest + primary.range.latest) / 2;
  const u = yearToUnit(anchor);
  const focus = `/kaalchakra?id=${encodeURIComponent(e.id)}`;
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
    return { name: other.names.en, href: entityHref(id), kind: other.kind, when: summarizeDatings(other.datings) };
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
  const item = toKcItem(e);
  const levels: ReadingLevel[] = ['adult', ...(e.summaries?.teen ? (['teen'] as const) : []), ...(e.summaries?.kids ? (['kids'] as const) : [])];
  const debates = debatesForEntity(g, e.id);
  const paths = pathsForEntity(g, e.id);
  const src = (ref: Parameters<typeof citationId>[0]) => {
    const s = g.sources.get(citationId(ref));
    return s ? <SourceCitation source={s} locator={typeof ref === 'string' ? undefined : ref.locator} record /> : citationId(ref);
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
    <div className="main-content" data-pagefind-body>
      <SearchIndexMeta
        title={e.names.en}
        kind={e.kind}
        when={summarizeDatings(e.datings)}
        filters={{
          kind: [e.kind],
          grade: [...e.datings.map((d) => d.grade), ...e.claims.map((c) => c.grade)],
          lens: e.datings.map((d) => (isTraditional(d.method) ? 'tradition' : 'scholarship')),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb" data-pagefind-ignore>
        <Link href="/archive" prefetch={false}>Archive</Link> / <Link href={`/archive#${e.kind}`} prefetch={false}>{KIND_LABELS[e.kind]}</Link>
      </nav>
      <div className="entity-head">
        <div>
          <h1>{e.names.en}</h1>
          <EntityNames native={item.native} iast={item.iast} nativeLang={item.nativeLang} iastLang={item.iastLang} />
          {levels.length > 1 ? <ReadingLevelSwitcher available={levels} /> : null}
          <LeveledText className="lede entity-lede" adult={e.summary} teen={e.summaries?.teen} kids={e.summaries?.kids} tagged />
          {e.region ? <p className="muted">Region: {e.region}</p> : null}
          {e.location ? (
            <p className="muted">
              Place: {e.location.name} ({coordinate(e.location.lat, 'N', 'S')}, {coordinate(e.location.lon, 'E', 'W')}).{' '}
              <Link href={`${focus}&view=map`} prefetch={false}>Show on the map</Link>
            </p>
          ) : null}
        </div>
        {img && e.image ? (
          <figure data-pagefind-ignore>
            {/* Anonymous CORS keeps Wikimedia from reading or setting third-party cookies. Lazy, because React turns an eager image
                into a preload hint in this page's RSC payload, and every prefetched link to this entity would then download it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.thumb} alt={e.image.alt} width={img.width} height={img.height} loading="lazy" decoding="async" crossOrigin="anonymous" />
            <figcaption>
              <a href={img.pageUrl} rel="noopener noreferrer" target="_blank">Wikimedia Commons</a>, {img.license}
              {img.artist ? `, ${img.artist}` : ''}
            </figcaption>
          </figure>
        ) : null}
      </div>

      <div data-pagefind-ignore>
        <KaalchakraStrip items={getIndex()} dating={primary} selfId={e.id} focusHref={`${focus}&view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`} />
      </div>

      <h2 data-pagefind-ignore>When, and how we know</h2>
      <DatingList datings={ordered} sources={g.sources} />

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
                <ul className="dating__sources" data-pagefind-ignore>
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

      {debates.length ? (
        <div data-pagefind-ignore>
          <h2>Debates</h2>
          <ul className="relations">
            {debates.map((d) => (
              <li key={d.id}>
                <Link href={debateHref(d)}>
                  {d.title} <span>{d.published ? `${d.positions.length} positions` : `${d.positions.length} positions, unpublished draft`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {paths.length ? (
        <>
          <h2>Learning paths</h2>
          <ul className="relations">
            {paths.map((lp) => (
              <li key={lp.id}>
                <Link href={learnHref(lp)}>
                  {lp.title} <span>{READING_LEVEL_LABELS[lp.level]} level</span>
                </Link>
              </li>
            ))}
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

      <section aria-labelledby="sources" data-pagefind-ignore>
        <h2 id="sources">Sources</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {cited.size} {cited.size === 1 ? 'work is' : 'works are'} cited on this page. Each is listed above beside the dating or claim it supports.
        </p>
        <ul className="biblio entity-sources">
          {[...cited.values()].map((source) => (
            <li key={source.id}>
              <SourceCitation source={source} record />
              <div className="muted">{source.type.replace(/-/g, ' ')}</div>
            </li>
          ))}
        </ul>
      </section>

      <p className="review-note" style={{ marginTop: 32, maxWidth: 860 }} data-pagefind-ignore>
        Review status: {reviewStatusText(e.review)}.
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
