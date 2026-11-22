import Link from 'next/link';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import { GRADES, GRADE_LABELS, METHOD_LABELS, isTraditional } from '@/lib/content/labels';
import { formatRange } from '@/lib/time';
import type { GradeSummary } from '@/lib/content/references';

/** Evidence-grade summary at the top of an article: its own dating, then the grades of the records it covers. */
export default function EvidenceSummary({ summary, references }: { summary: GradeSummary; references: number }) {
  const present = GRADES.filter((g) => summary.counts[g] > 0);
  return (
    <aside className="evidence-summary" aria-labelledby="evidence-summary-title" data-pagefind-ignore>
      <h2 id="evidence-summary-title" className="evidence-summary__title">
        Evidence at a glance
      </h2>
      <ul className="evidence-summary__datings">
        {summary.datings.map((d, i) => (
          <li key={i}>
            <span className="evidence-summary__range">{formatRange(d.range)}</span>
            <span className="evidence-summary__how">
              <span>
                <span className="muted">{i === 0 ? 'Dated by' : 'Also dated by'}</span> {METHOD_LABELS[d.method]}
              </span>
              <GradeBadge grade={d.grade} />
              <LensTag lens={isTraditional(d.method) ? 'tradition' : 'scholarship'} />
            </span>
          </li>
        ))}
      </ul>
      {summary.total > 0 ? (
        <>
          <p className="evidence-summary__lead">
            {summary.total} graded {summary.total === 1 ? 'dating or claim' : 'datings and claims'} across the {summary.records} archive {summary.records === 1 ? 'record' : 'records'} this article covers:
          </p>
          <div className="grade-bar" aria-hidden="true">
            {present.map((g) => (
              <span key={g} className={`grade-bar__seg grade-bar__seg--${g}`} style={{ flexGrow: summary.counts[g] }} />
            ))}
          </div>
          <ul className="grade-counts">
            {present.map((g) => (
              <li key={g}>
                <strong className="grade-counts__n">{summary.counts[g]}</strong>
                <GradeBadge grade={g} showLabel={false} />
                <span className="grade-counts__label">{GRADE_LABELS[g]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="evidence-summary__lead muted">No archive records are linked to this article yet, so only its own dating is graded here. Each reference below links to the source and everything else that cites it.</p>
      )}
      <p className="evidence-summary__links">
        <a href="#refs">
          {references} {references === 1 ? 'reference' : 'references'}
        </a>
        <Link href="/methodology#grades">How evidence grades work</Link>
      </p>
    </aside>
  );
}
