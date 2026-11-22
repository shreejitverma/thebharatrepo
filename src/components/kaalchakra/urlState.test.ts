import { describe, expect, it } from 'vitest';
import { KINDS } from '@/lib/content/labels';
import { PRESENT_YEAR } from '@/lib/time';
import { DEFAULT, hrefFor, parseState, serialise as serialiseWith, type State } from './urlState';

const items = new Map([
  ['site.sanchi', { place: { name: 'Sanchi', lat: 23.48, lon: 77.74 } }],
  ['event.mitanni-treaty', { place: { name: 'Hattusa', lat: 40.02, lon: 34.62 } }],
  ['text.rigveda', {}],
]);

const parse = (q: string) => parseState(q, items);
const serialise = (s: State) => serialiseWith(s, items);

describe('parseState', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULT);
  });
  it('reads the documented deep link', () => {
    const s = parse('view=map&t=-268&zoom=century&lens=scholarship&kinds=site,event&region=ganga');
    expect(s).toMatchObject({ view: 'map', t: -268, zoom: 'century', lens: 'scholarship', kinds: ['site', 'event'], region: { preset: 'ganga' } });
  });
  it('reads every view', () => {
    for (const v of ['wheel', 'river', 'list', 'map'] as const) expect(parse(`view=${v}`).view).toBe(v);
    expect(parse('view=globe').view).toBe('wheel');
  });
  it('treats t=0 as 1 BCE and a missing or empty t as all time', () => {
    expect(parse('view=map&t=0').t).toBe(0);
    expect(parse('view=map').t).toBeNull();
    expect(parse('view=map&t=').t).toBeNull();
    expect(parse('view=map&t=soon').t).toBeNull();
  });
  it('clamps t to the axis and rounds it', () => {
    expect(parse('t=99999').t).toBe(PRESENT_YEAR);
    expect(parse('t=-268.6').t).toBe(-269);
  });
  it('falls back on unknown values instead of throwing', () => {
    const s = parse('lens=x&zoom=fortnight&kinds=nope&cal=mayan&level=phd&region=atlantis&win=2,1&id=site.nowhere');
    expect(s).toEqual(DEFAULT);
  });
  it('keeps known kinds in canonical order and drops unknown ones', () => {
    expect(parse('kinds=event,bogus,site').kinds).toEqual(['site', 'event']);
  });
  it('reads a free map view and clamps it', () => {
    expect(parse('view=map&region=78.5,22,40').region).toEqual({ lon: 78.5, lat: 22, span: 40 });
    expect(parse('view=map&region=78.5,22,0.001').region).toMatchObject({ span: 1.5 });
  });
  it('frames a deep-linked selection outside the default region, unless a region is given', () => {
    expect(parse('view=map&id=site.sanchi').region).toEqual({ preset: 'subcontinent' });
    expect(parse('view=map&id=event.mitanni-treaty').region).toEqual({ preset: 'wide' });
    expect(parse('view=map&id=event.mitanni-treaty&region=south').region).toEqual({ preset: 'south' });
    expect(parse('view=map&id=text.rigveda').region).toEqual({ preset: 'subcontinent' });
  });
  it('reads the River window and the selection', () => {
    expect(parse('view=river&win=0.25000,0.50000&id=text.rigveda')).toMatchObject({ win: { start: 0.25, end: 0.5 }, sel: 'text.rigveda' });
  });
});

describe('serialise', () => {
  it('writes nothing for the defaults', () => {
    expect(serialise(DEFAULT)).toBe('');
    expect(hrefFor('/kaalchakra', serialise(DEFAULT))).toBe('/kaalchakra');
  });
  it('writes map parameters only in the Map view', () => {
    const s: State = { ...DEFAULT, t: -268, zoom: 'decade', region: { preset: 'south' } };
    expect(serialise(s)).toBe('');
    expect(serialise({ ...s, view: 'map' })).toBe('view=map&t=-268&zoom=decade&region=south');
  });
  it('omits the default zoom and region, and zoom when there is no moment', () => {
    expect(serialise({ ...DEFAULT, view: 'map', t: 1000 })).toBe('view=map&t=1000');
    expect(serialise({ ...DEFAULT, view: 'map', zoom: 'era' })).toBe('view=map');
  });
  it('writes a free view as lon, lat, span', () => {
    expect(new URLSearchParams(serialise({ ...DEFAULT, view: 'map', region: { lon: 78.5, lat: 22, span: 40 } })).get('region')).toBe('78.50,22.00,40.0');
  });
  it('writes the River window only in the River view', () => {
    const s: State = { ...DEFAULT, win: { start: 0.25, end: 0.5 } };
    expect(serialise(s)).toBe('');
    expect(serialise({ ...s, view: 'river' })).toBe('view=river&win=0.25000%2C0.50000');
  });
  it('round-trips every field', () => {
    const states: State[] = [
      { ...DEFAULT, view: 'map', lens: 'tradition', cal: 'kali', kinds: ['site', 'event'], q: 'ashoka edict', sel: 'site.sanchi', level: 'kids', t: -268, zoom: 'millennium', region: { preset: 'ganga' } },
      { ...DEFAULT, view: 'map', t: 0, region: { lon: 80.25, lat: 13.5, span: 12.5 } },
      { ...DEFAULT, view: 'river', lens: 'scholarship', win: { start: 0.4, end: 0.6 }, sel: 'text.rigveda' },
      { ...DEFAULT, view: 'list', kinds: KINDS.slice(0, 3) as State['kinds'], level: 'teen' },
    ];
    for (const s of states) expect(parse(serialise(s))).toEqual(s);
  });
  it('writes the region whenever a link would otherwise reopen on a different one', () => {
    // Hattusa lies outside the subcontinent, so a link naming it with no region opens on the wide view.
    expect(new URLSearchParams(serialise({ ...DEFAULT, view: 'map', sel: 'event.mitanni-treaty' })).get('region')).toBe('subcontinent');
    expect(new URLSearchParams(serialise({ ...DEFAULT, view: 'map', sel: 'event.mitanni-treaty', region: { preset: 'wide' } })).get('region')).toBeNull();
    expect(new URLSearchParams(serialise({ ...DEFAULT, view: 'map', sel: 'site.sanchi' })).get('region')).toBeNull();
  });
  it('round-trips the region with a selection outside the default region', () => {
    const states: State[] = [
      { ...DEFAULT, view: 'map', sel: 'event.mitanni-treaty' },
      { ...DEFAULT, view: 'map', sel: 'event.mitanni-treaty', region: { preset: 'wide' } },
      { ...DEFAULT, view: 'map', sel: 'event.mitanni-treaty', region: { preset: 'ganga' } },
      { ...DEFAULT, view: 'map', sel: 'site.sanchi', region: { preset: 'wide' } },
    ];
    for (const s of states) expect(parse(serialise(s))).toEqual(s);
  });
  it('is stable: serialising a parsed query gives the same query', () => {
    const q = 'view=map&lens=scholarship&kinds=site%2Cevent&t=-268&region=ganga';
    expect(serialise(parse(q))).toBe(q);
  });
});
