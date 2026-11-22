'use client';

import { KIND_LABELS } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import { segmentOf } from '@/lib/time/scale';
import GradeBadge from '@/components/GradeBadge';
import { formatDating, primaryAnchor, primaryDating } from './shared';

export default function ListView({
  items,
  lens,
  cal,
  selectedId,
  onSelect,
}: {
  items: KcItem[];
  lens: Lens;
  cal: CalendarSystem;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return <p className="empty">0 entries match these filters.</p>;
  const groups: { label: string; items: KcItem[] }[] = [];
  for (const it of items) {
    const seg = segmentOf(primaryAnchor(it, lens)!);
    const last = groups[groups.length - 1];
    if (last && last.label === seg.label) last.items.push(it);
    else groups.push({ label: seg.label, items: [it] });
  }
  return (
    <div className="kc-list">
      {groups.map((g, gi) => (
        <section key={`${g.label}-${gi}`} aria-label={g.label}>
          <h3>
            {g.label} <span className="muted">({g.items.length})</span>
          </h3>
          <ol>
            {g.items.map((it) => {
              const d = primaryDating(it, lens);
              return (
                <li key={it.id}>
                  <button type="button" onClick={() => onSelect(it.id)} aria-current={it.id === selectedId}>
                    <span className="kc-list__date">{d ? formatDating(d, cal) : ''}</span>
                    <span>
                      {it.name}
                      <br />
                      <span className="kc-list__kind">{KIND_LABELS[it.kind]}</span>
                    </span>
                    {d ? <GradeBadge grade={d.grade} showLabel={false} /> : <span />}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
