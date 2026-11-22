import type { Metadata } from 'next';
import Link from 'next/link';
import { ProgressSummary } from '@/components/learn/Progress';
import { getGraph } from '@/lib/content/site';
import { learnHref, pathPlacement } from '@/lib/content/learning';
import { placementLabel } from '@/lib/content/debates';
import { READING_LEVEL_AUDIENCE, READING_LEVEL_LABELS } from '@/lib/content/labels';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Learning paths across the Kaalchakra for young readers, students, teachers and parents: story first, then the evidence, with quizzes and printable packs.',
};

export default function LearnPage() {
  const g = getGraph();
  const paths = g.learningPaths;
  return (
    <div className="main-content">
      <p className="eyebrow">Learn</p>
      <h1>Learning paths</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        Short journeys through the archive. Each step tells the story first, then shows how we know: the inscription, the coin, the text or the dig. Every path ends with a quiz that rewards reasoning
        about evidence, and every one can be printed as a pack for class or home.
      </p>
      <p className="section-note">No accounts and no tracking: your progress is saved only in this browser.</p>
      {paths.length === 0 ? (
        <p className="empty">0 learning paths yet.</p>
      ) : (
        <section aria-labelledby="paths">
          {/* Keeps the heading outline h1, h2, h3 for the cards' titles. */}
          <h2 id="paths" className="visually-hidden">
            All learning paths
          </h2>
          <div className="category-grid" style={{ marginTop: 16 }}>
            {paths.map((p) => {
              const r = pathPlacement(g, p);
              const steps = p.steps.map((s) => (s.entity ?? s.article)!);
              return (
                <Link key={p.id} href={learnHref(p)} className="card">
                  <p style={{ marginBottom: 8 }}>
                    <span className="level-badge">{READING_LEVEL_LABELS[p.level]}</span>
                  </p>
                  <h3>{p.title}</h3>
                  <p>{p.summary.length > 160 ? `${p.summary.slice(0, 157).replace(/\s+\S*$/, '')}...` : p.summary}</p>
                  <p className="card__meta">
                    {READING_LEVEL_AUDIENCE[p.level]}. <ProgressSummary pathId={p.id} steps={steps} />
                    {p.quiz.length ? `, ${p.quiz.length}-question quiz` : ''}
                    {r ? (
                      <>
                        . <span className="nowrap">{placementLabel(r)}</span>
                      </>
                    ) : null}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
