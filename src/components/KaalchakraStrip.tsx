import Link from 'next/link';
import type { KcItem } from '@/lib/content/kaalchakra';
import { neighbours } from '@/lib/content/kaalchakra';
import { formatRange, type YearRange } from '@/lib/time';
import { SEGMENTS, SEGMENT_STARTS, yearToUnit } from '@/lib/time/scale';

/**
 * Mini Kaalchakra: locates an entity or article on the full axis, with its neighbours in time.
 * Server component, no client JavaScript.
 */
export default function KaalchakraStrip({ items, range, selfId, focusHref }: { items: KcItem[]; range: YearRange; selfId: string | null; focusHref: string }) {
  const W = 1000;
  const u0 = yearToUnit(range.earliest);
  const u1 = yearToUnit(range.latest);
  const anchor = range.best ?? (range.earliest + range.latest) / 2;
  const { before, after } = neighbours(items, anchor, selfId, 3);
  return (
    <section className="kc-strip" aria-label="Place in the Kaalchakra">
      <div className="kc-strip__head">
        <strong>Place in the Kaalchakra</strong>
        <span className="muted">{formatRange(range)}</span>
        <Link href={focusHref}>Open in the Kaalchakra</Link>
      </div>
      <svg viewBox={`0 0 ${W} 46`} preserveAspectRatio="none" aria-hidden="true">
        {SEGMENTS.map((s, i) => {
          const x = SEGMENT_STARTS[i] * W;
          return <rect key={s.id} x={x} y={14} width={s.share * W} height={18} fill={i % 2 ? 'var(--wheel-seg-b)' : 'var(--wheel-seg-a)'} stroke="var(--line)" strokeWidth={0.5} />;
        })}
        {items.map((it) => {
          const a = it.anchor.scholarship ?? it.anchor.tradition;
          if (a === null) return null;
          return <rect key={it.id} x={yearToUnit(a) * W - 0.6} y={18} width={1.2} height={10} fill="var(--ink-faint)" opacity={0.45} />;
        })}
        <rect x={u0 * W} y={8} width={Math.max((u1 - u0) * W, 4)} height={30} rx={2} fill="var(--accent)" opacity={0.85} />
      </svg>
      {before.length || after.length ? (
        <div className="kc-strip__nb">
          <div>
            <span className="muted">Before</span>
            <ul>
              {before.map((b) => (
                <li key={b.id}>
                  <Link href={b.href}>{b.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="muted">After</span>
            <ul>
              {after.map((b) => (
                <li key={b.id}>
                  <Link href={b.href}>{b.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
