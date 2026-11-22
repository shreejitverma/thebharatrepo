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
const GROUPS = [
  { key: 'before', label: 'Before' },
  { key: 'during', label: 'During' },
  { key: 'after', label: 'After' },
] as const;

/**
 * `dating` is the page's primary dating (lens.ts primaryDating). Neighbours are drawn from the same lens as that
 * dating, so a page placed by traditional reckoning is compared only with other traditional datings.
 */
export default function KaalchakraStrip({ items, dating, selfId, focusHref }: { items: KcItem[]; dating: { range: YearRange; method: DatingMethod }; selfId: string | null; focusHref: string }) {
  const { range, method } = dating;
  const lens = isTraditional(method) ? 'tradition' : 'scholarship';
  const u0 = yearToUnit(range.earliest);
  const u1 = yearToUnit(range.latest);
  const markW = Math.min(Math.max((u1 - u0) * W, 4), W);
  const markX = clamp(u0 * W, 0, W - markW);
  const nb = neighbours(items, range, selfId, lens, 3);
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
          return <rect key={s.id} x={x} y={14} width={s.share * W} height={18} fill={`var(--era-${i + 1})`} stroke="var(--line)" strokeWidth={0.5} />;
        })}
        <path d={ticksPath(items)} stroke="var(--ink-faint)" strokeWidth={1.2} opacity={0.45} fill="none" />
        <rect x={markX.toFixed(1)} y={8} width={markW.toFixed(1)} height={30} rx={2} fill="var(--accent)" opacity={0.85} />
      </svg>
      <div className="kc-strip__nb">
        {GROUPS.map((g) => (
          <div key={g.key} data-neighbours={g.key}>
            <span className="muted">{g.label}</span>
            {nb[g.key].length ? (
              <ul>
                {nb[g.key].map((b) => (
                  <li key={b.id}>
                    <Link href={b.href}>{b.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="kc-strip__none">No entries {g.key === 'during' ? 'overlap this range' : `${g.key} this`}{lens === 'tradition' ? ' in traditional reckoning' : ''}.</p>
            )}
          </div>
        ))}
      </div>
      {lens === 'tradition' ? <p className="kc-strip__lens">Placed by traditional reckoning; the neighbours shown are other traditional datings.</p> : null}
    </section>
  );
}
