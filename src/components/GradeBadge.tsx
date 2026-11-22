import { GRADE_LABELS, type Grade } from '@/lib/content/labels';

/** Evidence grade badge. Shape and letter carry meaning as well as colour. */
export default function GradeBadge({ grade, showLabel = true }: { grade: Grade; showLabel?: boolean }) {
  return (
    <span className={`grade grade--${grade}`} title={`Grade ${grade}: ${GRADE_LABELS[grade]}`}>
      <span className="grade__letter" aria-hidden="true">
        {grade}
      </span>
      {showLabel ? <span className="grade__label">{GRADE_LABELS[grade]}</span> : <span className="visually-hidden">Grade {grade}: {GRADE_LABELS[grade]}</span>}
    </span>
  );
}

export function LensTag({ lens }: { lens: 'scholarship' | 'tradition' }) {
  return <span className={`lens-tag lens-tag--${lens}`}>{lens === 'tradition' ? 'Tradition' : 'Scholarship'}</span>;
}
