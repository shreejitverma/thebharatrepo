import type { KcItem } from './kaalchakra';

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
