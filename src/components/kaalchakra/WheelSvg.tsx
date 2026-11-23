import type { CSSProperties, MouseEventHandler, PointerEventHandler, ReactNode, Ref, SVGProps } from 'react';
import type { Kind } from '@/lib/content/labels';
import type { Lens } from '@/lib/content/lens';
import { PRESENT_YEAR, formatYear } from '@/lib/time';
import { SEGMENT_STARTS } from '@/lib/time/scale';
import { BOUNDARY_LABELS, SEGMENTS, SHORT_SEGMENT_LABELS, anchorIn, hash, kindColor, visibleDatings, wrapText, yearToUnit, type PlacedItem } from './shared';
import { C, INDICATOR, R_INNER, R_OUTER, VB, angleOf, polarXY, radialLabel, shortestDelta, tangentLabel } from './wheelGeometry';

/*
 * Pure wheel renderer shared by the interactive client Wheel and static server renders (home page,
 * Kaalchakra fallback). No hooks and no client directive; handlers and refs are optional and absent on the server.
 *
 * Two stacked SVGs share one viewBox:
 *   - the rotor holds everything that turns with time (eras, rings, marks, scale breaks). The client spins it
 *     with a CSS transform on the element itself, so the browser can move it as one composited layer without
 *     repainting a thousand shapes per frame;
 *   - the overlay holds what must stay upright or fixed: era and year labels (re-placed each frame from their
 *     data attributes by placeLabels), the hub and the indicator. It never takes pointer events.
 * Every emitted coordinate is rounded to two decimals so server and client output match exactly.
 */

function f(n: number): string {
  return n.toFixed(2);
}

function polar(r: number, a: number): [string, string] {
  const { x, y } = polarXY(r, a);
  return [f(x), f(y)];
}

function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${f(r)} ${f(r)} 0 ${large} 1 ${x1} ${y1}`;
}

function sectorPath(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${f(r1)} ${f(r1)} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${f(r0)} ${f(r0)} 0 ${large} 0 ${x3} ${y3}Z`;
}

function lineProps(r0: number, r1: number, a: number) {
  const [x1, y1] = polar(r0, a);
  const [x2, y2] = polar(r1, a);
  return { x1, y1, x2, y2 };
}

export const SEGMENT_ANGLES = SEGMENTS.map((seg, i) => ({ seg, i, a0: angleOf(SEGMENT_STARTS[i]), a1: angleOf(SEGMENT_STARTS[i] + seg.share) }));

const TODAY_A = angleOf(yearToUnit(PRESENT_YEAR));
const START_A = angleOf(0);
const RADIAL_R = R_INNER + 18;

/**
 * A label in the overlay: where it sits on the unrotated wheel and how it turns.
 * `year` labels are set along the rim like era names, just inside them, and give way to the indicator.
 */
type LabelMode = 'tangent' | 'year' | 'radial';

/** 0 when a label sits under the indicator, rising to 1 once it is clear of it. */
function clearOfIndicator(at: number): number {
  const deg = (Math.abs(shortestDelta(at, INDICATOR)) * 180) / Math.PI;
  const t = Math.min(1, Math.max(0, (deg - 6) / 4));
  return t * t * (3 - 2 * t);
}

/**
 * Attributes of an overlay label for a wheel rotation (rad) and angular speed (rad/ms).
 * The renderer uses it for the first paint; placeLabels applies the same rule on every frame.
 */
type Anchor = 'start' | 'middle' | 'end';

function labelAttrs(mode: LabelMode, a: number, r: number, side: number, rotation: number, speed: number): { x: string; y: string; transform?: string; anchor: Anchor; opacity: string } {
  const at = a + rotation;
  if (mode === 'tangent' || mode === 'year') {
    const { x, y } = polarXY(r, at);
    const { deg, opacity } = tangentLabel(at, speed);
    const o = mode === 'year' ? opacity * clearOfIndicator(at) : opacity;
    return { x: f(x), y: f(y), transform: `rotate(${f(deg)} ${f(x)} ${f(y)})`, anchor: 'middle', opacity: f(o) };
  }
  const { x, y } = polarXY(r, at + (side * 9) / r);
  const { deg, flipped, opacity } = radialLabel(at, speed);
  return { x: f(x), y: f(y), transform: `rotate(${f(deg)} ${f(x)} ${f(y)})`, anchor: flipped ? 'end' : 'start', opacity: f(opacity) };
}

/** Re-place every overlay label for a rotation; called once per animation frame, with no React render. */
export function placeLabels(labels: readonly SVGTextElement[], rotation: number, speed: number): void {
  for (const el of labels) {
    const d = el.dataset;
    const at = labelAttrs(d.mode as LabelMode, Number(d.a), Number(d.r), Number(d.side ?? 0), rotation, speed);
    el.setAttribute('x', at.x);
    el.setAttribute('y', at.y);
    if (at.transform) el.setAttribute('transform', at.transform);
    el.setAttribute('text-anchor', at.anchor);
    el.setAttribute('opacity', at.opacity);
  }
}

function OverlayLabel({ mode, a, r, side = 0, rotation, children, ...rest }: { mode: LabelMode; a: number; r: number; side?: number; rotation: number; children: ReactNode } & SVGProps<SVGTextElement>) {
  const at = labelAttrs(mode, a, r, side, rotation, 0);
  return (
    <text
      data-mode={mode}
      data-a={a}
      data-r={r}
      data-side={side}
      x={at.x}
      y={at.y}
      transform={at.transform}
      textAnchor={at.anchor}
      opacity={at.opacity}
      dominantBaseline="middle"
      {...rest}
    >
      {children}
    </text>
  );
}

function markElements(item: PlacedItem, r: number, ringW: number, lens: Lens): ReactNode[] {
  const ds = visibleDatings(item, lens);
  const color = kindColor(item.kind);
  const els: ReactNode[] = [];
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
          fill={trad ? 'var(--wheel-trad-fill)' : color}
          stroke={trad ? 'var(--lens-tradition)' : 'var(--wheel-mark-edge)'}
          strokeWidth={trad ? 2.4 : 1.2}
        />,
      );
    } else {
      // Very long spans (living traditions, long-occupied sites) recede so point events stay legible.
      const long = a1 - a0 > 0.6;
      els.push(
        <path
          key={k}
          d={arcPath(r, a0, a1)}
          fill="none"
          stroke={trad ? 'var(--lens-tradition)' : color}
          strokeWidth={trad ? 4 : long ? 4 : 7}
          strokeLinecap="round"
          strokeDasharray={trad ? '2 5' : undefined}
          opacity={trad ? 0.95 : long ? 0.5 : 0.85}
        />,
      );
    }
  });
  if (lens === 'both' && item.anchor.scholarship !== null && item.anchor.tradition !== null && anchors.length > 1) {
    const lo = Math.min(...anchors);
    const hi = Math.max(...anchors);
    if ((hi - lo) * r > 10) {
      els.unshift(<path key="bridge" d={arcPath(r - ringW * 0.42, lo, hi)} fill="none" stroke="var(--lens-tradition)" strokeWidth={1} strokeDasharray="1 4" opacity={0.7} />);
    }
  }
  // Generous invisible hit target at the primary anchor for touch.
  const anchor = anchorIn(item, lens);
  if (anchor !== null) {
    const [hx, hy] = polar(r, angleOf(yearToUnit(anchor)));
    els.push(<circle key="hit" cx={hx} cy={hy} r={11} fill="transparent" />);
  }
  return els;
}

export interface WheelCore {
  lines: string[];
  sub: string;
  /** Shown as its own tag under the date, so a long date can never push it out of the hub. */
  tag?: string;
  kind?: string;
}

export interface WheelRefs {
  container?: Ref<HTMLDivElement>;
  rotor?: Ref<SVGSVGElement>;
  overlay?: Ref<SVGSVGElement>;
}

export interface WheelSvgProps {
  items: PlacedItem[];
  kinds: readonly Kind[];
  lens: Lens;
  selectedId: string | null;
  /** Text in the hub; defaults to the wheel name and entry count. */
  core?: WheelCore;
  title?: string;
  /** Rotation in radians for the first paint; the client turns the wheel from here without re-rendering. */
  rotation?: number;
  /** Draw the fixed indicator at the top that a selection spins to. */
  indicator?: boolean;
  refs?: WheelRefs;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null, clientX: number, clientY: number) => void;
  onRotorPointerDown?: PointerEventHandler<SVGSVGElement>;
  onRotorClick?: MouseEventHandler<SVGSVGElement>;
}

function Hub({ core, count }: { core?: WheelCore; count: number }) {
  const hub = core ?? { lines: ['Kaalchakra'], sub: `${count} moments` };
  const sub = wrapText(hub.sub, 24, 2);
  // Full hub: name, date, tag and kind, stacked about the centre.
  const rows: { h: number; el: (y: number) => ReactNode }[] = [];
  hub.lines.forEach((l, i) =>
    rows.push({
      h: core ? 28 : 38,
      el: (y) => (
        <text key={`n${i}`} x={C} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={core ? 24 : 32} fill="var(--wheel-core-ink)" style={{ fontFamily: 'var(--font-display)' }}>
          {l}
        </text>
      ),
    }),
  );
  sub.forEach((l, i) =>
    rows.push({
      h: 21,
      el: (y) => (
        <text key={`s${i}`} x={C} y={y + (i === 0 ? 4 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="var(--wheel-core-ink)" opacity={0.85}>
          {l}
        </text>
      ),
    }),
  );
  if (hub.tag) rows.push({ h: 34, el: (y) => <HubTag key="tag" y={y + 4} text={hub.tag!} size={13} /> });
  if (hub.kind) {
    rows.push({
      h: 22,
      el: (y) => (
        <text key="kind" x={C} y={y + 4} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="var(--wheel-core-ink)" opacity={0.7}>
          {hub.kind}
        </text>
      ),
    });
  }
  const total = rows.reduce((sum, r) => sum + r.h, 0);
  const tops = rows.map((_, i) => C - total / 2 + rows.slice(0, i).reduce((sum, r) => sum + r.h, 0));
  const full = rows.map((r, i) => r.el(tops[i] + r.h / 2));

  // Compact hub for small wheels, where the panel below already names the entry: the date and tag, larger.
  const date = wrapText(hub.sub, 13, 3);
  const compactRows = date.length + (hub.tag ? 1.3 : 0);
  const cy0 = C - (compactRows * 38) / 2 + 19;
  const compact: ReactNode[] = date.map((l, i) => (
    <text key={`c${i}`} x={C} y={f(cy0 + i * 38)} textAnchor="middle" dominantBaseline="middle" fontSize={34} fill="var(--wheel-core-ink)" style={{ fontFamily: 'var(--font-display)' }}>
      {l}
    </text>
  ));
  if (hub.tag) compact.push(<HubTag key="ctag" y={cy0 + date.length * 38 + 6} text={hub.tag} size={26} />);

  return (
    <>
      {/* Without a selection there is no compact form: the wheel's name shows at every size. */}
      <g className={core ? 'kc-hub kc-hub--full' : 'kc-hub'}>{full}</g>
      {core ? <g className="kc-hub kc-hub--compact">{compact}</g> : null}
    </>
  );
}

/** A small pill, sized from its text so the whole word always shows. */
function HubTag({ y, text, size }: { y: number; text: string; size: number }) {
  const w = text.length * size * 0.66 + size * 1.4;
  const h = size * 1.75;
  return (
    <g className="kc-hub__tag">
      <rect x={f(C - w / 2)} y={f(y - h / 2)} width={f(w)} height={f(h)} rx={f(h / 2)} fill="var(--wheel-tag-bg)" stroke="var(--wheel-tag-edge)" strokeWidth={1.5} />
      <text x={C} y={f(y)} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={700} letterSpacing={size * 0.06} fill="var(--wheel-tag-ink)">
        {text}
      </text>
    </g>
  );
}

export default function WheelSvg({ items, kinds, lens, selectedId, core, title, rotation = 0, indicator = false, refs, onSelect, onHover, onRotorPointerDown, onRotorClick }: WheelSvgProps) {
  const ringW = (R_OUTER - R_INNER) / Math.max(kinds.length, 1);
  const ringIndex = new Map(kinds.map((k, i) => [k, i]));
  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  const selAnchor = selected ? anchorIn(selected, lens) : null;
  const selRing = selected ? ringIndex.get(selected.kind) : undefined;
  // Kept independent of selection so selecting an entry does not rebuild every mark.
  const marks = items.flatMap((item) => {
    const ri = ringIndex.get(item.kind);
    if (ri === undefined || visibleDatings(item, lens).length === 0) return [];
    const lane = (hash(item.id) % 3) - 1;
    const r = R_INNER + (ri + 0.5) * ringW + lane * ringW * 0.27;
    return [{ id: item.id, els: markElements(item, r, ringW, lens) }];
  });
  const rotorStyle: CSSProperties = { transform: `rotate(${f((rotation * 180) / Math.PI)}deg)` };
  const interactive = Boolean(onSelect);

  return (
    <div
      className="kc-wheel"
      ref={refs?.container}
      role="img"
      aria-label={title ?? `Kaalchakra wheel showing ${items.length} entries from the start of the kalpa to the present`}
      data-interactive={interactive || undefined}
    >
      <svg className="kc-wheel__rotor" viewBox={`0 0 ${VB} ${VB}`} ref={refs?.rotor} style={rotorStyle} onPointerDown={onRotorPointerDown} onClick={onRotorClick} aria-hidden="true" focusable="false">
        {/* The drag surface: the whole disc, so a drag can start anywhere on it but a touch outside it still scrolls the page. */}
        <circle className="kc-wheel__disc" cx={C} cy={C} r={R_OUTER + 16} fill="transparent" />

        {SEGMENT_ANGLES.map(({ seg, a0, a1, i }) => (
          <path key={seg.id} className="kc-wheel__era" data-era={seg.id} d={sectorPath(R_INNER, R_OUTER, a0, a1)} fill={`var(--era-${i + 1})`} stroke="var(--line)" strokeWidth={1}>
            <title>{`${seg.label}: ${formatYear(seg.from, seg.interp === 'log' ? 'Ma' : 'year')} to ${formatYear(seg.to)}${seg.interp === 'log' ? ' (logarithmic scale)' : ' (linear scale)'}`}</title>
          </path>
        ))}

        {kinds.map((k, i) => (
          <circle key={k} cx={C} cy={C} r={f(R_INNER + i * ringW)} fill="none" stroke="var(--line)" strokeWidth={0.6} opacity={0.7} />
        ))}

        {/* Scale breaks */}
        {SEGMENT_ANGLES.map(({ seg, a0 }, i) =>
          i === 0 ? null : <line key={`b-${seg.id}`} {...lineProps(R_INNER - 4, R_OUTER + 12, a0)} stroke="var(--line-strong)" strokeWidth={1.2} strokeDasharray="4 3" />,
        )}

        {/* Today and the start of the present kalpa (traditional) */}
        <line {...lineProps(R_INNER - 6, R_OUTER + 10, TODAY_A)} stroke="var(--accent)" strokeWidth={2.5} />
        <line {...lineProps(R_INNER - 6, R_OUTER + 10, START_A)} stroke="var(--lens-tradition)" strokeWidth={2} strokeDasharray="3 3" />

        {selected && selAnchor !== null && selRing !== undefined ? (
          <line {...lineProps(R_INNER - 10, R_OUTER, angleOf(yearToUnit(selAnchor)))} stroke="var(--ink)" strokeWidth={1.2} opacity={0.6} />
        ) : null}

        <g>
          {marks.map(({ id, els }) => (
            <g
              key={id}
              className="kc-mark"
              data-id={id}
              data-active={id === selectedId}
              onClick={onSelect ? () => onSelect(id) : undefined}
              onPointerEnter={onHover ? (e) => onHover(id, e.clientX, e.clientY) : undefined}
              onPointerLeave={onHover ? (e) => onHover(null, e.clientX, e.clientY) : undefined}
            >
              {els}
            </g>
          ))}
        </g>
      </svg>

      <svg className="kc-wheel__overlay" viewBox={`0 0 ${VB} ${VB}`} ref={refs?.overlay} aria-hidden="true" focusable="false">
        {SEGMENT_ANGLES.map(({ seg, a0 }, i) =>
          i === 0 ? null : (
            <OverlayLabel key={`b-${seg.id}`} mode="year" a={a0} r={R_OUTER + 27} rotation={rotation} fontSize={15} fill="var(--ink-faint)" className="kc-wheel__label">
              {BOUNDARY_LABELS[seg.id]}
            </OverlayLabel>
          ),
        )}
        {SEGMENT_ANGLES.map(({ seg, a0, a1 }) => (
          <OverlayLabel key={`l-${seg.id}`} mode="tangent" a={(a0 + a1) / 2} r={R_OUTER + 58} rotation={rotation} fontSize={18} fontWeight={600} fill="var(--ink-soft)" className="kc-wheel__label">
            {SHORT_SEGMENT_LABELS[seg.id]}
          </OverlayLabel>
        ))}
        <OverlayLabel mode="radial" a={TODAY_A} r={RADIAL_R} side={1} rotation={rotation} fontSize={15} fontWeight={700} fill="var(--accent)">
          Today
        </OverlayLabel>
        <OverlayLabel mode="radial" a={START_A} r={RADIAL_R} side={-1} rotation={rotation} fontSize={15} fontWeight={700} fill="var(--lens-tradition)">
          Kalpa begins
        </OverlayLabel>

        {indicator ? (
          <g className="kc-wheel__indicator">
            <path d={`M${C} ${C - R_OUTER + 2}L${C - 11} ${C - R_OUTER - 17}A12.5 12.5 0 1 1 ${C + 11} ${C - R_OUTER - 17}Z`} fill="var(--wheel-indicator)" stroke="var(--bg-elev)" strokeWidth={2} />
            <circle cx={C} cy={C - R_OUTER - 25} r={3.2} fill="var(--bg-elev)" />
          </g>
        ) : null}

        <circle cx={C} cy={C} r={R_INNER - 14} fill="var(--wheel-core)" />
        <circle cx={C} cy={C} r={R_INNER - 24} fill="none" stroke="var(--wheel-core-ring)" strokeWidth={1} opacity={0.7} />
        <HubLotus />
        <Hub core={core} count={items.length} />
      </svg>
    </div>
  );
}

/** A faint eight-petalled lotus behind the hub text, drawn from arcs; original geometry, no imagery. */
function HubLotus() {
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 2 * Math.PI;
    const tip = polarXY(R_INNER - 30, a);
    const l = polarXY(40, a - 0.5);
    const r = polarXY(40, a + 0.5);
    return `M${f(l.x)} ${f(l.y)}Q${f(polarXY(R_INNER - 56, a - 0.32).x)} ${f(polarXY(R_INNER - 56, a - 0.32).y)} ${f(tip.x)} ${f(tip.y)}Q${f(polarXY(R_INNER - 56, a + 0.32).x)} ${f(polarXY(R_INNER - 56, a + 0.32).y)} ${f(r.x)} ${f(r.y)}`;
  });
  return (
    <g className="kc-hub__lotus" fill="none" stroke="var(--wheel-core-ring)" strokeWidth={1} opacity={0.28}>
      {petals.map((d, i) => (
        <path key={i} d={d} />
      ))}
      <circle cx={C} cy={C} r={40} />
    </g>
  );
}
