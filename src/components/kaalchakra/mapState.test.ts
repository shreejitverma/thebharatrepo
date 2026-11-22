import { describe, expect, it } from 'vitest';
import basemap from '@/data/basemap/south-asia.json';
import { PRESENT_YEAR } from '@/lib/time';
import { AXIS_START, SEGMENTS, yearToUnit } from '@/lib/time/scale';
import { containsPoint, project, viewBounds } from '@/lib/geo/projection';
import {
  DEFAULT_REGION,
  MAP_LIMITS,
  MAX_SPAN,
  MIN_SPAN,
  REGIONS,
  clampTime,
  maxSpanFor,
  datedWithin,
  entriesAt,
  extentsAt,
  panRegion,
  parseRegion,
  regionBounds,
  regionFor,
  resolveRegion,
  revealPlace,
  serialiseRegion,
  stepTime,
  timeWindow,
  zoomRegion,
} from './mapState';

const size = { width: 800, height: 600 };

const item = (id: string, ...datings: [lens: 'scholarship' | 'tradition', earliest: number, latest: number][]) => ({
  id,
  datings: datings.map(([lens, earliest, latest]) => ({ lens, earliest, latest })),
});

describe('time window', () => {
  it('is centred on the moment for fixed widths', () => {
    expect(timeWindow(-268, 'century')).toEqual({ from: -318, to: -218 });
    expect(timeWindow(1000, 'millennium')).toEqual({ from: 500, to: 1500 });
    expect(timeWindow(1947, 'decade')).toEqual({ from: 1942, to: 1952 });
  });
  it('is the whole scale segment for an era, never past the present', () => {
    expect(timeWindow(-268, 'era')).toEqual({ from: -499, to: 600 });
    expect(timeWindow(2000, 'era')).toEqual({ from: 1947, to: PRESENT_YEAR });
  });
  it('clamps the moment to the axis and to the present, and to whole years', () => {
    expect(clampTime(9999)).toBe(PRESENT_YEAR);
    expect(clampTime(-1e12)).toBe(AXIS_START);
    expect(clampTime(-268.4)).toBe(-268);
  });
});

describe('stepTime', () => {
  it('moves one window in historical time', () => {
    expect(stepTime(-268, 1, 'century')).toBe(-168);
    expect(stepTime(-268, -1, 'century')).toBe(-368);
    expect(stepTime(1500, 1, 'millennium')).toBe(PRESENT_YEAR);
  });
  it('always makes visible progress in deep time, where a century is invisible on the axis', () => {
    const t = PRESENT_YEAR - 400_000;
    const later = stepTime(t, 1, 'century');
    const earlier = stepTime(t, -1, 'century');
    expect(yearToUnit(later) - yearToUnit(t)).toBeGreaterThan(0.0035);
    expect(yearToUnit(t) - yearToUnit(earlier)).toBeGreaterThan(0.0035);
  });
  it('reaches both ends of the axis and stops there', () => {
    let t = 1900;
    for (let i = 0; i < 20; i++) t = stepTime(t, 1, 'decade');
    expect(t).toBe(PRESENT_YEAR);
    expect(stepTime(PRESENT_YEAR, 1, 'decade')).toBe(PRESENT_YEAR);
    expect(stepTime(AXIS_START, -1, 'century')).toBe(AXIS_START);
  });
  it('jumps era by era and stays inside the neighbouring segment', () => {
    const next = stepTime(-268, 1, 'era');
    expect(next).toBeGreaterThan(600);
    expect(next).toBeLessThan(1500);
    const prev = stepTime(-268, -1, 'era');
    expect(prev).toBeGreaterThan(-3299);
    expect(prev).toBeLessThan(-499);
    const first = SEGMENTS[0];
    expect(stepTime(first.from + 10, -1, 'era')).toBe(first.from + 10);
  });
});

describe('entries at a moment', () => {
  const items = [item('maurya', ['scholarship', -321, -184]), item('gupta', ['scholarship', 319, 550]), item('kali', ['tradition', -3101, -3101]), item('rama', ['scholarship', -700, -300], ['tradition', -5000, -5000])];
  it('returns everything for all time', () => {
    expect(entriesAt(items, 'both', null, 'century')).toHaveLength(4);
  });
  it('keeps entries whose range overlaps the window, edges included', () => {
    expect(entriesAt(items, 'both', -268, 'century').map((i) => i.id)).toEqual(['maurya', 'rama']);
    expect(datedWithin(items[1], 'both', { from: 550, to: 600 })).toBe(true);
    expect(datedWithin(items[1], 'both', { from: 551, to: 600 })).toBe(false);
  });
  it('honours the lens', () => {
    expect(entriesAt(items, 'tradition', -5000, 'decade').map((i) => i.id)).toEqual(['rama']);
    expect(entriesAt(items, 'scholarship', -5000, 'decade')).toEqual([]);
    expect(entriesAt(items, 'scholarship', -3101, 'decade')).toEqual([]);
    expect(entriesAt(items, 'both', -3101, 'decade').map((i) => i.id)).toEqual(['kali']);
  });
});

describe('extents at a moment', () => {
  const square: [number, number][] = [
    [70, 20],
    [80, 20],
    [80, 30],
  ];
  const polity = {
    extents: [
      { label: 'early', from: -321, to: -270, polygon: square, grade: 'B' as const, lens: 'scholarship' as const },
      { label: 'peak', from: -269, to: -232, polygon: square, grade: 'B' as const, lens: 'scholarship' as const },
      { label: 'undated', polygon: square, grade: 'C' as const, lens: 'scholarship' as const },
      { label: 'puranic', polygon: square, grade: 'D' as const, lens: 'tradition' as const },
    ],
  };
  it('draws all extents of the lens for all time', () => {
    expect(extentsAt(polity, 'both', null, 'century').map((x) => x.label)).toEqual(['early', 'peak', 'undated', 'puranic']);
    expect(extentsAt(polity, 'scholarship', null, 'century').map((x) => x.label)).toEqual(['early', 'peak', 'undated']);
    expect(extentsAt(polity, 'tradition', null, 'century').map((x) => x.label)).toEqual(['puranic']);
  });
  it('filters dated extents by the window and keeps undated ones', () => {
    expect(extentsAt(polity, 'scholarship', -250, 'decade').map((x) => x.label)).toEqual(['peak', 'undated']);
    expect(extentsAt(polity, 'scholarship', -300, 'decade').map((x) => x.label)).toEqual(['early', 'undated']);
  });
  it('returns nothing for an item without extents', () => {
    expect(extentsAt({}, 'both', null, 'century')).toEqual([]);
  });
});

describe('regions', () => {
  it('have unique ids and sit inside the basemap', () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) {
      expect(r.bounds.west).toBeGreaterThanOrEqual(MAP_LIMITS.west);
      expect(r.bounds.east).toBeLessThanOrEqual(MAP_LIMITS.east);
      expect(r.bounds.south).toBeGreaterThanOrEqual(MAP_LIMITS.south);
      expect(r.bounds.north).toBeLessThanOrEqual(MAP_LIMITS.north);
    }
  });
  it('resolve to a view that shows the whole region at phone and desktop sizes', () => {
    for (const s of [size, { width: 326, height: 340 }, { width: 1000, height: 620 }]) {
      for (const r of REGIONS) {
        const b = viewBounds(resolveRegion({ preset: r.id }, s), s);
        expect(b.west).toBeLessThanOrEqual(r.bounds.west);
        expect(b.east).toBeGreaterThanOrEqual(r.bounds.east);
        expect(b.south).toBeLessThanOrEqual(r.bounds.south);
        expect(b.north).toBeGreaterThanOrEqual(r.bounds.north);
      }
    }
  });
  it('round-trip through the URL as a name or as lon, lat, span', () => {
    expect(serialiseRegion({ preset: 'ganga' })).toBe('ganga');
    expect(parseRegion('ganga')).toEqual({ preset: 'ganga' });
    const free = { lon: 78.5, lat: 22.25, span: 40 };
    expect(serialiseRegion(free)).toBe('78.50,22.25,40.0');
    expect(parseRegion(serialiseRegion(free))).toEqual(free);
  });
  it('reject malformed values and clamp wild ones', () => {
    for (const bad of [null, '', 'atlantis', '1,2', '1,2,3,4', 'a,b,c', '80,20,0', '80,20,-5']) expect(parseRegion(bad)).toBeNull();
    expect(parseRegion('500,-80,9999')).toEqual({ lon: MAP_LIMITS.east, lat: MAP_LIMITS.south, span: MAX_SPAN });
    expect(parseRegion('80,20,0.01')).toEqual({ lon: 80, lat: 20, span: MIN_SPAN });
  });
  it('zoom and pan from a named region into a clamped free view', () => {
    const base = resolveRegion({ preset: DEFAULT_REGION }, size);
    const zoomed = zoomRegion({ preset: DEFAULT_REGION }, size, 0.5);
    expect(zoomed.span).toBeCloseTo(base.span / 2, 9);
    expect(zoomed.lon).toBeCloseTo(base.lon, 9);
    let v = zoomed;
    for (let i = 0; i < 20; i++) v = zoomRegion(v, size, 0.5);
    expect(v.span).toBe(MIN_SPAN);
    const panned = panRegion({ preset: DEFAULT_REGION }, size, 100, 0);
    expect(panned.lon).toBeLessThan(base.lon);
    const corner = viewBounds(panRegion(panned, size, -1e7, -1e7), size);
    expect(corner.east).toBeCloseTo(MAP_LIMITS.east, 9);
    expect(corner.south).toBeCloseTo(MAP_LIMITS.south, 9);
  });
});

describe('the viewport never leaves the basemap', () => {
  // The oracle is the basemap file itself: its bounds are where its land, lakes and rivers stop.
  const limits = basemap.bounds;
  const EPS = 1e-6;
  const inside = (v: { lon: number; lat: number; span: number }, s: { width: number; height: number }) => {
    const b = viewBounds(v, s);
    return b.west >= limits.west - EPS && b.east <= limits.east + EPS && b.south >= limits.south - EPS && b.north <= limits.north + EPS;
  };
  // Desktop and tablet canvases, and portrait phones down to a 320 px screen (the canvas is at least 280 px wide).
  const sizes = [size, { width: 1000, height: 620 }, { width: 1400, height: 580 }, { width: 2400, height: 580 }, { width: 600, height: 400 }, { width: 341, height: 358 }, { width: 288, height: 302 }, { width: 280, height: 294 }];

  it('for any centre, span and canvas', () => {
    for (const s of sizes) {
      for (let lon = -60; lon <= 200; lon += 13) {
        for (let lat = -80; lat <= 85; lat += 11) {
          for (const span of [0.5, 1.5, 7, 30, 60, 88, 95, 120, 140, 500]) {
            const v = resolveRegion({ lon, lat, span }, s);
            expect(inside(v, s), `${lon},${lat},${span} on ${s.width}x${s.height}`).toBe(true);
            expect(v.span).toBeLessThanOrEqual(maxSpanFor(s) + EPS);
          }
        }
      }
    }
  });
  it('for every named region, and after zooming fully out or panning far in any direction', () => {
    for (const s of sizes) {
      for (const r of REGIONS) expect(inside(resolveRegion({ preset: r.id }, s), s), `${r.id} on ${s.width}x${s.height}`).toBe(true);
      let v = resolveRegion({ preset: 'wide' }, s);
      for (let i = 0; i < 8; i++) v = zoomRegion(v, s, 2);
      expect(v.span).toBeCloseTo(maxSpanFor(s), 9);
      expect(inside(v, s)).toBe(true);
      for (const [dx, dy] of [[1e6, 0], [-1e6, 0], [0, 1e6], [0, -1e6], [1e6, 1e6], [-1e6, -1e6]]) expect(inside(panRegion({ preset: 'south' }, s, dx, dy), s)).toBe(true);
    }
  });
  it('while the widest view is as wide as the basemap allows on that canvas', () => {
    for (const s of sizes) {
      const b = viewBounds(resolveRegion({ lon: 70, lat: 20, span: 1e9 }, s), s);
      // Filled edge to edge on at least one axis: the clamp never leaves a reader more zoomed in than it must.
      expect(Math.abs(b.east - b.west - Math.min(MAX_SPAN, limits.east - limits.west)) < 1e-6 || Math.abs(b.north - limits.north) + Math.abs(b.south - limits.south) < 1e-6).toBe(true);
    }
  });
});

describe('revealing a place', () => {
  const delhi = { name: 'Delhi', lat: 28.6, lon: 77.2 };
  const hattusa = { name: 'Hattusa', lat: 40.02, lon: 34.62 };
  it('leaves the region alone when the place is comfortably visible', () => {
    const r = { preset: DEFAULT_REGION } as const;
    expect(revealPlace(r, size, delhi)).toBe(r);
  });
  it('recentres at the same zoom when the place is outside', () => {
    const before = resolveRegion({ preset: 'south' }, size);
    const after = revealPlace({ preset: 'south' }, size, delhi);
    expect(after).toEqual({ lon: 77.2, lat: 28.6, span: before.span });
    const p = project(resolveRegion(after, size), size, delhi.lon, delhi.lat);
    expect(p.x).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(300, 6);
  });
  it('recentres when the place is inside the canvas but within the edge margin', () => {
    const view = { lon: 80, lat: 22, span: 40 };
    const edge = { name: 'Edge', lat: 22, lon: 60.5 };
    expect(containsPoint(viewBounds(view, size), edge.lon, edge.lat)).toBe(true);
    expect(revealPlace(view, size, edge)).toEqual({ lon: 60.5, lat: 22, span: 40 });
  });
  it('opens a deep link on the wide region only when the default would hide the place', () => {
    expect(regionFor(delhi)).toBe(DEFAULT_REGION);
    expect(regionFor(hattusa)).toBe('wide');
    expect(regionFor(undefined)).toBe(DEFAULT_REGION);
    expect(containsPoint(regionBounds('wide'), hattusa.lon, hattusa.lat)).toBe(true);
  });
});
