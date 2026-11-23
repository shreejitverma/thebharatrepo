import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SocialShare from '@/components/SocialShare';
import DatingList from '@/components/DatingList';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import ArticleReferences from '@/components/ArticleReferences';
import EvidenceSummary from '@/components/EvidenceSummary';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import { CATEGORY_META, getGraph, getIndex, issueUrl } from '@/lib/content/site';
import { renderArticle } from '@/lib/content/render';
import { articleGradeSummary, toCitationUse } from '@/lib/content/references';
import { entityHref } from '@/lib/content/kaalchakra';
import { isTraditional, reviewStatusText } from '@/lib/content/labels';
import { rankDatings, summarizeDatings } from '@/lib/content/lens';
import { yearToUnit } from '@/lib/time/scale';

export const dynamicParams = false;

export function generateStaticParams() {
  return getGraph().articles.map((a) => ({ category: a.category, slug: a.slug }));
}

function find(category: string, slug: string) {
  return getGraph().articles.find((a) => a.category === category && a.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params;
  const a = find(category, slug);
  return a ? { title: a.title, description: a.summary, openGraph: { title: a.title, description: a.summary, type: 'article' } } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const a = find(category, slug);
  if (!a) notFound();
  const g = getGraph();
  const ordered = rankDatings(a.datings, (d) => isTraditional(d.method));
  const primary = ordered[0];
  const { html, references } = await renderArticle(
    a.body,
    g.sources,
    a.datings.flatMap((d) => d.sources.map(toCitationUse)),
  );
  const summary = articleGradeSummary(a, g.entities);
  const u = yearToUnit(primary.range.best ?? (primary.range.earliest + primary.range.latest) / 2);
  const focus = `/kaalchakra?view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`;
  const linked = a.entities.map((id) => g.entities.get(id)).filter((e) => e !== undefined);
  const meta = CATEGORY_META[a.category];

  return (
    <div className="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${a.category}`}>{meta.title}</Link>
      </nav>
      <article className="article-layout" data-pagefind-body>
        <SearchIndexMeta
          title={a.title}
          kind="article"
          when={summarizeDatings(a.datings)}
          filters={{
            kind: ['article'],
            category: [a.category],
            grade: a.datings.map((d) => d.grade),
            lens: a.datings.map((d) => (isTraditional(d.method) ? 'tradition' : 'scholarship')),
          }}
        />
        <header className="article-header">
          <h1>{a.title}</h1>
          <p className="lede" style={{ margin: '0 0 16px' }}>{a.summary}</p>
          <EvidenceSummary summary={summary} references={references.length} datingsHref="#when" />
          <div data-pagefind-ignore>
            <KaalchakraStrip items={getIndex()} dating={primary} selfId={null} focusHref={focus} />
          </div>
          <section className="article-datings" aria-labelledby="when">
            <h2 id="when" data-pagefind-ignore>
              When, and how we know
            </h2>
            <DatingList datings={ordered} sources={g.sources} />
          </section>
        </header>
        <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
        {linked.length ? (
          <section className="prose-wrap" aria-labelledby="in-archive" data-pagefind-ignore>
            <h2 id="in-archive">In the archive</h2>
            <ul className="relations">
              {linked.map((e) => (
                <li key={e.id}>
                  <Link href={entityHref(e.id)}>
                    {e.names.en}
                    <span>{summarizeDatings(e.datings)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <ArticleReferences references={references} />
        <p className="review-note prose-wrap" data-pagefind-ignore>
          Review status: {reviewStatusText(a.review)}.
          {a.updated ? ` Last updated ${a.updated}.` : ''}{' '}
          <a href={issueUrl(`Correction: ${a.title}`, `Page: /${a.category}/${a.slug}\n\nWhat is wrong:\n\nEvidence (with source):\n`)}>Report an error</a>
        </p>
        <div data-pagefind-ignore>
          <SocialShare title={a.title} category={a.category} slug={a.slug} tags={a.tags} />
        </div>
      </article>
    </div>
  );
}
