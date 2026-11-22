import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  clampView,
  containsPoint,
  fitBounds,
  inverseMercatorY,
  kmPerPixel,
  mercatorY,
  panView,
  project,
  unproject,
  viewBounds,
  zoomView,
  type MapView,
} from './projection';
import { clusterPoints, type ScreenPoint } from './cluster';

const size = { width: 800, height: 600 };
const view: MapView = { lon: 80, lat: 22, span: 40 };

describe('mercator', () => {
  it('is zero at the equator, odd, and increasing', () => {
    expect(mercatorY(0)).toBeCloseTo(0, 12);
    expect(mercatorY(-30)).toBeCloseTo(-mercatorY(30), 12);
    expect(mercatorY(31)).toBeGreaterThan(mercatorY(30));
  });
  it('matches the closed form at known latitudes', () => {
    // ln(tan(45 + 15)) = ln(sqrt(3)), in degrees.
    expect(mercatorY(30)).toBeCloseTo((Math.log(Math.sqrt(3)) * 180) / Math.PI, 10);
    expect(mercatorY(45)).toBeCloseTo((Math.log(1 + Math.SQRT2) * 180) / Math.PI, 10);
  });
  it('round-trips through its inverse', () => {
    for (const lat of [-60, -4, 0, 8.5, 22, 37.7, 48, 84]) expect(inverseMercatorY(mercatorY(lat))).toBeCloseTo(lat, 9);
  });
  it('clamps beyond the usable latitude instead of returning infinity', () => {
    expect(Number.isFinite(mercatorY(90))).toBe(true);
    expect(mercatorY(90)).toBe(mercatorY(85));
  });
});

describe('project and unproject', () => {
  it('puts the view centre at the canvas centre', () => {
    expect(project(view, size, 80, 22)).toEqual({ x: 400, y: 300 });
  });
  it('maps the span onto the canvas width', () => {
    expect(project(view, size, 60, 22).x).toBeCloseTo(0, 9);
    expect(project(view, size, 100, 22).x).toBeCloseTo(800, 9);
  });
  it('draws north above south and east right of west', () => {
    expect(project(view, size, 80, 30).y).toBeLessThan(project(view, size, 80, 10).y);
    expect(project(view, size, 90, 22).x).toBeGreaterThan(project(view, size, 70, 22).x);
  });
  it('round-trips', () => {
    for (const [lon, lat] of [
      [34.6, 40.02],
      [77.2, 28.6],
      [80.3, 13.1],
      [103.9, 5.7],
    ]) {
      const p = project(view, size, lon, lat);
      const g = unproject(view, size, p.x, p.y);
      expect(g.lon).toBeCloseTo(lon, 9);
      expect(g.lat).toBeCloseTo(lat, 9);
    }
  });
  it('reports the visible bounds', () => {
    const b = viewBounds(view, size);
    expect(b.west).toBeCloseTo(60, 9);
    expect(b.east).toBeCloseTo(100, 9);
    expect(b.north).toBeGreaterThan(22);
    expect(b.south).toBeLessThan(22);
    expect(containsPoint(b, 80, 22)).toBe(true);
    expect(containsPoint(b, 59.9, 22)).toBe(false);
  });
});

describe('fitBounds', () => {
  const india = { west: 66, east: 98, south: 5, north: 38 };
  it('contains the bounds on a wide canvas and on a tall one', () => {
    for (const s of [size, { width: 330, height: 420 }, { width: 1100, height: 400 }]) {
      const v = fitBounds(india, s);
      const b = viewBounds(v, s);
      expect(b.west).toBeLessThanOrEqual(india.west + 1e-9);
      expect(b.east).toBeGreaterThanOrEqual(india.east - 1e-9);
      expect(b.south).toBeLessThanOrEqual(india.south + 1e-9);
      expect(b.north).toBeGreaterThanOrEqual(india.north - 1e-9);
    }
  });
  it('is tight on the limiting axis', () => {
    const wide = { width: 1100, height: 400 };
    const b = viewBounds(fitBounds(india, wide), wide);
    expect(b.north).toBeCloseTo(india.north, 6);
    expect(b.south).toBeCloseTo(india.south, 6);
  });
  it('honours padding', () => {
    const v = fitBounds(india, size, 40);
    expect(project(v, size, india.west, 22).x).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(project(v, size, 80, india.north).y).toBeGreaterThanOrEqual(40 - 1e-6);
  });
  it('survives a degenerate box', () => {
    const v = fitBounds({ west: 77, east: 77, south: 28, north: 28 }, size);
    expect(Number.isFinite(v.span)).toBe(true);
    expect(v.lon).toBe(77);
  });
});

describe('zoom, pan and clamp', () => {
  it('keeps the focus point fixed while zooming', () => {
    const focus = { x: 620, y: 140 };
    const before = unproject(view, size, focus.x, focus.y);
    const zoomed = zoomView(view, size, 0.5, focus);
    const after = unproject(zoomed, size, focus.x, focus.y);
    expect(zoomed.span).toBe(20);
    expect(after.lon).toBeCloseTo(before.lon, 9);
    expect(after.lat).toBeCloseTo(before.lat, 9);
  });
  it('zooms about the centre without a focus', () => {
    expect(zoomView(view, size, 2)).toEqual({ lon: 80, lat: 22, span: 80 });
  });
  it('pans the content with the pointer', () => {
    const p = project(view, size, 75, 20);
    const moved = panView(view, size, 50, -30);
    const q = project(moved, size, 75, 20);
    expect(q.x - p.x).toBeCloseTo(50, 9);
    expect(q.y - p.y).toBeCloseTo(-30, 9);
  });
  it('clamps span and centre', () => {
    const limits = { west: 24, east: 112, south: -4, north: 48 };
    expect(clampView({ lon: 0, lat: 80, span: 500 }, limits, 2, 90)).toEqual({ lon: 24, lat: 48, span: 90 });
    expect(clampView({ lon: 80, lat: 22, span: 0.1 }, limits, 2, 90).span).toBe(2);
  });
  it('gives a ground scale that shrinks toward the pole', () => {
    expect(kmPerPixel({ lon: 80, lat: 0, span: 40 }, size)).toBeCloseTo((111.195 * 40) / 800, 9);
    expect(kmPerPixel({ lon: 80, lat: 40, span: 40 }, size)).toBeLessThan(kmPerPixel({ lon: 80, lat: 10, span: 40 }, size));
  });
  it('computes bounds of points', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lon: 70, lat: 10 }, { lon: 90, lat: 30 }, { lon: 80, lat: 5 }])).toEqual({ west: 70, east: 90, south: 5, north: 30 });
  });
});

describe('clusterPoints', () => {
  const pts: ScreenPoint[] = [
    { id: 'a', x: 100, y: 100 },
    { id: 'b', x: 110, y: 104 },
    { id: 'c', x: 300, y: 100 },
    { id: 'd', x: 96, y: 92 },
    { id: 'e', x: 305, y: 300 },
  ];
  it('groups points within the radius and leaves the rest alone', () => {
    const out = clusterPoints(pts, 30);
    expect(out.map((c) => c.ids)).toEqual([['a', 'b', 'd'], ['c'], ['e']]);
  });
  it('places a cluster at the centroid of its members', () => {
    const [first] = clusterPoints(pts, 30);
    expect(first.x).toBeCloseTo((100 + 110 + 96) / 3, 9);
    expect(first.y).toBeCloseTo((100 + 104 + 92) / 3, 9);
  });
  it('keeps every point exactly once', () => {
    const many: ScreenPoint[] = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, x: (i * 37) % 640, y: (i * 91) % 480 }));
    const out = clusterPoints(many, 24);
    const ids = out.flatMap((c) => c.ids);
    expect(ids).toHaveLength(500);
    expect(new Set(ids).size).toBe(500);
    expect(out.length).toBeLessThan(500);
  });
  it('leaves no two clusters closer than the radius, so drawn markers cannot overlap', () => {
    const line: ScreenPoint[] = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, x: 100 + ((i * 53) % 300), y: 200 + ((i * 17) % 40) }));
    for (const radius of [12, 26, 40]) {
      const out = clusterPoints(line, radius);
      expect(out.flatMap((c) => c.ids).sort()).toEqual(line.map((p) => p.id).sort());
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(radius);
      }
    }
  });
  it('merges clusters whose centroids drift within the radius', () => {
    // a and c seed two clusters 40 px apart. b joins c and d joins a, which pulls the two centroids
    // to 10 and 32.5: closer than the radius, so the merge pass must join them.
    const out = clusterPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'c', x: 40, y: 0 },
        { id: 'b', x: 25, y: 0 },
        { id: 'd', x: 20, y: 0 },
      ],
      30,
    );
    expect(out).toHaveLength(1);
    expect(out[0].ids.sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('merges coincident points', () => {
    const out = clusterPoints([{ id: 'x', x: 5, y: 5 }, { id: 'y', x: 5, y: 5 }], 10);
    expect(out).toEqual([{ ids: ['x', 'y'], x: 5, y: 5 }]);
  });
  it('is unchanged by panning', () => {
    const shifted = pts.map((p) => ({ ...p, x: p.x - 1234.5, y: p.y + 77.25 }));
    expect(clusterPoints(shifted, 30).map((c) => c.ids)).toEqual(clusterPoints(pts, 30).map((c) => c.ids));
  });
  it('finds a seed across a grid cell boundary, including at negative coordinates', () => {
    const out = clusterPoints([{ id: 'a', x: -1, y: -1 }, { id: 'b', x: 1, y: 1 }], 10);
    expect(out).toHaveLength(1);
  });
  it('does not cluster with a zero radius and returns nothing for no points', () => {
    expect(clusterPoints(pts, 0)).toHaveLength(5);
    expect(clusterPoints([], 30)).toEqual([]);
  });
});
