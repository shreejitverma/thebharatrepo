import type { KcItem } from './kaalchakra';
import { isTraditional, type DatingMethod } from './labels';
import { formatRange, type YearRange } from '../time';

export const LENSES = ['both', 'scholarship', 'tradition'] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABELS: Record<Lens, string> = {
  both: 'Both lenses',
  scholarship: 'Scholarship',
  tradition: 'Tradition',
};

/** Primary anchor in a lens: scholarship wins in "both" when it exists. Client-safe (no zod). */
export function primaryAnchor(item: KcItem, lens: Lens): number | null {
  if (lens === 'scholarship') return item.anchor.scholarship;
  if (lens === 'tradition') return item.anchor.tradition;
  return item.anchor.scholarship ?? item.anchor.tradition;
}

/** The dating that stands for an item in a one-line summary: its first scholarly dating, else its first traditional one. */
export function primaryDating<D extends { method: DatingMethod }>(datings: readonly D[]): D {
  return datings.find((d) => !isTraditional(d.method)) ?? datings[0];
}

/** One-line date label; a traditional reckoning is marked so it never reads as dated history. */
export function datingSummary(range: YearRange, method: DatingMethod): string {
  return isTraditional(method) ? `${formatRange(range)} (tradition)` : formatRange(range);
}

/** Summary label for an entity or article: its primary dating, marked when it is a traditional reckoning. */
export function summarizeDatings(datings: readonly { method: DatingMethod; range: YearRange }[]): string {
  const d = primaryDating(datings);
  return datingSummary(d.range, d.method);
}
