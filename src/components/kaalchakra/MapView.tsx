'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import basemap from '@/data/basemap/south-asia.json';
import GradeBadge from '@/components/GradeBadge';
import { KIND_LABELS } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import { clusterPoints, type Cluster } from '@/lib/geo/cluster';
import { boundsOf, fitBounds, kmPerPixel, mercatorY, project, viewBounds, type MapView as View, type Size } from '@/lib/geo/projection';
import { formatInCalendar, type CalendarSystem } from '@/lib/time';
import { segmentOf, unitToYear, yearToUnit } from '@/lib/time/scale';
import {
  MIN_SPAN,
  REGIONS,
  TIME_ZOOMS,
  TIME_ZOOM_LABELS,
  clampTime,
  clampToMap,
  extentsAt,
  isPreset,
  maxSpanFor,
  panRegion,
  stepTime,
  timeWindow,
  zoomRegion,
  type MapRegion,
  type RegionId,
  type TimeZoom,
} from './mapState';
import { formatDating, kindColor, primaryDating } from './shared';
import { niceStep } from './ticks';

/** Markers closer than this, in pixels, are drawn as one numbered cluster. */
const CLUSTER_RADIUS = 26;
/** Movement in pixels before a mouse or pen press becomes a drag. */
const DRAG_PX = 4;
/** Movement in pixels before a finger press stops being a tap; a finger drifts further than a mouse. */
const TAP_SLOP_PX = 10;
/** Slider resolution along the piecewise time axis. */
const SLIDER_MAX = 2000;
const LABEL_CHAR_PX = 6.3;
/** Extent names are set larger and bolder than marker names. */
const EXTENT_CHAR_PX = 7.2;
/** Above this many single markers, names are left to the tooltip and the list. */
const MAX_LABELLED = 70;
/** How long the two-finger hint stays up after a one-finger drag on a touch screen. */
const GESTURE_HINT_MS = 1600;

/** Orientation labels, drawn only when their point is in view. */
const WATERS: { name: string; lon: number; lat: number }[] = [
  { name: 'Arabian Sea', lon: 64.5, lat: 15.5 },
  { name: 'Bay of Bengal', lon: 89, lat: 14.5 },
  { name: 'Indian Ocean', lon: 77, lat: 1.5 },
];

/** Canvas size for a container width: taller on phones, where the subcontinent would otherwise be tiny. */
export function mapSizeFor(width: number): Size {
  const w = Math.max(280, Math.floor(width));
  return { width: w, height: Math.round(w < 520 ? w * 1.05 : Math.min(580, Math.max(380, w * 0.66))) };
}

export interface MapViewProps {
  /** Entries with a place that pass the filters and the time window, in time order. */
  items: KcItem[];
  /** Entries that pass the filters and the time window and carry an extent, placed or not. */
  extentItems: KcItem[];
  /** Entries that pass the filters and the time window but have no recorded place. */
  unplaced: number;
  lens: Lens;
  cal: CalendarSystem;
  selectedId: string | null;
  t: number | null;
  zoom: TimeZoom;
  region: MapRegion;
  /** The region resolved for the current canvas. */
  view: View;
  size: Size;
  onSize: (size: Size) => void;
  onTime: (t: number | null) => void;
  onZoom: (zoom: TimeZoom) => void;
  onRegion: (region: MapRegion) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX: number, clientY: number) => void;
}

interface Placed {
  item: KcItem;
  x: number;
  y: number;
  /** Placed only by traditional reckoning in the current lens. */
  trad: boolean;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * One focusable thing on the map: a single marker or a numbered cluster. Both are kept in one list in time
 * order (a cluster by its earliest member) with stable keys, so selecting, panning or zooming never moves
 * the focused element in the DOM. When panning or zooming does unmount it (it joins or leaves a cluster, or
 * leaves the view), focus moves to the node that now holds its entries, or to the map's keyboard owner.
 */
type MapNode = { kind: 'one'; key: string; p: Placed } | { kind: 'many'; key: string; c: Cluster };

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function graticuleStep(span: number): number {
  return span > 50 ? 10 : span > 20 ? 5 : span > 8 ? 2 : 1;
}

/** Midpoint and spread of the first two tracked pointers. */
function pinchOf(points: ReadonlyMap<number, { x: number; y: number }>) {
  const [p, q] = [...points.values()];
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, dist: Math.max(10, Math.hypot(p.x - q.x, p.y - q.y)) };
}

/** At most half the clustering radius, so two cluster markers can never overlap. */
function clusterRadius(n: number): number {
  return Math.min(CLUSTER_RADIUS / 2, 9 + 1.1 * Math.sqrt(n));
}

export default function MapView({ items, extentItems, unplaced, lens, cal, selectedId, t, zoom, region, view, size, onSize, onTime, onZoom, onRegion, onSelect, onHover }: MapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Handlers read these synchronously so consecutive pointer events never start from a stale view.
  const regionRef = useRef(region);
  const sizeRef = useRef(size);
  useLayoutEffect(() => {
    regionRef.current = region;
    sizeRef.current = size;
  }, [region, size]);
  const pointers = useRef(new Map<number, { x: number; y: number; touch: boolean }>());
  /**
   * The gesture in progress. `touch` marks a single finger, which never moves the map: it is left to scroll the
   * page, so the map cannot trap a reader scrolling past it. Two fingers pan and pinch; a mouse or pen drags.
   */
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean; touch: boolean; pinch?: number } | null>(null);
  /** Members of a cluster that zooming cannot separate, with the context they were opened in. */
  const [open, setOpen] = useState<{ ids: string[]; key: string; viaKeyboard: boolean } | null>(null);
  /** The marker, cluster or cluster-list entry that has focus, and the entries it stands for. */
  const lastFocus = useRef<{ el: Element; ids: readonly string[] } | null>(null);
  const openListRef = useRef<HTMLUListElement>(null);
  /** The "use two fingers" hint, shown briefly when one finger drags across the map on a touch screen. */
  const [gestureHint, setGestureHint] = useState(false);
  /**
   * Whether the list of every entry on the map is expanded. Its rows are rendered only then: the list holds every
   * matching entry, several thousand nodes at the full archive, and keeping them in the DOM while collapsed made
   * every zoom, pan and selection re-render them.
   */
  const [listOpen, setListOpen] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedDomId = `${useId()}-selected`;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => onSize(mapSizeFor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSize]);

  // Pinch on a trackpad (ctrlKey) or Ctrl and scroll zooms about the pointer; plain scrolling is left to the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      const next = zoomRegion(regionRef.current, sizeRef.current, Math.exp(Math.max(-1, Math.min(1, e.deltaY * k * 0.01))), { x: e.clientX - rect.left, y: e.clientY - rect.top });
      regionRef.current = next;
      onRegion(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onRegion]);

  // One finger scrolls the page (touch-action: pan-y); two fingers belong to the map. Cancelling the two-finger
  // touchmove stops the browser from scrolling or zooming the page, so the pointer events keep arriving.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length >= 2 && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchstart', onTouch, { passive: false });
    el.addEventListener('touchmove', onTouch, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchmove', onTouch);
    };
  }, []);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const flashGestureHint = useCallback(() => {
    setGestureHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setGestureHint(false), GESTURE_HINT_MS);
  }, []);

  const { width, height } = size;
  const k = width / view.span;
  const contextKey = `${view.lon.toFixed(4)},${view.lat.toFixed(4)},${view.span.toFixed(4)}|${t}|${zoom}|${lens}|${items.length}`;

  const layout = useMemo(() => {
    const placed: Placed[] = [];
    let outside = 0;
    for (const item of items) {
      const p = project(view, size, item.place!.lon, item.place!.lat);
      if (p.x < 0 || p.x > size.width || p.y < 0 || p.y > size.height) {
        outside++;
        continue;
      }
      placed.push({ item, x: p.x, y: p.y, trad: primaryDating(item, lens)?.lens === 'tradition' });
    }
    const byId = new Map(placed.map((p) => [p.item.id, p]));
    const selected = selectedId ? byId.get(selectedId) : undefined;
    // The selected entry is always drawn on its own, so it is never hidden inside a cluster.
    const clusters = clusterPoints(
      placed.filter((p) => p !== selected).map((p) => ({ id: p.item.id, x: p.x, y: p.y })),
      CLUSTER_RADIUS,
    );
    const singles = clusters.filter((c) => c.ids.length === 1).map((c) => byId.get(c.ids[0])!);
    const groups = clusters.filter((c) => c.ids.length > 1);
    const order = new Map(items.map((it, i) => [it.id, i]));
    const nodes: MapNode[] = [
      ...[...singles, ...(selected ? [selected] : [])].map((p): MapNode => ({ kind: 'one', key: p.item.id, p })),
      ...groups.map((c): MapNode => ({ kind: 'many', key: `cluster:${c.ids[0]}`, c })),
    ].sort((a, b) => order.get(a.kind === 'one' ? a.p.item.id : a.c.ids[0])! - order.get(b.kind === 'one' ? b.p.item.id : b.c.ids[0])!);

    // Greedy name labels: the selected entry first, then time order; a label is dropped if it would
    // cover a marker, a cluster or an earlier label, or leave the canvas.
    const boxes: Box[] = [
      ...singles.map((p) => ({ x0: p.x - 7, y0: p.y - 7, x1: p.x + 7, y1: p.y + 7 })),
      ...groups.map((c) => {
        const r = clusterRadius(c.ids.length);
        return { x0: c.x - r, y0: c.y - r, x1: c.x + r, y1: c.y + r };
      }),
    ];
    if (selected) boxes.push({ x0: selected.x - 13, y0: selected.y - 13, x1: selected.x + 13, y1: selected.y + 13 });
    const labels: { id: string; x: number; y: number; anchor: 'start' | 'end'; text: string; active: boolean }[] = [];
    const candidates = [...(selected ? [selected] : []), ...(singles.length <= MAX_LABELLED ? singles : [])];
    for (const p of candidates) {
      const w = p.item.name.length * LABEL_CHAR_PX;
      // The selected marker carries a ring, so its label starts further out.
      const gap = p === selected ? 16 : 10;
      const own = (b: Box) => b.x0 < p.x && b.x1 > p.x && b.y0 < p.y && b.y1 > p.y;
      for (const anchor of ['start', 'end'] as const) {
        const x0 = anchor === 'start' ? p.x + gap : p.x - gap - w;
        const box = { x0, y0: p.y - 8, x1: x0 + w, y1: p.y + 8 };
        if (box.x0 < 4 || box.x1 > size.width - 4 || box.y0 < 4 || box.y1 > size.height - 4) continue;
        if (boxes.some((b) => !own(b) && overlaps(b, box))) continue;
        boxes.push(box);
        labels.push({ id: p.item.id, x: anchor === 'start' ? p.x + gap : p.x - gap, y: p.y + 4, anchor, text: p.item.name, active: p === selected });
        break;
      }
    }
    return { byId, selected, nodes, labels, boxes, outside };
  }, [items, lens, selectedId, view, size]);

  const extents = useMemo(
    () =>
      extentItems.flatMap((item) =>
        extentsAt(item, lens, t, zoom).map((x, i) => {
          const pts = x.polygon.map(([lon, lat]) => project(view, size, lon, lat));
          const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
          const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
          const label = x.label ? `${item.name}: ${x.label}` : item.name;
          const xs = pts.map((p) => p.x);
          return { key: `${item.id}-${i}`, item, d: `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`, cx, cy, label, span: Math.max(...xs) - Math.min(...xs) };
        }),
      ),
    [extentItems, lens, t, zoom, view, size],
  );

  // When the arrow keys step the selection while a marker has focus, focus follows the selected marker.
  useEffect(() => {
    const svg = svgRef.current;
    const active = document.activeElement;
    if (!svg || !selectedId || !(active instanceof SVGElement) || !svg.contains(active) || active.dataset.key === selectedId) return;
    svg.querySelector<SVGGElement>(`[data-key="${CSS.escape(selectedId)}"]`)?.focus();
  }, [selectedId]);

  // A cluster opened from the keyboard moves focus into its list of members.
  useEffect(() => {
    if (open?.viaKeyboard) openListRef.current?.querySelector('button')?.focus();
  }, [open]);

  const bounds = viewBounds(view, size);
  const step = graticuleStep(view.span);
  const meridians: number[] = [];
  for (let lon = Math.ceil(bounds.west / step) * step; lon <= bounds.east; lon += step) meridians.push(lon);
  const parallels: number[] = [];
  for (let lat = Math.ceil(bounds.south / step) * step; lat <= bounds.north; lat += step) parallels.push(lat);

  const kmPx = kmPerPixel(view, size);
  const barKm = niceStep(kmPx * Math.min(110, width * 0.28));
  const barPx = barKm / kmPx;

  const waters = WATERS.map((w) => ({ ...w, ...project(view, size, w.lon, w.lat) })).filter((w) => w.x > 50 && w.x < width - 50 && w.y > 30 && w.y < height - 40);
  /** A graticule label is left out where it would sit under a marker, a cluster, a name, a sea's name or the scale bar. */
  const taken: Box[] = [
    ...layout.boxes,
    ...waters.map((w) => ({ x0: w.x - w.name.length * 4.2, y0: w.y - 12, x1: w.x + w.name.length * 4.2, y1: w.y + 4 })),
    { x0: 0, y0: height - 37, x1: barPx + 22, y1: height },
  ];
  const gridLabelFree = (box: Box) => !taken.some((b) => overlaps(b, box));
  /** An extent is named only where its name fits inside the outline and covers no marker, cluster or other name. */
  const extentLabelShown = (x: { cx: number; cy: number; label: string; span: number }) => {
    const half = (x.label.length * EXTENT_CHAR_PX) / 2;
    const box = { x0: x.cx - half, y0: x.cy - 12, x1: x.cx + half, y1: x.cy + 4 };
    return 2 * half < x.span && box.x0 > 4 && box.x1 < width - 4 && box.y0 > 4 && box.y1 < height - 4 && !layout.boxes.some((b) => overlaps(b, box));
  };

  const commit = (next: View) => {
    regionRef.current = next;
    onRegion(next);
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
    // Touch captures implicitly to the marker under the finger, which can unmount while panning.
    const target = e.target as Element;
    if (target !== e.currentTarget && target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    const touch = e.pointerType === 'touch';
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, touch });
    if (pointers.current.size >= 2) {
      const m = pinchOf(pointers.current);
      drag.current = { x: m.x, y: m.y, sx: m.x, sy: m.y, moved: true, touch: false, pinch: m.dist };
      setGestureHint(false);
      for (const id of pointers.current.keys()) capture(e.currentTarget, id);
    } else drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, touch };
  };

  const endPointer = useCallback((id: number) => {
    if (!pointers.current.delete(id)) return;
    const rest = [...pointers.current.values()];
    if (rest.length >= 2) {
      const m = pinchOf(pointers.current);
      drag.current = { x: m.x, y: m.y, sx: m.x, sy: m.y, moved: true, touch: false, pinch: m.dist };
    } else if (rest.length === 1) {
      // The finger left after a pinch stays still: one finger never pans.
      drag.current = { x: rest[0].x, y: rest[0].y, sx: rest[0].x, sy: rest[0].y, moved: true, touch: rest[0].touch };
    } else {
      // Cleared after the click that follows pointerup, so a drag never also selects.
      const d = drag.current;
      setTimeout(() => {
        if (drag.current === d) drag.current = null;
      }, 0);
    }
  }, []);

  // A finger that lands on a marker or the basemap is not captured (see onPointerDown), so it can lift outside the
  // map, where the SVG never sees its pointerup. Every pointer therefore ends here, wherever it ends; otherwise it
  // would stay tracked and every later touch would count as a second finger.
  useEffect(() => {
    const onUp = (e: PointerEvent) => endPointer(e.pointerId);
    const onCancel = (e: PointerEvent) => {
      // The browser took a one-finger touch to scroll the page, which is what it is for; remind how to move the map.
      if (drag.current?.touch && pointers.current.size === 1 && pointers.current.has(e.pointerId)) flashGestureHint();
      endPointer(e.pointerId);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [endPointer, flashGestureHint]);

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) return endPointer(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' });
    const rect = e.currentTarget.getBoundingClientRect();
    if (pointers.current.size >= 2 && d.pinch !== undefined) {
      const m = pinchOf(pointers.current);
      const zoomed = zoomRegion(regionRef.current, sizeRef.current, d.pinch / m.dist, { x: m.x - rect.left, y: m.y - rect.top });
      commit(panRegion(zoomed, sizeRef.current, m.x - d.x, m.y - d.y));
      d.pinch = m.dist;
      d.x = m.x;
      d.y = m.y;
      return;
    }
    if (d.touch) {
      // A sideways one-finger drag, which the page does not scroll: say how to move the map instead.
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP_PX) {
        d.moved = true;
        flashGestureHint();
      }
      return;
    }
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <= DRAG_PX) return;
      d.moved = true;
      capture(e.currentTarget, e.pointerId);
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (dx || dy) commit(panRegion(regionRef.current, sizeRef.current, dx, dy));
  };

  const onLostPointerCapture = (e: React.PointerEvent<SVGSVGElement>) => {
    // lostpointercapture bubbles; only the SVG's own capture ending matters here.
    if (e.target === e.currentTarget) endPointer(e.pointerId);
  };

  const click = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const clickCluster = (c: Cluster, viaKeyboard = false) => {
    if (!viaKeyboard && drag.current?.moved) return;
    const b = boundsOf(c.ids.map((id) => layout.byId.get(id)!.item.place!));
    if (b) {
      const fitted = clampToMap(fitBounds(b, size, Math.min(70, width / 5)), size);
      const p = project(fitted, size, b.west, b.south);
      const q = project(fitted, size, b.east, b.north);
      // Zoom in only when that would pull the members apart; places a few hundred metres apart never separate.
      if (fitted.span < view.span * 0.95 && Math.hypot(p.x - q.x, p.y - q.y) > CLUSTER_RADIUS * 1.5) return commit(fitted);
    }
    setOpen({ ids: c.ids, key: contextKey, viaKeyboard });
  };

  /** Enter and Space activate a focused marker or cluster, as they would a button. */
  const activateKey = (e: React.KeyboardEvent, activate: () => void) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    activate();
  };

  /** A focused marker shows the same tooltip as a hovered one, anchored to the marker. */
  const focusTip = (e: React.FocusEvent<SVGGElement>, id: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    onHover(id, r.left + r.width / 2, r.top + r.height / 2 - 6);
  };

  const noteFocus = (el: Element, ids: readonly string[]) => {
    lastFocus.current = { el, ids };
  };

  /** Focus that moves on, or a click elsewhere, forgets the record; an element that blurs because it unmounted keeps it. */
  const noteBlur = (e: React.FocusEvent) => {
    const el = e.target;
    queueMicrotask(() => {
      if (lastFocus.current?.el === el && el.isConnected) lastFocus.current = null;
    });
  };

  const moment = t === null ? null : formatInCalendar(t, cal);
  const win = t === null ? null : timeWindow(t, zoom);
  const windowText =
    t === null || !win
      ? 'all time'
      : zoom === 'era'
        ? `${segmentOf(t).label}, ${formatInCalendar(win.from, cal)} to ${formatInCalendar(win.to, cal)}`
        : `within ${(win.to - win.from) / 2} years of ${moment}`;
  const status = `${items.length} ${items.length === 1 ? 'entry' : 'entries'} on the map, ${t === null ? 'all time' : `dated ${windowText}`}.`;
  const sliderValue = Math.round(yearToUnit(t ?? unitToYear(1)) * SLIDER_MAX);
  const regionValue: RegionId | 'custom' = isPreset(region) ? region.preset : 'custom';
  const openIds = open && open.key === contextKey ? open.ids : null;
  const shownInView = items.length - layout.outside;

  // When the focused marker, cluster or cluster-list entry unmounts (it joined or left a cluster, left the view, or
  // the list closed), focus moves to the node that now holds its entries, or to the map's keyboard owner.
  useEffect(() => {
    const f = lastFocus.current;
    const svg = svgRef.current;
    if (!f || f.el.isConnected || !svg) return;
    lastFocus.current = null;
    if (document.activeElement && document.activeElement !== document.body) return;
    const want = new Set(f.ids);
    const node = layout.nodes.find((n) => (n.kind === 'one' ? want.has(n.p.item.id) : n.c.ids.some((id) => want.has(id))));
    const target = node ? svg.querySelector<SVGGElement>(`[data-key="${CSS.escape(node.key)}"]`) : wrapRef.current?.closest<HTMLElement>('[tabindex]');
    target?.focus();
  }, [layout, openIds]);

  const markerLabel = (p: Placed, active: boolean) => {
    const d = primaryDating(p.item, lens);
    return [p.item.name, d ? formatDating(d, cal) : null, KIND_LABELS[p.item.kind], p.trad ? 'traditional reckoning' : null, active ? 'selected' : null].filter(Boolean).join(', ');
  };

  const marker = (p: Placed) => {
    const active = p === layout.selected;
    const color = p.trad ? 'var(--gold)' : kindColor(p.item.kind);
    return (
      <g
        key={p.item.id}
        id={active ? selectedDomId : undefined}
        className="kc-mark"
        role="button"
        tabIndex={0}
        aria-label={markerLabel(p, active)}
        aria-current={active || undefined}
        data-active={active}
        data-id={p.item.id}
        data-key={p.item.id}
        onClick={() => click(p.item.id)}
        onKeyDown={(e) => activateKey(e, () => onSelect(p.item.id))}
        onFocus={(e) => {
          noteFocus(e.currentTarget, [p.item.id]);
          focusTip(e, p.item.id);
        }}
        onBlur={(e) => {
          noteBlur(e);
          onHover(null, 0, 0);
        }}
        onPointerEnter={(e) => onHover(p.item.id, e.clientX, e.clientY)}
        onPointerLeave={(e) => onHover(null, e.clientX, e.clientY)}
      >
        <circle className="kc-map-focus" cx={p.x} cy={p.y} r={active ? 16 : 10.5} />
        {active ? <circle cx={p.x} cy={p.y} r={12} fill="none" stroke="var(--ink)" strokeWidth={2} /> : null}
        <circle cx={p.x} cy={p.y} r={active ? 7.5 : 6} fill={p.trad ? 'var(--map-land)' : color} stroke={p.trad ? color : 'var(--map-land)'} strokeWidth={p.trad ? 2.4 : 1.4} />
        <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
      </g>
    );
  };

  const cluster = (c: Cluster, key: string) => {
    const r = clusterRadius(c.ids.length);
    const first = layout.byId.get(c.ids[0])?.item.name;
    return (
      <g
        key={key}
        className="kc-map-cluster"
        role="button"
        tabIndex={0}
        aria-label={`${c.ids.length} entries close together, among them ${first}. Zoom in to separate them.`}
        data-count={c.ids.length}
        data-key={key}
        onClick={() => clickCluster(c)}
        onKeyDown={(e) => activateKey(e, () => clickCluster(c, true))}
        onFocus={(e) => noteFocus(e.currentTarget, c.ids)}
        onBlur={noteBlur}
      >
        <circle className="kc-map-focus" cx={c.x} cy={c.y} r={Math.max(r, 14) + 3} />
        <circle className="kc-map-cluster__dot" cx={c.x} cy={c.y} r={r} />
        <text x={c.x} y={c.y + 3.8} textAnchor="middle" aria-hidden="true">
          {c.ids.length}
        </text>
        <circle cx={c.x} cy={c.y} r={Math.max(r, 14)} fill="transparent" stroke="none" />
      </g>
    );
  };

  return (
    <div className="kc-map" ref={wrapRef}>
      <div className="kc-map-time" role="group" aria-label="Time scrubber">
        <button type="button" className="chip" aria-pressed={t === null} onClick={() => onTime(null)}>
          All time
        </button>
        <button type="button" className="btn kc-map-btn" onClick={() => onTime(stepTime(t ?? clampTime(unitToYear(1)), -1, zoom))}>
          Earlier
        </button>
        <input
          type="range"
          className="kc-map-slider"
          name="moment"
          min={0}
          max={SLIDER_MAX}
          step={1}
          value={sliderValue}
          aria-label="Moment in time"
          aria-valuetext={moment ?? 'All time'}
          data-all-time={t === null}
          onChange={(e) => onTime(clampTime(unitToYear(Number(e.target.value) / SLIDER_MAX)))}
          onKeyDown={(e) => {
            // Arrow keys move by one window instead of one slider notch, so each press changes what is shown.
            const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
            if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            e.stopPropagation();
            onTime(stepTime(t ?? clampTime(unitToYear(1)), dir, zoom));
          }}
        />
        <button type="button" className="btn kc-map-btn" onClick={() => onTime(stepTime(t ?? clampTime(unitToYear(1)), 1, zoom))}>
          Later
        </button>
        <label className="kc-map-field">
          <span>Window</span>
          <select className="select" name="window" value={zoom} onChange={(e) => onZoom(e.target.value as TimeZoom)}>
            {TIME_ZOOMS.map((z) => (
              <option key={z} value={z}>
                {TIME_ZOOM_LABELS[z]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="kc-map-status" data-testid="map-status">
        <strong>{moment ?? 'All time'}</strong>
        <span>{status}</span>
      </p>
      <div className="kc-map-controls">
        <label className="kc-map-field">
          <span>Region</span>
          <select className="select" name="region" value={regionValue} onChange={(e) => e.target.value !== 'custom' && onRegion({ preset: e.target.value as RegionId })}>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
            {regionValue === 'custom' ? <option value="custom">Custom view</option> : null}
          </select>
        </label>
        <button type="button" className="btn kc-map-btn" onClick={() => commit(zoomRegion(region, size, 0.5))} aria-label="Zoom in" disabled={view.span <= MIN_SPAN}>
          +
        </button>
        <button type="button" className="btn kc-map-btn" onClick={() => commit(zoomRegion(region, size, 2))} aria-label="Zoom out" disabled={view.span >= maxSpanFor(size)}>
          -
        </button>
        <span className="kc-map-hint">
          <span className="kc-map-hint__pointer">Drag to move; pinch, Ctrl and scroll, or + and - to zoom. Tab to a marker and press Enter to open it; Shift and arrow keys move the map.</span>
          <span className="kc-map-hint__touch">Tap a marker to open it. Use two fingers to move or zoom the map.</span>
        </span>
      </div>
      <div className="kc-map-frame">
        <svg
          ref={svgRef}
          className="kc-map-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`Map of South Asia and its neighbours. ${status} Each marker and numbered cluster is a button; the list below the map gives the same entries.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onLostPointerCapture={onLostPointerCapture}
        >
          <rect width={width} height={height} fill="var(--map-sea)" />
          <g className="kc-map-base" aria-hidden="true" transform={`translate(${(width / 2 - view.lon * k).toFixed(2)} ${(height / 2 + mercatorY(view.lat) * k).toFixed(2)}) scale(${(k / basemap.scale).toFixed(6)})`}>
            <path d={basemap.land} fill="var(--map-land)" />
            <path d={basemap.coast} fill="none" stroke="var(--map-coast)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={basemap.lakes} fill="var(--map-sea)" />
            <path d={basemap.shores} fill="none" stroke="var(--map-coast)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
            <path d={basemap.riversMinor} fill="none" stroke="var(--map-river)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity={k < 12 ? 0.3 : k < 30 ? 0.6 : 0.9} />
            <path d={basemap.riversMajor} fill="none" stroke="var(--map-river)" strokeWidth={k < 12 ? 1 : 1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
          <g className="kc-map-grid" aria-hidden="true">
            {meridians.map((lon) => {
              const x = project(view, size, lon, 0).x;
              return (
                <g key={`m${lon}`}>
                  <line x1={x} x2={x} y1={0} y2={height} />
                  {x < width - 36 && gridLabelFree({ x0: x, y0: 2, x1: x + 32, y1: 15 }) ? <text x={x + 3} y={12}>{`${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`}</text> : null}
                </g>
              );
            })}
            {parallels.map((lat) => {
              const y = project(view, size, view.lon, lat).y;
              return (
                <g key={`p${lat}`}>
                  <line x1={0} x2={width} y1={y} y2={y} />
                  {y > 24 && y < height - 30 && gridLabelFree({ x0: 2, y0: y - 14, x1: lat === 0 ? 48 : 34, y1: y - 1 }) ? (
                    <text x={4} y={y - 3}>
                      {lat === 0 ? 'Equator' : `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
          <g className="kc-map-waters" aria-hidden="true">
            {waters.map((w) => (
              <text key={w.name} x={w.x} y={w.y} textAnchor="middle">
                {w.name}
              </text>
            ))}
          </g>
          {extents.map((x) => (
            <g
              key={x.key}
              className="kc-map-extent"
              role="button"
              tabIndex={0}
              aria-label={`${x.label}, approximate extent`}
              data-id={x.item.id}
              onClick={() => click(x.item.id)}
              onKeyDown={(e) => activateKey(e, () => onSelect(x.item.id))}
              onPointerEnter={(e) => onHover(x.item.id, e.clientX, e.clientY)}
              onPointerLeave={(e) => onHover(null, e.clientX, e.clientY)}
              style={{ color: kindColor(x.item.kind) }}
            >
              <path d={x.d} />
              {extentLabelShown(x) ? (
                <text x={x.cx} y={x.cy} textAnchor="middle" aria-hidden="true">
                  {x.label}
                </text>
              ) : null}
            </g>
          ))}
          {layout.nodes.map((n) => (n.kind === 'one' ? marker(n.p) : cluster(n.c, n.key)))}
          {/* The selected marker stays in time order for focus, and is drawn again here so nothing covers it. */}
          {layout.selected ? <use href={`#${selectedDomId}`} pointerEvents="none" aria-hidden="true" className="kc-map-selected" /> : null}
          <g pointerEvents="none" className="kc-map-labels" aria-hidden="true">
            {layout.labels.map((l) => (
              <text key={l.id} x={l.x} y={l.y} textAnchor={l.anchor} fontWeight={l.active ? 700 : 500}>
                {l.text}
              </text>
            ))}
          </g>
          <g className="kc-map-scale" transform={`translate(12 ${height - 14})`} aria-hidden="true">
            <rect x={-6} y={-21} width={barPx + 12} height={27} rx={4} />
            <path d={`M0 -5V0H${barPx.toFixed(1)}V-5`} />
            <text x={barPx / 2} y={-6} textAnchor="middle">{`${barKm.toLocaleString('en-US')} km`}</text>
          </g>
        </svg>
        <p className="kc-map-gesture" data-show={gestureHint} aria-hidden="true">
          Use two fingers to move or zoom the map
        </p>
      </div>
      {openIds ? (
        <div
          className="kc-map-open"
          role="group"
          aria-label={`${openIds.length} entries at this place`}
          onFocus={(e) => noteFocus(e.target, openIds)}
          onBlur={noteBlur}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(null);
          }}
        >
          <div className="kc-map-open__head">
            <strong>{openIds.length} entries at this place</strong>
            <button type="button" className="btn kc-map-btn" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <ul ref={openListRef}>
            {openIds.map((id) => {
              const it = layout.byId.get(id)?.item;
              if (!it) return null;
              const d = primaryDating(it, lens);
              return (
                <li key={id}>
                  <button type="button" className="chip" aria-pressed={id === selectedId} onClick={() => onSelect(id)} style={{ color: kindColor(it.kind) }}>
                    <span className="chip__dot" aria-hidden="true" />
                    <span className="kc-map-open__name">
                      {it.name}
                      {d ? `, ${formatDating(d, cal)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <details className="kc-map-list" onToggle={(e) => setListOpen(e.currentTarget.open)}>
        <summary>
          List of the {items.length} {items.length === 1 ? 'entry' : 'entries'} on this map
        </summary>
        {!listOpen ? null : items.length === 0 ? (
          <p className="empty">0 entries with a recorded place match these filters and this moment.</p>
        ) : (
          <ol className="kc-list kc-map-list__items">
            {items.map((it) => {
              const d = primaryDating(it, lens);
              return (
                <li key={it.id}>
                  <button type="button" onClick={() => onSelect(it.id)} aria-current={it.id === selectedId}>
                    <span className="kc-list__date">{d ? formatDating(d, cal) : ''}</span>
                    <span>
                      {it.name}
                      <br />
                      <span className="kc-list__kind">
                        {it.place!.name} ({KIND_LABELS[it.kind]})
                      </span>
                    </span>
                    {d ? <GradeBadge grade={d.grade} showLabel={false} /> : <span />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </details>
      <div className="kc-scale-note">
        <p>
          {shownInView} of {items.length} {items.length === 1 ? 'entry is' : 'entries are'} inside this view
          {layout.outside ? `; ${layout.outside} ${layout.outside === 1 ? 'lies outside it and is' : 'lie outside it and are'} in the list` : ''}.{' '}
          {unplaced} matching {unplaced === 1 ? 'entry has' : 'entries have'} no recorded place and {unplaced === 1 ? 'is' : 'are'} not on the map.
        </p>
        <p>
          Filled markers are placed by scholarly dating and gold rings by traditional reckoning. A moment shows entries whose dating overlaps the window, not everything that stood at that time.
          {extents.length ? ' Dashed outlines are approximate extents; each carries its own grade and sources on the entry page.' : ''}
        </p>
        <p>
          Basemap made with Natural Earth (public domain): land, lakes and rivers only, with no modern political boundaries. The scale bar is measured at the centre of the view; this projection
          (Mercator) stretches distances further north.
        </p>
      </div>
    </div>
  );
}
