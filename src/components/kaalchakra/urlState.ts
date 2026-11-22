/**
 * The one URL state shared by every Kaalchakra view.
 *
 *   view    wheel (default; list for readers who prefer reduced motion), river, list or map
 *   lens    both (default), scholarship or tradition
 *   kinds   comma-separated kinds; absent means all
 *   q       text filter
 *   id      selected entity; the former id of a merged entity selects the entity it was merged into
 *   cal     calendar for displayed years
 *   level   reading level of the summary
 *   win     River window on the unit axis, "start,end"
 *   t       a moment, an astronomical year (1 BCE = 0, so 269 BCE is -268). In the Map view it is the scrubber's
 *           moment (absent means all time); in the other views a link with `t` and no `id` selects the nearest entry
 *   zoom    Map time window around t: era, millennium, century (default) or decade
 *   region  Map viewport: a named region, or "lon,lat,span" after panning or zooming
 *
 * Defaults are omitted so the shortest URL is the canonical one. Parsing never throws: an unknown or
 * malformed value falls back to its default.
 */

import { KINDS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import { LENSES, type Lens } from '@/lib/content/lens';
import { yearToUnit } from '@/lib/time/scale';
import type { CalendarSystem } from '@/lib/time';
import type { UnitWindow } from '@/lib/time/scale';
import { DEFAULT_REGION, DEFAULT_TIME_ZOOM, TIME_ZOOMS, clampTime, isPreset, parseRegion, regionFor, serialiseRegion, type MapRegion, type RegionId, type TimeZoom } from './mapState';
import type { Level, View } from './shared';

export const VIEWS: { id: View; label: string }[] = [
  { id: 'wheel', label: 'Wheel' },
  { id: 'river', label: 'River' },
  { id: 'map', label: 'Map' },
  { id: 'list', label: 'List' },
];

export const CALENDARS: { id: CalendarSystem; label: string }[] = [
  { id: 'ce', label: 'CE / BCE' },
  { id: 'ago', label: 'Years ago' },
  { id: 'vs', label: 'Vikram Samvat' },
  { id: 'shaka', label: 'Shaka Samvat' },
  { id: 'kali', label: 'Kali Yuga era' },
];

export interface State {
  view: View;
  lens: Lens;
  cal: CalendarSystem;
  kinds: Kind[];
  q: string;
  sel: string | null;
  win: UnitWindow;
  level: Level;
  /** Map moment as an astronomical year, or null for all time. */
  t: number | null;
  zoom: TimeZoom;
  region: MapRegion;
}

export const DEFAULT: State = {
  view: 'wheel',
  lens: 'both',
  cal: 'ce',
  kinds: [...KINDS],
  q: '',
  sel: null,
  win: { start: 0, end: 1 },
  level: 'adult',
  t: null,
  zoom: DEFAULT_TIME_ZOOM,
  region: { preset: DEFAULT_REGION },
};

/** The List view is the default for readers who ask for reduced motion; an explicit view in the URL still wins. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** What parseState reads of an item: its place frames a deep-linked selection, its anchors resolve a `t=` link. */
export type StateItem = Pick<KcItem, 'place'> & Partial<Pick<KcItem, 'anchor'>>;

/** Entry nearest a year (astronomical numbering) in a lens, for a `t=` link that names a moment rather than an entry. */
function nearestTo(items: ReadonlyMap<string, StateItem>, year: number, lens: Lens): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [id, it] of items) {
    if (!it.anchor) continue;
    const a = lens === 'scholarship' ? it.anchor.scholarship : lens === 'tradition' ? it.anchor.tradition : (it.anchor.scholarship ?? it.anchor.tradition);
    if (a === null) continue;
    const d = Math.abs(yearToUnit(a) - yearToUnit(year));
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** The region a link without `region` opens on: the default, or the wide one when the selected place lies outside it. */
function inferredRegion(sel: string | null, items: ReadonlyMap<string, StateItem>): RegionId {
  return regionFor(sel ? items.get(sel)?.place : undefined);
}

const NO_ALIASES: Readonly<Record<string, string>> = {};

/**
 * `items` maps every entity id to its record.
 * `aliases` maps the former id of a merged entity to the entity it was merged into, so an old ?id= deep link
 * selects the surviving entry (the server also redirects it; this covers client-side navigation).
 */
export function parseState(search: string, items: ReadonlyMap<string, StateItem>, aliases: Readonly<Record<string, string>> = NO_ALIASES): State {
  const p = new URLSearchParams(search);
  const s: State = { ...DEFAULT, kinds: [...KINDS] };
  const v = p.get('view');
  if (VIEWS.some((x) => x.id === v)) s.view = v as View;
  else if (prefersReducedMotion()) s.view = 'list';
  const l = p.get('lens');
  if (l && (LENSES as readonly string[]).includes(l)) s.lens = l as Lens;
  const c = p.get('cal');
  if (c && CALENDARS.some((x) => x.id === c)) s.cal = c as CalendarSystem;
  const k = p.get('kinds');
  if (k) {
    const ks = k.split(',').filter((x): x is Kind => (KINDS as readonly string[]).includes(x));
    if (ks.length) s.kinds = KINDS.filter((x) => ks.includes(x));
  }
  s.q = p.get('q') ?? '';
  const sel = p.get('id');
  const live = sel && !items.has(sel) && Object.hasOwn(aliases, sel) ? aliases[sel] : sel;
  if (live && items.has(live)) s.sel = live;
  const w = p.get('win');
  if (w) {
    const [a, b] = w.split(',').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= 1 && b - a > 0.0004) s.win = { start: a, end: b };
  }
  const lv = p.get('level');
  if (lv === 'teen' || lv === 'kids') s.level = lv;
  const t = p.get('t');
  // Number('') is 0, a real year (1 BCE), so an empty value must be rejected before converting.
  if (t !== null && t.trim() !== '' && Number.isFinite(Number(t))) s.t = clampTime(Number(t));
  // Outside the Map view a moment with no entry named selects the entry nearest to it; on the map it only sets the scrubber.
  if (s.sel === null && s.t !== null && s.view !== 'map') s.sel = nearestTo(items, s.t, s.lens);
  const z = p.get('zoom');
  if (z && (TIME_ZOOMS as readonly string[]).includes(z)) s.zoom = z as TimeZoom;
  s.region = parseRegion(p.get('region')) ?? { preset: inferredRegion(s.sel, items) };
  return s;
}

/** Query string for a state, without the leading "?", in URLSearchParams encoding. `items` is the map parseState reads. */
export function serialise(s: State, items: ReadonlyMap<string, StateItem>): string {
  const p = new URLSearchParams();
  // Reduced motion changes the default view, so its readers always get an explicit view: their links then open the same view for everyone.
  if (s.view !== DEFAULT.view || prefersReducedMotion()) p.set('view', s.view);
  if (s.lens !== DEFAULT.lens) p.set('lens', s.lens);
  if (s.cal !== DEFAULT.cal) p.set('cal', s.cal);
  if (s.kinds.length !== KINDS.length) p.set('kinds', s.kinds.join(','));
  if (s.q) p.set('q', s.q);
  if (s.sel) p.set('id', s.sel);
  if (s.view === 'river' && (s.win.start > 0 || s.win.end < 1)) p.set('win', `${s.win.start.toFixed(5)},${s.win.end.toFixed(5)}`);
  if (s.level !== 'adult') p.set('level', s.level);
  // Like `win`, the map parameters are written only while their view is open.
  if (s.view === 'map') {
    if (s.t !== null) {
      p.set('t', String(s.t));
      if (s.zoom !== DEFAULT_TIME_ZOOM) p.set('zoom', s.zoom);
    }
    // The region is left out only when parsing would infer the same one, so a link always reopens the view it was made from.
    if (!isPreset(s.region) || s.region.preset !== inferredRegion(s.sel, items)) p.set('region', serialiseRegion(s.region));
  }
  return p.toString();
}

export function hrefFor(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}
