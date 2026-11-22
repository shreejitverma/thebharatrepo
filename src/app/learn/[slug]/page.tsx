import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EntityNames from '@/components/EntityNames';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import KaalchakraStrip from '@/components/KaalchakraStrip';
import SourceCitation from '@/components/SourceCitation';
import Quiz, { type QuizQuestionView } from '@/components/learn/Quiz';
import { PathProgress, StepCard } from '@/components/learn/Progress';
import { getGraph, getIndex, issueUrl } from '@/lib/content/site';
import { citationViews, pathPlacement, resolveSteps, summaryAtLevel, type ResolvedStep } from '@/lib/content/learning';
import { primaryDating } from '@/lib/content/lens';
import { toKcItem } from '@/lib/content/kaalchakra';
import { READING_LEVEL_AUDIENCE, READING_LEVEL_LABELS, citationId, isTraditional } from '@/lib/content/schema';
import { formatRange } from '@/lib/time';
import { yearToUnit } from '@/lib/time/scale';

export const dynamicParams = false;

export function generateStaticParams() {
  return getGraph().learningPaths.map((p) => ({ slug: p.slug }));
}

function find(slug: string) {
  return getGraph().learningPaths.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = find(slug);
  return p ? { title: p.title, description: p.summary, openGraph: { title: p.title, description: p.summary } } : {};
}

function StepBody({ s, level }: { s: ResolvedStep; level: 'adult' | 'teen' | 'kids' }) {
  const g = getGraph();
  if (s.kind === 'article') {
    const d = primaryDating(s.article.datings);
    return (
      <>
        <h3>{s.title}</h3>
        <p className="step__when">
          <span>Article: {s.article.title}</span>
          <span>{formatRange(d.range)}</span>
          <GradeBadge grade={d.grade} />
          <LensTag lens={isTraditional(d.method) ? 'tradition' : 'scholarship'} />
        </p>
        <p className="step__note">{s.step.note}</p>
        <p className="step__summary">{s.article.summary}</p>
        <p style={{ margin: '0 0 8px' }}>
          <Link href={s.href}>Read the article</Link>
        </p>
      </>
    );
  }
  const e = s.entity;
  const item = toKcItem(e);
  const d = primaryDating(e.datings);
  const claim = e.claims[0];
  const src = claim ? g.sources.get(citationId(claim.sources[0])) : undefined;
  const ref = claim?.sources[0];
  return (
    <>
      <h3>{s.title}</h3>
      {s.title !== e.names.en ? <p className="muted" style={{ margin: '0 0 4px' }}>{e.names.en}</p> : null}
      <EntityNames native={item.native} iast={item.iast} nativeLang={item.nativeLang} iastLang={item.iastLang} />
      <p className="step__when">
        <span>{formatRange(d.range)}</span>
        <GradeBadge grade={d.grade} />
        <LensTag lens={isTraditional(d.method) ? 'tradition' : 'scholarship'} />
      </p>
      <p className="step__note">{s.step.note}</p>
      <p className="step__summary">{summaryAtLevel(e, level)}</p>
      {claim ? (
        <div className="step__evidence">
          <p>
            <strong>How do we know?</strong> {claim.text}
          </p>
          <GradeBadge grade={claim.grade} />
          {src && ref ? (
            <p className="step__source">
              Source: <SourceCitation source={src} locator={typeof ref === 'string' ? undefined : ref.locator} />
            </p>
          ) : null}
        </div>
      ) : null}
      <p style={{ margin: '0 0 8px' }}>
        <Link href={s.href}>Open the full entry</Link>
      </p>
    </>
  );
}

export default async function LearningPathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = find(slug);
  if (!p) notFound();
  const g = getGraph();
  const steps = resolveSteps(g, p);
  const keys = p.steps.map((s) => (s.entity ?? s.article)!);
  const place = pathPlacement(g, p);
  const u = place ? yearToUnit(place.range.best ?? (place.range.earliest + place.range.latest) / 2) : 0;
  const quiz: QuizQuestionView[] = p.quiz.map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices.map((c) => ({ text: c.text, correct: c.correct, explanation: c.explanation })),
    sources: citationViews(g.sources, q.sources),
  }));

  return (
    <div className="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link>
      </nav>
      <p className="eyebrow">Learning path</p>
      <h1>{p.title}</h1>
      <div className="path-meta">
        <span className="level-badge">{READING_LEVEL_LABELS[p.level]} level</span>
        <span>{p.audience}</span>
        <span>
          {p.steps.length} steps{p.quiz.length ? `, ${p.quiz.length}-question quiz` : ''}
        </span>
      </div>
      <p className="lede" style={{ marginTop: 0 }}>
        {p.summary}
      </p>
      <div className="learn-actions">
        <Link className="btn" href={`/learn/${p.slug}/print`}>
          Printable pack
        </Link>
        {p.quiz.length ? (
          <a className="btn" href="#quiz">
            Go to the quiz
          </a>
        ) : null}
      </div>

      <h2>By the end you will be able to</h2>
      <ul className="goals">
        {p.goals.map((goal, i) => (
          <li key={i}>{goal}</li>
        ))}
      </ul>

      {place ? <KaalchakraStrip items={getIndex()} dating={place} selfId={null} focusHref={`/kaalchakra?view=river&win=${Math.max(0, u - 0.02).toFixed(5)},${Math.min(1, u + 0.02).toFixed(5)}`} /> : null}

      <h2>The steps</h2>
      <p className="section-note">Summaries on this path are written for {READING_LEVEL_AUDIENCE[p.level].toLowerCase()}. Tick each step when you have finished it.</p>
      <PathProgress pathId={p.id} steps={keys} />
      <ol className="steps">
        {steps.map((s, i) => (
          <StepCard key={keys[i]} pathId={p.id} step={keys[i]} title={s.title}>
            <StepBody s={s} level={p.level} />
          </StepCard>
        ))}
      </ol>

      {quiz.length ? (
        <section aria-labelledby="quiz">
          <h2 id="quiz">Quiz</h2>
          <p className="section-note">Every answer is explained, and every correct answer is backed by a cited source. Your answers stay on this device.</p>
          <Quiz questions={quiz} />
        </section>
      ) : null}

      <p className="review-note" style={{ marginTop: 32, maxWidth: 860 }}>
        Review status: {p.review.status === 'reviewed' ? `reviewed by ${p.review.reviewer} on ${p.review.lastReviewed}` : 'draft, awaiting editor review'}.{' '}
        <a href={issueUrl(`Correction: ${p.title} (${p.id})`, `Learning path: ${p.id}\n\nWhat is wrong:\n\nEvidence (with source):\n`)}>Report an error</a>
      </p>
    </div>
  );
}
