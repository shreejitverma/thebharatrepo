/**
 * Compact, serialisable index of the archive for the Kaalchakra views.
 * Built on the server at build time and passed to the client component as props.
 */

import { isTraditional, type Entity, type Kind, type Grade, type DatingMethod, type Source } from './schema';
import { rangeAnchor, type Precision } from '../time';
import { yearToUnit } from '../time/scale';
import type { ContentGraph } from './load';
import { primaryAnchor, rankDatings, type Lens } from './lens';
export { primaryAnchor };

export interface KcDating {
  method: DatingMethod;
  grade: Grade;
  lens: Exclude<Lens, 'both'>;
  earliest: number;
  latest: number;
  best?: number;
  precision: Precision;
  circa: boolean;
  label?: string;
  note?: string;
}

/** A place on the map: one point per entity. */
export interface KcPlace {
  name: string;
  lat: number;
  lon: number;
}

/** A sourced, approximate territorial extent; the citations stay on the entity page. */
export interface KcExtent {
  label?: string;
  /** When the extent applies; absent means "for as long as the entity is dated". */
  from?: number;
  to?: number;
  /** One closed ring of [lon, lat] vertices. */
  polygon: [number, number][];
  grade: Grade;
  lens: Exclude<Lens, 'both'>;
  note?: string;
}

export interface KcItem {
  id: string;
  kind: Kind;
  type: Entity['type'];
  name: string;
  iast?: string;
  native?: string;
  summary: string;
  kids?: string;
  teen?: string;
  region?: string;
  /** Present only for entities with coordinates; these are the entities the Map view can show. */
  place?: KcPlace;
  extents?: KcExtent[];
  href: string;
  datings: KcDating[];
  /** Placement anchor per lens (astronomical year), null when the entity has no dating in that lens. */
  anchor: { scholarship: number | null; tradition: number | null };
}

export function entityHref(id: string): string {
  const [type, slug] = id.split('.');
  return `/archive/${type}/${slug}`;
}

/** Page of a source and everything that cites it: src.<slug> -> /sources/<slug>. */
export function sourceHref(id: string): string {
  return `/sources/${id.replace(/^src\./, '')}`;
}

/** The dating that places an entity in one lens: the archive's rankDatings order (best grade first, ties in the author's order). */
function placingDating<D extends KcDating>(datings: readonly D[]): D | undefined {
  return rankDatings(datings, (d) => d.lens === 'tradition')[0];
}

function anchorFor(datings: KcDating[]): number | null {
  const best = placingDating(datings);
  return best ? rangeAnchor(best) : null;
}

export function toKcItem(e: Entity): KcItem {
  const datings: KcDating[] = e.datings.map((d) => ({
    method: d.method,
    grade: d.grade,
    lens: isTraditional(d.method) ? 'tradition' : 'scholarship',
    earliest: d.range.earliest,
    latest: d.range.latest,
    best: d.range.best,
    precision: d.range.precision,
    circa: d.range.circa,
    label: d.label,
    note: d.note,
  }));
  return {
    id: e.id,
    kind: e.kind,
    type: e.type,
    name: e.names.en,
    iast: e.names.iast ?? undefined,
    native: e.names.native ?? undefined,
    summary: e.summary,
    kids: e.summaries?.kids,
    teen: e.summaries?.teen,
    region: e.region,
    place: e.location ? { name: e.location.name, lat: e.location.lat, lon: e.location.lon } : undefined,
    // Grade D is reserved for traditional reckoning, so it decides the lens of an extent as it does for datings.
    extents: e.extents?.map((x) => ({ label: x.label, from: x.from, to: x.to, polygon: x.polygon, grade: x.grade, lens: x.grade === 'D' ? 'tradition' : 'scholarship', note: x.note })),
    href: entityHref(e.id),
    datings,
    anchor: {
      scholarship: anchorFor(datings.filter((d) => d.lens === 'scholarship')),
      tradition: anchorFor(datings.filter((d) => d.lens === 'tradition')),
    },
  };
}

export function buildKaalchakraIndex(g: ContentGraph): KcItem[] {
  return [...g.entities.values()]
    .map(toKcItem)
    .sort((a, b) => (primaryAnchor(a, 'both') ?? 0) - (primaryAnchor(b, 'both') ?? 0));
}

export interface Neighbours {
  /** Entries that end before the range starts, nearest last. */
  before: KcItem[];
  /** Entries whose own range overlaps the range, in time order. */
  during: KcItem[];
  /** Entries that start after the range ends, nearest first. */
  after: KcItem[];
}

/**
 * Neighbours in time for the mini strip on entity and article pages.
 *
 * Each entry is placed by the same dating that anchors it on the Kaalchakra in the given lens, so a
 * page dated by scholarship is compared with scholarly datings only and a page dated only by tradition
 * with traditional reckoning only: the two layers are never interleaved. "During" keeps the `count`
 * overlapping entries whose anchors are nearest to the anchor of the range.
 */
export function neighbours(items: KcItem[], range: { earliest: number; latest: number; best?: number }, excludeId: string | null, lens: Exclude<Lens, 'both'> = 'scholarship', count = 3): Neighbours {
  const anchor = range.best ?? (range.earliest + range.latest) / 2;
  const placed: { item: KcItem; anchor: number; earliest: number; latest: number }[] = [];
  for (const item of items) {
    if (item.id === excludeId) continue;
    const d = placingDating(item.datings.filter((x) => x.lens === lens));
    if (d) placed.push({ item, anchor: rangeAnchor(d), earliest: d.earliest, latest: d.latest });
  }
  placed.sort((a, b) => a.anchor - b.anchor);
  const before = placed.filter((p) => p.latest < range.earliest).slice(-count);
  const after = placed.filter((p) => p.earliest > range.latest).slice(0, count);
  const during = placed
    .filter((p) => p.latest >= range.earliest && p.earliest <= range.latest)
    .sort((a, b) => Math.abs(a.anchor - anchor) - Math.abs(b.anchor - anchor))
    .slice(0, count)
    .sort((a, b) => a.anchor - b.anchor);
  return { before: before.map((p) => p.item), during: during.map((p) => p.item), after: after.map((p) => p.item) };
}

export function unitOf(year: number): number {
  return yearToUnit(year);
}

/** Human-readable citation, plain text. */
export function formatSource(s: Source): string {
  const people = s.authors.length ? s.authors : s.editors.map((e) => `${e} (ed.)`);
  const who = people.length > 3 ? `${people[0]} et al.` : people.join(', ');
  const parts = [who || s.corpus || s.publisher, s.year ? `(${s.year})` : undefined, s.title];
  const venue = [s.journal, s.volume, s.pages].filter(Boolean).join(', ');
  if (venue) parts.push(venue);
  if (s.publisher && who) parts.push(s.publisher);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.');
}

/** Links the identifier the verification gate checked: DOI, then ISBN, then OCLC; a URL only when it is the sole identifier. */
export function sourceLink(s: Source): string | undefined {
  if (s.doi) return `https://doi.org/${s.doi}`;
  if (s.isbn) return `https://openlibrary.org/isbn/${s.isbn}`;
  if (s.oclc) return `https://search.worldcat.org/title/${s.oclc}`;
  return s.url;
}
