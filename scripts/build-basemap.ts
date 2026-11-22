/**
 * Builds the offline basemap for the Kaalchakra Map view from Natural Earth vector data.
 *
 * Usage: tsx scripts/build-basemap.ts <directory holding the Natural Earth GeoJSON files>
 *
 * Inputs (public domain, https://www.naturalearthdata.com, GeoJSON from
 * https://github.com/nvkelso/natural-earth-vector/tree/master/geojson):
 *   ne_50m_land.geojson
 *   ne_50m_lakes.geojson
 *   ne_10m_rivers_lake_centerlines.geojson
 *
 * Output: src/data/basemap/south-asia.json, a few SVG path strings already projected to the Mercator
 * used by src/lib/geo/projection.ts, so the client only applies one transform. The output is committed;
 * this script is run by hand only when the basemap extent or detail changes.
 *
 * Land and lakes are clipped to the bounds, so their filled rings run along the bounds where they are cut.
 * Those cuts are not coastlines: the stroked `coast` and `shores` paths are the same rings without them.
 *
 * Only physical features are kept: land, large lakes and rivers. No political boundary is read or
 * drawn, because modern borders are anachronistic for most of the archive and contested in places.
 */

import fs from 'node:fs';
import path from 'node:path';
import { mercatorY, type Bounds } from '../src/lib/geo/projection';

type Pt = [number, number];

/** Everything the map can ever show. */
const BOUNDS: Bounds = { west: 24, east: 112, south: -4, north: 48 };
/** The subcontinent, where readers zoom in and detail matters. */
const CORE: Bounds = { west: 58, east: 100, south: 3, north: 40 };
/** Simplification tolerances and minimum ring areas, in degrees and square degrees. */
const FINE = { tolerance: 0.02, minArea: 0.003 };
const COARSE = { tolerance: 0.1, minArea: 0.05 };
/** Projected units per degree in the output paths. */
const SCALE = 100;

const dir = process.argv[2];
if (!dir) {
  console.error('usage: tsx scripts/build-basemap.ts <natural-earth-geojson-dir>');
  process.exit(1);
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

function read(name: string): Feature[] {
  return (JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as { features: Feature[] }).features;
}

const inCore = (p: Pt) => p[0] >= CORE.west && p[0] <= CORE.east && p[1] >= CORE.south && p[1] <= CORE.north;
const inBounds = (p: Pt) => p[0] >= BOUNDS.west && p[0] <= BOUNDS.east && p[1] >= BOUNDS.south && p[1] <= BOUNDS.north;

/** Sutherland-Hodgman clip of a closed ring against the basemap rectangle. */
function clipRing(ring: Pt[]): Pt[] {
  const edges: { inside: (p: Pt) => boolean; cut: (a: Pt, b: Pt) => Pt }[] = [
    { inside: (p) => p[0] >= BOUNDS.west, cut: (a, b) => [BOUNDS.west, a[1] + ((b[1] - a[1]) * (BOUNDS.west - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= BOUNDS.east, cut: (a, b) => [BOUNDS.east, a[1] + ((b[1] - a[1]) * (BOUNDS.east - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= BOUNDS.south, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (BOUNDS.south - a[1])) / (b[1] - a[1]), BOUNDS.south] },
    { inside: (p) => p[1] <= BOUNDS.north, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (BOUNDS.north - a[1])) / (b[1] - a[1]), BOUNDS.north] },
  ];
  let out = ring;
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (e.inside(cur)) {
        if (!e.inside(prev)) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (e.inside(prev)) out.push(e.cut(prev, cur));
    }
    if (out.length === 0) return [];
  }
  return out;
}

/** True for a ring edge that the clip laid along one side of the basemap rectangle. */
function onBoundary(a: Pt, b: Pt): boolean {
  return (
    (a[0] === BOUNDS.west && b[0] === BOUNDS.west) ||
    (a[0] === BOUNDS.east && b[0] === BOUNDS.east) ||
    (a[1] === BOUNDS.south && b[1] === BOUNDS.south) ||
    (a[1] === BOUNDS.north && b[1] === BOUNDS.north)
  );
}

/** The shoreline of a clipped ring as an SVG path: the whole ring, or the open runs between its boundary edges. */
function shorePath(ring: Pt[]): string {
  const n = ring.length;
  const cut = ring.findIndex((p, i) => onBoundary(p, ring[(i + 1) % n]));
  if (cut < 0) return pathOf(ring, true);
  let d = '';
  let run: Pt[] = [ring[(cut + 1) % n]];
  for (let k = 1; k <= n; k++) {
    const a = ring[(cut + k) % n];
    const b = ring[(cut + k + 1) % n];
    if (onBoundary(a, b)) {
      d += pathOf(run, false);
      run = [b];
    } else run.push(b);
  }
  return d;
}

/** Splits a line into the runs that lie inside the basemap rectangle. */
function clipLine(line: Pt[]): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of line) {
    if (inBounds(p)) cur.push(p);
    else {
      if (cur.length > 1) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker with a finer tolerance inside the core region. Iterative, so long rings cannot overflow the stack. */
function simplify(line: Pt[]): Pt[] {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let far = -1;
    let excess = 0;
    for (let k = i + 1; k < j; k++) {
      const d = distToSegment(line[k], line[i], line[j]) / (inCore(line[k]) ? FINE.tolerance : COARSE.tolerance);
      if (d > excess) {
        excess = d;
        far = k;
      }
    }
    if (far >= 0 && excess > 1) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return line.filter((_, k) => keep[k]);
}

function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function unit(p: Pt): Pt {
  return [Math.round(p[0] * SCALE), Math.round(-mercatorY(p[1]) * SCALE)];
}

/** Relative SVG path for a run of points; consecutive duplicates after rounding are dropped. */
function pathOf(points: Pt[], close: boolean): string {
  const u = points.map(unit).filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  if (u.length < (close ? 3 : 2)) return '';
  let d = `M${u[0][0]} ${u[0][1]}l`;
  for (let i = 1; i < u.length; i++) {
    const dx = u[i][0] - u[i - 1][0];
    const dy = u[i][1] - u[i - 1][1];
    d += `${i > 1 && dx >= 0 ? ' ' : ''}${dx}${dy >= 0 ? ' ' : ''}${dy}`;
  }
  return close ? `${d}z` : d;
}

function polygons(f: Feature): Pt[][][] {
  if (!f.geometry) return [];
  if (f.geometry.type === 'Polygon') return [f.geometry.coordinates as Pt[][]];
  if (f.geometry.type === 'MultiPolygon') return f.geometry.coordinates as Pt[][][];
  return [];
}

function lines(f: Feature): Pt[][] {
  if (!f.geometry) return [];
  if (f.geometry.type === 'LineString') return [f.geometry.coordinates as Pt[]];
  if (f.geometry.type === 'MultiLineString') return f.geometry.coordinates as Pt[][];
  return [];
}

function ringPaths(features: Feature[]): { d: string; shore: string; rings: number; points: number } {
  let d = '';
  let shore = '';
  let rings = 0;
  let points = 0;
  for (const f of features) {
    for (const poly of polygons(f)) {
      for (const raw of poly) {
        // GeoJSON rings repeat the first point at the end; the path closes itself.
        const clipped = clipRing(raw.slice(0, -1));
        if (clipped.length < 3) continue;
        const limits = clipped.some(inCore) ? FINE : COARSE;
        if (ringArea(clipped) < limits.minArea) continue;
        // Simplify as a closed loop by anchoring on the first point twice.
        const simple = simplify([...clipped, clipped[0]]).slice(0, -1);
        const p = pathOf(simple, true);
        if (!p) continue;
        d += p;
        shore += shorePath(simple);
        rings++;
        points += simple.length;
      }
    }
  }
  return { d, shore, rings, points };
}

const land = ringPaths(read('ne_50m_land.geojson'));
const lakes = ringPaths(read('ne_50m_lakes.geojson'));

/** Rivers are grouped by Natural Earth scalerank into two stroke weights. */
const major: string[] = [];
const minor: string[] = [];
let riverPoints = 0;
for (const f of read('ne_10m_rivers_lake_centerlines.geojson')) {
  const rank = Number(f.properties.scalerank);
  for (const raw of lines(f)) {
    for (const run of clipLine(raw)) {
      const core = run.some(inCore);
      // Outside the subcontinent only the great rivers are kept, for orientation.
      if (rank > (core ? 9 : 5)) continue;
      const simple = simplify(run);
      const p = pathOf(simple, false);
      if (!p) continue;
      (rank <= 6 ? major : minor).push(p);
      riverPoints += simple.length;
    }
  }
}

const out = {
  source: 'Natural Earth 5.x (public domain): ne_50m_land, ne_50m_lakes, ne_10m_rivers_lake_centerlines',
  projection: 'Spherical Mercator in degrees: x = lon * scale, y = -mercatorY(lat) * scale',
  scale: SCALE,
  bounds: BOUNDS,
  land: land.d,
  coast: land.shore,
  lakes: lakes.d,
  shores: lakes.shore,
  riversMajor: major.join(''),
  riversMinor: minor.join(''),
};

const file = path.join(process.cwd(), 'src', 'data', 'basemap', 'south-asia.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(out)}\n`);
console.log(
  `build-basemap: ${path.relative(process.cwd(), file)} ${(fs.statSync(file).size / 1024).toFixed(1)} KB; land ${land.rings} rings ${land.points} points, lakes ${lakes.rings} rings ${lakes.points} points, rivers ${major.length + minor.length} lines ${riverPoints} points`,
);
