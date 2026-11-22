import { formatInCalendar, formatRange, type CalendarSystem } from '@/lib/time';
import { yearToUnit, unitToYear, SEGMENTS, type Segment } from '@/lib/time/scale';
import { primaryAnchor, rankDatings, withTraditionMark, type Lens } from '@/lib/content/lens';
import type { KcDating, KcItem } from '@/lib/content/kaalchakra';
import type { Kind } from '@/lib/content/labels';

export type View = 'wheel' | 'river' | 'list';
export type Level = 'adult' | 'teen' | 'kids';

export const SHORT_SEGMENT_LABELS: Record<string, string> = {
  cosmic: 'Cosmic',
  palaeolithic: 'Palaeolithic',
  neolithic: 'Neolithic',
  'harappan-vedic': 'Harappan and Vedic',
  classical: 'Classical',
  medieval: 'Medieval',
  'early-modern': 'Early modern',
  republic: 'Republic',
};

/** Label for the boundary where each segment starts. */
export const BOUNDARY_LABELS: Record<string, string> = {
  palaeolithic: '3 Ma',
  neolithic: '10,000 BCE',
  'harappan-vedic': '3300 BCE',
  classical: '500 BCE',
  medieval: '600 CE',
  'early-modern': '1500',
  republic: '1947',
};

export function kindColor(kind: Kind): string {
  return `var(--k-${kind})`;
}

/** The fields of a dating that placement and ordering need. */
export type PlacedDating = Pick<KcDating, 'lens' | 'grade' | 'earliest' | 'latest' | 'best'>;

/** Minimal projection of an item that can be placed on the wheel or the river. */
export interface PlacedItem<D extends PlacedDating = PlacedDating> {
  id: string;
  kind: Kind;
  datings: D[];
  anchor: KcItem['anchor'];
}

/** Trimmed projection for static renders that never show names, summaries or notes. */
export function toPlacedItem(item: KcItem): PlacedItem {
  return {
    id: item.id,
    kind: item.kind,
    anchor: item.anchor,
    datings: item.datings.map((d) => ({ lens: d.lens, grade: d.grade, earliest: d.earliest, latest: d.latest, best: d.best })),
  };
}

/** primaryAnchor for any projection; it reads only the anchor. */
export function anchorIn(item: Pick<KcItem, 'anchor'>, lens: Lens): number | null {
  return primaryAnchor(item as KcItem, lens);
}

/** Datings of an item visible in a lens, in the archive's rankDatings order. */
export function visibleDatings<D extends PlacedDating>(item: { datings: D[] }, lens: Lens): D[] {
  return rankDatings(
    item.datings.filter((d) => lens === 'both' || d.lens === lens),
    (d) => d.lens === 'tradition',
  );
}

/** The bare range in a calendar, for places that show the lens beside it. */
export function formatDatingRange(d: KcDating, cal: CalendarSystem): string {
  if (cal === 'ce') return formatRange(d);
  if (d.earliest === d.latest) return formatInCalendar(d.earliest, cal, d.precision, d.circa);
  return `${formatInCalendar(d.earliest, cal, d.precision, d.circa)} to ${formatInCalendar(d.latest, cal, d.precision)}`;
}

/** One-line date label in a calendar, marked when the dating is a traditional reckoning. */
export function formatDating(d: KcDating, cal: CalendarSystem): string {
  return withTraditionMark(formatDatingRange(d, cal), d.lens === 'tradition');
}

export function primaryDating(item: KcItem, lens: Lens): KcDating | undefined {
  return visibleDatings(item, lens)[0];
}

/** Items placed in time order for a lens; items without a dating in the lens are dropped. */
export function orderedItems<T extends Pick<KcItem, 'anchor'>>(items: T[], lens: Lens): T[] {
  return items
    .filter((i) => anchorIn(i, lens) !== null)
    .sort((a, b) => anchorIn(a, lens)! - anchorIn(b, lens)!);
}

export function segmentUnitBounds(seg: Segment): { start: number; end: number } {
  return { start: yearToUnit(seg.from), end: yearToUnit(seg.to) };
}

export { SEGMENTS, yearToUnit, unitToYear, primaryAnchor };

/** Stable small hash for deterministic jitter. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function summaryFor(item: KcItem, level: Level): string {
  if (level === 'kids') return item.kids ?? item.teen ?? item.summary;
  if (level === 'teen') return item.teen ?? item.summary;
  return item.summary;
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else cur = (cur + ' ' + w).trim();
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...';
  }
  return lines;
}
