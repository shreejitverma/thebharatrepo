/**
 * Map projection and viewport arithmetic for the Kaalchakra Map view.
 *
 * The projection is spherical Mercator, expressed in degrees on both axes so that one projected unit
 * is one degree of longitude everywhere. It is conformal, which keeps coastlines and river courses in
 * their familiar shapes between the equator and about 48 N, the band the basemap covers. Mercator
 * stretches distance with latitude, so the view draws a scale bar computed at the centre latitude
 * instead of implying one scale for the whole canvas.
 *
 * Everything here is pure: no DOM, no state.
 */

export interface LonLat {
  lon: number;
  lat: number;
}

export interface Bounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * A viewport: the geographic point at the centre of the canvas and `span`, the degrees of longitude
 * across the full canvas width. A smaller span is a closer zoom.
 */
export interface MapView {
  lon: number;
  lat: number;
  span: number;
}

/** Mercator is unbounded at the poles; latitudes are clamped here before projecting. */
export const MAX_LAT = 85;

const RAD = Math.PI / 180;

/** Projected northing of a latitude, in degrees. mercatorY(0) is 0 and the function is odd. */
export function mercatorY(lat: number): number {
  const phi = Math.min(MAX_LAT, Math.max(-MAX_LAT, lat)) * RAD;
  return Math.log(Math.tan(Math.PI / 4 + phi / 2)) / RAD;
}

/** Inverse of mercatorY. */
export function inverseMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
}

/** Pixels per projected degree for a view on a canvas. */
export function pixelsPerDegree(view: MapView, size: Size): number {
  return size.width / view.span;
}

/** Geographic point to canvas pixels; the origin is the top left corner and y grows downward. */
export function project(view: MapView, size: Size, lon: number, lat: number): { x: number; y: number } {
  const k = pixelsPerDegree(view, size);
  return {
    x: size.width / 2 + (lon - view.lon) * k,
    y: size.height / 2 - (mercatorY(lat) - mercatorY(view.lat)) * k,
  };
}

/** Canvas pixels to geographic point; inverse of project. */
export function unproject(view: MapView, size: Size, x: number, y: number): LonLat {
  const k = pixelsPerDegree(view, size);
  return {
    lon: view.lon + (x - size.width / 2) / k,
    lat: inverseMercatorY(mercatorY(view.lat) - (y - size.height / 2) / k),
  };
}

/** The geographic rectangle visible on the canvas. */
export function viewBounds(view: MapView, size: Size): Bounds {
  const nw = unproject(view, size, 0, 0);
  const se = unproject(view, size, size.width, size.height);
  return { west: nw.lon, east: se.lon, south: se.lat, north: nw.lat };
}

export function containsPoint(b: Bounds, lon: number, lat: number): boolean {
  return lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
}

/**
 * The closest view that shows all of `b` on the canvas, with `padding` pixels kept clear on every side.
 * The centre is the middle of the bounds in projected space, so the bounds sit centred on screen.
 */
export function fitBounds(b: Bounds, size: Size, padding = 0): MapView {
  const w = Math.max(1, size.width - 2 * padding);
  const h = Math.max(1, size.height - 2 * padding);
  const yN = mercatorY(b.north);
  const yS = mercatorY(b.south);
  const lonSpan = Math.max(1e-9, b.east - b.west);
  const ySpan = Math.max(1e-9, yN - yS);
  // Pixels per degree is limited by whichever axis is tighter.
  const k = Math.min(w / lonSpan, h / ySpan);
  return { lon: (b.west + b.east) / 2, lat: inverseMercatorY((yN + yS) / 2), span: size.width / k };
}

/**
 * Keeps a view usable: span within [minSpan, maxSpan] and the centre inside `limits`, so the reader
 * can never pan the basemap entirely off the canvas.
 */
export function clampView(view: MapView, limits: Bounds, minSpan: number, maxSpan: number): MapView {
  return {
    lon: Math.min(limits.east, Math.max(limits.west, view.lon)),
    lat: Math.min(limits.north, Math.max(limits.south, view.lat)),
    span: Math.min(maxSpan, Math.max(minSpan, view.span)),
  };
}

/**
 * Zoom by `factor` (below 1 zooms in) keeping the geographic point under `focus` fixed on screen.
 * Without a focus the centre stays fixed.
 */
export function zoomView(view: MapView, size: Size, factor: number, focus?: { x: number; y: number }): MapView {
  const span = view.span * factor;
  if (!focus) return { ...view, span };
  const anchor = unproject(view, size, focus.x, focus.y);
  const k = size.width / span;
  return {
    lon: anchor.lon - (focus.x - size.width / 2) / k,
    lat: inverseMercatorY(mercatorY(anchor.lat) + (focus.y - size.height / 2) / k),
    span,
  };
}

/** Move the view so the content shifts by (dx, dy) pixels, as when dragging the map. */
export function panView(view: MapView, size: Size, dx: number, dy: number): MapView {
  const k = pixelsPerDegree(view, size);
  return { lon: view.lon - dx / k, lat: inverseMercatorY(mercatorY(view.lat) + dy / k), span: view.span };
}

/** Mean Earth radius times one degree, in kilometres. */
const KM_PER_DEGREE = 111.195;

/** Ground distance covered by one pixel at the centre latitude of the view. */
export function kmPerPixel(view: MapView, size: Size): number {
  return (KM_PER_DEGREE * Math.cos(view.lat * RAD)) / pixelsPerDegree(view, size);
}

/** Geographic bounds of a set of points, or null for an empty set. */
export function boundsOf(points: readonly LonLat[]): Bounds | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return { west, east, south, north };
}
