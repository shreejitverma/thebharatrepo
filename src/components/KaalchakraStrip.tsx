import Link from 'next/link';
import type { KcItem } from '@/lib/content/kaalchakra';
import { neighbours } from '@/lib/content/kaalchakra';
import { datingSummary } from '@/lib/content/lens';
import { isTraditional, type DatingMethod } from '@/lib/content/labels';
import type { YearRange } from '@/lib/time';
import { SEGMENTS, SEGMENT_STARTS, yearToUnit } from '@/lib/time/scale';

const W = 1000;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Every entry as one tick, drawn as a single path with at most one tick per pixel. */
function ticksPath(items: KcItem[]): string {
  const byPixel = new Map<number, string>();
  for (const it of items) {
    const a = it.anchor.scholarship ?? it.anchor.tradition;
    if (a === null) continue;
    const x = clamp(yearToUnit(a) * W, 0.6, W - 0.6);
    if (!byPixel.has(Math.round(x))) byPixel.set(Math.round(x), x.toFixed(1));
  }
  return [...byPixel.entries()]
    .sort((p, q) => p[0] - q[0])
    .map(([, x]) => `M${x} 18v10`)
    .join('');
}

/**
 * Mini Kaalchakra: locates an entity or article on the full axis, with its neighbours in time.
 * Server component, no client JavaScript.
 */
export default function KaalchakraStrip({ items, dating, selfId, focusHref }: { items: KcItem[]; dating: { range: YearRange; method: DatingMethod }; selfId: string | null; focusHref: string }) {
  const { range, method } = dating;
  const u0 = yearToUnit(range.earliest);
  const u1 = yearToUnit(range.latest);
  const markW = Math.min(Math.max((u1 - u0) * W, 4), W);
  const markX = clamp(u0 * W, 0, W - markW);
  const anchor = range.best ?? (range.earliest + range.latest) / 2;
  const { before, after } = neighbours(items, anchor, isTraditional(method) ? 'tradition' : 'scholarship', selfId, 3);
  return (
    <section className="kc-strip" aria-label="Place in the Kaalchakra">
      <div className="kc-strip__head">
        <strong>Place in the Kaalchakra</strong>
        <span className="muted">{datingSummary(range, method)}</span>
        <Link href={focusHref} prefetch={false}>
          Open in the Kaalchakra
        </Link>
      </div>
      <svg viewBox={`0 0 ${W} 46`} preserveAspectRatio="none" aria-hidden="true">
        {SEGMENTS.map((s, i) => {
          const x = SEGMENT_STARTS[i] * W;
          return <rect key={s.id} x={x} y={14} width={s.share * W} height={18} fill={i % 2 ? 'var(--wheel-seg-b)' : 'var(--wheel-seg-a)'} stroke="var(--line)" strokeWidth={0.5} />;
        })}
        <path d={ticksPath(items)} stroke="var(--ink-faint)" strokeWidth={1.2} opacity={0.45} fill="none" />
        <rect x={markX.toFixed(1)} y={8} width={markW.toFixed(1)} height={30} rx={2} fill="var(--accent)" opacity={0.85} />
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
