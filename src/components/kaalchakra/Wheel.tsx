'use client';

import { memo, useMemo } from 'react';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import { PRESENT_YEAR, formatYear } from '@/lib/time';
import { SEGMENT_STARTS } from '@/lib/time/scale';
import { BOUNDARY_LABELS, SEGMENTS, SHORT_SEGMENT_LABELS, hash, kindColor, visibleDatings, wrapText, yearToUnit, primaryAnchor, formatDating } from './shared';

const VB = 1000;
const C = VB / 2;
const R_INNER = 150;
const R_OUTER = 430;
/** Fraction of the circle left open at the top, where the end of time meets its beginning. */
const GAP = 0.035;

function angleOf(u: number): number {
  const start = -Math.PI / 2 + GAP * Math.PI;
  return start + u * (2 * Math.PI * (1 - GAP));
}

function polar(r: number, a: number): [number, number] {
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function sectorPath(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

export interface WheelProps {
  items: KcItem[];
  kinds: readonly Kind[];
  lens: Lens;
  selectedId: string | null;
  cal: Parameters<typeof formatDating>[1];
  interactive?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null, clientX: number, clientY: number) => void;
  onSegment?: (segmentId: string) => void;
  title?: string;
}

function WheelImpl({ items, kinds, lens, selectedId, cal, interactive = true, onSelect, onHover, onSegment, title }: WheelProps) {
  const ringW = (R_OUTER - R_INNER) / Math.max(kinds.length, 1);
  const ringIndex = useMemo(() => new Map(kinds.map((k, i) => [k, i])), [kinds]);

  const segments = useMemo(() => SEGMENTS.map((seg, i) => ({ seg, i, a0: angleOf(SEGMENT_STARTS[i]), a1: angleOf(SEGMENT_STARTS[i] + seg.share) })), []);

  const marks = useMemo(() => {
    const out: { item: KcItem; els: React.ReactNode[]; key: string }[] = [];
    for (const item of items) {
      const ri = ringIndex.get(item.kind);
      if (ri === undefined) continue;
      const lane = (hash(item.id) % 3) - 1;
      const r = R_INNER + (ri + 0.5) * ringW + lane * ringW * 0.27;
      const ds = visibleDatings(item, lens);
      if (ds.length === 0) continue;
      const color = kindColor(item.kind);
      const els: React.ReactNode[] = [];
      const anchors: number[] = [];
      ds.forEach((d, k) => {
        const a0 = angleOf(yearToUnit(d.earliest));
        const a1 = angleOf(yearToUnit(d.latest));
        const trad = d.lens === 'tradition';
        anchors.push(angleOf(yearToUnit(d.best ?? (d.earliest + d.latest) / 2)));
        if ((a1 - a0) * r < 7) {
          const [x, y] = polar(r, (a0 + a1) / 2);
          els.push(
            <circle
              key={k}
              cx={x}
              cy={y}
              r={trad ? 4.6 : 5.2}
              fill={trad ? 'var(--bg-elev)' : color}
              stroke={trad ? 'var(--gold)' : 'var(--bg-elev)'}
              strokeWidth={trad ? 2.4 : 1.2}
            />,
          );
        } else {
          els.push(
            <path
              key={k}
              d={arcPath(r, a0, a1)}
              fill="none"
              stroke={trad ? 'var(--gold)' : color}
              strokeWidth={trad ? 4 : 7}
              strokeLinecap="round"
              strokeDasharray={trad ? '2 5' : undefined}
              opacity={trad ? 0.95 : 0.85}
            />,
          );
        }
      });
      if (lens === 'both' && item.anchor.scholarship !== null && item.anchor.tradition !== null && anchors.length > 1) {
        const lo = Math.min(...anchors);
        const hi = Math.max(...anchors);
        if ((hi - lo) * r > 10) {
          els.unshift(<path key="bridge" d={arcPath(r - ringW * 0.42, lo, hi)} fill="none" stroke="var(--gold)" strokeWidth={1} strokeDasharray="1 4" opacity={0.7} />);
        }
      }
      // Generous invisible hit target at the primary anchor for touch.
      const anchor = primaryAnchor(item, lens);
      if (anchor !== null) {
        const [hx, hy] = polar(r, angleOf(yearToUnit(anchor)));
        els.push(<circle key="hit" cx={hx} cy={hy} r={11} fill="transparent" />);
      }
      out.push({ item, els, key: item.id });
    }
    return out;
  }, [items, ringIndex, ringW, lens]);

  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  const selAnchor = selected ? primaryAnchor(selected, lens) : null;
  const selRing = selected ? ringIndex.get(selected.kind) : undefined;
  const todayA = angleOf(yearToUnit(PRESENT_YEAR));
  const startA = angleOf(0);

  const coreLines = selected ? wrapText(selected.name, 17, 3) : ['Kaalchakra'];
  const coreSub = selected
    ? (visibleDatings(selected, lens)[0] ? formatDating(visibleDatings(selected, lens)[0], cal) : '')
    : `${items.length} moments`;

  return (
    <svg
      className="kc-wheel"
      viewBox={`0 0 ${VB} ${VB}`}
      role="img"
      aria-label={title ?? `Kaalchakra wheel showing ${items.length} entries from the start of the kalpa to the present`}
    >
      <defs>
        <radialGradient id="kc-core" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--wheel-core)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--wheel-core)" />
        </radialGradient>
      </defs>

      {segments.map(({ seg, a0, a1, i }) => (
        <path
          key={seg.id}
          d={sectorPath(R_INNER, R_OUTER, a0, a1)}
          fill={i % 2 === 0 ? 'var(--wheel-seg-a)' : 'var(--wheel-seg-b)'}
          stroke="var(--line)"
          strokeWidth={1}
          onClick={interactive && onSegment ? () => onSegment(seg.id) : undefined}
          style={interactive && onSegment ? { cursor: 'zoom-in' } : undefined}
        >
          <title>{`${seg.label}: ${formatYear(seg.from, seg.interp === 'log' ? 'Ma' : 'year')} to ${formatYear(seg.to)}${seg.interp === 'log' ? ' (logarithmic scale)' : ' (linear scale)'}`}</title>
        </path>
      ))}

      {kinds.map((k, i) => (
        <circle key={k} cx={C} cy={C} r={R_INNER + i * ringW} fill="none" stroke="var(--line)" strokeWidth={0.6} opacity={0.7} />
      ))}

      {/* Scale breaks with their years */}
      {segments.map(({ seg, a0 }, i) => {
        if (i === 0) return null;
        const [x0, y0] = polar(R_INNER - 4, a0);
        const [x1, y1] = polar(R_OUTER + 12, a0);
        const [tx, ty] = polar(R_OUTER + 30, a0);
        return (
          <g key={`b-${seg.id}`} className="kc-wheel__break">
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--line-strong)" strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={tx} y={ty} fontSize={17} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-faint)" className="kc-wheel__label">
              {BOUNDARY_LABELS[seg.id]}
            </text>
          </g>
        );
      })}

      {/* Era names on the outer rim */}
      {segments.map(({ seg, a0, a1 }) => {
        const mid = (a0 + a1) / 2;
        const [x, y] = polar(R_OUTER + 58, mid);
        let deg = (mid * 180) / Math.PI + 90;
        if (deg > 90 && deg < 270) deg += 180;
        return (
          <text
            key={`l-${seg.id}`}
            x={x}
            y={y}
            fontSize={18}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--ink-soft)"
            transform={`rotate(${deg} ${x} ${y})`}
            className="kc-wheel__label"
          >
            {SHORT_SEGMENT_LABELS[seg.id]}
          </text>
        );
      })}

      {/* Today and the start of the present kalpa (traditional), labelled along their own radial lines inside the gap */}
      <line {...lineProps(R_INNER - 6, R_OUTER + 10, todayA)} stroke="var(--accent)" strokeWidth={2.5} />
      <RadialLabel a={todayA} side={1} text="Today" color="var(--accent)" />
      <line {...lineProps(R_INNER - 6, R_OUTER + 10, startA)} stroke="var(--gold)" strokeWidth={2} strokeDasharray="3 3" />
      <RadialLabel a={startA} side={-1} text="Kalpa begins" color="var(--gold)" />

      {selected && selAnchor !== null && selRing !== undefined ? (
        <line {...lineProps(R_INNER - 10, R_OUTER, angleOf(yearToUnit(selAnchor)))} stroke="var(--ink)" strokeWidth={1.2} opacity={0.6} />
      ) : null}

      <g>
        {marks.map(({ item, els, key }) => (
          <g
            key={key}
            className="kc-mark"
            data-active={item.id === selectedId}
            onClick={interactive && onSelect ? () => onSelect(item.id) : undefined}
            onPointerEnter={interactive && onHover ? (e) => onHover(item.id, e.clientX, e.clientY) : undefined}
            onPointerLeave={interactive && onHover ? (e) => onHover(null, e.clientX, e.clientY) : undefined}
          >
            {els}
          </g>
        ))}
      </g>

      <circle cx={C} cy={C} r={R_INNER - 14} fill="url(#kc-core)" />
      <circle cx={C} cy={C} r={R_INNER - 24} fill="none" stroke="var(--gold)" strokeWidth={1} opacity={0.6} />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * 2 * Math.PI;
        const [x0, y0] = polar(R_INNER - 24, a);
        const [x1, y1] = polar(R_INNER - 14, a);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--gold)" strokeWidth={1} opacity={0.6} />;
      })}
      <text x={C} y={C - (coreLines.length - 1) * 14 - 6} textAnchor="middle" fill="var(--wheel-core-ink)" style={{ fontFamily: 'var(--font-display)' }}>
        {coreLines.map((l, i) => (
          <tspan key={i} x={C} dy={i === 0 ? 0 : 28} fontSize={selected ? 24 : 32}>
            {l}
          </tspan>
        ))}
      </text>
      <text x={C} y={C + (coreLines.length - 1) * 14 + 30} textAnchor="middle" fontSize={16} fill="var(--wheel-core-ink)" opacity={0.8}>
        {wrapText(coreSub, 24, 2).map((l, i) => (
          <tspan key={i} x={C} dy={i === 0 ? 0 : 20}>
            {l}
          </tspan>
        ))}
      </text>
      {selected ? (
        <text x={C} y={C + (coreLines.length - 1) * 14 + 74} textAnchor="middle" fontSize={13} fill="var(--wheel-core-ink)" opacity={0.65}>
          {KIND_LABELS[selected.kind]}
        </text>
      ) : null}
    </svg>
  );
}

/** Text running outward along a radial line, offset into the gap on the given side. */
function RadialLabel({ a, side, text, color }: { a: number; side: 1 | -1; text: string; color: string }) {
  const r = R_INNER + 18;
  const off = (side * 9) / r;
  const [x, y] = polar(r, a + off);
  const deg = (a * 180) / Math.PI;
  return (
    <text x={x} y={y} fontSize={15} fontWeight={700} fill={color} dominantBaseline="middle" transform={`rotate(${deg} ${x} ${y})`}>
      {text}
    </text>
  );
}

function lineProps(r0: number, r1: number, a: number) {
  const [x1, y1] = polar(r0, a);
  const [x2, y2] = polar(r1, a);
  return { x1, y1, x2, y2 };
}

const Wheel = memo(WheelImpl);
export default Wheel;
