/**
 * Pure state helpers for the Map view: the time scrubber (`t` and `zoom` in the URL) and the map
 * viewport (`region` in the URL). No DOM and no React, so all of it is unit tested.
 */

import type { KcExtent, KcItem, KcPlace } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import { PRESENT_YEAR } from '@/lib/time';
import { AXIS_START, SEGMENTS, SEGMENT_STARTS, segmentOf, unitToYear, yearToUnit } from '@/lib/time/scale';
import { clampView, containsPoint, fitBounds, maxSpanWithin, panView, viewBounds, zoomView, type Bounds, type MapView, type Size } from '@/lib/geo/projection';

/* ---------- Time ---------- */

/** How wide a "moment" is: the scrubber shows entries dated inside a window of this size around `t`. */
export const TIME_ZOOMS = ['era', 'millennium', 'century', 'decade'] as const;
export type TimeZoom = (typeof TIME_ZOOMS)[number];

export const DEFAULT_TIME_ZOOM: TimeZoom = 'century';

export const TIME_ZOOM_LABELS: Record<TimeZoom, string> = {
  era: 'Whole era',
  millennium: '1,000 years',
  century: '100 years',
  decade: '10 years',
};

/** Full width of the window in years; an era has no fixed width. */
const ZOOM_YEARS: Record<Exclude<TimeZoom, 'era'>, number> = { millennium: 1000, century: 100, decade: 10 };

/** The smallest move of the scrubber, as a share of the whole axis, so deep time stays reachable. */
const MIN_UNIT_STEP = 0.004;

export interface TimeWindow {
  from: number;
  to: number;
}

/** The scrubber never leaves the axis and never runs past the present. */
export function clampTime(t: number): number {
  return Math.round(Math.min(PRESENT_YEAR, Math.max(AXIS_START, t)));
}

/** The window of years shown for a moment: the whole scale segment for "era", else t plus or minus half the width. */
export function timeWindow(t: number, zoom: TimeZoom): TimeWindow {
  if (zoom === 'era') {
    const seg = segmentOf(t);
    return { from: seg.from, to: Math.min(seg.to, PRESENT_YEAR) };
  }
  const half = ZOOM_YEARS[zoom] / 2;
  return { from: t - half, to: t + half };
}

/**
 * The next moment in direction `dir`. Steps are one window wide, except where a window is too small
 * to see on the piecewise axis (deep time), where the step is a fixed share of the axis instead.
 * "era" jumps to the middle of the neighbouring segment.
 */
export function stepTime(t: number, dir: -1 | 1, zoom: TimeZoom): number {
  if (zoom === 'era') {
    const i = SEGMENTS.indexOf(segmentOf(t));
    const j = Math.min(SEGMENTS.length - 1, Math.max(0, i + dir));
    if (j === i) return clampTime(t);
    return clampTime(unitToYear(SEGMENT_STARTS[j] + SEGMENTS[j].share / 2));
  }
  const u = yearToUnit(t);
  const byYears = t + dir * ZOOM_YEARS[zoom];
  const moved = Math.abs(yearToUnit(byYears) - u);
  return clampTime(moved >= MIN_UNIT_STEP ? byYears : unitToYear(Math.min(1, Math.max(0, u + dir * MIN_UNIT_STEP))));
}

interface Dated {
  datings: readonly { lens: 'scholarship' | 'tradition'; earliest: number; latest: number }[];
}

/** True when any dating of the item that is visible in the lens overlaps the window. */
export function datedWithin(item: Dated, lens: Lens, win: TimeWindow): boolean {
  return item.datings.some((d) => (lens === 'both' || d.lens === lens) && d.earliest <= win.to && d.latest >= win.from);
}

/** Entries shown for a moment: everything when `t` is null (all time), else those dated inside the window. */
export function entriesAt<T extends Dated>(items: readonly T[], lens: Lens, t: number | null, zoom: TimeZoom): T[] {
  if (t === null) return [...items];
  const win = timeWindow(t, zoom);
  return items.filter((i) => datedWithin(i, lens, win));
}

/**
 * Extents of an item to draw for a moment. An extent with its own years is tested against the window;
 * one without is drawn whenever the item itself is shown. Extents follow the lens like datings do.
 */
export function extentsAt(item: Pick<KcItem, 'extents'>, lens: Lens, t: number | null, zoom: TimeZoom): KcExtent[] {
  const win = t === null ? null : timeWindow(t, zoom);
  return (item.extents ?? []).filter((x) => {
    if (lens !== 'both' && x.lens !== lens) return false;
    if (!win || x.from === undefined || x.to === undefined) return true;
    return x.from <= win.to && x.to >= win.from;
  });
}

/* ---------- Space ---------- */

/** The basemap extent (`bounds` in src/data/basemap/south-asia.json); no view ever shows anything outside it. */
export const MAP_LIMITS: Bounds = { west: 0, east: 140, south: -20, north: 62 };
/** Closest and widest zoom, in degrees of longitude across the canvas. A tall canvas is held narrower; see maxSpanFor. */
export const MIN_SPAN = 1.5;
export const MAX_SPAN = 120;

/** The widest view on a canvas of this size that still shows only the basemap. */
export function maxSpanFor(size: Size): number {
  return Math.min(MAX_SPAN, maxSpanWithin(MAP_LIMITS, size));
}

/** A view kept within the zoom limits and inside the basemap on a canvas of this size. */
export function clampToMap(view: MapView, size: Size): MapView {
  return clampView(view, size, MAP_LIMITS, MIN_SPAN, MAX_SPAN);
}

export const REGIONS = [
  { id: 'subcontinent', label: 'Subcontinent', bounds: { west: 60, east: 98, south: 5, north: 38 } },
  { id: 'wide', label: 'South Asia and neighbours', bounds: { west: 26, east: 110, south: 1, north: 46 } },
  { id: 'northwest', label: 'Northwest and the Indus', bounds: { west: 60, east: 78, south: 23, north: 37.5 } },
  { id: 'ganga', label: 'Gangetic plain', bounds: { west: 73, east: 90, south: 21, north: 32 } },
  { id: 'west', label: 'Western India', bounds: { west: 66, east: 78, south: 14, north: 26 } },
  { id: 'deccan', label: 'Deccan', bounds: { west: 72, east: 86, south: 12, north: 22 } },
  { id: 'south', label: 'South and Sri Lanka', bounds: { west: 73, east: 82.5, south: 5.5, north: 15 } },
  { id: 'east', label: 'East and northeast', bounds: { west: 82, east: 98, south: 16, north: 29 } },
] as const satisfies readonly { id: string; label: string; bounds: Bounds }[];

export type RegionId = (typeof REGIONS)[number]['id'];

export const DEFAULT_REGION: RegionId = 'subcontinent';

/** The viewport in state and in the URL: a named region, or a free view after panning or zooming. */
export type MapRegion = { preset: RegionId } | MapView;

export function isPreset(r: MapRegion): r is { preset: RegionId } {
  return 'preset' in r;
}

export function regionBounds(id: RegionId): Bounds {
  return REGIONS.find((r) => r.id === id)!.bounds;
}

/** `region=ganga` for a named region, `region=78.50,22.00,40.0` (lon, lat, span) for a free view. */
export function serialiseRegion(r: MapRegion): string {
  return isPreset(r) ? r.preset : `${r.lon.toFixed(2)},${r.lat.toFixed(2)},${r.span.toFixed(1)}`;
}

export function parseRegion(raw: string | null): MapRegion | null {
  if (!raw) return null;
  if (REGIONS.some((r) => r.id === raw)) return { preset: raw as RegionId };
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lon, lat, span] = parts;
  if (span <= 0) return null;
  // The view is fitted to the canvas when it is resolved; here only values no canvas could show are pulled in.
  return {
    lon: Math.min(MAP_LIMITS.east, Math.max(MAP_LIMITS.west, lon)),
    lat: Math.min(MAP_LIMITS.north, Math.max(MAP_LIMITS.south, lat)),
    span: Math.min(MAX_SPAN, Math.max(MIN_SPAN, span)),
  };
}

/** Pixels kept clear around a named region so markers on its edge are not cut off. */
const REGION_PADDING = 12;

/** The concrete view for a region on a canvas of the given size. */
export function resolveRegion(r: MapRegion, size: Size): MapView {
  return clampToMap(isPreset(r) ? fitBounds(regionBounds(r.preset), size, REGION_PADDING) : r, size);
}

export function zoomRegion(r: MapRegion, size: Size, factor: number, focus?: { x: number; y: number }): MapView {
  return clampToMap(zoomView(resolveRegion(r, size), size, factor, focus), size);
}

export function panRegion(r: MapRegion, size: Size, dx: number, dy: number): MapView {
  return clampToMap(panView(resolveRegion(r, size), size, dx, dy), size);
}

/** Margin, in pixels, inside which a place counts as comfortably visible. */
const REVEAL_MARGIN = 24;

/** The region unchanged when it already shows the place, else the same zoom centred on the place. */
export function revealPlace(r: MapRegion, size: Size, place: KcPlace): MapRegion {
  const view = resolveRegion(r, size);
  const inner = { width: Math.max(1, size.width - 2 * REVEAL_MARGIN), height: Math.max(1, size.height - 2 * REVEAL_MARGIN) };
  // The same centre and scale on a canvas shrunk by the margin: its bounds are the comfortable area.
  const comfortable = viewBounds({ ...view, span: (view.span * inner.width) / size.width }, inner);
  if (containsPoint(comfortable, place.lon, place.lat)) return r;
  return clampToMap({ lon: place.lon, lat: place.lat, span: view.span }, size);
}

/** The first region to try for a deep link to a place: the default, or the wide one when the place lies outside it. */
export function regionFor(place: KcPlace | undefined): RegionId {
  if (!place) return DEFAULT_REGION;
  return containsPoint(regionBounds(DEFAULT_REGION), place.lon, place.lat) ? DEFAULT_REGION : 'wide';
}
