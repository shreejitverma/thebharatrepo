import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EntityNames from '@/components/EntityNames';
import GradeBadge from '@/components/GradeBadge';
import SourceCitation from '@/components/SourceCitation';
import { PrintButton } from '@/components/learn/Progress';
import { SITE_URL, getGraph } from '@/lib/content/site';
import { learnHref, resolveSteps, summaryAtLevel } from '@/lib/content/learning';
import { toKcItem } from '@/lib/content/kaalchakra';
import { READING_LEVEL_AUDIENCE, READING_LEVEL_LABELS, citationId, isTraditional, type CitationRef } from '@/lib/content/schema';
import { formatRange } from '@/lib/time';

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
  return p ? { title: `${p.title} (printable pack)`, description: p.summary, robots: { index: false, follow: true } } : {};
}

const LETTERS = 'ABCDE';

export default async function PrintPackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = find(slug);
  if (!p) notFound();
  const g = getGraph();
  const steps = resolveSteps(g, p);

  // Every source the pack cites, in first-use order, for the reference list. Locators belong to each
  // citation, so the list itself carries none.
  const cited = new Set<string>();
  const note = (ref: CitationRef) => cited.add(citationId(ref));
  for (const s of steps) if (s.kind === 'entity' && s.entity.claims[0]) note(s.entity.claims[0].sources[0]);
  for (const q of p.quiz) q.sources.forEach(note);
  const cite = (ref: CitationRef) => {
    const src = g.sources.get(citationId(ref));
    return src ? <SourceCitation source={src} locator={typeof ref === 'string' ? undefined : ref.locator} /> : citationId(ref);
  };

  return (
    <div className="main-content print-pack">
      <div className="print-toolbar no-print">
        <PrintButton />
        <Link href={learnHref(p)}>Back to the path</Link>
        <span className="muted" style={{ fontSize: '0.9rem' }}>
          The answer key prints on its own page.
        </span>
      </div>

      <p className="eyebrow">The Bharat Repo, learning pack</p>
      <h1>{p.title}</h1>
      <p className="path-meta">
        <span className="level-badge">{READING_LEVEL_LABELS[p.level]} level</span>
        <span>{p.audience}</span>
      </p>
      <p className="lede" style={{ marginTop: 0 }}>
        {p.summary}
      </p>
      <h2>Learning goals</h2>
      <ul className="goals">
        {p.goals.map((goal, i) => (
          <li key={i}>{goal}</li>
        ))}
      </ul>

      <h2>The steps</h2>
      {steps.map((s, i) => {
        if (s.kind === 'article') {
          return (
            <section key={i} className="print-card">
              <h3>
                {i + 1}. {s.title}
              </h3>
              <p className="muted">Article: {s.article.title}. {formatRange(s.article.datings[0].range)}</p>
              <p>
                <strong>{s.step.note}</strong>
              </p>
              <p>{s.article.summary}</p>
              <p className="muted">
                {SITE_URL}
                {s.href}
              </p>
            </section>
          );
        }
        const e = s.entity;
        const item = toKcItem(e);
        const d = [...e.datings].sort((a, b) => Number(isTraditional(a.method)) - Number(isTraditional(b.method)))[0];
        const claim = e.claims[0];
        return (
          <section key={i} className="print-card">
            <h3>
              {i + 1}. {s.title}
            </h3>
            {s.title !== e.names.en ? <p className="muted">{e.names.en}</p> : null}
            <EntityNames native={item.native} iast={item.iast} nativeLang={item.nativeLang} iastLang={item.iastLang} />
            <p>
              {formatRange(d.range)} <GradeBadge grade={d.grade} />
            </p>
            <p>
              <strong>{s.step.note}</strong>
            </p>
            <p>{summaryAtLevel(e, p.level)}</p>
            {claim ? (
              <p>
                <strong>How do we know?</strong> {claim.text} <GradeBadge grade={claim.grade} showLabel={false} />
              </p>
            ) : null}
          </section>
        );
      })}

      {p.quiz.length ? (
        <>
          <h2>Quiz</h2>
          <p>Choose one answer for each question. Then check your answers with the key on the last page.</p>
          <ol className="print-quiz">
            {p.quiz.map((q) => (
              <li key={q.id}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{q.question}</p>
                <ol>
                  {q.choices.map((c, j) => (
                    <li key={j}>{c.text}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>

          <section className="print-break" aria-labelledby="answer-key">
            <h2 id="answer-key">Answer key</h2>
            <ol className="answer-key">
              {p.quiz.map((q) => {
                const j = q.choices.findIndex((c) => c.correct);
                return (
                  <li key={q.id}>
                    <p>
                      <strong>
                        {LETTERS[j]}. {q.choices[j].text}
                      </strong>
                    </p>
                    <p>{q.choices[j].explanation}</p>
                    <p className="muted">
                      Source:{' '}
                      {q.sources.map((ref, k) => (
                        <span key={k}>
                          {k ? '; ' : ''}
                          {cite(ref)}
                        </span>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : null}

      <section aria-labelledby="pack-sources">
        <h2 id="pack-sources">Sources</h2>
        <ol className="references">
          {[...cited].map((id) => {
            const src = g.sources.get(id);
            return <li key={id}>{src ? <SourceCitation source={src} /> : id}</li>;
          })}
        </ol>
      </section>

      <p className="review-note" style={{ marginTop: 24 }}>
        {READING_LEVEL_AUDIENCE[p.level]}. From {SITE_URL}
        {learnHref(p)}. Content licensed CC BY-SA 4.0. Review status: {p.review.status === 'reviewed' ? `reviewed by ${p.review.reviewer} on ${p.review.lastReviewed}` : 'draft, awaiting editor review'}.
      </p>
    </div>
  );
}
