import { describe, expect, it } from 'vitest';
import { primaryDating, summarizeDatings } from './lens';
import type { YearRange } from '../time';

const year = (astro: number): YearRange => ({ earliest: astro, latest: astro, precision: 'year', circa: false });
const kaliEpoch = { method: 'traditional-siddhantic' as const, grade: 'D' as const, range: year(-3101) };
const ashokaEdict = { method: 'epigraphic' as const, grade: 'A' as const, range: { earliest: -267, latest: -232, precision: 'year' as const, circa: false } };

describe('primary dating for one-line summaries', () => {
  it('prefers a scholarly dating over an earlier-listed traditional one', () => {
    expect(primaryDating([kaliEpoch, ashokaEdict])).toBe(ashokaEdict);
    expect(summarizeDatings([kaliEpoch, ashokaEdict])).toBe('268 to 233 BCE');
  });

  it('marks a tradition-only dating as tradition', () => {
    expect(primaryDating([kaliEpoch])).toBe(kaliEpoch);
    expect(summarizeDatings([kaliEpoch])).toBe('3102 BCE (tradition)');
  });

  it('never summarises Rama or Krishna by their traditional reckoning', async () => {
    const { loadContentUncached } = await import('./load');
    const g = loadContentUncached();
    for (const id of ['person.rama', 'person.krishna']) {
      const label = summarizeDatings(g.entities.get(id)!.datings);
      expect(label, id).not.toMatch(/million|ka\b|\(tradition\)|3102 BCE/);
    }
    expect(summarizeDatings(g.entities.get('cosmology.kali-yuga')!.datings)).toMatch(/\(tradition\)$/);
  });

  it('prefers the better-graded scholarly dating over an earlier-listed weaker one', () => {
    const linguistic = { method: 'linguistic' as const, grade: 'C' as const, range: { earliest: -699, latest: -499, precision: 'century' as const, circa: true } };
    const epigraphic = { method: 'epigraphic' as const, grade: 'B' as const, range: { earliest: -119, latest: -89, precision: 'year' as const, circa: true } };
    expect(primaryDating([kaliEpoch, linguistic, epigraphic])).toBe(epigraphic);
    expect(primaryDating([linguistic, { ...epigraphic, grade: 'C' as const }])).toBe(linguistic);
  });

  it('marks a traditional reckoning in Kaalchakra one-line dates, and only that', async () => {
    const { formatDating } = await import('../../components/kaalchakra/shared');
    const kc = (lens: 'scholarship' | 'tradition', d: typeof kaliEpoch | typeof ashokaEdict) => ({ method: d.method, grade: d.grade, lens, earliest: d.range.earliest, latest: d.range.latest, precision: d.range.precision, circa: d.range.circa });
    expect(formatDating(kc('tradition', kaliEpoch), 'ce')).toBe('3102 BCE (tradition)');
    expect(formatDating(kc('scholarship', ashokaEdict), 'ce')).toBe('268 to 233 BCE');
  });

  it('gives person.krishna one date on cards, in search and on the Kaalchakra', async () => {
    const { loadContentUncached } = await import('./load');
    const { toKcItem } = await import('./kaalchakra');
    const { primaryDating: kcPrimary, formatDating } = await import('../../components/kaalchakra/shared');
    const { rangeAnchor } = await import('../time');
    const krishna = loadContentUncached().entities.get('person.krishna')!;
    const chosen = primaryDating(krishna.datings);
    expect(chosen.method).toBe('epigraphic');
    expect(chosen.grade).toBe('B');
    const item = toKcItem(krishna);
    expect(item.anchor.scholarship).toBe(rangeAnchor(chosen.range));
    const kc = kcPrimary(item, 'both')!;
    expect(formatDating(kc, 'ce')).toBe(summarizeDatings(krishna.datings));
  });
});
