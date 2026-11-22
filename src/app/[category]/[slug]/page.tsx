import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SocialShare from '@/components/SocialShare';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import ArticleReferences from '@/components/ArticleReferences';
import EvidenceSummary from '@/components/EvidenceSummary';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import { CATEGORY_META, getGraph, getIndex, issueUrl } from '@/lib/content/site';
import { renderArticle } from '@/lib/content/render';
import { articleGradeSummary, toCitationUse } from '@/lib/content/references';
import { entityHref } from '@/lib/content/kaalchakra';
import { isTraditional } from '@/lib/content/labels';
import { formatRange } from '@/lib/time';
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
  const { html, references } = await renderArticle(
    a.body,
    g.sources,
    a.datings.flatMap((d) => d.sources.map(toCitationUse)),
  );
  const summary = articleGradeSummary(a, g.entities);
  const primary = a.datings[0];
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
          when={formatRange(primary.range)}
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
          <EvidenceSummary summary={summary} references={references.length} />
          <div data-pagefind-ignore>
            <KaalchakraStrip items={getIndex()} range={primary.range} selfId={null} focusHref={focus} />
          </div>
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
                    <span>{formatRange(e.datings[0].range)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <ArticleReferences references={references} />
        <p className="review-note prose-wrap" data-pagefind-ignore>
          Review status: {a.review.status === 'reviewed' ? `reviewed by ${a.review.reviewer} on ${a.review.lastReviewed}` : a.review.status === 'machine-checked' ? 'citations machine-checked, awaiting editor review' : 'draft, identifiers machine-verified, awaiting editor review'}.
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
