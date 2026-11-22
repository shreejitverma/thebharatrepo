import { describe, expect, it } from 'vitest';
import { primaryDating, summarizeDatings } from './lens';
import type { YearRange } from '../time';

const year = (astro: number): YearRange => ({ earliest: astro, latest: astro, precision: 'year', circa: false });
const kaliEpoch = { method: 'traditional-siddhantic' as const, range: year(-3101) };
const ashokaEdict = { method: 'epigraphic' as const, range: { earliest: -267, latest: -232, precision: 'year' as const, circa: false } };

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
});
