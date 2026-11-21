'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import { formatYear, yearsAgo, PRESENT_YEAR } from '@/lib/time';
import { panWindow, zoomWindow, type UnitWindow } from '@/lib/time/scale';
import { BOUNDARY_LABELS, SEGMENTS, SHORT_SEGMENT_LABELS, kindColor, unitToYear, visibleDatings, yearToUnit } from './shared';

const LANE_H = 38;
const TOP = 30;
const AXIS_H = 34;
const LABEL_W_PER_CHAR = 6.6;

function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Tick years for a window: rounds to nice values in years-ago for deep time and in calendar years otherwise. */
function ticksFor(win: UnitWindow, width: number): { year: number; label: string }[] {
  const n = Math.max(2, Math.floor(width / 110));
  const out: { year: number; label: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i <= n; i++) {
    const u = win.start + ((win.end - win.start) * i) / n;
    const du = (win.end - win.start) / n;
    const y = unitToYear(u);
    const span = Math.abs(unitToYear(Math.min(1, u + du)) - unitToYear(Math.max(0, u - du))) / 2;
    const step = niceStep(span);
    let ry: number;
    let label: string;
    if (y < -9999) {
      const ago = Math.round(yearsAgo(y) / step) * step;
      ry = PRESENT_YEAR - ago;
      label = ago >= 1e9 ? `${+(ago / 1e9).toFixed(2)} Ga` : ago >= 1e6 ? `${+(ago / 1e6).toFixed(2)} Ma` : `${+(ago / 1e3).toFixed(1)} ka`;
    } else {
      // Round in historical numbering so labels read 500 BCE rather than 499 BCE.
      const hist = y <= 0 ? 1 - y : y;
      const rh = Math.max(step >= 1 ? Math.round(hist / step) * step : hist, 1);
      ry = y <= 0 ? 1 - rh : rh;
      label = formatYear(ry);
      if (ry > 0 && ry < 3000) label = ry >= 1000 && step >= 1 ? `${ry}` : label;
    }
    if (!seen.has(label)) {
      seen.add(label);
      out.push({ year: ry, label });
    }
  }
  return out;
}

export interface RiverProps {
  items: KcItem[];
  kinds: readonly Kind[];
  lens: Lens;
  selectedId: string | null;
  win: UnitWindow;
  onWindow: (w: UnitWindow) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX: number, clientY: number) => void;
}

export default function River({ items, kinds, lens, selectedId, win, onWindow, onSelect, onHover }: RiverProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(900);
  const winRef = useRef(win);
  useEffect(() => {
    winRef.current = win;
  }, [win]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; moved: boolean; pinch?: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Non-passive wheel listener: pinch (ctrlKey) and horizontal scroll zoom and pan; vertical scroll is left to the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const w = winRef.current;
      const rect = el.getBoundingClientRect();
      const focus = w.start + ((e.clientX - rect.left) / rect.width) * (w.end - w.start);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onWindow(zoomWindow(w, focus, Math.exp(e.deltaY * 0.01)));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        onWindow(panWindow(w, (e.deltaX / rect.width) * (w.end - w.start)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWindow]);

  const height = TOP + kinds.length * LANE_H + AXIS_H;
  const x = (u: number) => ((u - win.start) / (win.end - win.start)) * width;

  const lanes = useMemo(() => {
    const byKind = new Map<Kind, { item: KcItem; x0: number; x1: number; trad: boolean; grade: string }[]>();
    for (const item of items) {
      const ds = visibleDatings(item, lens);
      if (!ds.length) continue;
      for (const d of ds) {
        const x0 = x(yearToUnit(d.earliest));
        const x1 = x(yearToUnit(d.latest));
        if (x1 < -200 || x0 > width + 200) continue;
        const list = byKind.get(item.kind) ?? [];
        list.push({ item, x0, x1, trad: d.lens === 'tradition', grade: d.grade });
        byKind.set(item.kind, list);
      }
    }
    for (const list of byKind.values()) list.sort((a, b) => a.x0 - b.x0);
    return byKind;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lens, win.start, win.end, width]);

  const ticks = useMemo(() => ticksFor(win, width), [win, width]);

  const breaks = SEGMENTS.slice(1)
    .map((s) => ({ s, px: x(yearToUnit(s.from)) }))
    .filter((b) => b.px > 0 && b.px < width);

  const segLabels = SEGMENTS.map((s) => {
    const a = Math.max(0, x(yearToUnit(s.from)));
    const b = Math.min(width, x(yearToUnit(s.to)));
    return { s, a, b };
  }).filter((l) => l.b - l.a > 70);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      drag.current = { x: (p.x + q.x) / 2, moved: true, pinch: Math.abs(p.x - q.x) };
    } else drag.current = { x: e.clientX, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = svgRef.current!.getBoundingClientRect();
    const w = winRef.current;
    if (pointers.current.size === 2 && drag.current.pinch) {
      const [p, q] = [...pointers.current.values()];
      const dist = Math.max(10, Math.abs(p.x - q.x));
      const mid = (p.x + q.x) / 2;
      const focus = w.start + ((mid - rect.left) / rect.width) * (w.end - w.start);
      onWindow(zoomWindow(w, focus, drag.current.pinch / dist));
      drag.current.pinch = dist;
      return;
    }
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    drag.current.x = e.clientX;
    onWindow(panWindow(w, (-dx / rect.width) * (w.end - w.start)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setTimeout(() => (drag.current = null), 0);
  };

  const click = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const zoomBy = (f: number) => onWindow(zoomWindow(win, (win.start + win.end) / 2, f));

  return (
    <div ref={wrapRef}>
      <div className="kc-river-controls">
        <button type="button" className="btn" onClick={() => zoomBy(0.5)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="btn" onClick={() => zoomBy(2)} aria-label="Zoom out">
          -
        </button>
        <button type="button" className="btn" onClick={() => onWindow({ start: 0, end: 1 })}>
          Whole wheel
        </button>
        <span>
          {formatYear(unitToYear(win.start))} to {formatYear(unitToYear(win.end))}. Drag to move, pinch or Ctrl and scroll to zoom.
        </span>
      </div>
      <svg
        ref={svgRef}
        className="kc-river"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Timeline from ${formatYear(unitToYear(win.start))} to ${formatYear(unitToYear(win.end))}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {segLabels.map(({ s, a, b }, i) => (
          <g key={s.id}>
            <rect x={a} y={0} width={b - a} height={height - AXIS_H} fill={i % 2 ? 'var(--wheel-seg-b)' : 'var(--wheel-seg-a)'} opacity={0.6} />
            <text x={(a + b) / 2} y={18} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink-faint)">
              {SHORT_SEGMENT_LABELS[s.id]}
              {s.interp === 'log' ? ' (log scale)' : ''}
            </text>
          </g>
        ))}
        {kinds.map((k, i) => (
          <g key={k}>
            <line x1={0} x2={width} y1={TOP + (i + 1) * LANE_H} y2={TOP + (i + 1) * LANE_H} stroke="var(--line)" strokeWidth={0.6} />
            <text x={6} y={TOP + i * LANE_H + 11} fontSize={10} fill="var(--ink-faint)" fontWeight={600} letterSpacing="0.05em">
              {KIND_LABELS[k].toUpperCase()}
            </text>
          </g>
        ))}
        {breaks.map(({ s, px }) => (
          <g key={s.id}>
            <line x1={px} x2={px} y1={TOP - 6} y2={height - AXIS_H} stroke="var(--line-strong)" strokeDasharray="4 3" />
            <path d={`M${px - 4} ${height - AXIS_H - 2}l4 -6l4 6`} fill="none" stroke="var(--ink-faint)" />
            <title>{`Scale break at ${BOUNDARY_LABELS[s.id]}`}</title>
          </g>
        ))}
        {(() => {
          const labels: { key: string; x: number; y: number; text: string; active: boolean }[] = [];
          const marks = kinds.map((k, i) => {
            const list = lanes.get(k) ?? [];
            const y = TOP + i * LANE_H + LANE_H / 2 + 5;
            let labelEnd = -Infinity;
            return (
              <g key={k}>
                {list.map(({ item, x0, x1, trad }, j) => {
                  const w = Math.max(x1 - x0, 0);
                  const isPoint = w < 8;
                  const cx = isPoint ? (x0 + x1) / 2 : x0;
                  const visibleStart = Math.max(x0, 0);
                  const labelX = isPoint ? cx + 8 : visibleStart + 4;
                  const lw = item.name.length * LABEL_W_PER_CHAR;
                  const active = item.id === selectedId;
                  if (!trad && labelX >= 4 && labelX > labelEnd + 8 && labelX + lw < width - 4) {
                    labelEnd = labelX + lw;
                    labels.push({ key: `${item.id}-${j}`, x: labelX, y: isPoint ? y + 4 : y - 8, text: item.name, active });
                  }
                  const color = trad ? 'var(--gold)' : kindColor(item.kind);
                  return (
                    <g
                      key={`${item.id}-${j}`}
                      className="kc-mark"
                      data-active={active}
                      onClick={() => click(item.id)}
                      onPointerEnter={(e) => onHover(item.id, e.clientX, e.clientY)}
                      onPointerLeave={(e) => onHover(null, e.clientX, e.clientY)}
                    >
                      {isPoint ? (
                        <circle cx={cx} cy={y} r={active ? 7 : 5.5} fill={trad ? 'var(--bg-elev)' : color} stroke={trad ? color : 'var(--bg-elev)'} strokeWidth={trad ? 2.2 : 1.2} />
                      ) : (
                        <rect
                          x={x0}
                          y={y - (trad ? 3 : 4)}
                          width={w}
                          height={trad ? 6 : 8}
                          rx={trad ? 3 : 4}
                          fill={trad ? 'none' : color}
                          stroke={trad ? color : active ? 'var(--ink)' : 'none'}
                          strokeDasharray={trad ? '3 3' : undefined}
                          opacity={active ? 1 : 0.8}
                        />
                      )}
                      <rect x={Math.min(x0, cx - 10)} y={y - 12} width={Math.max(w, 20)} height={24} fill="transparent" />
                    </g>
                  );
                })}
              </g>
            );
          });
          return (
            <>
              {marks}
              <g pointerEvents="none">
                {labels.map((l) => (
                  <text
                    key={l.key}
                    x={l.x}
                    y={l.y}
                    fontSize={11.5}
                    fill="var(--ink)"
                    fontWeight={l.active ? 700 : 500}
                    stroke="var(--bg-elev)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  >
                    {l.text}
                  </text>
                ))}
              </g>
            </>
          );
        })()}
        <line x1={0} x2={width} y1={height - AXIS_H} y2={height - AXIS_H} stroke="var(--ink-faint)" />
        {ticks.map((t) => {
          const px = x(yearToUnit(t.year));
          if (px < 20 || px > width - 20) return null;
          return (
            <g key={t.label}>
              <line x1={px} x2={px} y1={height - AXIS_H} y2={height - AXIS_H + 6} stroke="var(--ink-faint)" />
              <text x={px} y={height - AXIS_H + 20} fontSize={11} textAnchor="middle" fill="var(--ink-soft)">
                {t.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
