'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import { panWindow, zoomWindow, type UnitWindow } from '@/lib/time/scale';
import { BOUNDARY_LABELS, SEGMENTS, SHORT_SEGMENT_LABELS, kindColor, visibleDatings, yearToUnit } from './shared';
import { edgeLabel, ticksFor } from './ticks';

const LANE_H = 38;
const TOP = 30;
const AXIS_H = 34;
const LABEL_W_PER_CHAR = 6.6;
/** Lane titles: 10 px uppercase semibold with 0.05em tracking, measured at about 6.5 px per character. */
const LANE_TITLE_X = 6;
const LANE_TITLE_W_PER_CHAR = 6.8;
/** Minimum horizontal gap between labels in a lane, and between the lane title and the first label. */
const LABEL_GAP = 8;
/** Era headers: 12 px semibold, about 7 px per character, with this much clear space on each side. */
const SEG_LABEL_W_PER_CHAR = 7;
const SEG_LABEL_PAD = 6;
/** Marks are clamped to this margin beyond the canvas so huge off-screen rects are never drawn. */
const BLEED = 10;
/** Horizontal movement in pixels before a press becomes a drag. */
const DRAG_PX = 4;

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
  // Handlers read and advance this synchronously so consecutive events never start from a stale window.
  const winRef = useRef(win);
  useLayoutEffect(() => {
    winRef.current = win;
  }, [win]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ startX: number; x: number; moved: boolean; pinch?: number } | null>(null);

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
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.width : 1;
      const dx = e.deltaX * k;
      const dy = e.deltaY * k;
      let next: UnitWindow;
      if (e.ctrlKey || e.metaKey) {
        const focus = w.start + ((e.clientX - rect.left) / rect.width) * (w.end - w.start);
        next = zoomWindow(w, focus, Math.exp(Math.max(-1, Math.min(1, dy * 0.01))));
      } else if (Math.abs(dx) > Math.abs(dy)) {
        next = panWindow(w, (dx / rect.width) * (w.end - w.start));
      } else return;
      e.preventDefault();
      winRef.current = next;
      onWindow(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWindow]);

  const height = TOP + kinds.length * LANE_H + AXIS_H;
  const x = (u: number) => ((u - win.start) / (win.end - win.start)) * width;

  const lanes = useMemo(() => {
    const px = (u: number) => ((u - win.start) / (win.end - win.start)) * width;
    const byKind = new Map<Kind, { item: KcItem; key: string; x0: number; x1: number; trad: boolean }[]>();
    for (const item of items) {
      visibleDatings(item, lens).forEach((d, k) => {
        const x0 = px(yearToUnit(d.earliest));
        const x1 = px(yearToUnit(d.latest));
        if (x1 < -2 * BLEED || x0 > width + 2 * BLEED) return;
        const list = byKind.get(item.kind) ?? [];
        list.push({ item, key: `${item.id}-${k}`, x0, x1, trad: d.lens === 'tradition' });
        byKind.set(item.kind, list);
      });
    }
    for (const list of byKind.values()) list.sort((a, b) => a.x0 - b.x0);
    return byKind;
  }, [items, lens, win.start, win.end, width]);

  const ticks = useMemo(() => ticksFor(win, width), [win, width]);

  const breaks = SEGMENTS.slice(1)
    .map((s) => ({ s, px: x(yearToUnit(s.from)) }))
    .filter((b) => b.px > 0 && b.px < width);

  // Every visible era keeps its band, coloured by its own index so the alternation matches the wheel; its header is
  // the longest form that fits ("Palaeolithic (log scale)", then "Palaeolithic", then none), so headers never collide.
  const segLabels = SEGMENTS.map((s, i) => {
    const a = Math.max(0, x(yearToUnit(s.from)));
    const b = Math.min(width, x(yearToUnit(s.to)));
    const name = SHORT_SEGMENT_LABELS[s.id];
    const fits = (t: string) => t.length * SEG_LABEL_W_PER_CHAR + 2 * SEG_LABEL_PAD <= b - a;
    const full = s.interp === 'log' ? `${name} (log scale)` : name;
    return { s, i, a, b, label: fits(full) ? full : fits(name) ? name : null };
  }).filter((l) => l.b > l.a);

  const commit = (next: UnitWindow) => {
    winRef.current = next;
    onWindow(next);
  };

  const capture = (el: Element, id: number) => {
    try {
      el.setPointerCapture(id);
    } catch {
      // The pointer may already be gone; the drag still ends through pointerup or pointercancel.
    }
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Touch captures implicitly to the mark under the finger, which can unmount while panning.
    const t = e.target as Element;
    if (t !== e.currentTarget && t.hasPointerCapture?.(e.pointerId)) t.releasePointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [p, q] = [...pointers.current.values()];
      const mid = (p.x + q.x) / 2;
      drag.current = { startX: mid, x: mid, moved: true, pinch: Math.max(10, Math.hypot(p.x - q.x, p.y - q.y)) };
      for (const id of pointers.current.keys()) capture(e.currentTarget, id);
    } else drag.current = { startX: e.clientX, x: e.clientX, moved: false };
  };

  const endPointer = (id: number) => {
    if (!pointers.current.delete(id)) return;
    const rest = [...pointers.current.values()];
    if (rest.length >= 2) {
      const [p, q] = rest;
      const mid = (p.x + q.x) / 2;
      drag.current = { startX: mid, x: mid, moved: true, pinch: Math.max(10, Math.hypot(p.x - q.x, p.y - q.y)) };
    } else if (rest.length === 1) {
      drag.current = { startX: rest[0].x, x: rest[0].x, moved: true };
    } else {
      // Cleared after the click that follows pointerup, so a drag never also selects.
      const d = drag.current;
      setTimeout(() => {
        if (drag.current === d) drag.current = null;
      }, 0);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) return endPointer(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = e.currentTarget.getBoundingClientRect();
    const w = winRef.current;
    if (pointers.current.size >= 2 && d.pinch !== undefined) {
      const [p, q] = [...pointers.current.values()];
      const dist = Math.max(10, Math.hypot(p.x - q.x, p.y - q.y));
      const focus = w.start + (((p.x + q.x) / 2 - rect.left) / rect.width) * (w.end - w.start);
      commit(zoomWindow(w, focus, d.pinch / dist));
      d.pinch = dist;
      return;
    }
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) <= DRAG_PX) return;
      d.moved = true;
      capture(e.currentTarget, e.pointerId);
    }
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    if (dx) commit(panWindow(w, (-dx / rect.width) * (w.end - w.start)));
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => endPointer(e.pointerId);

  const onLostPointerCapture = (e: React.PointerEvent<SVGSVGElement>) => {
    // lostpointercapture bubbles; only the SVG's own capture ending matters here.
    if (e.target === e.currentTarget) endPointer(e.pointerId);
  };

  const click = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const zoomBy = (f: number) => commit(zoomWindow(win, (win.start + win.end) / 2, f));
  const clampX = (v: number) => Math.min(width + BLEED, Math.max(-BLEED, v));
  const range = `${edgeLabel(win.start)} to ${edgeLabel(win.end)}`;

  return (
    <div ref={wrapRef}>
      <div className="kc-river-controls">
        <button type="button" className="btn" onClick={() => zoomBy(0.5)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="btn" onClick={() => zoomBy(2)} aria-label="Zoom out">
          -
        </button>
        <button type="button" className="btn" onClick={() => commit({ start: 0, end: 1 })}>
          Whole wheel
        </button>
        <span>{range}. Drag, or Shift and arrow keys, to move. Pinch, Ctrl and scroll, or the + and - keys to zoom.</span>
      </div>
      <svg
        ref={svgRef}
        className="kc-river"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Timeline from ${range}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onLostPointerCapture}
      >
        {segLabels.map(({ s, i, a, b, label }) => (
          <g key={s.id}>
            <rect x={a} y={0} width={b - a} height={height - AXIS_H} fill={i % 2 ? 'var(--wheel-seg-b)' : 'var(--wheel-seg-a)'} opacity={0.6} />
            {label ? (
              <text x={(a + b) / 2} y={18} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink-faint)">
                {label}
              </text>
            ) : null}
          </g>
        ))}
        {kinds.map((k, i) => (
          <g key={k}>
            <line x1={0} x2={width} y1={TOP + (i + 1) * LANE_H} y2={TOP + (i + 1) * LANE_H} stroke="var(--line)" strokeWidth={0.6} />
            <text x={LANE_TITLE_X} y={TOP + i * LANE_H + 11} fontSize={10} fill="var(--ink-faint)" fontWeight={600} letterSpacing="0.05em">
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
            // Range labels sit on the same line as the lane title, so no label may start before the title ends.
            const titleEnd = LANE_TITLE_X + KIND_LABELS[k].length * LANE_TITLE_W_PER_CHAR;
            let labelEnd = titleEnd;
            return (
              <g key={k}>
                {list.map(({ item, key, x0, x1, trad }) => {
                  const isPoint = x1 - x0 < 8;
                  const cx = (x0 + x1) / 2;
                  const left = clampX(x0);
                  const right = clampX(x1);
                  const lw = item.name.length * LABEL_W_PER_CHAR;
                  let labelX = isPoint ? cx + 8 : Math.max(x0, 0) + 4;
                  // A range label slides right along its bar, past the lane title or the previous label, while the bar still holds it.
                  if (!isPoint && labelX < labelEnd + LABEL_GAP && x1 >= labelEnd + LABEL_GAP + lw) labelX = labelEnd + LABEL_GAP;
                  const active = item.id === selectedId;
                  if (!trad && labelX >= 4 && labelX >= labelEnd + LABEL_GAP && labelX + lw < width - 4) {
                    labelEnd = labelX + lw;
                    labels.push({ key, x: labelX, y: isPoint ? y + 4 : y - 8, text: item.name, active });
                  }
                  const color = trad ? 'var(--gold)' : kindColor(item.kind);
                  const hitLeft = isPoint ? cx - 10 : left;
                  const hitRight = isPoint ? cx + 10 : Math.max(right, left + 20);
                  return (
                    <g
                      key={key}
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
                          x={left}
                          y={y - (trad ? 3 : 4)}
                          width={right - left}
                          height={trad ? 6 : 8}
                          rx={trad ? 3 : 4}
                          fill={trad ? 'none' : color}
                          stroke={trad ? color : active ? 'var(--ink)' : 'none'}
                          strokeDasharray={trad ? '3 3' : undefined}
                          opacity={active ? 1 : 0.8}
                        />
                      )}
                      <rect x={hitLeft} y={y - 12} width={hitRight - hitLeft} height={24} fill="transparent" />
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
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={t.px} x2={t.px} y1={height - AXIS_H} y2={height - AXIS_H + 6} stroke="var(--ink-faint)" />
            <text x={t.px} y={height - AXIS_H + 20} fontSize={11} textAnchor="middle" fill="var(--ink-soft)">
              {t.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
