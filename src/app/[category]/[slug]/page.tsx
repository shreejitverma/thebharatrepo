import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SocialShare from '@/components/SocialShare';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import DatingList from '@/components/DatingList';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import SourceCitation from '@/components/SourceCitation';
import { CATEGORY_META, getGraph, getIndex, issueUrl } from '@/lib/content/site';
import { renderArticle } from '@/lib/content/render';
import { entityHref } from '@/lib/content/kaalchakra';
import { METHOD_LABELS, isTraditional } from '@/lib/content/labels';
import { formatRange } from '@/lib/time';
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
  const { html, references } = await renderArticle(a.body, g.sources);
  const ordered = rankDatings(a.datings, (d) => isTraditional(d.method));
  const primary = ordered[0];
  const u = yearToUnit(primary.range.best ?? (primary.range.earliest + primary.range.latest) / 2);
  const focus = `/kaalchakra?view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`;
  const linked = a.entities.map((id) => g.entities.get(id)).filter((e) => e !== undefined);
  const meta = CATEGORY_META[a.category];

  return (
    <div className="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${a.category}`}>{meta.title}</Link>
      </nav>
      <article className="article-layout">
        <header className="article-header">
          <h1>{a.title}</h1>
          <p className="lede" style={{ margin: 0 }}>{a.summary}</p>
          <div className="article-meta">
            <span>{formatRange(primary.range)}</span>
            <GradeBadge grade={primary.grade} />
            <LensTag lens={isTraditional(primary.method) ? 'tradition' : 'scholarship'} />
            <span>{METHOD_LABELS[primary.method]}</span>
            <span>{references.length} sources cited</span>
          </div>
          <KaalchakraStrip items={getIndex()} range={primary.range} selfId={null} focusHref={focus} />
          <section className="article-datings" aria-labelledby="when">
            <h2 id="when">When, and how we know</h2>
            <DatingList datings={ordered} sources={g.sources} />
          </section>
        </header>
        <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
        {linked.length ? (
          <section className="prose-wrap" aria-labelledby="in-archive">
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
        <section className="references" aria-labelledby="refs">
          <h2 id="refs">References</h2>
          <ol>
            {references.map((r) => (
              <li key={r.n} id={`ref-${r.n}`}>
                <SourceCitation source={r.source} />
                {r.locators.length ? <span className="muted"> Cited at: {r.locators.join('; ')}.</span> : null}
              </li>
            ))}
          </ol>
        </section>
        <p className="review-note prose-wrap">
          Review status: {a.review.status === 'reviewed' ? `reviewed by ${a.review.reviewer} on ${a.review.lastReviewed}` : a.review.status === 'machine-checked' ? 'citations machine-checked, awaiting editor review' : 'draft, identifiers machine-verified, awaiting editor review'}.
          {a.updated ? ` Last updated ${a.updated}.` : ''}{' '}
          <a href={issueUrl(`Correction: ${a.title}`, `Page: /${a.category}/${a.slug}\n\nWhat is wrong:\n\nEvidence (with source):\n`)}>Report an error</a>
        </p>
        <SocialShare title={a.title} category={a.category} slug={a.slug} tags={a.tags} />
      </article>
    </div>
  );
}
