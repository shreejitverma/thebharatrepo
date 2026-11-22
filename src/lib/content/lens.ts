import type { KcItem } from './kaalchakra';
import { GRADES, isTraditional, type DatingMethod, type Grade } from './labels';
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

/**
 * The archive's single ordering rule for datings: scholarship before tradition, then the best evidence grade
 * (A before E), ties kept in the author's order. The first dating in this order stands for the item everywhere.
 */
export function rankDatings<D extends { grade: Grade }>(datings: readonly D[], traditional: (d: D) => boolean): D[] {
  return [...datings].sort((a, b) => Number(traditional(a)) - Number(traditional(b)) || GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade));
}

/** The dating that stands for an entity or article, by the rankDatings rule. */
export function primaryDating<D extends { method: DatingMethod; grade: Grade }>(datings: readonly D[]): D {
  return rankDatings(datings, (d) => isTraditional(d.method))[0];
}

/** One-line date label; a traditional reckoning is marked so it never reads as dated history. */
export function datingSummary(range: YearRange, method: DatingMethod): string {
  return isTraditional(method) ? `${formatRange(range)} (tradition)` : formatRange(range);
}

/** Summary label for an entity or article: its primary dating, marked when it is a traditional reckoning. */
export function summarizeDatings(datings: readonly { method: DatingMethod; grade: Grade; range: YearRange }[]): string {
  const d = primaryDating(datings);
  return datingSummary(d.range, d.method);
}
