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
  href: string;
  datings: KcDating[];
  /** Placement anchor per lens (astronomical year), null when the entity has no dating in that lens. */
  anchor: { scholarship: number | null; tradition: number | null };
}

export function entityHref(id: string): string {
  const [type, slug] = id.split('.');
  return `/archive/${type}/${slug}`;
}

function anchorFor(datings: KcDating[]): number | null {
  if (datings.length === 0) return null;
  return rangeAnchor(rankDatings(datings, (d) => d.lens === 'tradition')[0]);
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

/** Neighbours in time for the mini strip on entity and article pages. */
export function neighbours(items: KcItem[], year: number, lens: 'scholarship' | 'tradition', excludeId: string | null, count = 3): { before: KcItem[]; after: KcItem[] } {
  const sorted = items
    .filter((i) => i.id !== excludeId && primaryAnchor(i, lens) !== null)
    .sort((a, b) => primaryAnchor(a, lens)! - primaryAnchor(b, lens)!);
  const before = sorted.filter((i) => primaryAnchor(i, lens)! <= year).slice(-count);
  const after = sorted.filter((i) => primaryAnchor(i, lens)! > year).slice(0, count);
  return { before, after };
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
